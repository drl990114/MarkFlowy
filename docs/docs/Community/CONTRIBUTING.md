# Contributing to MarkFlowy

Welcome, and thank you for your interest in contributing to MarkFlowy!

## How to Contribute Code

### Prerequisites

In order to download necessary tools, clone the repository, and install dependencies via yarn, you need network access.

You'll need the following tools:

- [Git](https://git-scm.com/)
- [Node.JS](https://nodejs.org/en) >= 18.x
- [yarn](https://yarnpkg.com/) 4.0.0
- [rust](https://www.rust-lang.org/) >= 1.75.0

### Steps

#### Fork

Fork [MarkFlowy](https://github.com/drl990114/MarkFlowy) and `git clone`

#### Dependency installation

Execute the following command to install related dependencies.

```bash
yarn install
```

and

```bash
cargo install --path apps/desktop/src-tauri
```

#### Startup MarkFlowy

Execute the following command, you will start MarkFlowy.

```bash
yarn dev:desktop
```

# Thank You!

Your contributions to open source, large or small, make the project better. Thank you for taking the time to contribute.
