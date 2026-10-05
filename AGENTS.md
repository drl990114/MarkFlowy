# MarkFlowy Collaboration Guide

This file applies to the entire repository. If a subdirectory contains a more specific `AGENTS.md`, follow the more specific rules for that subtree.

## Before You Start

- First use `rg` to search for similar implementations and inspect the target workspace's `package.json`. Then review the official implementation and current version of the relevant open-source project. Prefer reusing existing capabilities.
- A user's proposed technical approach is not automatically the final decision. Before implementation, explain the main benefits, costs, and reasons for the recommended approach. If the proposal conflicts with existing boundaries, point out the conflict and choose the lower-impact implementation.
- Do not add a new dependency for a capability the repository already provides. Desktop already includes `radix-ui`, a shadcn-style facade, Tailwind, CVA, and Lucide; new Dialogs, Buttons, and similar components do not require another UI or overlay library.
- When referencing upstream source code such as shadcn, adapt it to this repository's theme, APIs, and dependency conventions. Do not blindly run a CLI that overwrites local components.

## Repository and Package Boundaries

- `apps/desktop`: the React/Vite/Tauri desktop application. Keep Desktop-specific interactions and styles here.
- `apps/desktop/src/components/ui`: the Desktop import facade for shared primitives implemented in `packages/zens/src/components`. Re-export or thinly adapt the shared implementation; do not duplicate it. The facade must not depend on business stores, i18n, Tauri services, or a specific feature.
- `apps/desktop/src/components`: reusable Desktop composite components shared across features. Keep feature-private components close to their corresponding `router`, `extensions`, or other feature directory.
- `packages/interface`: components and interfaces that genuinely need to be reused across applications. It must not import `@/...`, the Desktop UI facade, or Tauri APIs, and it must not depend on Desktop's Tailwind content scanning.
- `packages/zens`: the shared Radix + Tailwind component library. Generic primitives belong in `src/components`; retained convenience adapters live beside them. It must not depend on Desktop aliases, stores, i18n, Tauri, or host Tailwind scanning. Keep styled-components only for the legacy theme bridge.
- `packages/theme`: the source of shared themes and legacy styled tokens. Do not move application styles here for a single Desktop component.
- Do not directly edit build outputs such as `dist`, `lib`, `esm`, or generated declarations.

## UI and Styling Choices

Choose in the following order:

1. Implement shared primitives in `packages/zens/src/components` using the existing Radix conventions, then expose them through `apps/desktop/src/components/ui`. Desktop business code must import from `@/components/ui/*` instead of assembling Radix primitives directly; other workspaces may import the shared zens components.
2. Prefer Tailwind for new components and local styles. Use CVA for variants and follow neighboring components' `data-slot` naming conventions. Shared zens classes use the `mfc:` prefix and its local class-merging helper; Desktop classes remain unprefixed and use `@/lib/cn`.
3. Use styled-components only to maintain existing styled layouts, legacy complex styles that depend heavily on `props.theme`, or third-party components without a suitable `className` API. Do not use it to create new foundational primitives such as Button, Dialog, or Input, and do not opportunistically rewrite untouched legacy pages.
4. Use plain CSS for global contracts, fonts, keyframes, scrollbars, browser or Tauri behavior, third-party class selectors, or state styles that span multiple React trees. Keep local CSS with its feature. Namespace new first-party global classes with `mf-`; third-party integrations and existing features should retain their established namespace, such as `aui-`, while avoiding global pollution. Do not recreate existing UI primitives with plain CSS.
5. Use Radix for primitive interaction, focus, Portals, and dismissal. Do not reintroduce Ariakit or a parallel focus/dismiss implementation.

Keep migrations scoped to the code being touched. A component currently being reworked may be fully migrated to the new facade, but unrelated pages must not be migrated as a side effect.

## Component and API Conventions

- UI primitives should extend native or Radix props and support `className`. Content components that use a Portal should also support an optional `container`.
- At the primitive layer, follow the Radix conventions for `open`, `defaultOpen`, and `onOpenChange`. Keep business semantics such as `onClose` and `onResolve` in composite components or the service layer.
- Prefer compound APIs such as `Root`, `Content`, `Header`, and `Footer` for multipart components, allowing the business layer to compose them. Do not cover every layout by continually adding boolean props.
- The project uses React 19. New components should accept `ref` directly as a prop. Do not add a `forwardRef` wrapper unless compatibility with a legacy third-party API requires it.
- Button defaults must use `type='button'`. Use the destructive variant for dangerous actions and existing outline or ghost variants for secondary actions. Do not invent button visuals in business code.
- Prefer composing existing primitives instead of copying a feature-private Button, Dialog, Tooltip, or Popover.
- Explicitly export public types and avoid `any`. Before changing a shared API, inspect all callers across workspaces.

## Theme and Tailwind

- Use semantic classes and tokens such as `bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-muted-foreground`, and `bg-destructive`. Do not copy shadcn's default neutral or slate colors, and do not hard-code light, dark, or brand colors.
- Shared Tailwind tokens and fallback variables are defined in `packages/zens/src/styles.css`; the package emits its own `esm/styles.css` and `lib/styles.css`. Load shared CSS once at each host entry. Shared rules use the `mf-components` layer so host `utilities` can override them. Desktop tokens remain in `apps/desktop/src/ui.css`, with the active theme mapped to `--mf-*` variables by `DesktopSpecificStyles` in `apps/desktop/src/globalStyles.ts`.
- When adding a shared semantic token, update the zens CSS fallback, `@theme inline` mapping, and component theme adapter. For a Desktop-specific token, provide both a `:root` fallback in `ui.css` and a runtime mapping in `DesktopSpecificStyles`. Keep Portal theme variables scoped to their owning provider, including nested editor instances.
- Dark mode is driven by `data-mf-theme`. Prefer semantic tokens that adapt automatically; do not add a parallel `.dark` or `prefers-color-scheme` theme system.
- Both shared CSS and Desktop `ui.css` deliberately disable Tailwind preflight, protecting legacy and editor styles. Do not add a global Tailwind reset, `@tailwind base`, or `@import "tailwindcss"`. Shared CSS must explicitly scan zens sources instead of depending on host source scanning.

## Portals, Layering, and Accessibility

- Radix overlays must use the corresponding `Portal`, which mounts to `document.body` by default. Pass a `container` when local mounting is required. Do not hand-write `createPortal` in place of an existing primitive.
- A Portal does not produce its own DOM node. The rendered Overlay or Content must include `data-slot`, and primary overlay nodes must include `data-mf-portal` so Desktop's scoped reset, font, and `box-sizing` rules apply.
- Preserve the existing layering order: Dialog sits below Select and Popover (`z-index: 1000`), and Tooltip is highest (`z-index: 1001`). Do not add arbitrary higher z-index values in business components.
- Every Dialog must have an accessible Title and, when explanatory text is needed, a Description. Icon-only buttons must have an accessible name, and decorative icons must use `aria-hidden`.
- Preserve a visible keyboard focus indicator. Leave focus trapping, Escape handling, outside interaction, and focus restoration after close to Radix. Do not implement separate keyboard or dismiss behavior without a confirmed gap.

## Validation

- Follow the user's validation limit: run TypeScript checks, relevant unit tests, and lint only; do not run builds unless the user explicitly changes that instruction. Report the commands and keep generated-output or native-runtime behavior unverified when those checks do not cover it.
- For Desktop changes, also run `yarn workspace @markflowy/desktop build:types`, which executes `tsc --noEmit`.
- Lint only the `.ts` and `.tsx` files changed in the current task, without `--fix`. Until the root ESLint 9 setup and legacy `.eslintrc`/parser configuration are migrated to flat config, use the installed and verified ESLint 8 runner:
  `node node_modules/@umijs/fabric/node_modules/eslint/bin/eslint.js --resolve-plugins-relative-to node_modules/@umijs/fabric <changed-files...>`
- Do not use the root `yarn lint` command for validation because it runs with `--fix` and scans too broadly.
- Documentation-only changes and translation-only i18n content changes do not require a build. Inspect the diff and Markdown for documentation changes; run `yarn translate:check` for i18n content changes. If an i18n change also touches runtime loading, locale schemas, code generation, or build configuration, run the affected TypeScript checks and unit tests as well.

## Prohibited Actions

- Do not add another UI, Dialog, Popover, or focus-trap library for an existing capability.
- Do not import `@ariakit/react` directly in Desktop business components or bypass the facade to assemble Radix primitives directly.
- Do not duplicate shared zens primitive implementations in Desktop or feature packages.
- Do not place Desktop Tailwind or shadcn implementations in `packages/interface`.
- Do not add Tailwind preflight, unscoped global CSS, hard-coded theme colors, or arbitrary z-index values.
- Do not edit generated outputs or use lint `--fix` in a way that produces unrelated changes.
