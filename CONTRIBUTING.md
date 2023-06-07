# Contributing to LineByLine

Welcome, and thank you for your interest in contributing to LineByLine!

## How to Contribute Code

### Prerequisites
In order to download necessary tools, clone the repository, and install dependencies via pnpm, you need network access.

You'll need the following tools:

- [Git](https://git-scm.com/)
- [Node.JS](https://nodejs.org/en)
- [pnpm](https://pnpm.io/)
- [rust](https://www.rust-lang.org/)

### Steps

#### Fork
Fork [LineByLine](https://github.com/linebyline-group/linebyline) and `git clone`


#### Dependency installation
Execute the following command to install related dependencies.

```bash
pnpm install
```
and

```bash
cargo install --path ./src-tauri
```

#### Startup LineByLine
Execute the following command, you will start LineByLine.
```bash
pnpm tauri:dev
```

# Thank You!

Your contributions to open source, large or small, make the project better. Thank you for taking the time to contribute.