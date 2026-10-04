# Getting started

Load `zens/esm/styles.css` once in the application entry, then import shared primitives from `zens/esm/components/*`. The CSS is already compiled for consumers: applications do not need to scan zens sources or install Tailwind themselves. CommonJS consumers use the corresponding `zens/lib` paths.

```tsx
import 'zens/esm/styles.css';
import { Button } from 'zens/esm/components/button';
import { Input } from 'zens/esm/components/input';

export function RenameField() {
  return (
    <form>
      <Input aria-label='Document name' />
      <Button type='submit'>Rename</Button>
    </form>
  );
}
```

In MarkFlowy Desktop, use `@/components/ui/button` and neighboring facade modules. Shared packages must import zens directly, never Desktop aliases.

## Styling and themes

Shared utility classes use the `mfc:` prefix and the `mf-components` cascade layer. The package does not enable Tailwind preflight. Desktop's unprefixed `utilities` can override shared presentation through `className`; consumers without Tailwind can use their own CSS classes.

Defaults are supplied by the shared stylesheet. Hosts with custom themes should supply component theme variables through the shared theme provider; the existing `ThemeProvider` adapts legacy tokens and preserves styled-components consumers. Portals retain their owner's component variables, including nested providers.

## Accessible composition

Use the component families' Root/Trigger/Content APIs, an accessible title for dialogs, labels for icon-only controls, and the shared `container` prop for local Portal placement. Use `open`, `defaultOpen`, and `onOpenChange` to control overlays. Radix owns focus, Escape, and outside-interaction handling.

See the [migration guide](migration.md) for changes from the Ariakit APIs.
