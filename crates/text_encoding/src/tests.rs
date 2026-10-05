use super::*;

#[test]
fn unicode_bom_newlines_and_body_feff_round_trip() {
    let text = "\u{feff}中文😀\r\nA\rB\n\n";
    for (encoding, bom) in [
        (TextEncoding::Utf8, Bom::Utf8),
        (TextEncoding::Utf16le, Bom::Utf16le),
        (TextEncoding::Utf16be, Bom::Utf16be),
    ] {
        for bom in [Bom::None, bom] {
            let format = TextFileFormat { encoding, bom };
            if bom == Bom::None {
                assert!(matches!(encode(text, format), Err(TextError::AmbiguousBom)));
                continue;
            }
            let bytes = encode(text, format).unwrap();
            // Explicit selection removes only an actual signature. U+FEFF at position zero
            // needs a separate BOM to be distinguishable from a signature on disk.
            let decoded = decode(&bytes, None).unwrap();
            assert_eq!(decoded.content, text);
            assert_eq!(decoded.metadata.format, format);
            assert_eq!(
                decoded.metadata.line_endings,
                LineEndings {
                    crlf: 1,
                    cr: 1,
                    lf: 2
                }
            );
            assert!(decoded.metadata.decoding.byte_round_trip);
            assert!(prepare_write(text, Some(&bytes), None).unwrap().is_none());
        }
    }
}

#[test]
fn legacy_characters_and_strict_unmappable_errors() {
    let gbk = TextFileFormat {
        encoding: TextEncoding::Gbk,
        bom: Bom::None,
    };
    let gb18030 = TextFileFormat {
        encoding: TextEncoding::Gb18030,
        bom: Bom::None,
    };
    let bytes = encode("你好，中文文档。\r\n测试编码！", gbk).unwrap();
    assert_eq!(
        decode(&bytes, Some(TextEncoding::Gbk)).unwrap().content,
        "你好，中文文档。\r\n测试编码！"
    );
    assert!(
        decode(&bytes, None)
            .unwrap()
            .metadata
            .decoding
            .needs_confirmation
    );
    assert!(matches!(
        encode("a中😀", gbk),
        Err(TextError::Unmappable {
            character: '😀',
            offset: 2,
            ..
        })
    ));
    let emoji = encode("𠮷😀", gb18030).unwrap();
    assert_eq!(
        decode(&emoji, Some(TextEncoding::Gb18030)).unwrap().content,
        "𠮷😀"
    );
    assert!(decode(&emoji, Some(TextEncoding::Gbk)).is_err());
    assert!(encode(
        "x",
        TextFileFormat {
            bom: Bom::Utf8,
            ..gbk
        }
    )
    .is_err());
}

#[test]
fn malformed_bytes_are_never_replaced() {
    for bytes in [
        vec![0xFF, 0xFE, 0],
        vec![0xFF, 0xFE, 0, 0xD8],
        vec![0xEF, 0xBB, 0xBF, 0xFF],
    ] {
        assert!(decode(&bytes, None).is_err());
    }
    assert!(matches!(
        decode(&[0xFF, 0xFE, 0, 0], None),
        Err(TextError::Unsupported(_))
    ));
    assert!(decode(&[0x81], Some(TextEncoding::Gb18030)).is_err());
    assert!(matches!(
        decode(b"PK\x03\x04stuff", None),
        Err(TextError::Binary)
    ));
    assert!(matches!(
        decode(&[0xFF, 0xFE, 65, 0], Some(TextEncoding::Utf8)),
        Err(TextError::InvalidBom)
    ));
}

#[test]
fn inferred_encoding_requires_confirmation_but_unchanged_save_is_noop() {
    let format = TextFileFormat {
        encoding: TextEncoding::Gb18030,
        bom: Bom::None,
    };
    let text = "你好，中文文档。测试编码！";
    let before = encode(text, format).unwrap();
    assert!(prepare_write(text, Some(&before), None).unwrap().is_none());
    assert!(matches!(
        prepare_write("修改", Some(&before), None),
        Err(TextError::ConfirmationRequired)
    ));
    let options = TextWriteOptions {
        format,
        original_format: Some(format),
        encoding_confirmed: true,
    };
    assert_eq!(
        decode(
            &prepare_write("修改😀", Some(&before), Some(&options))
                .unwrap()
                .unwrap(),
            Some(format.encoding)
        )
        .unwrap()
        .content,
        "修改😀"
    );
}

#[test]
fn noncanonical_euro_byte_is_not_silently_rewritten() {
    let format = TextFileFormat {
        encoding: TextEncoding::Gb18030,
        bom: Bom::None,
    };
    let original = [0x80];
    let decoded = decode(&original, Some(format.encoding)).unwrap();
    assert!(!decoded.metadata.decoding.byte_round_trip);
    let options = TextWriteOptions {
        format,
        original_format: Some(format),
        encoding_confirmed: true,
    };
    assert!(
        prepare_write(&decoded.content, Some(&original), Some(&options))
            .unwrap()
            .is_none()
    );
    assert!(matches!(
        prepare_write("€!", Some(&original), Some(&options)),
        Err(TextError::Noncanonical)
    ));
    assert!(prepare_write(
        "€!",
        Some(&original),
        Some(&TextWriteOptions {
            format: TextFileFormat::default(),
            ..options
        })
    )
    .unwrap()
    .is_some());
}

#[test]
fn encoder_processes_multiple_output_chunks() {
    let format = TextFileFormat {
        encoding: TextEncoding::Gb18030,
        bom: Bom::None,
    };
    let text = "𠮷中\r\n".repeat(10_000);
    assert_eq!(
        decode(&encode(&text, format).unwrap(), Some(format.encoding))
            .unwrap()
            .content,
        text
    );
}
