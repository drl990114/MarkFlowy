# Zens

MarkFlowy's shared React 19 components, implemented with Radix primitives and Tailwind CSS. Generic implementations live in `src/components`; Desktop exposes them through its `components/ui` facade. The package has no application, Tauri, or host Tailwind configuration dependency.

Import the stylesheet once at your application entry:

```tsx
import 'zens/esm/styles.css';
import { Button } from 'zens/esm/components/button';

export function Example() {
  return <Button variant='outline'>Open document</Button>;
}
```

CJS consumers can use the matching `zens/lib/components/*` and `zens/lib/styles.css` paths. Existing root exports retain convenience adapters for menus, images, inputs, spacing, themes, and notifications. Ariakit exports and stores have been removed; see the [migration guide](docs/migration.md).

- [Getting started](docs/getting-started.md)
- [Component and theme migration](docs/migration.md)

## Development

Use Node 24 and the repository's Yarn installation. `yarn workspace zens dev` watches JavaScript, CSS, and declarations in both `lib` and `esm`. Desktop's `yarn dev:desktop` includes this watcher and waits for the current watcher session to finish writing JavaScript, CSS, and declarations before starting Tauri. Documentation is maintained as Markdown; there is no separate documentation server.

- `yarn workspace zens typecheck`: check source types without emitting output.
- `yarn workspace zens test --runInBand`: run component tests.
- `yarn workspace zens build:types`: emit CJS/ESM declarations when producing a package.
- `yarn workspace zens build`: produce the package for publishing, including its CSS.

For this migration, validation is limited to TypeScript, unit tests, and changed-file lint as requested; the build scripts are retained for normal package production but are not a claimed verification result.
