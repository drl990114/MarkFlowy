// fc::format_file_write_revision appends process-local write counters to its
// disk fingerprint. Those counters still protect live CAS writes, but reset on
// restart and cannot be part of a persisted draft's disk baseline.
const existingRevision = /^(existing:(?:\d+:\d+:)?\d+:\d+:sha256:[a-f0-9]{64})(?::path-generation:\d+:file-generation:\d+)?$/

/** For draft storage/recovery only. Never use this value for a conditional write. */
export function persistentDiskRevision(revision: string | undefined): string | undefined {
  // Accept both legacy full tokens and new stable baselines. Preserve unknown
  // formats verbatim so a future revision format cannot silently lose fields.
  return revision === undefined ? undefined : existingRevision.exec(revision)?.[1] ?? revision
}
