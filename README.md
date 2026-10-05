# Kuma

**Kuma** (Mandinka for *word / speech*) is a cross-platform (macOS / Linux /
Windows) desktop app for **local, offline audio & video transcription**,
powered by [OpenAI Whisper](https://github.com/openai/whisper) running
on-device via [whisper.cpp](https://github.com/ggerganov/whisper.cpp). A
MacWhisper-style tool built with **Tauri** (Rust) + **React** — with a focus on
making speech-to-text work for **African languages**.

## Features

- 🎙️ **Transcribe audio/video files** — drag-and-drop or file picker. Any format
  ffmpeg can read (mp3, wav, m4a, flac, mp4, mov, mkv, …).
- ⏺️ **Record & transcribe** — capture from the microphone with a live level
  meter, then transcribe.
- ✏️ **Edit + export** — inline-editable transcript with timestamps; export to
  **SRT**, **VTT**, and **TXT**.
- 📦 **Model manager** — download / switch / remove Whisper models
  (tiny → large-v3) from within the app, with download progress.
- 🌍 **Import community models** — load any fine-tuned GGML model from a
  local `.bin` file or a Hugging Face URL. This is how Kuma supports African
  languages that stock Whisper handles poorly (Yoruba, Swahili, Amharic,
  Luganda, …) — bring a community fine-tune and it shows up as a selectable
  model.
- 🌍 **African-language catalog** — an in-app guide (the *African languages*
  button) covering ~20 languages incl. The Gambia's own (Wolof, Mandinka,
  Fula): honest stock-support labels, the right multilingual model to download,
  verified links to community fine-tunes (Sunbird 51-language, Africanvoice
  Yoruba, …) with format tags, a conversion path to GGML, and a per-language
  Hugging Face search.
- 🌍 Auto language detection or forced language.
- 🔒 100% offline. No API keys, no cloud, no per-minute cost.

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  React + TypeScript (UI)     │  IPC   │  Rust / Tauri backend         │
│  src/                        │◀──────▶│  src-tauri/src/               │
│   App.tsx    transcript UI   │ invoke │   models.rs   catalog+download │
│   ModelManager               │ events │   audio.rs    ffmpeg decode    │
│   TranscriptView             │        │   whisper.rs  whisper-rs engine│
│   export.ts  SRT/VTT/TXT     │        │   recording.rs cpal capture    │
└─────────────────────────────┘        └──────────────────────────────┘
```

- **Transcription**: `whisper-rs` (bindings to whisper.cpp). Progress and each
  decoded segment are streamed to the UI over Tauri events.
- **Audio decode**: shells out to the system `ffmpeg` to normalize any input to
  the 16 kHz mono f32 PCM whisper expects.
- **Recording**: `cpal` captures the default input device to a temp WAV, which
  is then fed through the same decode + transcribe path.
- **Models**: downloaded from Hugging Face (`ggerganov/whisper.cpp`) into the
  app data directory.

## Prerequisites

- **Rust** (stable) + **Cargo**
- **Node** 18+ and **npm**
- **cmake** (to build whisper.cpp) — `brew install cmake` / `apt install cmake`
- **ffmpeg** on `PATH` — `brew install ffmpeg` / `apt install ffmpeg`

## Development

```bash
npm install
npm run tauri dev
```

The first build compiles whisper.cpp from source and takes a few minutes;
subsequent builds are incremental.

## Build a release bundle

```bash
npm run tauri build
```

Produces platform installers (`.dmg`/`.app` on macOS, `.deb`/`.AppImage` on
Linux, `.msi`/`.exe` on Windows) under `src-tauri/target/release/bundle/`.

## Hardware acceleration (GPU)

whisper.cpp uses a different GPU backend on each platform — they are the
per-platform implementations of the same idea. **Metal is Apple-only** and does
not exist on Windows or Linux; **Vulkan** is the cross-platform equivalent
there.

| Platform | GPU backend | Enable |
|----------|-------------|--------|
| macOS / Apple Silicon | **Metal** + unified memory | **automatic** (default on macOS) |
| Windows / Linux — any GPU incl. **Intel iGPU** | **Vulkan** | `--features vulkan` (needs the Vulkan SDK) |
| Windows / Linux — **Intel** GPU / iGPU (native) | **oneAPI / SYCL** | `--features sycl` (needs the Intel oneAPI toolkit) |
| Windows / Linux — NVIDIA | **CUDA** | `--features cuda` (needs the CUDA toolkit) |
| Linux — AMD | **ROCm / HIP** | `--features rocm` (needs ROCm) |
| macOS — Neural Engine | **CoreML** | `--features coreml` (needs a CoreML model) |

**Integrated GPUs (Intel Iris/Arc, AMD APUs) are fully supported.** Like Apple's
unified memory, an iGPU has no dedicated VRAM — it draws from shared system RAM,
so there is no small VRAM ceiling and you can run large models as long as the
machine has the RAM. Vulkan is the easy cross-vendor path; `sycl` is Intel's
native stack and is often faster on Intel hardware.

Examples:

```bash
# Windows / Linux, broad GPU support (NVIDIA, AMD, Intel iGPU) via Vulkan:
npm run tauri build -- --features vulkan

# Windows / Linux with an Intel GPU / iGPU, Intel-native oneAPI:
npm run tauri build -- --features sycl

# Windows / Linux with an NVIDIA GPU via CUDA:
npm run tauri build -- --features cuda
```

The CPU build is the default everywhere and always compiles. GPU backends are
opt-in because Vulkan/CUDA/ROCm require their SDK **at build time** — macOS
Metal is the one exception that is safe to default, since it ships with the OS.
The active backend is shown as a pill in the app sidebar (`⚡ Metal …`,
`⚡ Vulkan`, `⚡ CUDA`, or `⚡ CPU`).

## Smoke test

Verify the decode + transcription pipeline without the GUI:

```bash
# macOS: synthesize speech, grab a model, transcribe it
say -o /tmp/test.aiff "Hello world, this is a test."
curl -L -o /tmp/ggml-tiny.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
cd src-tauri && cargo run --example smoke -- /tmp/ggml-tiny.en.bin /tmp/test.aiff
```

## Roadmap / not yet implemented

- System-audio capture (loopback) for recording meetings/calls.
- Speaker diarization, word-level timestamps, transcript search.
- Bundling ffmpeg so it isn't a runtime dependency.

## Notes

- macOS microphone access is declared in `src-tauri/Info.plist`
  (`NSMicrophoneUsageDescription`); the OS will prompt on first record.
- The app icon in `src-tauri/icons/` is a generated placeholder — replace it.

## License

Kuma is released under the [MIT License](LICENSE). It builds on other open
projects, each under its own permissive license: whisper.cpp (MIT), OpenAI
Whisper models (MIT), Tauri (MIT / Apache-2.0), and cpal (Apache-2.0). ffmpeg
is used as an external program (not linked), so its license does not extend to
Kuma.
