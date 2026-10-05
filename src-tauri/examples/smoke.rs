//! Standalone smoke test for the decode + whisper pipeline.
//! Usage: cargo run --example smoke -- <model.bin> <audio-file>
//!
//! Mirrors the logic in src/audio.rs + src/whisper.rs without the Tauri layer,
//! so we can verify transcription actually produces text.

use std::process::{Command, Stdio};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

fn decode(path: &str) -> Vec<f32> {
    let out = Command::new("ffmpeg")
        .args([
            "-nostdin", "-hide_banner", "-loglevel", "error",
            "-i", path, "-f", "f32le", "-acodec", "pcm_f32le",
            "-ac", "1", "-ar", "16000", "-",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .expect("run ffmpeg");
    assert!(out.status.success(), "ffmpeg: {}", String::from_utf8_lossy(&out.stderr));
    out.stdout
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let model = &args[1];
    let audio = &args[2];

    let samples = decode(audio);
    println!("decoded {} samples ({:.1}s)", samples.len(), samples.len() as f32 / 16000.0);

    let ctx = WhisperContext::new_with_params(model, WhisperContextParameters::default())
        .expect("load model");
    let mut state = ctx.create_state().expect("state");

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_special(false);
    params.set_print_timestamps(false);

    state.full(params, &samples).expect("transcribe");

    let n = state.full_n_segments();
    println!("--- {} segment(s) ---", n);
    for i in 0..n {
        if let Some(seg) = state.get_segment(i) {
            println!(
                "[{:>6} -> {:>6}ms] {}",
                seg.start_timestamp() * 10,
                seg.end_timestamp() * 10,
                seg.to_str_lossy().unwrap().trim()
            );
        }
    }
}
