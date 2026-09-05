mod snapshot_tests {
    use super::*;
    use std::time::{Duration, Instant, SystemTime};

    fn successful_snapshot(result: FileSnapshotResult) -> (String, String) {
        match result {
            FileSnapshotResult::Success { content, revision } => (content, revision),
            FileSnapshotResult::Unavailable { result } => {
                panic!("snapshot was unavailable: {result:?}")
            }
            FileSnapshotResult::Unstable => panic!("snapshot did not stabilize"),
        }
    }

    fn unavailable_snapshot(result: FileSnapshotResult) -> FileResult {
        match result {
            FileSnapshotResult::Unavailable { result } => result,
            FileSnapshotResult::Success { .. } => panic!("unexpected successful snapshot"),
            FileSnapshotResult::Unstable => panic!("unexpected unstable snapshot"),
        }
    }

    fn restore_modified(path: &Path, modified: SystemTime) {
        fs::OpenOptions::new()
            .write(true)
            .open(path)
            .unwrap()
            .set_modified(modified)
            .unwrap();
    }

    #[test]
    fn snapshot_result_serializes_the_existing_frontend_union_shape() {
        let success = serde_json::to_value(FileSnapshotResult::Success {
            content: "# Heading".to_string(),
            revision: "revision".to_string(),
        })
        .unwrap();
        assert_eq!(
            success,
            serde_json::json!({
                "status": "success",
                "content": "# Heading",
                "revision": "revision"
            })
        );
        let unavailable = serde_json::to_value(FileSnapshotResult::Unavailable {
            result: FileResult {
                code: FileResultCode::PermissionDenied,
                content: "access denied".to_string(),
            },
        })
        .unwrap();
        assert_eq!(
            unavailable,
            serde_json::json!({
                "status": "unavailable",
                "result": { "code": "PermissionDenied", "content": "access denied" }
            })
        );
        assert_eq!(
            serde_json::to_value(FileSnapshotResult::Unstable).unwrap(),
            serde_json::json!({ "status": "unstable" })
        );
    }

    #[test]
    fn stable_snapshot_uses_two_samples_and_its_revision_can_save() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("stable.md");
        fs::write(&path, "# Stable\n你好\n").unwrap();
        let mut calls = 0;

        let (content, revision) =
            successful_snapshot(read_file_snapshot_with_reader(&path, |path| {
                calls += 1;
                read_file_sample(path)
            }));

        assert_eq!(calls, 2);
        assert_eq!(content, "# Stable\n你好\n");
        assert_eq!(revision, get_file_write_revision(&path).unwrap());
        let saved = conditional_write_file(&path, b"updated", &revision).unwrap();
        assert_eq!(saved.status, ConditionalWriteStatus::Success);
        assert_eq!(fs::read_to_string(&path).unwrap(), "updated");
        assert_ne!(saved.revision, revision);
    }

    #[test]
    fn snapshot_retries_same_length_changes_even_with_the_original_mtime() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("same-length.md");
        fs::write(&path, "before").unwrap();
        let modified = fs::metadata(&path).unwrap().modified().unwrap();
        let mut calls = 0;

        let (content, revision) =
            successful_snapshot(read_file_snapshot_with_reader(&path, |path| {
                calls += 1;
                let mut sample = read_file_sample(path)?.unwrap();
                if calls == 1 {
                    fs::write(path, "after!").unwrap();
                    restore_modified(path, modified);
                    // Equalize metadata too, so this specifically requires the byte comparison.
                    sample.metadata = fs::metadata(path).unwrap();
                }
                Ok(Some(sample))
            }));

        assert_eq!(calls, 4);
        assert_eq!(content, "after!");
        assert_eq!(revision, get_file_write_revision(&path).unwrap());
    }

    #[test]
    fn snapshot_retries_metadata_only_changes() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("metadata.md");
        fs::write(&path, "unchanged").unwrap();
        let modified = fs::metadata(&path).unwrap().modified().unwrap();
        let mut calls = 0;

        let (content, revision) =
            successful_snapshot(read_file_snapshot_with_reader(&path, |path| {
                calls += 1;
                let sample = read_file_sample(path)?;
                if calls == 1 {
                    restore_modified(path, modified + Duration::from_secs(10));
                }
                Ok(sample)
            }));

        assert_eq!(calls, 4);
        assert_eq!(content, "unchanged");
        assert_eq!(revision, get_file_write_revision(&path).unwrap());
    }

    #[test]
    fn snapshot_retries_atomic_replacement_with_identical_bytes_and_mtime() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("replaced.md");
        fs::write(&path, "identical").unwrap();
        let original_identity = same_file::Handle::from_path(&path).unwrap();
        let modified = fs::metadata(&path).unwrap().modified().unwrap();
        let mut calls = 0;

        let (content, revision) =
            successful_snapshot(read_file_snapshot_with_reader(&path, |path| {
                calls += 1;
                let mut sample = read_file_sample(path)?.unwrap();
                if calls == 1 {
                    let mut replacement =
                        tempfile::NamedTempFile::new_in(directory.path()).unwrap();
                    replacement.write_all(b"identical").unwrap();
                    replacement.as_file().set_modified(modified).unwrap();
                    replacement.persist(path).unwrap();
                    // Keep the old open identity but remove other stability signals.
                    sample.metadata = fs::metadata(path).unwrap();
                    sample.generations = file_write_generations(path, &sample.metadata).unwrap();
                }
                Ok(Some(sample))
            }));

        assert_eq!(calls, 4);
        assert_eq!(content, "identical");
        assert_ne!(
            original_identity,
            same_file::Handle::from_path(&path).unwrap()
        );
        assert_eq!(revision, get_file_write_revision(&path).unwrap());
    }

    #[test]
    fn snapshot_retries_identical_process_writes_using_generations() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("same-content.md");
        fs::write(&path, "same").unwrap();
        let initial_revision = get_file_write_revision(&path).unwrap();
        let modified = fs::metadata(&path).unwrap().modified().unwrap();
        let mut calls = 0;

        let (content, revision) =
            successful_snapshot(read_file_snapshot_with_reader(&path, |path| {
                calls += 1;
                let mut sample = read_file_sample(path)?.unwrap();
                if calls == 1 {
                    let saved = conditional_write_file(path, b"same", &initial_revision).unwrap();
                    assert_eq!(saved.status, ConditionalWriteStatus::Success);
                    restore_modified(path, modified);
                    // Require generations, even on platforms that expose a changed ctime.
                    sample.metadata = fs::metadata(path).unwrap();
                }
                Ok(Some(sample))
            }));

        assert_eq!(calls, 4);
        assert_eq!(content, "same");
        assert_ne!(revision, initial_revision);
        assert_eq!(revision, get_file_write_revision(&path).unwrap());
        assert_eq!(
            conditional_write_file(&path, b"stale", &initial_revision)
                .unwrap()
                .status,
            ConditionalWriteStatus::Conflict
        );
        assert_eq!(
            conditional_write_file(&path, b"fresh", &revision)
                .unwrap()
                .status,
            ConditionalWriteStatus::Success
        );
    }

    #[test]
    fn snapshot_retries_process_aba_writes_even_when_bytes_and_metadata_return() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("aba.md");
        fs::write(&path, "A").unwrap();
        let initial_revision = get_file_write_revision(&path).unwrap();
        let modified = fs::metadata(&path).unwrap().modified().unwrap();
        let mut calls = 0;

        let (content, revision) =
            successful_snapshot(read_file_snapshot_with_reader(&path, |path| {
                calls += 1;
                let mut sample = read_file_sample(path)?.unwrap();
                if calls == 1 {
                    assert_eq!(
                        write_file(path.to_str().unwrap(), "B").code,
                        FileResultCode::Success
                    );
                    assert_eq!(
                        write_file(path.to_str().unwrap(), "A").code,
                        FileResultCode::Success
                    );
                    restore_modified(path, modified);
                    sample.metadata = fs::metadata(path).unwrap();
                }
                Ok(Some(sample))
            }));

        assert_eq!(calls, 4);
        assert_eq!(content, "A");
        assert_ne!(revision, initial_revision);
        assert_eq!(revision, get_file_write_revision(&path).unwrap());
    }

    #[test]
    fn snapshot_stops_after_three_mismatched_pairs() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("changing.md");
        fs::write(&path, "A").unwrap();
        let mut calls = 0;

        let result = read_file_snapshot_with_reader(&path, |path| {
            calls += 1;
            let sample = read_file_sample(path)?;
            fs::write(path, if calls % 2 == 1 { "B" } else { "A" }).unwrap();
            Ok(sample)
        });

        assert!(matches!(result, FileSnapshotResult::Unstable));
        assert_eq!(calls, 6);
    }

    #[test]
    fn snapshot_counts_unstable_individual_samples_toward_the_retry_limit() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("unstable-sample.md");
        fs::write(&path, "text").unwrap();

        for unstable_first_sample in [true, false] {
            let mut calls = 0;
            let result = read_file_snapshot_with_reader(&path, |path| {
                calls += 1;
                if unstable_first_sample || calls % 2 == 0 {
                    Ok(None)
                } else {
                    read_file_sample(path)
                }
            });

            assert!(matches!(result, FileSnapshotResult::Unstable));
            assert_eq!(calls, if unstable_first_sample { 3 } else { 6 });
        }
    }

    #[test]
    fn snapshot_recovers_after_an_unstable_individual_sample() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("recovered.md");
        fs::write(&path, "stable").unwrap();
        let mut calls = 0;

        let (content, revision) =
            successful_snapshot(read_file_snapshot_with_reader(&path, |path| {
                calls += 1;
                if calls == 1 {
                    Ok(None)
                } else {
                    read_file_sample(path)
                }
            }));

        assert_eq!(calls, 3);
        assert_eq!(content, "stable");
        assert_eq!(revision, get_file_write_revision(&path).unwrap());
    }

    #[test]
    fn snapshot_preserves_supported_encodings_and_hashes_original_bytes() {
        let directory = tempfile::tempdir().unwrap();
        let text = "Hello 世界 📝\n";
        let utf16_le = text
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>();
        let utf16_be = text
            .encode_utf16()
            .flat_map(u16::to_be_bytes)
            .collect::<Vec<_>>();
        let cases = [
            ("utf8", text.as_bytes().to_vec(), text),
            (
                "utf8-bom",
                [vec![0xef, 0xbb, 0xbf], text.as_bytes().to_vec()].concat(),
                text,
            ),
            ("utf16-le", [vec![0xff, 0xfe], utf16_le].concat(), text),
            ("utf16-be", [vec![0xfe, 0xff], utf16_be].concat(), text),
            ("utf16-le-no-bom", vec![b'A', 0, b'B', 0], "AB"),
            ("utf16-be-no-bom", vec![0, b'A', 0, b'B'], "AB"),
            ("empty", vec![], ""),
        ];

        for (name, bytes, expected) in cases {
            let path = directory.path().join(name);
            fs::write(&path, &bytes).unwrap();
            let (content, revision) = successful_snapshot(read_file_snapshot(&path));
            assert_eq!(content, expected, "{name}");
            assert_eq!(revision, get_file_write_revision(&path).unwrap(), "{name}");
            assert!(revision.contains(&revision_for_content(&bytes)), "{name}");
            assert_eq!(
                conditional_write_file(&path, expected.as_bytes(), &revision)
                    .unwrap()
                    .status,
                ConditionalWriteStatus::Success,
                "{name}"
            );
        }
    }

    #[test]
    fn snapshot_preserves_binary_and_invalid_encoding_errors_without_retrying() {
        let directory = tempfile::tempdir().unwrap();
        let cases = [
            ("binary", vec![0, 1, 2, 0, 3, 4], FileResultCode::Binary),
            (
                "invalid-utf8",
                vec![0xff, 0xff],
                FileResultCode::UnknownError,
            ),
            (
                "invalid-utf8-bom",
                vec![0xef, 0xbb, 0xbf, 0xff],
                FileResultCode::UnknownError,
            ),
            (
                "odd-utf16",
                vec![0xff, 0xfe, b'A'],
                FileResultCode::UnknownError,
            ),
            (
                "invalid-utf16",
                vec![0xff, 0xfe, 0, 0xd8],
                FileResultCode::UnknownError,
            ),
        ];

        for (name, bytes, expected_code) in cases {
            let path = directory.path().join(name);
            fs::write(&path, bytes).unwrap();
            let mut calls = 0;
            let result = unavailable_snapshot(read_file_snapshot_with_reader(&path, |path| {
                calls += 1;
                read_file_sample(path)
            }));
            let old_result = read_file(path.to_str().unwrap());

            assert_eq!(calls, 2, "{name}");
            assert_eq!(result.code, expected_code, "{name}");
            assert_eq!(result.code, old_result.code, "{name}");
            assert_eq!(result.content, old_result.content, "{name}");
        }
    }

    #[test]
    fn snapshot_reports_missing_files_and_does_not_return_a_missing_revision() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("missing.md");
        let mut calls = 0;

        let result = unavailable_snapshot(read_file_snapshot_with_reader(&path, |path| {
            calls += 1;
            read_file_sample(path)
        }));

        assert_eq!(calls, 1);
        assert_eq!(result.code, FileResultCode::NotFound);
        assert!(!result.content.is_empty());
    }

    #[test]
    fn snapshot_returns_a_read_failure_immediately_on_either_sample() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("permission-denied.md");
        fs::write(&path, "readable fixture").unwrap();

        for failure_at in [1, 2] {
            let mut calls = 0;
            let result = unavailable_snapshot(read_file_snapshot_with_reader(&path, |path| {
                calls += 1;
                if calls == failure_at {
                    Err(FileResult {
                        code: FileResultCode::PermissionDenied,
                        content: "permission denied after access recovery".to_string(),
                    })
                } else {
                    read_file_sample(path)
                }
            }));

            assert_eq!(calls, failure_at);
            assert_eq!(result.code, FileResultCode::PermissionDenied);
            assert_eq!(result.content, "permission denied after access recovery");
        }
    }

    #[test]
    fn snapshot_supports_hardlinks_and_writes_through_the_observed_alias() {
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("target.md");
        let alias = directory.path().join("alias.md");
        fs::write(&target, "before").unwrap();
        fs::hard_link(&target, &alias).unwrap();

        let (content, revision) = successful_snapshot(read_file_snapshot(&alias));
        assert_eq!(content, "before");
        assert_eq!(revision, get_file_write_revision(&alias).unwrap());
        assert_eq!(
            conditional_write_file(&alias, b"after", &revision)
                .unwrap()
                .status,
            ConditionalWriteStatus::Success
        );
        assert_eq!(fs::read_to_string(&target).unwrap(), "after");
        assert!(paths_refer_to_same_file(&target, &alias));
    }

    #[cfg(unix)]
    #[test]
    fn snapshot_detects_same_content_writes_through_another_hardlink() {
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("target.md");
        let alias = directory.path().join("alias.md");
        fs::write(&target, "same").unwrap();
        fs::hard_link(&target, &alias).unwrap();
        let modified = fs::metadata(&target).unwrap().modified().unwrap();
        let initial_revision = get_file_write_revision(&target).unwrap();
        let mut calls = 0;

        let (content, revision) =
            successful_snapshot(read_file_snapshot_with_reader(&target, |path| {
                calls += 1;
                let mut sample = read_file_sample(path)?.unwrap();
                if calls == 1 {
                    assert_eq!(
                        write_file(alias.to_str().unwrap(), "same").code,
                        FileResultCode::Success
                    );
                    restore_modified(path, modified);
                    sample.metadata = fs::metadata(path).unwrap();
                }
                Ok(Some(sample))
            }));

        assert_eq!(calls, 4);
        assert_eq!(content, "same");
        assert_ne!(revision, initial_revision);
        assert_eq!(revision, get_file_write_revision(&target).unwrap());
    }

    #[cfg(unix)]
    #[test]
    fn snapshot_follows_symlinks_and_its_revision_preserves_the_link_when_saving() {
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("target.md");
        let alias = directory.path().join("symlink.md");
        fs::write(&target, "before").unwrap();
        std::os::unix::fs::symlink(&target, &alias).unwrap();

        let (content, revision) = successful_snapshot(read_file_snapshot(&alias));
        assert_eq!(content, "before");
        assert_eq!(revision, get_file_write_revision(&alias).unwrap());
        assert_eq!(
            conditional_write_file(&alias, b"after", &revision)
                .unwrap()
                .status,
            ConditionalWriteStatus::Success
        );
        assert_eq!(fs::read_link(&alias).unwrap(), target);
        assert_eq!(fs::read_to_string(&target).unwrap(), "after");
    }

    #[cfg(unix)]
    #[test]
    fn snapshot_retries_when_a_symlink_is_retargeted_to_identical_content() {
        let directory = tempfile::tempdir().unwrap();
        let target = directory.path().join("target.md");
        let replacement = directory.path().join("replacement.md");
        let alias = directory.path().join("symlink.md");
        fs::write(&target, "same").unwrap();
        fs::write(&replacement, "same").unwrap();
        let modified = fs::metadata(&target).unwrap().modified().unwrap();
        restore_modified(&replacement, modified);
        std::os::unix::fs::symlink(&target, &alias).unwrap();
        let mut calls = 0;

        let (content, revision) =
            successful_snapshot(read_file_snapshot_with_reader(&alias, |path| {
                calls += 1;
                let mut sample = read_file_sample(path)?.unwrap();
                if calls == 1 {
                    fs::remove_file(path).unwrap();
                    std::os::unix::fs::symlink(&replacement, path).unwrap();
                    sample.metadata = fs::metadata(path).unwrap();
                    sample.generations = file_write_generations(path, &sample.metadata).unwrap();
                }
                Ok(Some(sample))
            }));

        assert_eq!(calls, 4);
        assert_eq!(content, "same");
        assert_eq!(revision, get_file_write_revision(&alias).unwrap());
        assert_eq!(fs::read_link(&alias).unwrap(), replacement);
    }

    fn previous_snapshot(path: &Path) -> (String, String) {
        let before = get_file_write_revision(path).unwrap();
        let content = read_file(path.to_str().unwrap());
        let after = get_file_write_revision(path).unwrap();
        assert_eq!(content.code, FileResultCode::Success);
        assert_eq!(before, after);
        (content.content, after)
    }

    fn timing_statistics(samples: &mut [Duration]) -> (f64, f64) {
        samples.sort_unstable();
        let middle = samples.len() / 2;
        let median = if samples.len() % 2 == 0 {
            (samples[middle - 1].as_secs_f64() + samples[middle].as_secs_f64()) / 2.0
        } else {
            samples[middle].as_secs_f64()
        };
        let p95 = samples[(samples.len() * 95).div_ceil(100) - 1].as_secs_f64();
        (median * 1000.0, p95 * 1000.0)
    }

    #[test]
    #[ignore = "manual warm-cache snapshot benchmark; run with --ignored --nocapture --test-threads=1"]
    fn benchmark_file_snapshot_old_and_new() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("benchmark.md");
        const REPETITIONS: usize = 30;

        println!(
            "snapshot benchmark: warm filesystem cache, debug_assertions={}, repetitions={}, no IPC/editor rendering; read/hash counts are algorithmic counts per stable result",
            cfg!(debug_assertions), REPETITIONS
        );
        for bytes in [100 * 1024_usize, 2 * 1024 * 1024, 10 * 1024 * 1024] {
            let content = "# Snapshot benchmark\nA markdown paragraph with plain UTF-8 text.\n";
            let mut input = content.repeat(bytes.div_ceil(content.len()));
            input.truncate(bytes);
            fs::write(&path, &input).unwrap();
            let expected = previous_snapshot(&path);
            assert_eq!(successful_snapshot(read_file_snapshot(&path)), expected);
            let mut old_samples = Vec::with_capacity(REPETITIONS);
            let mut new_samples = Vec::with_capacity(REPETITIONS);

            // Alternate order to reduce systematic cache/order bias in the same process.
            for iteration in 0..REPETITIONS {
                for use_new in [iteration % 2 == 0, iteration % 2 != 0] {
                    let started = Instant::now();
                    let observed = if use_new {
                        successful_snapshot(read_file_snapshot(&path))
                    } else {
                        previous_snapshot(&path)
                    };
                    let elapsed = started.elapsed();
                    assert_eq!(observed, expected);
                    std::hint::black_box(observed);
                    if use_new {
                        new_samples.push(elapsed);
                    } else {
                        old_samples.push(elapsed);
                    }
                }
            }

            let (old_median, old_p95) = timing_statistics(&mut old_samples);
            let (new_median, new_p95) = timing_statistics(&mut new_samples);
            println!(
                "bytes={bytes} old: reads=3 hashes=2 median_ms={old_median:.3} p95_ms={old_p95:.3}; new: reads=2 hashes=1 comparisons=1 median_ms={new_median:.3} p95_ms={new_p95:.3}; median_change_percent={:.1}",
                (new_median / old_median - 1.0) * 100.0
            );
        }
    }
}
