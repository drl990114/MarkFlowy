# Migrating Zens to shared Radix components

The package name and its `lib`/`esm` JavaScript and declaration directories are retained. This migration changes interaction APIs and adds an explicit stylesheet import; retaining the package name does not make all old APIs compatible.

## Imports and ownership

Generic primitives now live in `packages/zens/src/components`. Desktop `components/ui/*` modules forward those implementations, preserving application import paths. Shared `interface` and `rme` components import zens directly and have no dependency on Desktop's facade or Tailwind scan.

Import `zens/esm/styles.css` once at your host entry (`zens/lib/styles.css` for CommonJS). Independent `rme` and `@markflowy/interface` hosts can import `rme/styles.css` or `@markflowy/interface/styles.css`; these entries include the shared component stylesheet. Keep any existing editor content styles as well, and avoid importing the same shared stylesheet twice. CSS is included in published `lib` and `esm` outputs and marked as a package side effect so bundlers retain it.

## Overlay and toolbar APIs

The `Ariakit` namespace, `useMenuStore`, `PopoverStore`, and other Ariakit-specific types are no longer public APIs. Replace store ownership with `open`/`defaultOpen`/`onOpenChange` props on shared Radix roots. Compose Trigger and Content where an interactive anchor is available; use the retained menu adapter for data-driven items. Use the exported component props instead of upstream Ariakit types.

Shared overlay content accepts an optional Portal `container`. Let the primitive handle focus restoration, Escape, and outside interaction. Toolbar buttons retain keyboard navigation through Radix Toolbar; editor commands must preserve their existing document selection and focus behavior.

The root-level convenience adapters retain their purpose: image loading and fallback, input compatibility, data-driven menus, spacing, and Sonner notifications. Use the lower-level `components/*` modules for new compound composition. Sonner loading identifiers, dismiss operations, and notification actions remain supported.

## Styles and themes

Shared classes are prefixed with `mfc:` and emitted in the `mf-components` layer, without preflight. The layer order is `theme`, `base`, `components`, `mf-components`, then `utilities`; Desktop resets precede shared components and its unprefixed utilities can override them. Use the appropriate class-merging helper for each prefix; do not run prefixed and unprefixed utility names through a single configuration.

Shared semantic variables have stylesheet fallbacks and can be supplied by a theme provider. The legacy `ThemeProvider` bridges existing tokens and styled-components subtrees; the component theme context carries variables into Portals so nested editors keep their own theme. Global host styles are no longer a prerequisite for a shared component to be styled.

## Development tools

The dumi documentation server, site deployment, LESS compilation, demo generator, and commit/release scaffolding have been removed. Keep examples in Markdown and verify component behavior with tests. `zens dev` now watches JavaScript, stylesheet, and declaration outputs; `dev:desktop` includes it and requires a readiness marker from that watcher session after all three output tasks succeed. Old markers and partially written output cannot satisfy startup. Babel still emits CommonJS and ESM with the automatic React JSX runtime, and TypeScript emits declarations for both.

No package exports restriction was added, so existing `lib` and `esm` deep imports remain resolvable when the referenced module is retained. Direct imports of removed Ariakit implementation files or documentation/demo code must be migrated.
