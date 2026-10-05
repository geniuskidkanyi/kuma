# CI / Release workflows

## `ci.yml` — checks on every push & PR
CPU-only. Typechecks + builds the frontend and compiles the Rust backend on
Linux, macOS and Windows. Fast and reliable; no installers, no GPU SDKs.

## `release.yml` — build installers & publish a release
Triggered by pushing a version tag:

```bash
# bump the version in package.json + src-tauri/tauri.conf.json first, then:
git tag v0.1.0
git push origin v0.1.0
```

(You can also run it manually from the **Actions** tab — that produces a draft
release named after the branch.)

It builds a 4-way matrix and attaches the installers to a **draft** GitHub
Release for you to review and publish:

| Job | Output | GPU backend |
|-----|--------|-------------|
| macOS (Apple Silicon) | `.dmg` / `.app` (aarch64) | Metal (default) |
| macOS (Intel) | `.dmg` / `.app` (x86_64) | Metal (default) |
| Windows | `.msi` / `.exe` | Vulkan |
| Linux | `.deb` / `.rpm` / `.AppImage` | Vulkan |

`fail-fast` is off, so one platform failing won't cancel the rest.

## Known follow-ups

- **Unsigned builds.** Signing is intentionally not configured yet, so macOS
  users will see a Gatekeeper warning and Windows users a SmartScreen prompt.
  To enable it later, add the Tauri signing secrets and pass them as env in the
  "Build app + create release" step:
  - macOS: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
    `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` (for notarization).
  - Windows: a code-signing certificate via `tauri.conf.json > bundle > windows`.

- **GPU SDK steps are untested on CI hardware.** The Windows/Linux Vulkan legs
  install a GPU SDK that could need a version/input tweak on the first real run.
  If a Vulkan leg fails and you want a guaranteed installer for that platform in
  the meantime, drop `--features vulkan` from its matrix entry (and its
  "Install Vulkan SDK" step) to ship a CPU build, then re-enable once the SDK
  step is green.

- **ffmpeg is a runtime dependency.** Installers do not bundle ffmpeg yet; users
  need it on PATH. Bundling it is tracked in the project roadmap.
