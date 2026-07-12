# MarkFlowy Collaboration Guide

This file applies to the entire repository. If a subdirectory contains a more specific `AGENTS.md`, follow the more specific rules for that subtree.

## Before You Start

- First use `rg` to search for similar implementations and inspect the target workspace's `package.json`. Then review the official implementation and current version of the relevant open-source project. Prefer reusing existing capabilities.
- A user's proposed technical approach is not automatically the final decision. Before implementation, explain the main benefits, costs, and reasons for the recommended approach. If the proposal conflicts with existing boundaries, point out the conflict and choose the lower-impact implementation.
- Do not add a new dependency for a capability the repository already provides. Desktop already includes `radix-ui`, a shadcn-style facade, Tailwind, CVA, and Lucide; new Dialogs, Buttons, and similar components do not require another UI or overlay library.
- When referencing upstream source code such as shadcn, adapt it to this repository's theme, APIs, and dependency conventions. Do not blindly run a CLI that overwrites local components.

## Repository and Package Boundaries

- `apps/desktop`: the React/Vite/Tauri desktop application. Keep Desktop-specific interactions and styles here.
- `apps/desktop/src/components/ui`: the facade for shared Desktop UI primitives. It should contain only generic presentation and interaction behavior and must not depend on business stores, i18n, Tauri services, or a specific feature.
- `apps/desktop/src/components`: reusable Desktop composite components shared across features. Keep feature-private components close to their corresponding `router`, `extensions`, or other feature directory.
- `packages/interface`: components and interfaces that genuinely need to be reused across applications. It must not import `@/...`, the Desktop UI facade, or Tauri APIs, and it must not depend on Desktop's Tailwind content scanning.
- `packages/zens`: the existing shared UI library. Ariakit and styled-components are internal implementation details of this package. Desktop may maintain existing usages, but new Desktop UI must not use zens Button or Dialog as its foundation.
- `packages/theme`: the source of shared themes and legacy styled tokens. Do not move application styles here for a single Desktop component.
- Do not directly edit build outputs such as `dist`, `lib`, `esm`, or generated declarations.

## UI and Styling Choices

Choose in the following order:

1. When adding a shared Desktop primitive, use or extend the shadcn/Radix facade in `apps/desktop/src/components/ui`. Business code must import from `@/components/ui/*` instead of assembling Radix primitives directly.
2. Prefer Tailwind for new Desktop components and local styles. Use CVA for variants, `@/lib/cn` for class-name merging, and follow neighboring components' `data-slot` naming conventions.
3. Use styled-components only to maintain existing styled layouts, legacy complex styles that depend heavily on `props.theme`, or third-party components without a suitable `className` API. Do not use it to create new foundational primitives such as Button, Dialog, or Input, and do not opportunistically rewrite untouched legacy pages.
4. Use plain CSS for global contracts, fonts, keyframes, scrollbars, browser or Tauri behavior, third-party class selectors, or state styles that span multiple React trees. Keep local CSS with its feature. Namespace new first-party global classes with `mf-`; third-party integrations and existing features should retain their established namespace, such as `aui-`, while avoiding global pollution. Do not recreate existing UI primitives with plain CSS.
5. Use Ariakit only when maintaining or extending `packages/zens`. New Desktop primitives must use Radix. Do not mix Ariakit and Radix focus, Portal, or dismiss mechanisms within the same primitive.

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
- Tailwind tokens are defined in `apps/desktop/src/ui.css`. The active theme is mapped to `--mf-*` variables by `DesktopSpecificStyles` in `apps/desktop/src/globalStyles.ts`.
- When adding a semantic token, provide both a `:root` fallback in `ui.css` and a runtime mapping in `DesktopSpecificStyles`. If a semantic utility must be generated, also add an `@theme inline` mapping.
- Dark mode is driven by `data-mf-theme`. Prefer semantic tokens that adapt automatically; do not add a parallel `.dark` or `prefers-color-scheme` theme system.
- `ui.css` deliberately does not enable Tailwind preflight, protecting legacy and editor styles. Do not add a global Tailwind reset, `@tailwind base`, or `@import "tailwindcss"`.

## Portals, Layering, and Accessibility

- Radix overlays must use the corresponding `Portal`, which mounts to `document.body` by default. Pass a `container` when local mounting is required. Do not hand-write `createPortal` in place of an existing primitive.
- A Portal does not produce its own DOM node. The rendered Overlay or Content must include `data-slot`, and primary overlay nodes must include `data-mf-portal` so Desktop's scoped reset, font, and `box-sizing` rules apply.
- Preserve the existing layering order: Dialog sits below Select and Popover (`z-index: 1000`), and Tooltip is highest (`z-index: 1001`). Do not add arbitrary higher z-index values in business components.
- Every Dialog must have an accessible Title and, when explanatory text is needed, a Description. Icon-only buttons must have an accessible name, and decorative icons must use `aria-hidden`.
- Preserve a visible keyboard focus indicator. Leave focus trapping, Escape handling, outside interaction, and focus restoration after close to Radix. Do not implement separate keyboard or dismiss behavior without a confirmed gap.

## Validation

- Decide whether a build is necessary from the nature and scope of the change. In the final handoff, state which validation commands were run and why a build was required or skipped.
- When a change can affect compiled output, runtime behavior, public APIs, dependencies, or build configuration, run the narrowest build that fully covers the affected workspaces and their dependents. Use `yarn build` from the repository root for cross-workspace or broadly scoped changes; an isolated workspace may use its own `build` script when that fully covers the impact.
- For Desktop changes, also run `yarn workspace @markflowy/desktop build:types`, which executes `tsc --noEmit`.
- Lint only the `.ts` and `.tsx` files changed in the current task, without `--fix`. Until the root ESLint 9 setup and legacy `.eslintrc`/parser configuration are migrated to flat config, use the installed and verified ESLint 8 runner:
  `node node_modules/@umijs/fabric/node_modules/eslint/bin/eslint.js <changed-files...>`
- Do not use the root `yarn lint` command for validation because it runs with `--fix` and scans too broadly.
- Documentation-only changes and translation-only i18n content changes do not require a build. Inspect the diff and Markdown for documentation changes; run `yarn translate:check` for i18n content changes. If an i18n change also touches runtime loading, locale schemas, code generation, or build configuration, follow the build rule above.

## Prohibited Actions

- Do not add another UI, Dialog, Popover, or focus-trap library for an existing capability.
- Do not import `@ariakit/react` directly in Desktop business components or bypass the facade to assemble Radix primitives directly.
- Do not use a new zens Button or Dialog as the foundation of a new Desktop interface.
- Do not place Desktop Tailwind or shadcn implementations in `packages/interface`.
- Do not add Tailwind preflight, unscoped global CSS, hard-coded theme colors, or arbitrary z-index values.
- Do not edit generated outputs, skip a necessary build for changes that can affect build or runtime output, or use lint `--fix` in a way that produces unrelated changes.
