//! Lossless text-file boundaries. No newline or Unicode normalization takes place here.
use encoding_rs::{EncoderResult, Encoding, GB18030, GBK, UTF_16BE, UTF_16LE, UTF_8};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TextEncoding {
    #[default]
    #[serde(rename = "utf-8")]
    Utf8,
    #[serde(rename = "utf-16le")]
    Utf16le,
    #[serde(rename = "utf-16be")]
    Utf16be,
    Gbk,
    Gb18030,
}

impl TextEncoding {
    fn codec(self) -> &'static Encoding {
        match self {
            Self::Utf8 => UTF_8,
            Self::Utf16le => UTF_16LE,
            Self::Utf16be => UTF_16BE,
            Self::Gbk => GBK,
            Self::Gb18030 => GB18030,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Bom {
    #[default]
    None,
    Utf8,
    Utf16le,
    Utf16be,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct TextFileFormat {
    pub encoding: TextEncoding,
    pub bom: Bom,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMetadata {
    pub format: TextFileFormat,
    pub line_endings: LineEndings,
    pub decoding: Decoding,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Decoding {
    pub source: String,
    pub needs_confirmation: bool,
    pub byte_round_trip: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct LineEndings {
    pub lf: usize,
    pub crlf: usize,
    pub cr: usize,
}

impl LineEndings {
    pub fn of(text: &str) -> Self {
        let mut result = Self::default();
        let mut bytes = text.bytes().peekable();
        while let Some(byte) = bytes.next() {
            match byte {
                b'\r' if bytes.peek() == Some(&b'\n') => {
                    bytes.next();
                    result.crlf += 1;
                }
                b'\r' => result.cr += 1,
                b'\n' => result.lf += 1,
                _ => {}
            }
        }
        result
    }
}

#[derive(Debug)]
pub struct DecodedText {
    pub content: String,
    pub metadata: TextMetadata,
}

#[derive(Debug, thiserror::Error)]
pub enum TextError {
    #[error(
        "text_invalid_encoding: Invalid or incomplete {0} data; choose the encoding to reopen."
    )]
    Invalid(&'static str),
    #[error("text_unsupported_encoding: {0}")]
    Unsupported(String),
    #[error("text_binary: Binary files cannot be opened as text.")]
    Binary,
    #[error("text_invalid_bom: The BOM does not match the selected encoding.")]
    InvalidBom,
    #[error("text_unmappable: Character {character:?} (U+{codepoint:04X}) at UTF-16 offset {offset} cannot be saved in {encoding}.")]
    Unmappable {
        character: char,
        codepoint: u32,
        offset: usize,
        encoding: &'static str,
    },
    #[error("text_confirm_encoding: Confirm the detected encoding before overwriting this file.")]
    ConfirmationRequired,
    #[error("text_noncanonical: The original byte mapping cannot be preserved. Explicitly convert to another encoding or save a copy.")]
    Noncanonical,
    #[error("text_not_reversible: The selected encoding cannot round-trip this Unicode text without changing characters.")]
    NotReversible,
    #[error("text_ambiguous_bom: A leading U+FEFF requires a separate BOM to remain body text in this Unicode file.")]
    AmbiguousBom,
}

fn signature(bytes: &[u8]) -> Result<(Option<TextEncoding>, Bom, usize), TextError> {
    if bytes.starts_with(&[0, 0, 0xFE, 0xFF]) || bytes.starts_with(&[0xFF, 0xFE, 0, 0]) {
        return Err(TextError::Unsupported("UTF-32".into()));
    }
    Ok(if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        (Some(TextEncoding::Utf8), Bom::Utf8, 3)
    } else if bytes.starts_with(&[0xFF, 0xFE]) {
        (Some(TextEncoding::Utf16le), Bom::Utf16le, 2)
    } else if bytes.starts_with(&[0xFE, 0xFF]) {
        (Some(TextEncoding::Utf16be), Bom::Utf16be, 2)
    } else {
        (None, Bom::None, 0)
    })
}

pub fn decode(bytes: &[u8], selected: Option<TextEncoding>) -> Result<DecodedText, TextError> {
    let (signed, bom, skip) = signature(bytes)?;
    if selected.is_some() && signed.is_some() && selected != signed {
        return Err(TextError::InvalidBom);
    }
    let (encoding, source) = if let Some(encoding) = selected {
        (encoding, "user")
    } else if let Some(encoding) = signed {
        (encoding, "bom")
    } else {
        (
            detect(bytes)?,
            if std::str::from_utf8(bytes).is_ok() && !bytes.contains(&0) {
                "utf8"
            } else {
                "heuristic"
            },
        )
    };
    let body = &bytes[skip..];
    // WHATWG's GBK decoder also accepts GB18030 four-byte sequences. Never label those GBK.
    if encoding == TextEncoding::Gbk
        && body.windows(4).any(|b| {
            (0x81..=0xFE).contains(&b[0])
                && (0x30..=0x39).contains(&b[1])
                && (0x81..=0xFE).contains(&b[2])
                && (0x30..=0x39).contains(&b[3])
        })
    {
        return Err(TextError::Invalid(
            "GBK (contains GB18030 four-byte sequences)",
        ));
    }
    let content = encoding
        .codec()
        .decode_without_bom_handling_and_without_replacement(body)
        .ok_or(TextError::Invalid(encoding.codec().name()))?
        .into_owned();
    let format = TextFileFormat { encoding, bom };
    let byte_round_trip = encode(&content, format).is_ok_and(|encoded| encoded == bytes);
    let line_endings = LineEndings::of(&content);
    Ok(DecodedText {
        content,
        metadata: TextMetadata {
            format,
            line_endings,
            decoding: Decoding {
                source: source.into(),
                needs_confirmation: source == "heuristic",
                byte_round_trip,
            },
        },
    })
}

fn detect(bytes: &[u8]) -> Result<TextEncoding, TextError> {
    if [
        b"%PDF-".as_slice(),
        b"\x89PNG",
        b"PK\x03\x04",
        b"GIF8",
        b"\x7FELF",
        b"\xFF\xD8\xFF",
    ]
    .iter()
    .any(|header| bytes.starts_with(header))
    {
        return Err(TextError::Binary);
    }
    if bytes.contains(&0) {
        let sample = &bytes[..bytes.len().min(1024)];
        let even = sample.iter().step_by(2).filter(|&&b| b == 0).count();
        let odd = sample
            .iter()
            .skip(1)
            .step_by(2)
            .filter(|&&b| b == 0)
            .count();
        let candidate = if odd > even * 4 && odd * 10 >= sample.len() {
            Some(TextEncoding::Utf16le)
        } else if even > odd * 4 && even * 10 >= sample.len() {
            Some(TextEncoding::Utf16be)
        } else {
            None
        };
        if let Some(candidate) = candidate {
            if bytes.len() % 2 == 0
                && candidate
                    .codec()
                    .decode_without_bom_handling_and_without_replacement(bytes)
                    .is_some_and(|s| {
                        s.chars()
                            .all(|c| !c.is_control() || matches!(c, '\t' | '\n' | '\r'))
                    })
            {
                return Ok(candidate);
            }
        }
        return Err(TextError::Binary);
    }
    if std::str::from_utf8(bytes).is_ok() {
        return Ok(TextEncoding::Utf8);
    }
    let mut detector = chardetng::EncodingDetector::new(chardetng::Iso2022JpDetection::Deny);
    detector.feed(bytes, true);
    let candidate = detector.guess(None, chardetng::Utf8Detection::Allow);
    if candidate == GBK || candidate == GB18030 {
        // Prefer the superset until the user explicitly chooses GBK.
        Ok(TextEncoding::Gb18030)
    } else {
        Err(TextError::Unsupported(format!(
            "Detected {}; choose an encoding to reopen.",
            candidate.name()
        )))
    }
}

pub fn encode(text: &str, format: TextFileFormat) -> Result<Vec<u8>, TextError> {
    use TextEncoding::*;
    if format.bom == Bom::None
        && matches!(format.encoding, Utf8 | Utf16le | Utf16be)
        && text.starts_with('\u{feff}')
    {
        return Err(TextError::AmbiguousBom);
    }
    let mut bytes = match (format.encoding, format.bom) {
        (_, Bom::None) => Vec::new(),
        (Utf8, Bom::Utf8) => vec![0xEF, 0xBB, 0xBF],
        (Utf16le, Bom::Utf16le) => vec![0xFF, 0xFE],
        (Utf16be, Bom::Utf16be) => vec![0xFE, 0xFF],
        _ => return Err(TextError::InvalidBom),
    };
    match format.encoding {
        Utf8 => bytes.extend_from_slice(text.as_bytes()),
        Utf16le => bytes.extend(text.encode_utf16().flat_map(u16::to_le_bytes)),
        Utf16be => bytes.extend(text.encode_utf16().flat_map(u16::to_be_bytes)),
        Gbk | Gb18030 => {
            let mut encoder = format.encoding.codec().new_encoder();
            let mut consumed = 0;
            let mut buffer = [0u8; 8192];
            loop {
                let (result, read, written) = encoder.encode_from_utf8_without_replacement(
                    &text[consumed..],
                    &mut buffer,
                    true,
                );
                consumed += read;
                bytes.extend_from_slice(&buffer[..written]);
                match result {
                    EncoderResult::InputEmpty => break,
                    EncoderResult::OutputFull => {}
                    EncoderResult::Unmappable(character) => {
                        return Err(TextError::Unmappable {
                            character,
                            codepoint: character as u32,
                            offset: text[..consumed - character.len_utf8()]
                                .encode_utf16()
                                .count(),
                            encoding: format.encoding.codec().name(),
                        })
                    }
                }
            }
            if !format
                .encoding
                .codec()
                .decode_without_bom_handling_and_without_replacement(&bytes)
                .is_some_and(|decoded| decoded == text)
            {
                return Err(TextError::NotReversible);
            }
        }
    }
    Ok(bytes)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextWriteOptions {
    pub format: TextFileFormat,
    pub original_format: Option<TextFileFormat>,
    pub encoding_confirmed: bool,
}

/// Complete preflight before opening/truncating the destination. None means no byte change.
pub fn prepare_write(
    text: &str,
    before: Option<&[u8]>,
    options: Option<&TextWriteOptions>,
) -> Result<Option<Vec<u8>>, TextError> {
    let old = before
        .map(|bytes| {
            decode(
                bytes,
                options.and_then(|o| o.original_format.map(|f| f.encoding)),
            )
        })
        .transpose()?;
    let target = options
        .map(|o| o.format)
        .or_else(|| old.as_ref().map(|d| d.metadata.format))
        .unwrap_or_default();
    if old
        .as_ref()
        .is_some_and(|d| d.content == text && d.metadata.format == target)
    {
        return Ok(None);
    }
    if options.map_or_else(
        || {
            old.as_ref()
                .is_some_and(|d| d.metadata.decoding.needs_confirmation)
        },
        |o| !o.encoding_confirmed,
    ) {
        return Err(TextError::ConfirmationRequired);
    }
    if old
        .as_ref()
        .is_some_and(|d| !d.metadata.decoding.byte_round_trip && d.metadata.format == target)
    {
        return Err(TextError::Noncanonical);
    }
    let bytes = encode(text, target)?;
    Ok(if before == Some(bytes.as_slice()) {
        None
    } else {
        Some(bytes)
    })
}

#[cfg(test)]
mod tests;
