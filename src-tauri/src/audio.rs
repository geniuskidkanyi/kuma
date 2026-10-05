//! Audio/video decoding. Uses the system `ffmpeg` to convert any input into
//! the mono 16 kHz f32 PCM stream that whisper.cpp expects.

use std::process::{Command, Stdio};

pub const WHISPER_SAMPLE_RATE: u32 = 16_000;

/// Decode `path` into 16 kHz mono `f32` samples in `[-1.0, 1.0]`.
///
/// Works for any container/codec ffmpeg supports (mp3, wav, m4a, flac, mp4,
/// mov, mkv, …). Returns an error with ffmpeg's stderr if decoding fails.
pub fn decode_to_pcm(path: &str) -> anyhow::Result<Vec<f32>> {
    let output = Command::new("ffmpeg")
        .args([
            "-nostdin",
            "-hide_banner",
            "-loglevel", "error",
            "-i", path,
            "-f", "f32le",
            "-acodec", "pcm_f32le",
            "-ac", "1",
            "-ar", &WHISPER_SAMPLE_RATE.to_string(),
            "-", // stdout
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| {
            anyhow::anyhow!("could not launch ffmpeg ({e}). Is ffmpeg installed and on PATH?")
        })?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("ffmpeg failed to decode audio: {}", err.trim());
    }

    let bytes = output.stdout;
    if bytes.len() < 4 {
        anyhow::bail!("no audio decoded from file");
    }

    // Interpret the raw byte stream as little-endian f32 samples.
    let samples: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect();

    Ok(samples)
}

/// Duration of a decoded PCM buffer, in milliseconds.
pub fn duration_ms(samples: &[f32]) -> u64 {
    (samples.len() as u64 * 1000) / WHISPER_SAMPLE_RATE as u64
}
