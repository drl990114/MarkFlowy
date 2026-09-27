# Desktop release process

The tag, `apps/desktop/src-tauri/tauri.conf.json` version, and the Desktop Cargo package version must match exactly. Add a nonempty `## v<version>` section to `apps/desktop/UPDATE_LOG.md`, with English followed by Chinese. A prerelease uses a version such as `1.0.0-rc.1` in both manifests and tag `v1.0.0-rc.1`.

Pushing a release tag starts the shared quality workflow before packaging. It checks workspace builds, application types, unit tests, the pinned published Capricorn runtime, Rust tests, translations, dependency regressions, release contracts, and freshly generated public documents. Local review can run the type checks and focused tests without building the applications.

The release job then:

1. Refuses to change an already published release for that tag.
2. Collects all macOS, Windows, Linux, portable, and offline installer artifacts.
3. Generates `install.json` from those exact files and the current tag. Missing, empty, or symlink artifacts and malformed Tauri signature envelopes fail the job. Legacy updater target names remain available.
4. Generates `SHA256SUMS` for the installers, signatures, and update manifest.
5. Uploads the complete set to a draft, then compares every uploaded asset's GitHub SHA-256 digest against the local inventory. Missing, extra, or mismatched assets keep the release unpublished.
6. Publishes the verified draft. Only a stable release which GitHub identifies as the latest release can update the GitHub Pages updater fallback. RCs keep their own downloadable manifest and do not enter the stable update channel.

Validate the release scripts locally with `yarn test:release-workflows`. Given the renamed artifacts from the workflow, metadata can be prepared without a GitHub token or network requests:

```sh
yarn updater --tag v1.0.0-rc.1 --repository drl990114/MarkFlowy --artifacts /path/to/artifacts
```

This writes `install.json` and `SHA256SUMS` inside the artifact directory and `release-notes.md` in the working directory. It does not upload or publish. `verify-release-assets.mjs` uses `GH_TOKEN`, `GITHUB_REPOSITORY`, and `GITHUB_REF_NAME` to check the draft remotely; it also never publishes by itself.

These checks establish artifact completeness and upload integrity. Signature envelope validation is not cryptographic verification; Tauri verifies each update against the configured public key before installation. A local script test does not prove a packaged-app upgrade, macOS notarization, Windows signing, or native behavior. Run and record those acceptance checks on the actual RC before declaring V1.0 ready.

If uploading or verification fails, inspect and retry the same unpublished draft. Published releases are immutable to this workflow; use a new version for a replacement package. A failed stable-channel deployment may be retried only after confirming the release is still GitHub's latest stable release.
