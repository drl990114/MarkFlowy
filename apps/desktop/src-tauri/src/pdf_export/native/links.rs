//! Rebuild same-document links from the trusted final page DOM. Native printer
//! annotations are optional; Linux does not need to preserve them for this path.
use super::{native_error, outline::PageGeometry, PdfExportError};
use lopdf::{dictionary, Dictionary, Document, Object, ObjectId};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};

pub(super) const MAX_LINK_RECTS: usize = 20_000;
const MAX_ANNOTATIONS: usize = 200_000;
const MAX_RECT_COMPARISONS: usize = 2_000_000;
const RECT_TOLERANCE: f32 = 2.0;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct InternalLink {
    pub page_index: usize,
    pub left: f32,
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
    pub target_page_index: usize,
    pub target_left: f32,
    pub target_top: f32,
}

fn invalid(reason: &str) -> PdfExportError {
    native_error(format!("PDF internal links: {reason}"))
}

pub(super) fn validate(links: &[InternalLink], page_count: usize) -> Result<(), PdfExportError> {
    if links.len() > MAX_LINK_RECTS {
        return Err(invalid("The document has too many link rectangles."));
    }
    for link in links {
        if link.page_index >= page_count
            || link.target_page_index >= page_count
            || [
                link.left,
                link.top,
                link.right,
                link.bottom,
                link.target_left,
                link.target_top,
            ]
            .into_iter()
            .any(|value| !value.is_finite() || !(0.0..=1.0).contains(&value))
            || link.left >= link.right
            || link.top >= link.bottom
        {
            return Err(invalid(
                "A link has an invalid page, rectangle or target position.",
            ));
        }
    }
    Ok(())
}

fn resolved<'a>(document: &'a Document, object: &'a Object) -> Result<&'a Object, PdfExportError> {
    document
        .dereference(object)
        .map(|(_, object)| object)
        .map_err(native_error)
}

fn owned_uri(uri: &str, document_url: &url::Url) -> bool {
    let uri = uri.trim_start_matches(|character: char| character.is_ascii_whitespace());
    if uri.starts_with('#') {
        return true;
    }
    // Some native printers omit the empty '#' on a document-top link.
    let base = uri.split_once('#').map_or(uri, |(base, _)| base);
    url::Url::parse(base).is_ok_and(|candidate| candidate == *document_url)
}

fn annotation_rectangle(document: &Document, annotation: &Dictionary) -> Option<[f32; 4]> {
    let values = resolved(document, annotation.get(b"Rect").ok()?)
        .ok()?
        .as_array()
        .ok()?;
    if values.len() != 4 {
        return None;
    }
    let mut rect = [0.0; 4];
    for (coordinate, value) in rect.iter_mut().zip(values) {
        *coordinate = resolved(document, value).ok()?.as_float().ok()?;
        if !coordinate.is_finite() || coordinate.abs() > 1_000_000.0 {
            return None;
        }
    }
    let [x0, y0, x1, y1] = rect;
    if x0 == x1 || y0 == y1 {
        return None;
    }
    Some([x0.min(x1), y0.min(y1), x0.max(x1), y0.max(y1)])
}

fn overlap(a: [f32; 4], b: [f32; 4]) -> f32 {
    (a[2].min(b[2]) - a[0].max(b[0])).max(0.0) * (a[3].min(b[3]) - a[1].max(b[1])).max(0.0)
}
fn close_edges(a: [f32; 4], b: [f32; 4]) -> bool {
    a.into_iter()
        .zip(b)
        .all(|(a, b)| (a - b).abs() <= RECT_TOLERANCE)
}

struct MeasuredLink<'a> {
    source: &'a InternalLink,
    rect: [f32; 4],
}

fn matching_source(rect: [f32; 4], measured: &[MeasuredLink<'_>]) -> bool {
    let candidates = measured
        .iter()
        .filter(|link| overlap(rect, link.rect) > 0.0)
        .collect::<Vec<_>>();
    for link in &candidates {
        if close_edges(rect, link.rect) {
            return true;
        }
        // A printer may use the glyph bounds rather than the DOM line box.
        // Keep horizontal edges close and demand near containment plus a
        // similar height, so an unrelated large GoTo region cannot match.
        let area_a = (rect[2] - rect[0]) * (rect[3] - rect[1]);
        let area_b = (link.rect[2] - link.rect[0]) * (link.rect[3] - link.rect[1]);
        let height_a = rect[3] - rect[1];
        let height_b = link.rect[3] - link.rect[1];
        if (rect[0] - link.rect[0]).abs() <= RECT_TOLERANCE
            && (rect[2] - link.rect[2]).abs() <= RECT_TOLERANCE
            && overlap(rect, link.rect) >= area_a.min(area_b) * 0.95
            && height_a.min(height_b) >= height_a.max(height_b) * 0.6
        {
            return true;
        }
    }
    // Some printers emit one bounding rectangle for a multiline anchor.
    // Match a union only of intersecting fragments sharing one destination.
    let mut groups = HashMap::<(usize, u32, u32), [f32; 4]>::new();
    for link in candidates {
        let key = (
            link.source.target_page_index,
            link.source.target_left.to_bits(),
            link.source.target_top.to_bits(),
        );
        groups
            .entry(key)
            .and_modify(|union| {
                *union = [
                    union[0].min(link.rect[0]),
                    union[1].min(link.rect[1]),
                    union[2].max(link.rect[2]),
                    union[3].max(link.rect[3]),
                ];
            })
            .or_insert(link.rect);
    }
    groups.values().any(|union| close_edges(rect, *union))
}

fn collect_chain(
    document: &Document,
    object: &Object,
    detached: &mut HashSet<ObjectId>,
) -> Result<(), PdfExportError> {
    let mut object = object;
    let mut seen = HashSet::new();
    while let Object::Reference(id) = object {
        if seen.len() >= 128 || !seen.insert(*id) {
            return Err(invalid("An annotation reference contains a cycle."));
        }
        detached.insert(*id);
        object = document.get_object(*id).map_err(native_error)?;
    }
    Ok(())
}
fn references(object: &Object, output: &mut HashSet<ObjectId>) {
    let mut pending = vec![object];
    while let Some(object) = pending.pop() {
        match object {
            Object::Reference(id) => {
                output.insert(*id);
            }
            Object::Array(values) => pending.extend(values),
            Object::Dictionary(values) => pending.extend(values.iter().map(|(_, value)| value)),
            Object::Stream(stream) => pending.extend(stream.dict.iter().map(|(_, value)| value)),
            _ => {}
        }
    }
}
fn remove_detached(document: &mut Document, detached: &HashSet<ObjectId>) {
    let mut used = HashSet::new();
    for (_, value) in document.trailer.iter() {
        references(value, &mut used);
    }
    for (id, object) in &document.objects {
        if !detached.contains(id) {
            references(object, &mut used);
        }
    }
    let mut pending = used.intersection(detached).copied().collect::<Vec<_>>();
    let mut retained = HashSet::new();
    while let Some(id) = pending.pop() {
        if !retained.insert(id) {
            continue;
        }
        if let Some(object) = document.objects.get(&id) {
            let mut dependencies = HashSet::new();
            references(object, &mut dependencies);
            pending.extend(dependencies.intersection(detached).copied());
        }
    }
    for id in detached.difference(&retained) {
        document.objects.remove(id);
    }
}

pub(super) fn replace(
    document: &mut Document,
    pages: &[ObjectId],
    geometry: &[PageGeometry],
    links: &[InternalLink],
    document_url: &str,
) -> Result<(), PdfExportError> {
    let document_url = url::Url::parse(document_url).map_err(native_error)?;
    if document_url.scheme() != "file"
        || document_url.fragment().is_some()
        || document_url.query().is_some()
    {
        return Err(invalid("The private print document URL is invalid."));
    }
    if document.objects.len().saturating_add(links.len()) > 1_000_000
        || document.max_id.checked_add(links.len() as u32).is_none()
    {
        return Err(invalid("The PDF has too many objects."));
    }
    let mut page_links = (0..pages.len()).map(|_| Vec::new()).collect::<Vec<_>>();
    for link in links {
        let rect =
            geometry[link.page_index].rectangle(link.left, link.top, link.right, link.bottom);
        if rect[0] >= rect[2] || rect[1] >= rect[3] {
            return Err(invalid("A link rectangle has no printable area."));
        }
        page_links[link.page_index].push(MeasuredLink { source: link, rect });
    }
    let mut detached = HashSet::new();
    let mut annotation_count = 0usize;
    let mut comparison_count = 0usize;
    for (page_index, &page_id) in pages.iter().enumerate() {
        let original = document
            .get_object(page_id)
            .and_then(Object::as_dict)
            .map_err(native_error)?
            .get(b"Annots")
            .ok()
            .cloned();
        let annotations = match &original {
            Some(value) => resolved(document, value)?
                .as_array()
                .map_err(native_error)?
                .clone(),
            None => Vec::new(),
        };
        annotation_count = annotation_count.saturating_add(annotations.len());
        if annotation_count > MAX_ANNOTATIONS {
            return Err(invalid("The PDF has too many annotations."));
        }
        let mut kept = Vec::new();
        let mut changed = false;
        for annotation_object in annotations {
            let annotation = resolved(document, &annotation_object)?
                .as_dict()
                .map_err(native_error)?;
            let mut remove = false;
            if annotation.get(b"Subtype").and_then(Object::as_name).ok() == Some(b"Link") {
                let action = annotation
                    .get(b"A")
                    .ok()
                    .map(|value| {
                        resolved(document, value)
                            .and_then(|value| value.as_dict().map_err(native_error))
                    })
                    .transpose()?;
                let action_kind = action
                    .and_then(|action| action.get(b"S").ok())
                    .and_then(|value| value.as_name().ok());
                if action_kind == Some(b"URI") {
                    if let Some(uri) = action.and_then(|action| action.get(b"URI").ok()) {
                        let uri = resolved(document, uri)?;
                        let bytes = uri.as_str().map_err(native_error)?;
                        let uri = std::str::from_utf8(bytes)
                            .map(str::to_owned)
                            .or_else(|_| lopdf::decode_text_string(uri))
                            .map_err(native_error)?;
                        remove = owned_uri(&uri, &document_url);
                    }
                } else if annotation.get(b"Dest").is_ok() || action_kind == Some(b"GoTo") {
                    comparison_count =
                        comparison_count.saturating_add(page_links[page_index].len());
                    if comparison_count > MAX_RECT_COMPARISONS {
                        return Err(invalid("The PDF has too many link position comparisons."));
                    }
                    remove = annotation_rectangle(document, annotation)
                        .is_some_and(|rect| matching_source(rect, &page_links[page_index]));
                }
            }
            if remove {
                changed = true;
                collect_chain(document, &annotation_object, &mut detached)?;
                for key in [b"A".as_slice(), b"Dest", b"Rect"] {
                    if let Ok(value) = annotation.get(key) {
                        collect_chain(document, value, &mut detached)?;
                    }
                }
                if let Ok(value) = annotation.get(b"A") {
                    let action = resolved(document, value)?.as_dict().map_err(native_error)?;
                    for key in [b"URI".as_slice(), b"D"] {
                        if let Ok(value) = action.get(key) {
                            collect_chain(document, value, &mut detached)?;
                        }
                    }
                }
            } else {
                kept.push(annotation_object);
            }
        }
        for link in &page_links[page_index] {
            let (left, top) = geometry[link.source.target_page_index]
                .point(link.source.target_left, link.source.target_top);
            let annotation=document.add_object(dictionary! {
                "Type"=>"Annot", "Subtype"=>"Link", "P"=>page_id,
                "Rect"=>link.rect.into_iter().map(Object::Real).collect::<Vec<_>>(),
                "Border"=>vec![0.into(),0.into(),0.into()],
                "Dest"=>vec![Object::Reference(pages[link.source.target_page_index]),Object::Name(b"XYZ".to_vec()),Object::Real(left),Object::Real(top),Object::Null],
            });
            kept.push(Object::Reference(annotation));
            changed = true;
        }
        if changed {
            if let Some(original) = &original {
                collect_chain(document, original, &mut detached)?;
            }
            let page = document
                .get_object_mut(page_id)
                .and_then(Object::as_dict_mut)
                .map_err(native_error)?;
            if kept.is_empty() {
                page.remove(b"Annots");
            } else {
                page.set("Annots", Object::Array(kept));
            }
        }
    }
    remove_detached(document, &detached);
    Ok(())
}
