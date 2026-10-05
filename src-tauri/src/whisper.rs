//! Transcription via whisper.cpp (through the `whisper-rs` bindings).

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::audio;
use crate::models;

/// True when this build was compiled with a GPU backend (Metal on macOS, or an
/// opt-in CUDA/Vulkan/ROCm feature elsewhere).
pub const GPU_ACCELERATED: bool = cfg!(any(
    target_os = "macos",
    feature = "cuda",
    feature = "vulkan",
    feature = "sycl",
    feature = "rocm",
));

/// Human-readable name of the acceleration backend this build uses.
pub fn backend_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "Metal · Apple unified memory"
    } else if cfg!(feature = "cuda") {
        "CUDA"
    } else if cfg!(feature = "vulkan") {
        "Vulkan"
    } else if cfg!(feature = "sycl") {
        "Intel oneAPI · SYCL"
    } else if cfg!(feature = "rocm") {
        "ROCm / HIP"
    } else {
        "CPU"
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub id: i64,
    pub start: i64,
    pub end: i64,
    pub text: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptResult {
    pub segments: Vec<Segment>,
    pub language: String,
    pub source: String,
    pub model: String,
    pub duration_ms: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Progress {
    progress: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    segment: Option<Segment>,
    stage: String,
}

fn emit_stage(app: &AppHandle, stage: &str, progress: f32) {
    let _ = app.emit(
        "transcribe://progress",
        Progress {
            progress,
            segment: None,
            stage: stage.to_string(),
        },
    );
}

/// Whisper t0/t1 timestamps are in centiseconds (10 ms units).
fn cs_to_ms(cs: i64) -> i64 {
    cs * 10
}

/// Run a full transcription. Blocking — call from a worker thread.
pub fn transcribe(
    app: &AppHandle,
    path: &str,
    model_id: &str,
    language: Option<String>,
) -> anyhow::Result<TranscriptResult> {
    let model_path = models::model_path(app, model_id)?;
    if !model_path.exists() {
        anyhow::bail!("Model '{model_id}' is not downloaded yet.");
    }

    // 1. Decode audio.
    emit_stage(app, "decoding", 0.0);
    let samples = audio::decode_to_pcm(path)?;
    let duration_ms = audio::duration_ms(&samples);

    // 2. Load the model, requesting GPU acceleration when this build has it.
    //    On Apple Silicon the Metal backend runs on the unified-memory GPU;
    //    flash attention further cuts memory use and speeds decoding.
    emit_stage(app, "loading_model", 0.0);
    let mut cparams = WhisperContextParameters::default();
    cparams.use_gpu(GPU_ACCELERATED);
    cparams.flash_attn(GPU_ACCELERATED);
    let ctx = WhisperContext::new_with_params(
        model_path.to_string_lossy().as_ref(),
        cparams,
    )
    .map_err(|e| anyhow::anyhow!("failed to load model: {e}"))?;
    let mut state = ctx
        .create_state()
        .map_err(|e| anyhow::anyhow!("failed to create whisper state: {e}"))?;

    // 3. Configure the run.
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    let threads = std::thread::available_parallelism()
        .map(|n| n.get() as i32)
        .unwrap_or(4);
    params.set_n_threads(threads);
    params.set_translate(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_special(false);
    params.set_print_timestamps(false);

    let lang = language.as_deref().unwrap_or("auto");
    params.set_language(Some(lang));

    // Stream progress to the UI.
    let app_progress = app.clone();
    params.set_progress_callback_safe(move |p: i32| {
        let _ = app_progress.emit(
            "transcribe://progress",
            Progress {
                progress: (p as f32 / 100.0).clamp(0.0, 1.0),
                segment: None,
                stage: "transcribing".to_string(),
            },
        );
    });

    // Stream each segment as whisper produces it.
    let app_seg = app.clone();
    let seg_counter = Mutex::new(0i64);
    params.set_segment_callback_safe(move |data: whisper_rs::SegmentCallbackData| {
        let mut c = seg_counter.lock().unwrap();
        let id = *c;
        *c += 1;
        let _ = app_seg.emit(
            "transcribe://progress",
            Progress {
                progress: 0.0,
                segment: Some(Segment {
                    id,
                    start: cs_to_ms(data.start_timestamp),
                    end: cs_to_ms(data.end_timestamp),
                    text: data.text.trim().to_string(),
                }),
                stage: "transcribing".to_string(),
            },
        );
    });

    // 4. Run.
    emit_stage(app, "transcribing", 0.0);
    state
        .full(params, &samples)
        .map_err(|e| anyhow::anyhow!("transcription failed: {e}"))?;

    // 5. Collect the final segments.
    let n = state.full_n_segments();
    let mut segments = Vec::with_capacity(n.max(0) as usize);
    for i in 0..n {
        let Some(seg) = state.get_segment(i) else {
            continue;
        };
        let text = seg
            .to_str_lossy()
            .map_err(|e| anyhow::anyhow!("{e}"))?
            .to_string();
        segments.push(Segment {
            id: i as i64,
            start: cs_to_ms(seg.start_timestamp()),
            end: cs_to_ms(seg.end_timestamp()),
            text: text.trim().to_string(),
        });
    }

    emit_stage(app, "done", 1.0);

    Ok(TranscriptResult {
        segments,
        language: lang.to_string(),
        source: path.to_string(),
        model: model_id.to_string(),
        duration_ms,
    })
}
