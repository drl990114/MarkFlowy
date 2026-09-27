# V1 dependency follow-up — 2026-09-27

This records local fixes on `v1`, following the [September 22 audit](security-audit-2026-09-22.md). It does not imply that GitHub alerts have closed or that a release has shipped.

## SVG selector denial of service

The `html2sketch → svgo-browser` dependency now resolves `css-select 5.2.2`, which uses the patched `nth-check 2.1.1`. The old `nth-check 1.0.2` is no longer in the lockfile or installed dependency graph. The SVGO AST adapter is preserved. Its source patch changes the old callable CommonJS import to the supported `selectAll` API; `selectOne` and `is` retain their behavior. This is applied by the existing `patch-package` postinstall step.

Validation:

- `yarn postinstall`: the source patch applies successfully.
- `yarn test:security-dependencies`: 12 tests pass, including SVG AST selectors, actual html2sketch SVG optimization, and rejection of a malformed nth expression with 100,000 spaces in a child process limited to three seconds.
- `yarn why nth-check`: every installed consumer resolves `2.1.1`.
- `yarn npm audit --all --recursive --json`: six remaining npm advisories (one high, four moderate, one low), down from seven. Deprecation notices are excluded. The audit still exits nonzero because those advisories remain.

The remaining npm advisories concern OpenTelemetry Jaeger propagation, OpenTelemetry Core baggage propagation, decode-uri-component, two React Router 6 issues in the documentation toolchain, and elliptic. The previously reported Rust glib advisory has not been re-audited in this step.

No application build, document-site bundle, native UI acceptance, or publication was performed. The [nth-check advisory](https://github.com/advisories/GHSA-rp65-9cf3-cjxr) and [css-select API](https://github.com/fb55/css-select/tree/v5.2.2) explain the security fix and caller adaptation.

## Jaeger malformed-header crash

Contentlayer's existing tracing SDK now resolves `@opentelemetry/propagator-jaeger 2.11.0`. This leaf dependency uses the same stable OpenTelemetry propagation API, so the SDK and Contentlayer's Resource API are preserved. Its own Core 2 dependency is separate from the SDK's Core 1 dependency; the latter's baggage advisory remains.

Validation:

- `yarn test:security-dependencies`: 13 tests pass. An isolated process registers Contentlayer's actual tracing SDK with `OTEL_PROPAGATORS=jaeger`, round-trips trace context and encoded baggage, checks trace suppression, and completes a child span. Malformed percent encoding is tested directly against the Jaeger propagator as well as through the SDK.
- `yarn workspace @markflowy/web build:types`: passes (`tsc --noEmit`).
- The refreshed npm audit reports five advisories: four moderate and one low. Neither Jaeger nor nth-check remains in the advisory list. The command still exits nonzero for the remaining advisories.

This fixes [GHSA-45rx-2jwx-cxfr](https://github.com/advisories/GHSA-45rx-2jwx-cxfr), including the opt-in Jaeger path. It does not assert that the default W3C propagator was exposed to the Jaeger-specific crash. No build was run.
