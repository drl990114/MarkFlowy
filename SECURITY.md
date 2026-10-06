# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |

## Reporting a Vulnerability

People are welcomed to report a vulnerability by PR or Issues.

Vulnerability will be fixed and publish in shorter time.

## Dependency maintenance

Keep dependency overrides scoped to their existing callers. The Jaeger propagator pin preserves Contentlayer's tracing SDK, UUID 11 preserves CommonJS callers, and the Undici and TOML pins retain the existing APIs. Reassess these overrides when upgrading parent packages. Run `yarn test:security-dependencies` after changing overrides or dependency patches; this regression suite also runs in CI.

Historical audits left follow-ups for Contentlayer's OpenTelemetry Core 1 and the Linux GTK dependency on glib 0.18.5. These versions remain in the local lockfiles. Review them through compatible parent upgrades rather than forcing major versions across SDK or GTK types. Recheck advisory status during that work; this note is not a current remote vulnerability audit.
