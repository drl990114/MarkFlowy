# Contributing to MarkFlowy

Welcome, and thank you for your interest in contributing to MarkFlowy!

## How to Contribute Code

### Prerequisites

In order to download necessary tools, clone the repository, and install dependencies via yarn, you need network access.

You'll need the following tools:

- [Git](https://git-scm.com/)
- [Node.JS](https://nodejs.org/en) >= 20.x
- [yarn](https://yarnpkg.com/) >= 4.0.0
- [rust](https://www.rust-lang.org/) >= 1.79.0

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

In order to facilitate everyone's participation, the translation file path is placed in locales in the project root directory. If you want to add a new language, you can directly refer to the en.json file for translation.

### Development work steps

#### Fork

Fork [MarkFlowy](https://github.com/drl990114/MarkFlowy) and `git clone`

#### Dependency installation

Execute the following command to install related dependencies.

```bash
yarn install --immutable

cargo install --locked --path apps/desktop/src-tauri
```

#### Startup MarkFlowy

Note: that before the first startup, it is necessary to execute `yarn build` to compile the packages for the workspace.

Execute the following command, you will start MarkFlowy.

```bash
yarn dev:desktop
```

# Thank You!

Your contributions to open source, large or small, make the project better. Thank you for taking the time to contribute.
