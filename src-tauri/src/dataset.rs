//! Dataset contribution loop.
//!
//! Turns a corrected transcript into a training-ready speech dataset: each
//! segment's audio is cut into a 16 kHz mono clip and paired with its verified
//! text in a `metadata.csv` (Hugging Face `audiofolder` / Common Voice style).
//! Everything stays local — Kuma never uploads; the user donates the folder to
//! an open project (Common Voice, Masakhane, …) themselves.

use std::fs;
use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatasetSegment {
    /// Start time in milliseconds.
    pub start: i64,
    /// End time in milliseconds.
    pub end: i64,
    pub text: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DatasetSummary {
    pub clips: usize,
    pub skipped: usize,
    pub total_duration_ms: i64,
    pub out_dir: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Progress {
    done: usize,
    total: usize,
}

/// Minimal RFC-4180 CSV field escaping.
fn csv_escape(s: &str) -> String {
    if s.contains(['"', ',', '\n', '\r']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

/// Cut clips + write metadata. Blocking — call from a worker thread.
pub fn export(
    app: &AppHandle,
    source: &str,
    segments: &[DatasetSegment],
    language: &str,
    out_dir: &str,
) -> anyhow::Result<DatasetSummary> {
    let base = Path::new(out_dir);
    let clips_dir = base.join("clips");
    fs::create_dir_all(&clips_dir)?;

    let lang = if language.is_empty() || language == "auto" {
        "und"
    } else {
        language
    };

    // Only segments with real text and a positive duration are usable.
    let valid: Vec<&DatasetSegment> = segments
        .iter()
        .filter(|s| !s.text.trim().is_empty() && s.end > s.start)
        .collect();
    let total = valid.len();

    let mut csv = String::from("file_name,transcription,language,duration_ms\n");
    let mut clips = 0usize;
    let mut total_dur = 0i64;

    for seg in valid {
        let n = clips + 1;
        let rel = format!("clips/clip_{n:04}.wav");
        let out_path = base.join(&rel);
        let start_s = seg.start as f64 / 1000.0;
        let dur_s = (seg.end - seg.start) as f64 / 1000.0;

        // Fast input-seek, re-encode audio only to 16 kHz mono WAV.
        let status = Command::new("ffmpeg")
            .args([
                "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                "-ss", &format!("{start_s:.3}"),
                "-i", source,
                "-t", &format!("{dur_s:.3}"),
                "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
                out_path.to_string_lossy().as_ref(),
            ])
            .status()
            .map_err(|e| {
                anyhow::anyhow!("could not launch ffmpeg ({e}). Is ffmpeg installed and on PATH?")
            })?;

        if !status.success() {
            continue; // skip this clip, keep going
        }

        csv.push_str(&csv_escape(&rel));
        csv.push(',');
        csv.push_str(&csv_escape(seg.text.trim()));
        csv.push(',');
        csv.push_str(lang);
        csv.push(',');
        csv.push_str(&(seg.end - seg.start).to_string());
        csv.push('\n');

        clips += 1;
        total_dur += seg.end - seg.start;
        let _ = app.emit("dataset://progress", Progress { done: clips, total });
    }

    fs::write(base.join("metadata.csv"), csv)?;
    fs::write(base.join("README.md"), readme(lang, clips, total_dur))?;

    Ok(DatasetSummary {
        clips,
        skipped: segments.len() - clips,
        total_duration_ms: total_dur,
        out_dir: out_dir.to_string(),
    })
}

fn readme(lang: &str, clips: usize, total_dur_ms: i64) -> String {
    let minutes = total_dur_ms as f64 / 60_000.0;
    format!(
        "# Speech dataset exported from Kuma\n\
\n\
- Language: `{lang}`\n\
- Clips: {clips}\n\
- Total audio: {minutes:.1} min\n\
\n\
## Format\n\
\n\
This folder is a Hugging Face `audiofolder` dataset:\n\
\n\
- `clips/` — one 16 kHz mono WAV per transcript segment\n\
- `metadata.csv` — columns: `file_name,transcription,language,duration_ms`\n\
\n\
Load it in Python with:\n\
\n\
```python\n\
from datasets import load_dataset\n\
ds = load_dataset(\"audiofolder\", data_dir=\".\")\n\
```\n\
\n\
## Help improve African speech recognition\n\
\n\
African languages are under-served by speech models mainly because there is so\n\
little open training data. If you have the right to share these recordings,\n\
please consider donating them to an open project:\n\
\n\
- Mozilla Common Voice — https://commonvoice.mozilla.org\n\
- Masakhane (African NLP community) — https://www.masakhane.io\n\
\n\
## Consent & licensing\n\
\n\
Only contribute audio you recorded yourself or have explicit permission to\n\
share. Open datasets are typically released under CC0 (public domain). Make\n\
sure every speaker consented before sharing their voice.\n"
    )
}
