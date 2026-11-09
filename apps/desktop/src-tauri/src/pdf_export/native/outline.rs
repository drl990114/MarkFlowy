//! Add heading navigation using coordinates from the final physical-page DOM.
//! The native printer only paints fixed pages; it does not determine pagination.
use super::{native_error, PaperSize, PdfExportError, MAX_PDF_BYTES};
use lopdf::{dictionary, Document, LoadOptions, Object, ObjectId};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};

const MAX_HEADINGS: usize = 10_000;
const MAX_TITLE_BYTES: usize = 16 * 1024;
const MAX_TOTAL_TITLE_BYTES: usize = 4 * 1024 * 1024;
const MAX_PAGES: usize = 10_000;
const MAX_OBJECTS: usize = 1_000_000;
const PAGE_SIZE_TOLERANCE: f32 = 2.0;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Heading {
    pub index: usize,
    pub title: String,
    pub level: u8,
    pub page_index: usize,
    /// Fraction of the physical page width, measured from its left edge.
    pub left: f32,
    /// Fraction of the physical page height, measured from its top edge.
    pub top: f32,
}

#[derive(Clone, Copy, Debug)]
struct Destination {
    page: ObjectId,
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
    native_error(format!("PDF page navigation: {reason}"))
}

fn resolved<'a>(document: &'a Document, object: &'a Object) -> Result<&'a Object, PdfExportError> {
    document
        .dereference(object)
        .map(|(_, object)| object)
        .map_err(native_error)
}

fn inherited<'a>(
    document: &'a Document,
    page: ObjectId,
    key: &[u8],
) -> Result<Option<&'a Object>, PdfExportError> {
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
        if let Ok(value) = dictionary.get(key) {
            return resolved(document, value).map(Some);
        }
        let Ok(parent) = dictionary.get(b"Parent") else {
            return Ok(None);
        };
        current = parent.as_reference().map_err(native_error)?;
    }
    Err(invalid("The PDF page tree is too deep."))
}

fn rectangle(document: &Document, object: &Object) -> Result<[f32; 4], PdfExportError> {
    let values = resolved(document, object)?
        .as_array()
        .map_err(native_error)?;
    if values.len() != 4 {
        return Err(invalid("A page rectangle must have four coordinates."));
    }
    let mut coordinates = [0.0; 4];
    for (coordinate, value) in coordinates.iter_mut().zip(values) {
        *coordinate = resolved(document, value)?
            .as_float()
            .map_err(native_error)?;
        if !coordinate.is_finite() || coordinate.abs() > 1_000_000.0 {
            return Err(invalid("A page coordinate is outside the supported range."));
        }
    }
    if coordinates[2] <= coordinates[0] || coordinates[3] <= coordinates[1] {
        return Err(invalid("A page rectangle has no positive area."));
    }
    Ok(coordinates)
}

pub(super) struct PageGeometry {
    bounds: [f32; 4],
    rotation: i64,
}

impl PageGeometry {
    fn read(
        document: &Document,
        page: ObjectId,
        paper: PaperSize,
        landscape: bool,
    ) -> Result<Self, PdfExportError> {
        let bounds = rectangle(
            document,
            inherited(document, page, b"MediaBox")?
                .ok_or_else(|| invalid("A PDF page has no size."))?,
        )?;
        if let Some(crop) = inherited(document, page, b"CropBox")? {
            let crop = rectangle(document, crop)?;
            if bounds
                .iter()
                .zip(crop)
                .any(|(a, b)| (*a - b).abs() > PAGE_SIZE_TOLERANCE)
            {
                return Err(invalid(
                    "The native printer cropped a prepared physical page.",
                ));
            }
        }
        let rotation = inherited(document, page, b"Rotate")?
            .map(Object::as_i64)
            .transpose()
            .map_err(native_error)?
            .unwrap_or(0)
            .rem_euclid(360);
        if rotation % 90 != 0 {
            return Err(invalid("A PDF page has an unsupported rotation."));
        }
        let unit = inherited(document, page, b"UserUnit")?
            .map(Object::as_float)
            .transpose()
            .map_err(native_error)?
            .unwrap_or(1.0);
        if !unit.is_finite() || unit <= 0.0 {
            return Err(invalid("A PDF page has an invalid unit."));
        }
        let (mut width, mut height) = (
            (bounds[2] - bounds[0]) * unit,
            (bounds[3] - bounds[1]) * unit,
        );
        if rotation == 90 || rotation == 270 {
            std::mem::swap(&mut width, &mut height);
        }
        let (width_inches, height_inches) = paper.inches();
        let (expected_width, expected_height) = if landscape {
            (height_inches * 72.0, width_inches * 72.0)
        } else {
            (width_inches * 72.0, height_inches * 72.0)
        };
        if (f64::from(width) - expected_width).abs() > f64::from(PAGE_SIZE_TOLERANCE)
            || (f64::from(height) - expected_height).abs() > f64::from(PAGE_SIZE_TOLERANCE)
        {
            return Err(invalid(
                "The native printer changed the prepared physical page size.",
            ));
        }
        Ok(Self { bounds, rotation })
    }

    pub(super) fn point(&self, left: f32, top: f32) -> (f32, f32) {
        let [x0, y0, x1, y1] = self.bounds;
        let (width, height) = (x1 - x0, y1 - y0);
        // PDF uses unrotated bottom-origin coordinates; DOM uses displayed
        // left/top coordinates, including the physical page rotation.
        match self.rotation {
            90 => (x0 + top * width, y0 + left * height),
            180 => (x1 - left * width, y0 + top * height),
            270 => (x1 - top * width, y1 - left * height),
            _ => (x0 + left * width, y1 - top * height),
        }
    }

    pub(super) fn rectangle(&self, left: f32, top: f32, right: f32, bottom: f32) -> [f32; 4] {
        let (x0, y0) = self.point(left, top);
        let (x1, y1) = self.point(right, bottom);
        [x0.min(x1), y0.min(y1), x0.max(x1), y0.max(y1)]
    }

    fn destination(&self, page: ObjectId, heading: &Heading) -> Destination {
        let (left, top) = self.point(heading.left, heading.top);
        Destination { page, left, top }
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
            return Err(invalid("A heading has no physical page destination."));
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

/// Verify that the native printer preserved the prepared pagination before
/// using any DOM position. This runs even when heading navigation is disabled.
pub(super) struct Navigation<'a> {
    pub page_count: usize,
    pub headings: &'a [Heading],
    pub links: &'a [super::links::InternalLink],
    pub document_url: &'a str,
}

pub(super) fn finish_pdf(
    bytes: &[u8],
    navigation: Navigation<'_>,
    paper: PaperSize,
    landscape: bool,
    include_outline: bool,
    document_title: Option<&str>,
) -> Result<(Vec<u8>, usize), PdfExportError> {
    let Navigation {
        page_count: expected_page_count,
        headings,
        links,
        document_url,
    } = navigation;
    super::links::validate(links, expected_page_count)?;
    if bytes.is_empty()
        || bytes.len() > MAX_PDF_BYTES
        || !(1..=MAX_PAGES).contains(&expected_page_count)
    {
        return Err(invalid("The PDF or prepared page count is invalid."));
    }
    if headings.len() > MAX_HEADINGS || (!include_outline && !headings.is_empty()) {
        return Err(invalid(
            "The document heading list is invalid or too large.",
        ));
    }
    let mut total_title_bytes = 0usize;
    let mut indices = HashSet::new();
    for heading in headings {
        total_title_bytes = total_title_bytes.saturating_add(heading.title.len());
        if !(1..=6).contains(&heading.level)
            || heading.title.trim().is_empty()
            || heading.title.len() > MAX_TITLE_BYTES
            || total_title_bytes > MAX_TOTAL_TITLE_BYTES
            || heading.index >= MAX_HEADINGS
            || !indices.insert(heading.index)
            || heading.page_index >= expected_page_count
            || !heading.left.is_finite()
            || !heading.top.is_finite()
            || !(0.0..=1.0).contains(&heading.left)
            || !(0.0..=1.0).contains(&heading.top)
        {
            return Err(invalid(
                "A heading has an invalid title, level, page, or position.",
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
    let pages = document.get_pages().into_values().collect::<Vec<_>>();
    if pages.len() != expected_page_count {
        return Err(invalid(&format!(
            "The native printer changed the prepared page count (expected {expected_page_count}, actual {}).",
            pages.len()
        )));
    }
    let geometry = pages
        .iter()
        .map(|&page| PageGeometry::read(&document, page, paper, landscape))
        .collect::<Result<Vec<_>, _>>()?;
    let destinations = headings
        .iter()
        .map(|heading| {
            (
                heading.index,
                geometry[heading.page_index].destination(pages[heading.page_index], heading),
            )
        })
        .collect();
    super::links::replace(&mut document, &pages, &geometry, links, document_url)?;
    let count = write_outline(&mut document, headings, &destinations)?;
    if let Some(title) = document_title {
        if title.chars().count() > 4096 {
            return Err(invalid("The document title is too large."));
        }
        let mut utf16 = vec![0xFE, 0xFF];
        utf16.extend(title.encode_utf16().flat_map(u16::to_be_bytes));
        let title = Object::string_literal(utf16);
        if let Ok(info) = document.trailer.get(b"Info").and_then(Object::as_reference) {
            document
                .get_object_mut(info)
                .and_then(Object::as_dict_mut)
                .map_err(native_error)?
                .set("Title", title);
        } else {
            let info = document.add_object(dictionary! { "Title" => title });
            document.trailer.set("Info", info);
        }
    }
    // Page content, embedded fonts, unrelated annotations and the page tree stay intact.
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
    use lopdf::{Dictionary, Stream};

    const DOCUMENT_URL: &str = "file:///private/markflowy-native-pdf-unit/document.html";

    fn finish_pdf(
        bytes: &[u8],
        page_count: usize,
        headings: &[Heading],
        paper: PaperSize,
        landscape: bool,
        include_outline: bool,
        title: Option<&str>,
    ) -> Result<(Vec<u8>, usize), PdfExportError> {
        super::finish_pdf(
            bytes,
            Navigation {
                page_count,
                headings,
                links: &[],
                document_url: DOCUMENT_URL,
            },
            paper,
            landscape,
            include_outline,
            title,
        )
    }

    struct Fixture {
        document: Document,
        pages: Vec<ObjectId>,
        content: ObjectId,
        info: ObjectId,
    }
    fn fixture() -> Fixture {
        let mut document = Document::with_version("1.7");
        let parent = document.new_object_id();
        let content = document.add_object(Stream::new(
            dictionary! {},
            b"q 1 0 0 1 0 0 cm Q\n".to_vec(),
        ));
        let link = document.add_object(dictionary! {
            "Type" => "Annot", "Subtype" => "Link", "Rect" => vec![30.into(),30.into(),90.into(),40.into()],
            "A" => dictionary! { "S" => "URI", "URI" => Object::string_literal("https://example.com/original") },
        });
        let pages = (0..3)
            .map(|_| {
                document.add_object(dictionary! {
                    "Type" => "Page", "Parent" => parent, "Contents" => content,
                    "Resources" => dictionary! {}, "Annots" => vec![Object::Reference(link)],
                })
            })
            .collect::<Vec<_>>();
        document.objects.insert(parent, dictionary! {
            "Type" => "Pages", "Kids" => pages.iter().copied().map(Object::Reference).collect::<Vec<_>>(),
            "Count" => 3, "MediaBox" => vec![10.into(),20.into(),622.into(),812.into()],
        }.into());
        let catalog = document.add_object(dictionary! { "Type" => "Catalog", "Pages" => parent });
        document.trailer.set("Root", catalog);
        let info = document
            .add_object(dictionary! { "Title" => Object::string_literal("Original title") });
        document.trailer.set("Info", info);
        Fixture {
            document,
            pages,
            content,
            info,
        }
    }
    fn pdf(document: &mut Document) -> Vec<u8> {
        let mut bytes = Vec::new();
        document.save_to(&mut bytes).unwrap();
        bytes
    }
    fn heading(index: usize, title: &str, level: u8, page_index: usize) -> Heading {
        Heading {
            index,
            title: title.into(),
            level,
            page_index,
            left: 0.1,
            top: 0.25,
        }
    }
    fn dict(document: &Document, id: ObjectId) -> &Dictionary {
        document.get_object(id).unwrap().as_dict().unwrap()
    }
    fn reference(dictionary: &Dictionary, key: &[u8]) -> ObjectId {
        dictionary.get(key).unwrap().as_reference().unwrap()
    }
    fn title(dictionary: &Dictionary) -> String {
        let bytes = dictionary.get(b"Title").unwrap().as_str().unwrap();
        assert_eq!(&bytes[..2], &[0xFE, 0xFF]);
        String::from_utf16(
            &bytes[2..]
                .chunks_exact(2)
                .map(|pair| u16::from_be_bytes([pair[0], pair[1]]))
                .collect::<Vec<_>>(),
        )
        .unwrap()
    }

    #[test]
    fn coordinates_preserve_nested_skipped_levels_duplicate_titles_and_unicode() {
        let mut fixture = fixture();
        let headings = vec![
            heading(0, "中文标题 📚", 1, 0),
            heading(1, "Repeated", 3, 0),
            heading(2, "Repeated", 4, 1),
            heading(3, "Sibling", 2, 1),
            heading(4, "Next", 1, 2),
        ];
        let (bytes, count) = finish_pdf(
            &pdf(&mut fixture.document),
            3,
            &headings,
            PaperSize::Letter,
            false,
            true,
            None,
        )
        .unwrap();
        assert_eq!(count, 5);
        let document = Document::load_mem(&bytes).unwrap();
        let root_id = reference(document.catalog().unwrap(), b"Outlines");
        let root = dict(&document, root_id);
        assert_eq!(root.get(b"Count").unwrap().as_i64().unwrap(), 5);
        let first_id = reference(root, b"First");
        let first = dict(&document, first_id);
        assert_eq!(title(first), "中文标题 📚");
        assert_eq!(reference(first, b"Parent"), root_id);
        assert_eq!(first.get(b"Count").unwrap().as_i64().unwrap(), 3);
        let destination = first.get(b"Dest").unwrap().as_array().unwrap();
        assert_eq!(destination[0].as_reference().unwrap(), fixture.pages[0]);
        assert_eq!(destination[1].as_name().unwrap(), b"XYZ");
        assert!((destination[2].as_float().unwrap() - 71.2).abs() < 0.001);
        assert!((destination[3].as_float().unwrap() - 614.0).abs() < 0.001);
        let child_id = reference(first, b"First");
        let child = dict(&document, child_id);
        assert_eq!(title(child), "Repeated");
        assert_eq!(reference(child, b"Parent"), first_id);
        let grandchild = dict(&document, reference(child, b"First"));
        assert_eq!(title(grandchild), "Repeated");
        assert_eq!(reference(grandchild, b"Parent"), child_id);
        assert_eq!(
            grandchild.get(b"Dest").unwrap().as_array().unwrap()[0]
                .as_reference()
                .unwrap(),
            fixture.pages[1]
        );
        let sibling = dict(&document, reference(child, b"Next"));
        assert_eq!(title(sibling), "Sibling");
        assert_eq!(reference(sibling, b"Prev"), child_id);
        assert_eq!(title(dict(&document, reference(first, b"Next"))), "Next");
    }

    #[test]
    fn preserves_printed_content_links_metadata_and_removes_outline_when_disabled() {
        let mut fixture = fixture();
        let old_outline = fixture
            .document
            .add_object(dictionary! { "Type"=>"Outlines" });
        fixture
            .document
            .catalog_mut()
            .unwrap()
            .set("Outlines", old_outline);
        fixture
            .document
            .catalog_mut()
            .unwrap()
            .set("PageMode", "UseOutlines");
        let (bytes, count) = finish_pdf(
            &pdf(&mut fixture.document),
            3,
            &[],
            PaperSize::Letter,
            false,
            false,
            None,
        )
        .unwrap();
        assert_eq!(count, 0);
        let document = Document::load_mem(&bytes).unwrap();
        assert!(document.catalog().unwrap().get(b"Outlines").is_err());
        assert!(document.catalog().unwrap().get(b"PageMode").is_err());
        assert_eq!(
            document.get_pages().into_values().collect::<Vec<_>>(),
            fixture.pages
        );
        assert_eq!(
            document
                .get_object(fixture.content)
                .unwrap()
                .as_stream()
                .unwrap()
                .content,
            b"q 1 0 0 1 0 0 cm Q\n"
        );
        assert_eq!(reference(&document.trailer, b"Info"), fixture.info);
        assert_eq!(
            dict(&document, fixture.info)
                .get(b"Title")
                .unwrap()
                .as_str()
                .unwrap(),
            b"Original title"
        );
        for page in fixture.pages {
            assert_eq!(document.get_page_annotations(page).unwrap().len(), 1);
        }
    }

    #[test]
    fn rejects_repagination_even_when_outline_is_disabled() {
        let mut fixture = fixture();
        let bytes = pdf(&mut fixture.document);
        for include_outline in [false, true] {
            for count in [0, 1, 2, 4, MAX_PAGES + 1] {
                assert!(finish_pdf(
                    &bytes,
                    count,
                    &[],
                    PaperSize::Letter,
                    false,
                    include_outline,
                    None
                )
                .is_err());
            }
        }
        assert!(finish_pdf(&bytes, 3, &[], PaperSize::A4, false, true, None).is_err());
        assert!(finish_pdf(&bytes, 3, &[], PaperSize::Letter, true, true, None).is_err());
        assert!(finish_pdf(b"not a PDF", 3, &[], PaperSize::Letter, false, true, None).is_err());
    }

    #[test]
    fn rejects_invalid_duplicate_and_out_of_page_heading_inputs() {
        let mut fixture = fixture();
        let bytes = pdf(&mut fixture.document);
        for bad in [
            heading(0, "", 1, 0),
            heading(0, "Invalid level", 7, 0),
            heading(0, "Invalid page", 1, 3),
            heading(MAX_HEADINGS, "Invalid identifier", 1, 0),
            heading(0, &"x".repeat(MAX_TITLE_BYTES + 1), 1, 0),
        ] {
            assert!(finish_pdf(&bytes, 3, &[bad], PaperSize::Letter, false, true, None).is_err());
        }
        for value in [-0.01, 1.01, f32::INFINITY, f32::NAN] {
            for coordinate in ["left", "top"] {
                let mut bad = heading(0, "Invalid coordinate", 1, 0);
                if coordinate == "left" {
                    bad.left = value;
                } else {
                    bad.top = value;
                }
                assert!(
                    finish_pdf(&bytes, 3, &[bad], PaperSize::Letter, false, true, None).is_err()
                );
            }
        }
        let duplicate = vec![heading(0, "One", 1, 0), heading(0, "Two", 2, 1)];
        assert!(finish_pdf(&bytes, 3, &duplicate, PaperSize::Letter, false, true, None).is_err());
        assert!(finish_pdf(
            &bytes,
            3,
            &[heading(0, "Outline disabled", 1, 0)],
            PaperSize::Letter,
            false,
            false,
            None
        )
        .is_err());
    }

    #[test]
    fn converts_rotated_landscape_page_positions_to_pdf_coordinates() {
        let mut fixture = fixture();
        for &page in &fixture.pages {
            fixture
                .document
                .get_object_mut(page)
                .unwrap()
                .as_dict_mut()
                .unwrap()
                .set("Rotate", 90);
        }
        let (bytes, count) = finish_pdf(
            &pdf(&mut fixture.document),
            3,
            &[heading(0, "Landscape", 1, 0)],
            PaperSize::Letter,
            true,
            true,
            None,
        )
        .unwrap();
        assert_eq!(count, 1);
        let document = Document::load_mem(&bytes).unwrap();
        let outline = dict(
            &document,
            reference(document.catalog().unwrap(), b"Outlines"),
        );
        let first = dict(&document, reference(outline, b"First"));
        let destination = first.get(b"Dest").unwrap().as_array().unwrap();
        assert!((destination[2].as_float().unwrap() - 163.0).abs() < 0.001);
        assert!((destination[3].as_float().unwrap() - 99.2).abs() < 0.001);
    }

    #[test]
    fn rejects_cropped_or_malformed_physical_page_geometry() {
        for (key, value) in [
            (
                "CropBox",
                Object::Array(vec![10.into(), 20.into(), 500.into(), 700.into()]),
            ),
            ("Rotate", Object::Integer(45)),
            ("UserUnit", Object::Real(f32::NAN)),
            (
                "MediaBox",
                Object::Array(vec![0.into(), 0.into(), 0.into(), 700.into()]),
            ),
        ] {
            let mut fixture = fixture();
            fixture
                .document
                .get_object_mut(fixture.pages[0])
                .unwrap()
                .as_dict_mut()
                .unwrap()
                .set(key, value);
            assert!(finish_pdf(
                &pdf(&mut fixture.document),
                3,
                &[],
                PaperSize::Letter,
                false,
                false,
                None
            )
            .is_err());
        }
    }
    #[test]
    fn restores_complete_unicode_document_title_after_short_native_print_title() {
        let mut fixture = fixture();
        let full_title = "中文📚".repeat(600);
        let (bytes, count) = finish_pdf(
            &pdf(&mut fixture.document),
            3,
            &[],
            PaperSize::Letter,
            false,
            false,
            Some(&full_title),
        )
        .unwrap();
        assert_eq!(count, 0);
        let document = Document::load_mem(&bytes).unwrap();
        let info = reference(&document.trailer, b"Info");
        assert_eq!(title(dict(&document, info)), full_title);
    }
    fn internal_link(
        page_index: usize,
        target_page_index: usize,
    ) -> super::super::links::InternalLink {
        super::super::links::InternalLink {
            page_index,
            left: 0.1,
            top: 0.2,
            right: 0.3,
            bottom: 0.24,
            target_page_index,
            target_left: 0.4,
            target_top: 0.15,
        }
    }

    fn append_annotation(fixture: &mut Fixture, page_index: usize, annotation: Object) -> ObjectId {
        let id = fixture.document.add_object(annotation);
        fixture
            .document
            .get_object_mut(fixture.pages[page_index])
            .unwrap()
            .as_dict_mut()
            .unwrap()
            .get_mut(b"Annots")
            .unwrap()
            .as_array_mut()
            .unwrap()
            .push(Object::Reference(id));
        id
    }

    fn uri_annotation(uri: &str, rect: [f32; 4]) -> Object {
        dictionary! { "Type"=>"Annot", "Subtype"=>"Link", "Rect"=>rect.into_iter().map(Object::Real).collect::<Vec<_>>(),
            "A"=>dictionary! { "S"=>"URI", "URI"=>Object::string_literal(uri) } }.into()
    }

    fn finish_links(
        fixture: &mut Fixture,
        links: &[super::super::links::InternalLink],
        outline: bool,
        landscape: bool,
    ) -> Document {
        let headings = if outline {
            vec![heading(0, "Heading", 1, 0)]
        } else {
            Vec::new()
        };
        let (bytes, count) = super::finish_pdf(
            &pdf(&mut fixture.document),
            Navigation {
                page_count: 3,
                headings: &headings,
                links,
                document_url: DOCUMENT_URL,
            },
            PaperSize::Letter,
            landscape,
            outline,
            None,
        )
        .unwrap();
        assert_eq!(count, usize::from(outline));
        Document::load_mem(&bytes).unwrap()
    }

    #[test]
    fn creates_same_and_cross_page_multiline_internal_links_without_native_annotations_or_outline()
    {
        let mut fixture = fixture();
        for &page in &fixture.pages {
            fixture
                .document
                .get_object_mut(page)
                .unwrap()
                .as_dict_mut()
                .unwrap()
                .remove(b"Annots");
        }
        let mut lines = vec![
            internal_link(0, 2),
            internal_link(0, 2),
            internal_link(0, 0),
            internal_link(2, 0),
        ];
        lines[1].top = 0.25;
        lines[1].bottom = 0.29;
        lines[2].left = 0.6;
        lines[2].right = 0.8;
        lines[3].target_left = 0.0;
        lines[3].target_top = 0.0; // Empty named anchors need only a target point.
        let document = finish_links(&mut fixture, &lines, false, false);
        assert!(document.catalog().unwrap().get(b"Outlines").is_err());
        let annotations = document.get_page_annotations(fixture.pages[0]).unwrap();
        assert_eq!(annotations.len(), 3);
        let first = annotations[0];
        let rect = first.get(b"Rect").unwrap().as_array().unwrap();
        assert!((rect[0].as_float().unwrap() - 71.2).abs() < 0.001);
        assert!((rect[1].as_float().unwrap() - 621.92).abs() < 0.001);
        let destination = first.get(b"Dest").unwrap().as_array().unwrap();
        assert_eq!(destination[0].as_reference().unwrap(), fixture.pages[2]);
        assert_eq!(destination[1].as_name().unwrap(), b"XYZ");
        assert!((destination[2].as_float().unwrap() - 254.8).abs() < 0.001);
        assert!((destination[3].as_float().unwrap() - 693.2).abs() < 0.001);
        assert_eq!(
            document
                .get_page_annotations(fixture.pages[2])
                .unwrap()
                .len(),
            1
        );
        let backlink = document.get_page_annotations(fixture.pages[2]).unwrap()[0]
            .get(b"Dest")
            .unwrap()
            .as_array()
            .unwrap();
        assert_eq!(backlink[0].as_reference().unwrap(), fixture.pages[0]);
        assert_eq!(backlink[2].as_float().unwrap(), 10.0);
        assert_eq!(backlink[3].as_float().unwrap(), 812.0);
    }

    #[test]
    fn removes_only_private_document_uris_and_matching_native_goto_links() {
        let mut fixture = fixture();
        let target_page = fixture.pages[1];
        let link = internal_link(0, 2);
        let geometry = PageGeometry::read(
            &fixture.document,
            fixture.pages[0],
            PaperSize::Letter,
            false,
        )
        .unwrap();
        let rect = geometry.rectangle(link.left, link.top, link.right, link.bottom);
        for uri in [
            format!("{DOCUMENT_URL}#%E4%B8%AD%E6%96%87"),
            format!("{DOCUMENT_URL}#missing"),
            DOCUMENT_URL.into(),
            "#中文".into(),
            "#".into(),
        ] {
            append_annotation(&mut fixture, 0, uri_annotation(&uri, rect));
        }
        let external_file = append_annotation(
            &mut fixture,
            0,
            uri_annotation("file:///private/other-document.html#中文", rect),
        );
        let query = append_annotation(
            &mut fixture,
            0,
            uri_annotation(&format!("{DOCUMENT_URL}?external=1#section"), rect),
        );
        let remote = append_annotation(
            &mut fixture,
            0,
            uri_annotation("https://example.com/#中文", rect),
        );
        let remote_file=append_annotation(&mut fixture,0,dictionary! { "Type"=>"Annot","Subtype"=>"Link","Rect"=>rect.into_iter().map(Object::Real).collect::<Vec<_>>(),
            "A"=>dictionary! { "S"=>"GoToR", "F"=>Object::string_literal("other.pdf"),"D"=>0 } }.into());
        let note=append_annotation(&mut fixture,0,dictionary! { "Type"=>"Annot","Subtype"=>"Text","Rect"=>rect.into_iter().map(Object::Real).collect::<Vec<_>>(), "Contents"=>Object::string_literal("Preserved note") }.into());
        let matching=append_annotation(&mut fixture,0,dictionary! { "Type"=>"Annot","Subtype"=>"Link","Rect"=>rect.into_iter().map(Object::Real).collect::<Vec<_>>(),
            "Dest"=>vec![Object::Reference(target_page),Object::Name(b"Fit".to_vec())] }.into());
        let unrelated=append_annotation(&mut fixture,0,dictionary! { "Type"=>"Annot","Subtype"=>"Link","Rect"=>vec![300.into(),300.into(),400.into(),400.into()],
            "A"=>dictionary! { "S"=>"GoTo","D"=>vec![Object::Reference(target_page),Object::Name(b"Fit".to_vec())] } }.into());
        let document = finish_links(&mut fixture, &[link], true, false);
        let remaining = dict(&document, fixture.pages[0])
            .get(b"Annots")
            .unwrap()
            .as_array()
            .unwrap()
            .iter()
            .map(|value| value.as_reference().unwrap())
            .collect::<Vec<_>>();
        for id in [external_file, query, remote, remote_file, note, unrelated] {
            assert!(remaining.contains(&id));
        }
        assert!(!remaining.contains(&matching));
        assert!(!document.objects.contains_key(&matching));
        assert_eq!(remaining.len(), 8); // Original external link + six preserved + one authoritative internal link.
        assert_eq!(
            document
                .get_page_annotations(fixture.pages[1])
                .unwrap()
                .len(),
            1
        );
        assert!(document.catalog().unwrap().get(b"Outlines").is_ok());
    }

    #[test]
    fn replaces_indirect_uri_annotations_and_multiline_goto_without_leaving_private_uri_objects() {
        let mut fixture = fixture();
        let target_page = fixture.pages[1];
        let mut lines = vec![internal_link(0, 2), internal_link(0, 2)];
        lines[1].top = 0.25;
        lines[1].bottom = 0.29;
        let uri = fixture
            .document
            .add_object(Object::string_literal(format!("{DOCUMENT_URL}#跨页表格")));
        let action = fixture
            .document
            .add_object(dictionary! { "S"=>"URI","URI"=>uri });
        append_annotation(&mut fixture,0,dictionary! { "Type"=>"Annot","Subtype"=>"Link","A"=>action,"Rect"=>vec![20.into(),20.into(),30.into(),30.into()] }.into());
        let geometry = PageGeometry::read(
            &fixture.document,
            fixture.pages[0],
            PaperSize::Letter,
            false,
        )
        .unwrap();
        let r0 = geometry.rectangle(lines[0].left, lines[0].top, lines[0].right, lines[0].bottom);
        let r1 = geometry.rectangle(lines[1].left, lines[1].top, lines[1].right, lines[1].bottom);
        append_annotation(&mut fixture,0,dictionary! { "Type"=>"Annot","Subtype"=>"Link","Rect"=>vec![r0[0].into(),r1[1].into(),r0[2].into(),r0[3].into()],
            "A"=>dictionary! { "S"=>"GoTo","D"=>vec![Object::Reference(target_page),Object::Name(b"Fit".to_vec())] } }.into());
        let annotations = fixture
            .document
            .get_object_mut(fixture.pages[0])
            .unwrap()
            .as_dict_mut()
            .unwrap()
            .remove(b"Annots")
            .unwrap();
        let indirect = fixture.document.add_object(annotations);
        fixture
            .document
            .get_object_mut(fixture.pages[0])
            .unwrap()
            .as_dict_mut()
            .unwrap()
            .set("Annots", indirect);
        let document = finish_links(&mut fixture, &lines, false, false);
        assert_eq!(
            document
                .get_page_annotations(fixture.pages[0])
                .unwrap()
                .len(),
            3
        );
        for id in [uri, action, indirect] {
            assert!(!document.objects.contains_key(&id));
        }
        let mut document = document;
        let bytes = pdf(&mut document);
        assert!(!bytes
            .windows(DOCUMENT_URL.len())
            .any(|window| window == DOCUMENT_URL.as_bytes()));
    }

    #[test]
    fn internal_link_rectangles_and_targets_respect_rotated_page_coordinates() {
        let mut fixture = fixture();
        for &page in &fixture.pages {
            fixture
                .document
                .get_object_mut(page)
                .unwrap()
                .as_dict_mut()
                .unwrap()
                .set("Rotate", 90);
        }
        let link = internal_link(0, 1);
        let document = finish_links(&mut fixture, &[link], false, true);
        let annotations = document.get_page_annotations(fixture.pages[0]).unwrap();
        let annotation = annotations
            .iter()
            .find(|value| value.get(b"Dest").is_ok())
            .unwrap();
        let rect = annotation
            .get(b"Rect")
            .unwrap()
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_float().unwrap())
            .collect::<Vec<_>>();
        assert!((rect[0] - 132.4).abs() < 0.001);
        assert!((rect[1] - 99.2).abs() < 0.001);
        assert!((rect[2] - 156.88).abs() < 0.001);
        assert!((rect[3] - 257.6).abs() < 0.001);
        let target = annotation.get(b"Dest").unwrap().as_array().unwrap();
        assert!((target[2].as_float().unwrap() - 101.8).abs() < 0.001);
        assert!((target[3].as_float().unwrap() - 336.8).abs() < 0.001);
    }

    #[test]
    fn validates_internal_link_counts_pages_and_all_normalized_coordinates() {
        use super::super::links::{validate, MAX_LINK_RECTS};
        assert!(validate(&vec![internal_link(0, 1); MAX_LINK_RECTS + 1], 3).is_err());
        for value in [-0.1, 1.1, f32::INFINITY, f32::NAN] {
            for field in 0..6 {
                let mut link = internal_link(0, 1);
                match field {
                    0 => link.left = value,
                    1 => link.top = value,
                    2 => link.right = value,
                    3 => link.bottom = value,
                    4 => link.target_left = value,
                    _ => link.target_top = value,
                };
                assert!(validate(&[link], 3).is_err());
            }
        }
        let mut zero = internal_link(0, 1);
        zero.right = zero.left;
        assert!(validate(&[zero], 3).is_err());
        let mut inverted = internal_link(0, 1);
        inverted.bottom = 0.1;
        assert!(validate(&[inverted], 3).is_err());
        assert!(validate(&[internal_link(3, 0)], 3).is_err());
        assert!(validate(&[internal_link(0, 3)], 3).is_err());
    }
}
