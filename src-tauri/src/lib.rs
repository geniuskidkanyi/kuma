//! Kuma — Tauri command surface.

mod audio;
mod dataset;
mod models;
mod recording;
mod whisper;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use recording::RecorderState;
use tauri::{AppHandle, Manager, State};

type CmdResult<T> = Result<T, String>;

/// Shared flag used to abort an in-flight transcription.
#[derive(Default)]
struct CancelFlag(Arc<AtomicBool>);

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
fn list_models(app: AppHandle) -> CmdResult<Vec<models::ModelInfo>> {
    models::list(&app).map_err(err)
}

/// Name of the compute backend this build uses (e.g. "Metal", "CUDA", "CPU").
#[tauri::command]
fn accel_backend() -> String {
    whisper::backend_name().to_string()
}

/// Open an http(s) URL in the user's default browser. Used for links to model
/// pages / Hugging Face from the African-language catalog.
#[tauri::command]
fn open_external(url: String) -> CmdResult<()> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("only http(s) URLs are allowed".into());
    }
    #[cfg(target_os = "macos")]
    let mut cmd = {
        let mut c = std::process::Command::new("open");
        c.arg(&url);
        c
    };
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("cmd");
        // The empty "" is the window title arg that `start` expects.
        c.args(["/C", "start", "", &url]);
        c
    };
    #[cfg(target_os = "linux")]
    let mut cmd = {
        let mut c = std::process::Command::new("xdg-open");
        c.arg(&url);
        c
    };
    cmd.spawn().map_err(err)?;
    Ok(())
}

#[tauri::command]
async fn download_model(app: AppHandle, model_id: String) -> CmdResult<()> {
    // Network + disk IO on a blocking worker so the UI stays responsive.
    tauri::async_runtime::spawn_blocking(move || models::download(&app, &model_id))
        .await
        .map_err(err)?
        .map_err(err)
}

#[tauri::command]
fn delete_model(app: AppHandle, model_id: String) -> CmdResult<()> {
    models::delete(&app, &model_id).map_err(err)
}

#[tauri::command]
async fn import_model_from_path(app: AppHandle, path: String) -> CmdResult<()> {
    tauri::async_runtime::spawn_blocking(move || models::import_from_path(&app, &path))
        .await
        .map_err(err)?
        .map_err(err)
}

#[tauri::command]
async fn import_model_from_url(app: AppHandle, url: String) -> CmdResult<()> {
    tauri::async_runtime::spawn_blocking(move || models::import_from_url(&app, &url))
        .await
        .map_err(err)?
        .map_err(err)
}

#[tauri::command]
async fn transcribe_file(
    app: AppHandle,
    path: String,
    model_id: String,
    language: Option<String>,
    translate: bool,
) -> CmdResult<whisper::TranscriptResult> {
    // Reset the cancel flag for this run and hand a clone to the worker.
    let cancel = app.state::<CancelFlag>().0.clone();
    cancel.store(false, Ordering::Relaxed);
    tauri::async_runtime::spawn_blocking(move || {
        whisper::transcribe(&app, &path, &model_id, language, translate, cancel)
    })
    .await
    .map_err(err)?
    .map_err(err)
}

/// Request that the current transcription stop early.
#[tauri::command]
fn cancel_transcription(state: State<CancelFlag>) {
    state.0.store(true, Ordering::Relaxed);
}

#[tauri::command]
async fn export_dataset(
    app: AppHandle,
    source: String,
    segments: Vec<dataset::DatasetSegment>,
    language: String,
    out_dir: String,
) -> CmdResult<dataset::DatasetSummary> {
    tauri::async_runtime::spawn_blocking(move || {
        dataset::export(&app, &source, &segments, &language, &out_dir)
    })
    .await
    .map_err(err)?
    .map_err(err)
}

#[tauri::command]
fn start_recording(app: AppHandle, state: State<RecorderState>) -> CmdResult<()> {
    recording::start(&app, &state).map_err(err)
}

#[tauri::command]
fn stop_recording(state: State<RecorderState>) -> CmdResult<String> {
    recording::stop(&state).map_err(err)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(RecorderState::default())
        .manage(CancelFlag::default())
        .invoke_handler(tauri::generate_handler![
            list_models,
            accel_backend,
            open_external,
            download_model,
            delete_model,
            import_model_from_path,
            import_model_from_url,
            transcribe_file,
            cancel_transcription,
            export_dataset,
            start_recording,
            stop_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
