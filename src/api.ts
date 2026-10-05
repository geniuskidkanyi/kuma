// Thin, typed wrappers around Tauri IPC commands and events.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  DownloadProgress,
  ModelInfo,
  TranscribeProgress,
  TranscriptResult,
} from "./types";

export async function listModels(): Promise<ModelInfo[]> {
  return invoke("list_models");
}

/** Name of the active compute backend, e.g. "Metal · Apple unified memory". */
export async function accelBackend(): Promise<string> {
  return invoke("accel_backend");
}

/** Open an http(s) URL in the user's default browser. */
export async function openExternal(url: string): Promise<void> {
  return invoke("open_external", { url });
}

export async function downloadModel(modelId: string): Promise<void> {
  return invoke("download_model", { modelId });
}

export async function deleteModel(modelId: string): Promise<void> {
  return invoke("delete_model", { modelId });
}

/** Import a community/fine-tuned GGML model from a local .bin file. */
export async function importModelFromPath(path: string): Promise<void> {
  return invoke("import_model_from_path", { path });
}

/** Import a model by downloading it from a URL (e.g. a Hugging Face link). */
export async function importModelFromUrl(url: string): Promise<void> {
  return invoke("import_model_from_url", { url });
}

export async function transcribeFile(
  path: string,
  modelId: string,
  language: string | null,
): Promise<TranscriptResult> {
  return invoke("transcribe_file", { path, modelId, language });
}

export async function startRecording(): Promise<void> {
  return invoke("start_recording");
}

/** Stops recording and returns the path to the captured WAV file. */
export async function stopRecording(): Promise<string> {
  return invoke("stop_recording");
}

export async function onTranscribeProgress(
  cb: (p: TranscribeProgress) => void,
): Promise<UnlistenFn> {
  return listen<TranscribeProgress>("transcribe://progress", (e) =>
    cb(e.payload),
  );
}

export async function onDownloadProgress(
  cb: (p: DownloadProgress) => void,
): Promise<UnlistenFn> {
  return listen<DownloadProgress>("model://download-progress", (e) =>
    cb(e.payload),
  );
}

export async function onRecordingLevel(
  cb: (rms: number) => void,
): Promise<UnlistenFn> {
  return listen<number>("recording://level", (e) => cb(e.payload));
}
