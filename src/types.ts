// Shared types mirrored between the Rust backend and the React frontend.

export interface Segment {
  /** Segment index in the transcript. */
  id: number;
  /** Start time in milliseconds. */
  start: number;
  /** End time in milliseconds. */
  end: number;
  /** Segment text. Editable in the UI. */
  text: string;
}

export interface TranscriptResult {
  segments: Segment[];
  /** Detected (or forced) language code, e.g. "en". */
  language: string;
  /** Source media path. */
  source: string;
  /** Model used, e.g. "ggml-base.en.bin". */
  model: string;
  /** Total media duration in milliseconds, if known. */
  durationMs: number;
}

export interface ModelInfo {
  /** Canonical id, e.g. "base.en". */
  id: string;
  /** GGML filename, e.g. "ggml-base.en.bin". */
  filename: string;
  /** Human label. */
  label: string;
  /** Approximate download size in bytes. */
  sizeBytes: number;
  /** Whether this model is English-only. */
  englishOnly: boolean;
  /** True if the file already exists locally. */
  downloaded: boolean;
  /** True for user-imported models (community fine-tunes, etc.). */
  custom: boolean;
}

export interface TranscribeProgress {
  /** 0.0 – 1.0 */
  progress: number;
  /** Newest decoded segment, streamed as it is produced. */
  segment?: Segment;
  stage: "decoding" | "loading_model" | "transcribing" | "done";
}

export interface DownloadProgress {
  modelId: string;
  received: number;
  total: number;
}

export type ExportFormat = "srt" | "vtt" | "txt";
