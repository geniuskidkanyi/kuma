import { useCallback, useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import * as api from "./api";
import { EXTENSIONS, serialize } from "./export";
import { clock } from "./format";
import ModelManager from "./components/ModelManager";
import AfricanLanguages from "./components/AfricanLanguages";
import TranscriptView from "./components/TranscriptView";
import type { ExportFormat, Segment, TranscriptResult } from "./types";

const AUDIO_EXTS = [
  "mp3", "wav", "m4a", "aac", "flac", "ogg", "opus", "wma",
  "mp4", "mov", "mkv", "webm", "avi", "m4v",
];

const LANGUAGES: { code: string | null; label: string }[] = [
  { code: null, label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
];

export default function App() {
  const [activeModel, setActiveModel] = useState<string>("base.en");
  const [language, setLanguage] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [backend, setBackend] = useState<string>("");
  const [showLangs, setShowLangs] = useState(false);
  const [datasetBusy, setDatasetBusy] = useState(false);
  const [datasetProg, setDatasetProg] = useState<{ done: number; total: number } | null>(null);
  const [datasetMsg, setDatasetMsg] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recLevel, setRecLevel] = useState(0);
  const recStart = useRef<number>(0);
  const [recElapsed, setRecElapsed] = useState(0);

  // Subscribe to transcription progress + streamed segments.
  useEffect(() => {
    const un = api.onTranscribeProgress((p) => {
      setProgress(p.progress);
      setStage(p.stage);
      if (p.segment) {
        setSegments((prev) => [...prev, p.segment!]);
      }
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  // Report the active compute backend (Metal / CUDA / CPU …).
  useEffect(() => {
    api.accelBackend().then(setBackend).catch(() => setBackend(""));
  }, []);

  // Dataset export progress.
  useEffect(() => {
    const un = api.onDatasetProgress(setDatasetProg);
    return () => {
      un.then((f) => f());
    };
  }, []);

  // Recording level meter + elapsed timer.
  useEffect(() => {
    const un = api.onRecordingLevel(setRecLevel);
    return () => {
      un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecElapsed(Date.now() - recStart.current), 200);
    return () => clearInterval(t);
  }, [recording]);

  const runTranscription = useCallback(
    async (path: string) => {
      setError(null);
      setBusy(true);
      setProgress(0);
      setSegments([]);
      setResult(null);
      try {
        const res = await api.transcribeFile(path, activeModel, language);
        setResult(res);
        setSegments(res.segments);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
        setStage("");
      }
    },
    [activeModel, language],
  );

  // Native drag-and-drop from the OS.
  useEffect(() => {
    const un = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setDragOver(true);
      } else if (event.payload.type === "drop") {
        setDragOver(false);
        const file = event.payload.paths[0];
        if (file && !busy) runTranscription(file);
      } else {
        setDragOver(false);
      }
    });
    return () => {
      un.then((f) => f());
    };
  }, [busy, runTranscription]);

  async function pickFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Audio / Video", extensions: AUDIO_EXTS }],
    });
    if (typeof selected === "string") runTranscription(selected);
  }

  async function toggleRecording() {
    setError(null);
    if (!recording) {
      try {
        await api.startRecording();
        recStart.current = Date.now();
        setRecElapsed(0);
        setRecording(true);
      } catch (e) {
        setError(String(e));
      }
    } else {
      try {
        setRecording(false);
        const wavPath = await api.stopRecording();
        await runTranscription(wavPath);
      } catch (e) {
        setError(String(e));
      }
    }
  }

  function editSegment(id: number, text: string) {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text } : s)),
    );
  }

  async function exportAs(format: ExportFormat) {
    if (!result) return;
    const merged: TranscriptResult = { ...result, segments };
    const content = serialize(merged, format);
    const base = result.source.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") ?? "transcript";
    const path = await save({
      defaultPath: `${base}.${EXTENSIONS[format]}`,
      filters: [{ name: format.toUpperCase(), extensions: [EXTENSIONS[format]] }],
    });
    if (path) await writeTextFile(path, content);
  }

  async function contributeDataset() {
    if (!result) return;
    const dir = await open({
      directory: true,
      title: "Choose a folder for the dataset",
    });
    if (typeof dir !== "string") return;
    setError(null);
    setDatasetMsg(null);
    setDatasetProg(null);
    setDatasetBusy(true);
    try {
      const summary = await api.exportDataset(
        result.source,
        segments.map((s) => ({ start: s.start, end: s.end, text: s.text })),
        language ?? result.language,
        dir,
      );
      const mins = (summary.totalDurationMs / 60000).toFixed(1);
      setDatasetMsg(
        `Exported ${summary.clips} clip${summary.clips === 1 ? "" : "s"} (${mins} min) to ${summary.outDir}`,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setDatasetBusy(false);
      setDatasetProg(null);
    }
  }

  const wordCount = segments.reduce(
    (n, s) => n + s.text.trim().split(/\s+/).filter(Boolean).length,
    0,
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">🎙️</span>
          <div>
            <h1>Kuma</h1>
            <p className="sub">Speech → text, offline</p>
          </div>
        </div>

        {backend && (
          <div className="accel-pill" title="Hardware acceleration backend">
            ⚡ {backend}
          </div>
        )}

        <div className="control-group">
          <label>Language</label>
          <select
            value={language ?? ""}
            onChange={(e) => setLanguage(e.target.value || null)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.label} value={l.code ?? ""}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <button className="langs-btn" onClick={() => setShowLangs(true)}>
          🌍 African languages
        </button>

        <ModelManager
          activeModel={activeModel}
          onActiveModelChange={setActiveModel}
        />
      </aside>

      {showLangs && (
        <AfricanLanguages
          activeModel={activeModel}
          onActiveModelChange={(id) => setActiveModel(id)}
          onClose={() => setShowLangs(false)}
        />
      )}

      <main className="content">
        <header className="toolbar">
          <button className="primary" onClick={pickFile} disabled={busy}>
            Open file…
          </button>
          <button
            className={recording ? "rec active" : "rec"}
            onClick={toggleRecording}
            disabled={busy && !recording}
          >
            {recording ? (
              <>
                <span className="rec-dot" /> Stop {clock(recElapsed)}
              </>
            ) : (
              <>● Record</>
            )}
          </button>

          <div className="spacer" />

          <div className="export-group">
            <span>Export</span>
            <button className="ghost" disabled={!result} onClick={() => exportAs("srt")}>
              SRT
            </button>
            <button className="ghost" disabled={!result} onClick={() => exportAs("vtt")}>
              VTT
            </button>
            <button className="ghost" disabled={!result} onClick={() => exportAs("txt")}>
              TXT
            </button>
          </div>

          <button
            className="contribute"
            disabled={!result || datasetBusy}
            onClick={contributeDataset}
            title="Export corrected clips as an open speech dataset"
          >
            {datasetBusy
              ? datasetProg
                ? `Exporting ${datasetProg.done}/${datasetProg.total}…`
                : "Exporting…"
              : "🎁 Contribute dataset"}
          </button>
        </header>

        {recording && (
          <div className="rec-meter">
            <div
              className="rec-meter-fill"
              style={{ width: `${Math.min(100, recLevel * 140)}%` }}
            />
          </div>
        )}

        {error && <div className="error banner">{error}</div>}
        {datasetMsg && <div className="ok banner">✓ {datasetMsg}</div>}

        {busy && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            <span className="progress-label">
              {stage === "decoding" && "Decoding audio…"}
              {stage === "loading_model" && "Loading model…"}
              {stage === "transcribing" && `Transcribing… ${(progress * 100).toFixed(0)}%`}
            </span>
          </div>
        )}

        {!result && !busy && segments.length === 0 ? (
          <div
            className={dragOver ? "dropzone over" : "dropzone"}
            onClick={pickFile}
          >
            <div className="dropzone-inner">
              <div className="big-icon">⬇</div>
              <p>Drop an audio or video file here</p>
              <p className="hint">or click to browse · or hit Record</p>
            </div>
          </div>
        ) : (
          <>
            {result && (
              <div className="meta-bar">
                <span>{result.source.split(/[/\\]/).pop()}</span>
                <span>·</span>
                <span>{result.language.toUpperCase()}</span>
                <span>·</span>
                <span>{clock(result.durationMs)}</span>
                <span>·</span>
                <span>{wordCount} words</span>
              </div>
            )}
            <TranscriptView segments={segments} onEdit={editSegment} />
          </>
        )}
      </main>
    </div>
  );
}
