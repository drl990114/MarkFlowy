---
seoTitle: "Contribute to MarkFlowy"
description: "Set up the MarkFlowy development environment and learn how to contribute changes to the project."
updatedAt: "2026-09-27"
---

# Contributing to MarkFlowy

Welcome, and thank you for your interest in contributing to MarkFlowy!

## How to Contribute Code

### Prerequisites

In order to download necessary tools, clone the repository, and install dependencies via yarn, you need network access.

You'll need the following tools:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/en) 24, as declared in `.node-version`.
- [Yarn](https://yarnpkg.com/) 4.8.0, selected by the root `packageManager` field through Corepack.
- [Rust](https://www.rust-lang.org/) 1.96, selected by `rust-toolchain.toml` through rustup.
- The [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system.

### Table of Contents

- [Contributing to MarkFlowy](#contributing-to-markflowy)
  - [How to Contribute Code](#how-to-contribute-code)
    - [Prerequisites](#prerequisites)
    - [Table of Contents](#table-of-contents)
    - [Contribute multilingual translations steps](#contribute-multilingual-translations-steps)
      - [Fork](#fork)
      - [Translation file](#translation-file)
    - [Development work steps](#development-work-steps)
      - [Fork](#fork-1)
      - [Dependency installation](#dependency-installation)
      - [Startup MarkFlowy](#startup-markflowy)
- [Thank You!](#thank-you)

### Contribute multilingual translations steps

For some users who don't want to go through the complicated project startup steps and just want to participate in the translation work, you can check the following steps.

#### Fork

Fork [MarkFlowy](https://github.com/drl990114/MarkFlowy) and `git clone`

#### Translation file

##### Add a new language

Desktop translations live in the root `locales` directory; shared editor translations are in `locales/editor`, and website translations in `locales/web`. Start from the English resource for the relevant surface. A new language also needs registration in that surface's locale list. Run `yarn translate:check` after editing translations; this check does not require the private runtime.

##### Modify an existing language

Modifying the existing language may not be particularly easy to find the corresponding key. If you do not find it in the locales file, you can mention the issue, and I will help you find the corresponding place to modify.

### Development work steps

#### Fork

Fork [MarkFlowy](https://github.com/drl990114/MarkFlowy) and `git clone`

#### Dependency installation

Execute the following command to install related dependencies.

```bash
corepack enable
yarn install --immutable
```

No GitHub Packages token is needed for the public dependency install. Keep the tracked lockfile and the dependency source patches applied by `postinstall`.

#### Startup MarkFlowy

Prepare Desktop's workspace dependencies once, then start the development runner:

```bash
yarn turbo run build --filter='@markflowy/desktop^...' --concurrency=2
yarn dev:desktop
```

The runner checks the Rust toolchain, starts dependency watchers, waits for their outputs and launches Tauri. It compiles development code; the commands above are setup instructions, not evidence that a native build has been validated for a particular change. You do not need `cargo install` to launch this checkout.

### Public checkout and private editor runtime

Capricorn is currently not open source. Its source repository and runtime package are private and are not included in MarkFlowy's public repository. The public checkout supports Markdown source and reading modes without Capricorn. Live editing requires the private package `@drl990114/capricorn-runtime`, whose manifest is marked `UNLICENSED`. RME and its ProseMirror/CodeMirror integration remain in `packages/editor`.

Maintainers with package access can provide `GITHUB_PACKAGES_TOKEN` or `NODE_AUTH_TOKEN` through their local environment or ignored root `.env`, then run:

```bash
yarn install:capricorn-runtime
```

The installer uses the exact version and tarball SHA-256 pinned in `scripts/install-capricorn-runtime.mjs`, writes to the ignored `.private-runtime` directory, and validates package identity. Restart the development server after installation. Do not commit tokens, runtime files or generated declarations. Fork pull requests do not receive the private package credential.

### Validation before a pull request

Public contributors can run focused tests for the changed behavior and Desktop's `build:types` script (`tsc --noEmit`, covering both `src` and `tests`) without access to Capricorn. RME still powers source mode, preview and export, so its tests remain in `packages/editor`.

Maintainers with access to the private runtime run `test:capricorn-published` to check MarkFlowy's integration with the pinned package. This suite and the regular `test` suite are disjoint; CI runs each once, and the runtime suite remains a required release gate. A public checkout's fallback cannot establish parity with the private runtime.

`test:capricorn-source` is for maintainers who also have access to Capricorn's private source repository and a local checkout. Package access alone does not grant source access. It runs the same host contracts against that checkout for local integration work. Editor-internal regressions are maintained and tested in Capricorn's private repository; public contributors do not need to obtain its source or run these private checks themselves.

```bash
yarn workspace @markflowy/desktop build:types
yarn workspace @markflowy/desktop test <path-to-test>
# Maintainers with private package access and the pinned runtime installed:
yarn workspace @markflowy/desktop test:capricorn-published
```

For changed TypeScript files, use the existing ESLint 8 runner without `--fix`:

```bash
node node_modules/@umijs/fabric/node_modules/eslint/bin/eslint.js \
  --resolve-plugins-relative-to node_modules/@umijs/fabric <changed-files>
```

Run affected Rust unit tests when native code changes. Record which checks passed and which native scenarios were not exercised; unit tests do not verify OS input methods, installer signing or upgrade behavior.

## How to Submit Themes to the Theme Store

MarkFlowy has a built-in theme store feature where users can browse, download, and install community-created themes. If you want to submit your own theme to the theme store for other users, please refer to the "Sharing Your Theme" section in the [Custom Theme Documentation](https://www.markflowy.cc/docs/Extension/CustomTheme), which details the complete process for theme creation and submission to the theme store.

# Thank You!

Your contributions to open source, large or small, make the project better. Thank you for taking the time to contribute.
