---
seoTitle: "Large Markdown documents in MarkFlowy"
description: "Understand the reported 2 MB opening test, its evidence limits, and how to compare large Markdown files in MarkFlowy Desktop."
updatedAt: "2026-09-06"
---

# Large Markdown documents in MarkFlowy

MarkFlowy focuses on responsive editing of large Markdown files. Its v0.100.0 release notes report that **a 2 MB Markdown file opened in around 1 second in testing**. This page explains that observation and how to evaluate your own files; it is not a new benchmark report or a comparison ranking.

Evidence reviewed on September 6, 2026.

## What has been reported?

| Item | Available information |
| --- | --- |
| Source | [v0.100.0 release notes](https://github.com/drl990114/MarkFlowy/releases/tag/v0.100.0) |
| Document size | Reported as 2 MB |
| Opening time | Around 1 second in testing |
| Context | Editor rewrite in v0.100.0; some editing behaviors changed |
| Hardware, operating system, file contents and checksum | Not specified in the release note |
| Cold/warm state, sample count, P50/P95 and raw samples | Not specified in the release note |

This is not a one-second guarantee, a P95 result, or proof of identical performance on every operating system. New releases may behave differently, so record the version when checking performance.

## Why file size alone is not enough

Similarly sized Markdown files can contain very different structures: long paragraphs, many short blocks, tables, code fences, images, or diagrams. First opening also differs from reopening after modules are loaded or switching to an existing tab.

Choose files that resemble your work. Keep source and visual editing results separate, and record external images or diagrams. Compare the same files, editing mode, machine, and application state.

## Compare your own files

1. Download a desktop release and record its version, operating system, CPU, memory, and editing mode.
2. Record file size and structure. Keep a checksum or reproducible fixture when you can share one.
3. Measure first opening, repeated opening, and switching to an existing tab separately. Define the end point as the document becoming visible and editable.
4. Try the first keystroke, scrolling, and a representative selection or copy action. Opening time alone does not describe the full editing experience.
5. Repeat each scenario at least 30 times if publishing a distribution. Keep slow and failed samples, report sample counts and P50/P95, and share raw measurements.

A recording can provide an informal observation. Precise results need consistent instrumentation and a description of what starts and ends each measurement. Do not mix manual and instrumented timings in one distribution.

## Keep AI timing separate

AI requests include model loading, network time when applicable, and generation. Record provider, model, and context size. A slower model response does not on its own demonstrate slower editor opening or typing.

See the [introduction](../intro) and [Ollama guide](../Extension/UseCopilotWithOllama). If a file is slow, [report an issue](https://github.com/drl990114/MarkFlowy/issues) with the version, environment, scenario, and a shareable example.
