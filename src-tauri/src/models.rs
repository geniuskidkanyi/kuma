//! Whisper model catalog, download manager, custom imports, and local storage.

use std::collections::HashSet;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

const HF_BASE: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

/// A model in the built-in catalog.
struct CatalogEntry {
    id: &'static str,
    label: &'static str,
    size_bytes: u64,
    english_only: bool,
}

/// Static catalog of the GGML models we offer out of the box.
const CATALOG: &[CatalogEntry] = &[
    CatalogEntry { id: "tiny.en",         label: "Tiny (English)",     size_bytes: 77_700_000,    english_only: true },
    CatalogEntry { id: "tiny",            label: "Tiny",               size_bytes: 77_700_000,    english_only: false },
    CatalogEntry { id: "base.en",         label: "Base (English)",     size_bytes: 147_900_000,   english_only: true },
    CatalogEntry { id: "base",            label: "Base",               size_bytes: 147_900_000,   english_only: false },
    CatalogEntry { id: "small.en",        label: "Small (English)",    size_bytes: 487_600_000,   english_only: true },
    CatalogEntry { id: "small",           label: "Small",              size_bytes: 487_600_000,   english_only: false },
    CatalogEntry { id: "medium.en",       label: "Medium (English)",   size_bytes: 1_533_000_000, english_only: true },
    CatalogEntry { id: "medium",          label: "Medium",             size_bytes: 1_533_000_000, english_only: false },
    CatalogEntry { id: "large-v3-turbo",  label: "Large v3 Turbo",     size_bytes: 1_624_000_000, english_only: false },
    CatalogEntry { id: "large-v3",        label: "Large v3",           size_bytes: 3_095_000_000, english_only: false },
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub filename: String,
    pub label: String,
    pub size_bytes: u64,
    pub english_only: bool,
    pub downloaded: bool,
    /// True for user-imported models (not part of the built-in catalog).
    pub custom: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    model_id: String,
    received: u64,
    total: u64,
}

fn filename_for(id: &str) -> String {
    format!("ggml-{id}.bin")
}

/// Derive a safe catalog id (and therefore filename) from an arbitrary model
/// filename. Strips the conventional `ggml-` prefix / `.bin` suffix and keeps
/// only filename-safe characters so imports slot into the existing naming.
fn stem_from_filename(name: &str) -> String {
    let n = name.strip_suffix(".bin").unwrap_or(name);
    let n = n.strip_prefix("ggml-").unwrap_or(n);
    let cleaned: String = n
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-') {
                c
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "imported-model".to_string()
    } else {
        trimmed
    }
}

/// Directory where models live: <app_data_dir>/models
pub fn models_dir(app: &AppHandle) -> anyhow::Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| anyhow::anyhow!("no app data dir: {e}"))?
        .join("models");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Absolute path to a model's file (whether or not it exists yet).
pub fn model_path(app: &AppHandle, id: &str) -> anyhow::Result<PathBuf> {
    Ok(models_dir(app)?.join(filename_for(id)))
}

fn entry(id: &str) -> Option<&'static CatalogEntry> {
    CATALOG.iter().find(|e| e.id == id)
}

/// Quick sanity check that a file looks like a GGML whisper model by its magic
/// header. whisper models carry the `ggml` magic (stored little-endian, so the
/// first bytes read back as `lmgg`).
fn looks_like_ggml(path: &Path) -> anyhow::Result<bool> {
    let mut f = fs::File::open(path)?;
    let mut magic = [0u8; 4];
    if f.read_exact(&mut magic).is_err() {
        return Ok(false);
    }
    Ok(&magic == b"lmgg" || &magic == b"ggml")
}

pub fn list(app: &AppHandle) -> anyhow::Result<Vec<ModelInfo>> {
    let dir = models_dir(app)?;
    let catalog_files: HashSet<String> =
        CATALOG.iter().map(|e| filename_for(e.id)).collect();

    // Built-in catalog first.
    let mut out: Vec<ModelInfo> = CATALOG
        .iter()
        .map(|e| {
            let filename = filename_for(e.id);
            let downloaded = dir.join(&filename).exists();
            ModelInfo {
                id: e.id.to_string(),
                filename,
                label: e.label.to_string(),
                size_bytes: e.size_bytes,
                english_only: e.english_only,
                downloaded,
                custom: false,
            }
        })
        .collect();

    // Then any imported models: ggml-*.bin files on disk not in the catalog.
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("ggml-") || !name.ends_with(".bin") {
                continue;
            }
            if catalog_files.contains(&name) {
                continue;
            }
            let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
            let id = stem_from_filename(&name);
            out.push(ModelInfo {
                id: id.clone(),
                filename: name,
                label: id,
                size_bytes,
                english_only: false,
                downloaded: true,
                custom: true,
            });
        }
    }

    Ok(out)
}

pub fn delete(app: &AppHandle, id: &str) -> anyhow::Result<()> {
    let path = model_path(app, id)?;
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

/// Import a model from a local file (e.g. a community fine-tune for an African
/// language, copied from a USB stick or downloaded elsewhere).
pub fn import_from_path(app: &AppHandle, src: &str) -> anyhow::Result<()> {
    let src_path = Path::new(src);
    if !src_path.exists() {
        anyhow::bail!("file not found: {src}");
    }
    if !looks_like_ggml(src_path)? {
        anyhow::bail!(
            "This does not look like a GGML whisper model. Expected a ggml-*.bin file."
        );
    }
    let orig_name = src_path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "imported".to_string());
    let stem = stem_from_filename(&orig_name);
    let dest = models_dir(app)?.join(filename_for(&stem));
    fs::copy(src_path, &dest)?;
    Ok(())
}

/// Import a model by downloading it from an arbitrary URL (e.g. a Hugging Face
/// `resolve/main/ggml-<lang>.bin` link).
pub fn import_from_url(app: &AppHandle, url: &str) -> anyhow::Result<()> {
    let last = url
        .split('?')
        .next()
        .unwrap_or(url)
        .rsplit('/')
        .next()
        .unwrap_or("imported-model.bin");
    let stem = stem_from_filename(last);
    let dest = models_dir(app)?.join(filename_for(&stem));
    if dest.exists() {
        return Ok(());
    }
    download_to(app, url, &dest, &stem, 0)
}

/// Download a catalog model with streamed progress events.
pub fn download(app: &AppHandle, id: &str) -> anyhow::Result<()> {
    let ent = entry(id).ok_or_else(|| anyhow::anyhow!("unknown model: {id}"))?;
    let filename = filename_for(id);
    let dest = models_dir(app)?.join(&filename);
    if dest.exists() {
        return Ok(());
    }
    let url = format!("{HF_BASE}/{filename}");
    download_to(app, &url, &dest, id, ent.size_bytes)
}

/// Shared streaming downloader. Writes atomically via a `.part` file that is
/// renamed on success, and emits `model://download-progress` events throttled
/// to ~1 MB. `fallback_total` is used for the progress denominator when the
/// server does not report a content length.
fn download_to(
    app: &AppHandle,
    url: &str,
    dest: &Path,
    model_id: &str,
    fallback_total: u64,
) -> anyhow::Result<()> {
    let tmp = dest.with_extension("bin.part");
    let client = reqwest::blocking::Client::builder()
        .timeout(None)
        .build()?;
    let mut resp = client.get(url).send()?.error_for_status()?;

    let total = resp.content_length().unwrap_or(fallback_total);
    let mut file = fs::File::create(&tmp)?;
    let mut buf = [0u8; 64 * 1024];
    let mut received: u64 = 0;
    let mut last_emit = 0u64;

    loop {
        let n = resp.read(&mut buf)?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n])?;
        received += n as u64;
        if received - last_emit >= 1_000_000 {
            last_emit = received;
            let _ = app.emit(
                "model://download-progress",
                DownloadProgress {
                    model_id: model_id.to_string(),
                    received,
                    total,
                },
            );
        }
    }
    file.flush()?;
    drop(file);

    // Reject obviously-wrong downloads (e.g. an HTML error page).
    if !looks_like_ggml(&tmp)? {
        let _ = fs::remove_file(&tmp);
        anyhow::bail!("downloaded file is not a GGML whisper model (check the URL)");
    }

    fs::rename(&tmp, dest)?;
    let _ = app.emit(
        "model://download-progress",
        DownloadProgress {
            model_id: model_id.to_string(),
            received: total,
            total,
        },
    );
    Ok(())
}
