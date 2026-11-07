//! Add navigation to an already printed PDF without changing its page content.
//! Link rectangles are measured by the print engine, so pagination, embedded
//! fonts, repeated titles and non-Latin glyph mappings do not affect placement.
use super::{native_error, PdfExportError, MAX_PDF_BYTES};
use lopdf::{dictionary, Dictionary, Document, LoadOptions, Object, ObjectId};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};

const MAX_HEADINGS: usize = 10_000;
const MAX_TITLE_BYTES: usize = 16 * 1024;
const MAX_TOTAL_TITLE_BYTES: usize = 4 * 1024 * 1024;
const MAX_PAGES: usize = 10_000;
const MAX_ANNOTATIONS: usize = 200_000;
const MAX_OBJECTS: usize = 1_000_000;
const MAX_COORDINATE: f32 = 1_000_000.0;
const PAGE_EDGE_TOLERANCE: f32 = 2.0;

#[derive(Debug, Deserialize)]
pub(super) struct Heading {
    pub index: usize,
    pub title: String,
    pub level: u8,
}

#[derive(Clone, Copy, Debug)]
struct Destination {
    page: ObjectId,
    page_number: u32,
    left: f32,
    top: f32,
}

struct OutlineNode<'a> {
    heading: &'a Heading,
    destination: Destination,
    parent: Option<usize>,
    children: Vec<usize>,
    descendants: usize,
}

fn invalid(reason: &str) -> PdfExportError {
    native_error(format!("PDF heading navigation: {reason}"))
}

fn resolved<'a>(document: &'a Document, object: &'a Object) -> Result<&'a Object, PdfExportError> {
    document
        .dereference(object)
        .map(|(_, object)| object)
        .map_err(native_error)
}

fn rectangle(document: &Document, object: &Object) -> Result<[f32; 4], PdfExportError> {
    let values = resolved(document, object)?
        .as_array()
        .map_err(native_error)?;
    if values.len() != 4 {
        return Err(invalid("A position rectangle must have four coordinates."));
    }
    let mut coordinates = [0.0; 4];
    for (coordinate, value) in coordinates.iter_mut().zip(values) {
        *coordinate = resolved(document, value)?
            .as_float()
            .map_err(native_error)?;
        if !coordinate.is_finite() || coordinate.abs() > MAX_COORDINATE {
            return Err(invalid(
                "A position coordinate is outside the supported range.",
            ));
        }
    }
    let [x0, y0, x1, y1] = coordinates;
    if x0 == x1 || y0 == y1 {
        return Err(invalid("A position rectangle has no area."));
    }
    Ok([x0.min(x1), y0.min(y1), x0.max(x1), y0.max(y1)])
}

fn page_bounds(document: &Document, page: ObjectId) -> Result<[f32; 4], PdfExportError> {
    // MediaBox is inheritable. Bound the parent traversal even for malformed
    // page trees; normal native printer output usually has it on each page.
    let mut current = page;
    let mut visited = HashSet::new();
    for _ in 0..64 {
        if !visited.insert(current) {
            return Err(invalid("The PDF page tree contains a cycle."));
        }
        let dictionary = document
            .get_object(current)
            .and_then(Object::as_dict)
            .map_err(native_error)?;
        if let Ok(bounds) = dictionary.get(b"MediaBox") {
            return rectangle(document, bounds);
        }
        current = dictionary
            .get(b"Parent")
            .and_then(Object::as_reference)
            .map_err(native_error)?;
    }
    Err(invalid("The PDF page tree is too deep."))
}

fn collect_reference_chain<'a>(
    document: &'a Document,
    mut object: &'a Object,
    candidates: &mut HashSet<ObjectId>,
) -> Result<(), PdfExportError> {
    let mut visited = HashSet::new();
    while let Object::Reference(id) = object {
        if visited.len() >= 128 || !visited.insert(*id) {
            return Err(invalid("A PDF annotation reference contains a cycle."));
        }
        candidates.insert(*id);
        object = document
            .objects
            .get(id)
            .ok_or_else(|| invalid("A PDF annotation reference is missing."))?;
    }
    Ok(())
}

fn marker_suffix<'a>(
    document: &'a Document,
    annotation: &'a Dictionary,
    prefix: &[u8],
) -> Result<Option<&'a [u8]>, PdfExportError> {
    if annotation.get(b"Subtype").and_then(Object::as_name).ok() != Some(b"Link") {
        return Ok(None);
    }
    let Ok(action) = annotation.get(b"A") else {
        return Ok(None);
    };
    let action = resolved(document, action)?
        .as_dict()
        .map_err(native_error)?;
    if action.get(b"S").and_then(Object::as_name).ok() != Some(b"URI") {
        return Ok(None);
    }
    let uri = resolved(document, action.get(b"URI").map_err(native_error)?)?
        .as_str()
        .map_err(native_error)?;
    Ok(uri.strip_prefix(prefix))
}

fn referenced_objects(object: &Object, references: &mut HashSet<ObjectId>) {
    let mut pending = vec![object];
    while let Some(object) = pending.pop() {
        match object {
            Object::Reference(id) => {
                references.insert(*id);
            }
            Object::Array(array) => pending.extend(array),
            Object::Dictionary(dictionary) => {
                pending.extend(dictionary.iter().map(|(_, value)| value))
            }
            Object::Stream(stream) => pending.extend(stream.dict.iter().map(|(_, value)| value)),
            _ => {}
        }
    }
}

fn remove_detached_objects(document: &mut Document, candidates: &HashSet<ObjectId>) {
    // An annotation/action/array can be shared, including through a tagged PDF
    // structure tree. Delete only detached marker objects, never their users.
    let mut references = HashSet::new();
    for (_, value) in document.trailer.iter() {
        referenced_objects(value, &mut references);
    }
    for (id, object) in &document.objects {
        if !candidates.contains(id) {
            referenced_objects(object, &mut references);
        }
    }
    let mut pending = references
        .intersection(candidates)
        .copied()
        .collect::<Vec<_>>();
    let mut retained = HashSet::new();
    while let Some(id) = pending.pop() {
        if !retained.insert(id) {
            continue;
        }
        if let Some(object) = document.objects.get(&id) {
            let mut dependencies = HashSet::new();
            referenced_objects(object, &mut dependencies);
            pending.extend(dependencies.intersection(candidates).copied());
        }
    }
    for id in candidates.difference(&retained) {
        document.objects.remove(id);
    }
}

fn write_outline(
    document: &mut Document,
    headings: &[Heading],
    destinations: &HashMap<usize, Destination>,
) -> Result<usize, PdfExportError> {
    let mut nodes: Vec<OutlineNode<'_>> = Vec::new();
    let mut ancestors: Vec<usize> = Vec::new();
    let mut roots = Vec::new();
    for heading in headings {
        let Some(&destination) = destinations.get(&heading.index) else {
            // Print CSS may hide a heading; it has no destination or bookmark.
            continue;
        };
        while ancestors
            .last()
            .is_some_and(|&index| nodes[index].heading.level >= heading.level)
        {
            ancestors.pop();
        }
        let parent = ancestors.last().copied();
        let index = nodes.len();
        if let Some(parent) = parent {
            nodes[parent].children.push(index);
        } else {
            roots.push(index);
        }
        nodes.push(OutlineNode {
            heading,
            destination,
            parent,
            children: Vec::new(),
            descendants: 0,
        });
        ancestors.push(index);
    }
    if nodes.is_empty() {
        let catalog = document.catalog_mut().map_err(native_error)?;
        catalog.remove(b"Outlines");
        if catalog.get(b"PageMode").and_then(Object::as_name).ok() == Some(b"UseOutlines") {
            catalog.remove(b"PageMode");
        }
        return Ok(0);
    }
    if document
        .max_id
        .checked_add(nodes.len() as u32 + 1)
        .is_none()
    {
        return Err(invalid("The PDF has exhausted its object identifiers."));
    }
    // All branches start expanded. Count is the number of visible descendants,
    // not merely immediate children, including when heading levels are skipped.
    for index in (0..nodes.len()).rev() {
        if let Some(parent) = nodes[index].parent {
            nodes[parent].descendants += nodes[index].descendants + 1;
        }
    }
    let root_id = document.new_object_id();
    let ids = (0..nodes.len())
        .map(|_| document.new_object_id())
        .collect::<Vec<_>>();
    let mut sibling_links = vec![(None, None); nodes.len()];
    for siblings in std::iter::once(&roots).chain(nodes.iter().map(|node| &node.children)) {
        for pair in siblings.windows(2) {
            sibling_links[pair[0]].1 = Some(pair[1]);
            sibling_links[pair[1]].0 = Some(pair[0]);
        }
    }
    for (index, node) in nodes.iter().enumerate() {
        let mut title = vec![0xFE, 0xFF];
        title.extend(node.heading.title.encode_utf16().flat_map(u16::to_be_bytes));
        let mut item = dictionary! {
            "Title" => Object::string_literal(title),
            "Parent" => node.parent.map_or(root_id, |parent| ids[parent]),
            "Dest" => vec![
                Object::Reference(node.destination.page),
                Object::Name(b"XYZ".to_vec()),
                Object::Real(node.destination.left),
                Object::Real(node.destination.top),
                Object::Null,
            ],
        };
        if let Some(previous) = sibling_links[index].0 {
            item.set("Prev", ids[previous]);
        }
        if let Some(next) = sibling_links[index].1 {
            item.set("Next", ids[next]);
        }
        if let (Some(&first), Some(&last)) = (node.children.first(), node.children.last()) {
            item.set("First", ids[first]);
            item.set("Last", ids[last]);
            item.set("Count", node.descendants as i64);
        }
        document.objects.insert(ids[index], item.into());
    }
    document.objects.insert(
        root_id,
        dictionary! {
            "Type" => "Outlines",
            "First" => ids[roots[0]],
            "Last" => ids[*roots.last().unwrap()],
            "Count" => nodes.len() as i64,
        }
        .into(),
    );
    let catalog = document.catalog_mut().map_err(native_error)?;
    catalog.set("Outlines", root_id);
    catalog.set("PageMode", "UseOutlines");
    Ok(nodes.len())
}

pub(super) fn add_outline(
    bytes: &[u8],
    token: &str,
    headings: &[Heading],
) -> Result<(Vec<u8>, usize), PdfExportError> {
    if bytes.is_empty() || bytes.len() > MAX_PDF_BYTES {
        return Err(invalid("The generated PDF is empty or too large."));
    }
    if token.is_empty()
        || token.len() > 128
        || !token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err(invalid("The heading marker token is invalid."));
    }
    if headings.len() > MAX_HEADINGS {
        return Err(invalid("The document has too many headings."));
    }
    let mut total_title_bytes = 0;
    let mut indices = HashSet::new();
    for heading in headings {
        total_title_bytes += heading.title.len();
        if !(1..=6).contains(&heading.level)
            || heading.title.trim().is_empty()
            || heading.title.len() > MAX_TITLE_BYTES
            || total_title_bytes > MAX_TOTAL_TITLE_BYTES
            || !indices.insert(heading.index)
        {
            return Err(invalid(
                "The document heading list is invalid or too large.",
            ));
        }
    }
    let mut document = Document::load_mem_with_options(
        bytes,
        LoadOptions {
            max_decompressed_size: Some(64 * 1024 * 1024),
            ..LoadOptions::default()
        },
    )
    .map_err(native_error)?;
    if document.objects.len() > MAX_OBJECTS {
        return Err(invalid("The PDF has too many objects."));
    }
    let pages = document.get_pages();
    if pages.is_empty() || pages.len() > MAX_PAGES {
        return Err(invalid("The PDF has an invalid number of pages."));
    }
    let prefix = format!("https://markflowy.invalid/pdf-outline/{token}/");
    let mut destinations: HashMap<usize, Destination> = HashMap::new();
    let mut detached = HashSet::new();
    let mut annotation_count = 0;
    let mut probe_found = false;
    for (page_number, page_id) in pages {
        let page = document
            .get_object(page_id)
            .and_then(Object::as_dict)
            .map_err(native_error)?;
        let Ok(annotations_object) = page.get(b"Annots") else {
            continue;
        };
        let annotations = resolved(&document, annotations_object)?
            .as_array()
            .map_err(native_error)?;
        annotation_count += annotations.len();
        if annotation_count > MAX_ANNOTATIONS {
            return Err(invalid("The PDF has too many link annotations."));
        }
        let mut kept = Vec::with_capacity(annotations.len());
        let mut removed = false;
        let mut bounds = None;
        for annotation_object in annotations {
            let annotation = resolved(&document, annotation_object)?
                .as_dict()
                .map_err(native_error)?;
            let Some(suffix) = marker_suffix(&document, annotation, prefix.as_bytes())? else {
                kept.push(annotation_object.clone());
                continue;
            };
            let position = rectangle(&document, annotation.get(b"Rect").map_err(native_error)?)?;
            let page_bounds = match bounds {
                Some(bounds) => bounds,
                None => {
                    let value = page_bounds(&document, page_id)?;
                    bounds = Some(value);
                    value
                }
            };
            if position[0] < page_bounds[0] - PAGE_EDGE_TOLERANCE
                || position[1] < page_bounds[1] - PAGE_EDGE_TOLERANCE
                || position[2] > page_bounds[2] + PAGE_EDGE_TOLERANCE
                || position[3] > page_bounds[3] + PAGE_EDGE_TOLERANCE
            {
                return Err(invalid("A heading marker is outside its PDF page."));
            }
            if suffix == b"probe" {
                probe_found = true;
            } else {
                let text = std::str::from_utf8(suffix).map_err(native_error)?;
                let index = text.parse::<usize>().map_err(native_error)?;
                if index.to_string() != text || !indices.contains(&index) {
                    return Err(invalid("A heading marker has an unknown identifier."));
                }
                let destination = Destination {
                    page: page_id,
                    page_number,
                    left: position[0],
                    top: position[3],
                };
                destinations
                    .entry(index)
                    .and_modify(|previous| {
                        if destination.page_number < previous.page_number
                            || (destination.page_number == previous.page_number
                                && (destination.top > previous.top
                                    || (destination.top == previous.top
                                        && destination.left < previous.left)))
                        {
                            *previous = destination;
                        }
                    })
                    .or_insert(destination);
            }
            removed = true;
            collect_reference_chain(&document, annotation_object, &mut detached)?;
            let action_object = annotation.get(b"A").map_err(native_error)?;
            collect_reference_chain(&document, action_object, &mut detached)?;
            let action = resolved(&document, action_object)?
                .as_dict()
                .map_err(native_error)?;
            collect_reference_chain(
                &document,
                action.get(b"URI").map_err(native_error)?,
                &mut detached,
            )?;
        }
        if removed {
            collect_reference_chain(&document, annotations_object, &mut detached)?;
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
    if !probe_found {
        return Err(invalid(
            "The native printer did not preserve heading positions.",
        ));
    }
    remove_detached_objects(&mut document, &detached);
    let count = write_outline(&mut document, headings, &destinations)?;
    // Keep content streams and the original page tree untouched. A standard
    // save rewrites object/xref syntax, not rendered page contents.
    let mut output = Vec::new();
    document.save_to(&mut output).map_err(native_error)?;
    if output.len() > MAX_PDF_BYTES {
        return Err(invalid("The PDF with heading navigation is too large."));
    }
    Ok((output, count))
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::Stream;

    const TOKEN: &str = "outline-test-job";

    struct Fixture {
        document: Document,
        pages: Vec<ObjectId>,
        content: ObjectId,
        metadata: ObjectId,
        info: ObjectId,
    }

    fn fixture() -> Fixture {
        let mut document = Document::with_version("1.7");
        let parent = document.new_object_id();
        let content = document.add_object(Stream::new(
            dictionary! {},
            b"q 1 0 0 1 0 0 cm Q\n".to_vec(),
        ));
        let pages = (0..3)
            .map(|_| {
                document.add_object(dictionary! {
                    "Type" => "Page", "Parent" => parent, "Contents" => content,
                    "Resources" => dictionary! {}, "Annots" => Vec::<Object>::new(),
                })
            })
            .collect::<Vec<_>>();
        document.objects.insert(parent, dictionary! {
            "Type" => "Pages", "Kids" => pages.iter().copied().map(Object::Reference).collect::<Vec<_>>(),
            "Count" => pages.len() as i64, "MediaBox" => vec![0.into(), 0.into(), 600.into(), 800.into()],
        }.into());
        let metadata = document.add_object(Stream::new(
            dictionary! {
                "Type" => "Metadata", "Subtype" => "XML",
            },
            b"<metadata>original metadata</metadata>".to_vec(),
        ));
        let root = document.add_object(
            dictionary! { "Type" => "Catalog", "Pages" => parent, "Metadata" => metadata },
        );
        let info = document.add_object(dictionary! {
            "Title" => Object::string_literal("Original document"),
            "Producer" => Object::string_literal("Native printer"),
        });
        document.trailer.set("Root", root);
        document.trailer.set("Info", info);
        let mut fixture = Fixture {
            document,
            pages,
            content,
            metadata,
            info,
        };
        append_link(&mut fixture, 0, "probe", [20.0, 780.0, 21.0, 781.0], false);
        fixture
    }

    fn link(uri: &str, rect: [f32; 4]) -> Object {
        dictionary! {
            "Type" => "Annot", "Subtype" => "Link",
            "Rect" => rect.into_iter().map(Object::Real).collect::<Vec<_>>(),
            "A" => dictionary! { "S" => "URI", "URI" => Object::string_literal(uri) },
        }
        .into()
    }

    fn append_annotation(fixture: &mut Fixture, page: usize, annotation: Object) {
        fixture
            .document
            .get_object_mut(fixture.pages[page])
            .unwrap()
            .as_dict_mut()
            .unwrap()
            .get_mut(b"Annots")
            .unwrap()
            .as_array_mut()
            .unwrap()
            .push(annotation);
    }

    fn append_link(
        fixture: &mut Fixture,
        page: usize,
        suffix: &str,
        rect: [f32; 4],
        indirect: bool,
    ) {
        let mut annotation = link(
            &format!("https://markflowy.invalid/pdf-outline/{TOKEN}/{suffix}"),
            rect,
        );
        if indirect {
            let dictionary = annotation.as_dict_mut().unwrap();
            let mut action = dictionary.remove(b"A").unwrap();
            let uri = action.as_dict_mut().unwrap().remove(b"URI").unwrap();
            let uri_id = fixture.document.add_object(uri);
            action.as_dict_mut().unwrap().set("URI", uri_id);
            let action_id = fixture.document.add_object(action);
            dictionary.set("A", action_id);
            annotation = fixture.document.add_object(annotation).into();
        }
        append_annotation(fixture, page, annotation);
    }

    fn pdf(document: &mut Document) -> Vec<u8> {
        let mut bytes = Vec::new();
        document.save_to(&mut bytes).unwrap();
        bytes
    }

    fn headings(values: &[(usize, &str, u8)]) -> Vec<Heading> {
        values
            .iter()
            .map(|&(index, title, level)| Heading {
                index,
                title: title.into(),
                level,
            })
            .collect()
    }

    fn dictionary(document: &Document, id: ObjectId) -> &Dictionary {
        document.get_object(id).unwrap().as_dict().unwrap()
    }

    fn reference(dictionary: &Dictionary, key: &[u8]) -> ObjectId {
        dictionary.get(key).unwrap().as_reference().unwrap()
    }

    fn title(dictionary: &Dictionary) -> String {
        let bytes = dictionary.get(b"Title").unwrap().as_str().unwrap();
        assert_eq!(&bytes[..2], &[0xFE, 0xFF]);
        let utf16 = bytes[2..]
            .chunks_exact(2)
            .map(|pair| u16::from_be_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        String::from_utf16(&utf16).unwrap()
    }

    #[test]
    fn writes_nested_skipped_levels_duplicate_titles_and_utf16_destinations() {
        let mut fixture = fixture();
        for (index, page, top) in [
            (0, 0, 740.0),
            (1, 0, 650.0),
            (2, 1, 700.0),
            (3, 1, 500.0),
            (4, 2, 700.0),
        ] {
            append_link(
                &mut fixture,
                page,
                &index.to_string(),
                [40.0, top - 1.0, 41.0, top],
                index % 2 == 0,
            );
        }
        // Repeated printed markers choose the earliest page and then its topmost occurrence.
        append_link(&mut fixture, 2, "0", [40.0, 770.0, 41.0, 771.0], true);
        append_link(&mut fixture, 0, "0", [40.0, 749.0, 41.0, 750.0], false);
        let headings = headings(&[
            (0, "中文标题 📚", 1),
            (1, "Repeated", 3),
            (2, "Repeated", 4),
            (3, "Sibling", 2),
            (4, "Next", 1),
            (5, "Hidden", 2),
        ]);
        let (bytes, count) = add_outline(&pdf(&mut fixture.document), TOKEN, &headings).unwrap();
        assert_eq!(count, 5);
        let document = Document::load_mem(&bytes).unwrap();
        let catalog = document.catalog().unwrap();
        assert_eq!(
            catalog.get(b"PageMode").unwrap().as_name().unwrap(),
            b"UseOutlines"
        );
        let root_id = reference(catalog, b"Outlines");
        let root = dictionary(&document, root_id);
        assert_eq!(root.get(b"Count").unwrap().as_i64().unwrap(), 5);
        let first_id = reference(root, b"First");
        let first = dictionary(&document, first_id);
        assert_eq!(title(first), "中文标题 📚");
        assert_eq!(reference(first, b"Parent"), root_id);
        assert_eq!(first.get(b"Count").unwrap().as_i64().unwrap(), 3);
        let destination = first.get(b"Dest").unwrap().as_array().unwrap();
        assert_eq!(destination[0].as_reference().unwrap(), fixture.pages[0]);
        assert_eq!(destination[1].as_name().unwrap(), b"XYZ");
        assert_eq!(destination[2].as_float().unwrap(), 40.0);
        assert_eq!(destination[3].as_float().unwrap(), 750.0);
        assert!(matches!(destination[4], Object::Null));
        let child_id = reference(first, b"First");
        let child = dictionary(&document, child_id);
        assert_eq!(title(child), "Repeated");
        assert_eq!(reference(child, b"Parent"), first_id);
        assert_eq!(child.get(b"Count").unwrap().as_i64().unwrap(), 1);
        let grandchild = dictionary(&document, reference(child, b"First"));
        assert_eq!(title(grandchild), "Repeated");
        assert_eq!(reference(grandchild, b"Parent"), child_id);
        let sibling = dictionary(&document, reference(child, b"Next"));
        assert_eq!(title(sibling), "Sibling");
        assert_eq!(reference(sibling, b"Prev"), child_id);
        assert_eq!(reference(first, b"Last"), reference(child, b"Next"));
        let next = dictionary(&document, reference(first, b"Next"));
        assert_eq!(title(next), "Next");
        assert_eq!(reference(next, b"Prev"), first_id);
        for &page in &fixture.pages {
            assert!(document.get_page_annotations(page).unwrap().is_empty());
        }
    }

    #[test]
    fn preserves_original_links_page_content_metadata_and_shared_objects() {
        let mut fixture = fixture();
        append_link(&mut fixture, 1, "7", [50.0, 699.0, 51.0, 700.0], true);
        let original_link = fixture.document.add_object(link(
            "https://example.com/original",
            [30.0, 30.0, 90.0, 40.0],
        ));
        append_annotation(&mut fixture, 0, original_link.into());
        append_annotation(&mut fixture, 1, original_link.into());
        // A different job's URI is an ordinary link and must survive unchanged.
        let foreign = link(
            "https://markflowy.invalid/pdf-outline/other-job/1",
            [20.0, 20.0, 21.0, 21.0],
        );
        append_annotation(&mut fixture, 1, foreign.clone());
        let page = fixture
            .document
            .get_object_mut(fixture.pages[1])
            .unwrap()
            .as_dict_mut()
            .unwrap();
        let annotations = page.remove(b"Annots").unwrap();
        let array_id = fixture.document.add_object(annotations);
        fixture
            .document
            .get_object_mut(fixture.pages[1])
            .unwrap()
            .as_dict_mut()
            .unwrap()
            .set("Annots", array_id);
        let original_content = fixture
            .document
            .get_object(fixture.content)
            .unwrap()
            .as_stream()
            .unwrap()
            .content
            .clone();
        let (bytes, count) = add_outline(
            &pdf(&mut fixture.document),
            TOKEN,
            &headings(&[(7, "Heading", 1)]),
        )
        .unwrap();
        assert_eq!(count, 1);
        let document = Document::load_mem(&bytes).unwrap();
        assert_eq!(
            document.get_pages().values().copied().collect::<Vec<_>>(),
            fixture.pages
        );
        assert_eq!(
            document
                .get_object(fixture.content)
                .unwrap()
                .as_stream()
                .unwrap()
                .content,
            original_content
        );
        assert_eq!(
            document
                .get_object(fixture.metadata)
                .unwrap()
                .as_stream()
                .unwrap()
                .content,
            b"<metadata>original metadata</metadata>"
        );
        assert_eq!(
            dictionary(&document, fixture.info)
                .get(b"Title")
                .unwrap()
                .as_str()
                .unwrap(),
            b"Original document"
        );
        assert_eq!(
            reference(document.catalog().unwrap(), b"Metadata"),
            fixture.metadata
        );
        assert_eq!(reference(&document.trailer, b"Info"), fixture.info);
        assert_eq!(
            document
                .get_page_annotations(fixture.pages[0])
                .unwrap()
                .len(),
            1
        );
        let remaining = dictionary(&document, fixture.pages[1])
            .get(b"Annots")
            .unwrap()
            .as_array()
            .unwrap();
        assert_eq!(remaining.len(), 2);
        assert_eq!(remaining[0].as_reference().unwrap(), original_link);
        assert_eq!(remaining[1], foreign);
        assert!(!document.objects.contains_key(&array_id));
        assert!(!bytes
            .windows(TOKEN.len())
            .any(|window| window == TOKEN.as_bytes()));
    }

    #[test]
    fn removes_outline_and_markers_when_no_heading_was_printed() {
        for headings in [Vec::new(), headings(&[(0, "Hidden by print CSS", 1)])] {
            let mut fixture = fixture();
            let old_outline = fixture
                .document
                .add_object(dictionary! { "Type" => "Outlines" });
            let catalog = fixture.document.catalog_mut().unwrap();
            catalog.set("Outlines", old_outline);
            catalog.set("PageMode", "UseOutlines");
            let (bytes, count) =
                add_outline(&pdf(&mut fixture.document), TOKEN, &headings).unwrap();
            assert_eq!(count, 0);
            let document = Document::load_mem(&bytes).unwrap();
            assert!(document.catalog().unwrap().get(b"Outlines").is_err());
            assert!(document.catalog().unwrap().get(b"PageMode").is_err());
            assert!(document
                .get_page_annotations(fixture.pages[0])
                .unwrap()
                .is_empty());
        }
    }

    #[test]
    fn requires_calibration_even_without_headings() {
        let mut fixture = fixture();
        fixture
            .document
            .get_object_mut(fixture.pages[0])
            .unwrap()
            .as_dict_mut()
            .unwrap()
            .remove(b"Annots");
        assert!(add_outline(&pdf(&mut fixture.document), TOKEN, &[]).is_err());
    }

    #[test]
    fn rejects_unknown_malformed_or_duplicate_heading_identifiers() {
        for suffix in ["1", "00", "-1", "0/extra", "", "not-a-number"] {
            let mut fixture = fixture();
            append_link(&mut fixture, 0, suffix, [20.0, 20.0, 21.0, 21.0], false);
            assert!(
                add_outline(
                    &pdf(&mut fixture.document),
                    TOKEN,
                    &headings(&[(0, "Heading", 1)])
                )
                .is_err(),
                "{suffix}"
            );
        }
        let mut fixture = fixture();
        assert!(add_outline(
            &pdf(&mut fixture.document),
            TOKEN,
            &headings(&[(0, "One", 1), (0, "Two", 2)])
        )
        .is_err());
    }

    #[test]
    fn rejects_missing_degenerate_outside_and_nonnumeric_rectangles() {
        let bad_rectangles = [
            None,
            Some(Object::Array(vec![0.into(), 0.into(), 1.into()])),
            Some(Object::Array(vec![
                20.into(),
                20.into(),
                20.into(),
                21.into(),
            ])),
            Some(Object::Array(vec![
                20.into(),
                20.into(),
                21.into(),
                900.into(),
            ])),
            Some(Object::Array(vec![
                20.into(),
                Object::string_literal("NaN"),
                21.into(),
                22.into(),
            ])),
            Some(Object::Array(vec![
                20.into(),
                20.into(),
                Object::Real(f32::INFINITY),
                22.into(),
            ])),
        ];
        for rect in bad_rectangles {
            let mut fixture = fixture();
            let mut annotation = link(
                &format!("https://markflowy.invalid/pdf-outline/{TOKEN}/0"),
                [20.0, 20.0, 21.0, 21.0],
            );
            let dictionary = annotation.as_dict_mut().unwrap();
            dictionary.remove(b"Rect");
            if let Some(rect) = rect {
                dictionary.set("Rect", rect);
            }
            append_annotation(&mut fixture, 0, annotation);
            assert!(add_outline(
                &pdf(&mut fixture.document),
                TOKEN,
                &headings(&[(0, "Heading", 1)])
            )
            .is_err());
        }
    }

    #[test]
    fn bounds_input_metadata_and_rejects_invalid_pdfs() {
        let mut fixture = fixture();
        let bytes = pdf(&mut fixture.document);
        for token in ["", "invalid/token", "bad token"] {
            assert!(add_outline(&bytes, token, &[]).is_err());
        }
        for headings in [
            headings(&[(0, "", 1)]),
            headings(&[(0, "Invalid level", 7)]),
            headings(&[(0, &"x".repeat(MAX_TITLE_BYTES + 1), 1)]),
        ] {
            assert!(add_outline(&bytes, TOKEN, &headings).is_err());
        }
        assert!(add_outline(b"not a PDF", TOKEN, &[]).is_err());
    }
}
