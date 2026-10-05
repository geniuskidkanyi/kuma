import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import * as api from "../api";
import { humanBytes } from "../format";
import type { DownloadProgress, ModelInfo } from "../types";

interface Props {
  activeModel: string;
  onActiveModelChange: (id: string) => void;
}

export default function ModelManager({
  activeModel,
  onActiveModelChange,
}: Props) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [progress, setProgress] = useState<Record<string, DownloadProgress>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);

  async function refresh() {
    try {
      setModels(await api.listModels());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
    const un = api.onDownloadProgress((p) =>
      setProgress((prev) => ({ ...prev, [p.modelId]: p })),
    );
    return () => {
      un.then((f) => f());
    };
  }, []);

  async function download(id: string) {
    setError(null);
    try {
      await api.downloadModel(id);
      setProgress((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteModel(id);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function importFile() {
    setError(null);
    const selected = await open({
      multiple: false,
      filters: [{ name: "GGML model", extensions: ["bin"] }],
    });
    if (typeof selected !== "string") return;
    setImporting(true);
    try {
      await api.importModelFromPath(selected);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }

  async function importUrl() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    setImporting(true);
    try {
      await api.importModelFromUrl(trimmed);
      setUrl("");
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="panel">
      <h2>Models</h2>
      {error && <div className="error">{error}</div>}
      <ul className="model-list">
        {models.map((m) => {
          const dl = progress[m.id];
          const downloading = !!dl && (dl.total === 0 || dl.received < dl.total);
          const pct = dl && dl.total > 0 ? (dl.received / dl.total) * 100 : 0;
          return (
            <li key={m.id} className="model-row">
              <div className="model-meta">
                <label className="model-name">
                  <input
                    type="radio"
                    name="active-model"
                    disabled={!m.downloaded}
                    checked={activeModel === m.id}
                    onChange={() => onActiveModelChange(m.id)}
                  />
                  {m.label}
                  {m.englishOnly && <span className="tag">EN</span>}
                  {m.custom && <span className="tag custom">custom</span>}
                </label>
                <span className="model-size">{humanBytes(m.sizeBytes)}</span>
              </div>
              <div className="model-actions">
                {downloading ? (
                  <div className="dl-progress">
                    <div className="bar">
                      <div className="bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                ) : m.downloaded ? (
                  <button className="ghost danger" onClick={() => remove(m.id)}>
                    Remove
                  </button>
                ) : (
                  <button className="ghost" onClick={() => download(m.id)}>
                    Download
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="import-box">
        <h3>Add a community model</h3>
        <p className="hint">
          Bring a fine-tuned model for an African language — import a local
          <code> .bin</code> file or paste a Hugging Face link.
        </p>
        <button className="ghost" onClick={importFile} disabled={importing}>
          {importing ? "Importing…" : "Import .bin file…"}
        </button>
        <div className="url-row">
          <input
            type="text"
            placeholder="https://huggingface.co/…/ggml-model.bin"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && importUrl()}
            disabled={importing}
          />
          <button
            className="ghost"
            onClick={importUrl}
            disabled={importing || !url.trim()}
          >
            Add
          </button>
        </div>
      </div>

      <p className="hint">
        Models download from Hugging Face and are stored in your app data
        directory. Larger models are more accurate but slower.
      </p>
    </div>
  );
}
