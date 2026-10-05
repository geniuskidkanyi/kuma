import { useEffect, useState } from "react";
import * as api from "../api";
import { humanBytes } from "../format";
import type { DownloadProgress, ModelInfo } from "../types";
import {
  CONVERT_GUIDE_URL,
  FEATURED,
  LANGUAGES,
  RECOMMENDED_STOCK,
  hfSearch,
  type CommunityModel,
  type StockSupport,
} from "../africanModels";

interface Props {
  activeModel: string;
  onActiveModelChange: (id: string) => void;
  onClose: () => void;
}

const SUPPORT_LABEL: Record<StockSupport, string> = {
  fair: "Fair in stock Whisper",
  limited: "Limited in stock Whisper",
  none: "Community model needed",
};

const FORMAT_LABEL: Record<CommunityModel["format"], string> = {
  ggml: "GGML · importable",
  transformers: "Transformers · convert",
  "faster-whisper": "faster-whisper · convert",
};

function FormatTag({ format }: { format: CommunityModel["format"] }) {
  return <span className={`fmt-tag fmt-${format}`}>{FORMAT_LABEL[format]}</span>;
}

/** A community model row: import directly if GGML, else open its HF page. */
function CommunityRow({ m }: { m: CommunityModel }) {
  const [state, setState] = useState<"idle" | "importing" | "done" | "err">(
    "idle",
  );
  async function importGgml() {
    if (!m.ggmlUrl) return;
    setState("importing");
    try {
      await api.importModelFromUrl(m.ggmlUrl);
      setState("done");
    } catch {
      setState("err");
    }
  }
  return (
    <li className="community-row">
      <div className="community-meta">
        <span>{m.label}</span>
        <FormatTag format={m.format} />
      </div>
      {m.format === "ggml" && m.ggmlUrl ? (
        <button className="ghost" onClick={importGgml} disabled={state === "importing"}>
          {state === "importing"
            ? "Importing…"
            : state === "done"
              ? "Imported ✓"
              : state === "err"
                ? "Retry"
                : "Import"}
        </button>
      ) : (
        <button className="ghost" onClick={() => api.openExternal(m.url)}>
          Open ↗
        </button>
      )}
    </li>
  );
}

export default function AfricanLanguages({
  activeModel,
  onActiveModelChange,
  onClose,
}: Props) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [progress, setProgress] = useState<Record<string, DownloadProgress>>({});

  async function refresh() {
    try {
      setModels(await api.listModels());
    } catch {
      /* ignore */
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

  const byId = new Map(models.map((m) => [m.id, m]));

  async function download(id: string) {
    try {
      await api.downloadModel(id);
      setProgress((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await refresh();
    } catch {
      /* surfaced elsewhere */
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2>🌍 African languages</h2>
            <p className="hint">
              What works today, and the community models pushing it forward.
            </p>
          </div>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="modal-body">
          {/* Step 1: the shared multilingual model */}
          <section>
            <h3>1 · Get a multilingual model</h3>
            <p className="hint">
              Stock Whisper uses one multilingual model for every language it
              supports. Download one (bigger = more accurate), then pick the
              language in the main window.
            </p>
            <div className="stock-row">
              {RECOMMENDED_STOCK.map((id) => {
                const m = byId.get(id);
                const dl = progress[id];
                const downloading =
                  !!dl && (dl.total === 0 || dl.received < dl.total);
                const pct = dl && dl.total > 0 ? (dl.received / dl.total) * 100 : 0;
                return (
                  <div key={id} className="stock-chip">
                    <span className="stock-label">
                      {m?.label ?? id}
                      {m && (
                        <span className="stock-size">
                          {humanBytes(m.sizeBytes)}
                        </span>
                      )}
                    </span>
                    {downloading ? (
                      <span className="stock-dl">{pct.toFixed(0)}%</span>
                    ) : m?.downloaded ? (
                      activeModel === id ? (
                        <span className="stock-active">Active</span>
                      ) : (
                        <button
                          className="ghost"
                          onClick={() => onActiveModelChange(id)}
                        >
                          Use
                        </button>
                      )
                    ) : (
                      <button className="ghost" onClick={() => download(id)}>
                        Download
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Step 2: featured multi-language resources */}
          <section>
            <h3>2 · Best African-language coverage</h3>
            <ul className="community-list">
              {FEATURED.map((m) => (
                <CommunityRow key={m.url} m={m} />
              ))}
            </ul>
            <p className="hint">
              These cover dozens of African languages but ship in Transformers /
              faster-whisper format — convert them to GGML with{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  api.openExternal(CONVERT_GUIDE_URL);
                }}
              >
                whisper.cpp's conversion guide ↗
              </a>
              , then import the resulting <code>.bin</code> in the sidebar.
            </p>
          </section>

          {/* Step 3: per-language guide */}
          <section>
            <h3>3 · By language</h3>
            <ul className="lang-list">
              {LANGUAGES.map((lang) => (
                <li key={lang.name} className="lang-row">
                  <div className="lang-head">
                    <span className="lang-name">
                      {lang.name}
                      {lang.localName && (
                        <span className="lang-local">{lang.localName}</span>
                      )}
                    </span>
                    <span className={`support support-${lang.support}`}>
                      {SUPPORT_LABEL[lang.support]}
                    </span>
                  </div>
                  {lang.note && <p className="lang-note">{lang.note}</p>}
                  {lang.community.length > 0 && (
                    <ul className="community-list">
                      {lang.community.map((m) => (
                        <CommunityRow key={m.url} m={m} />
                      ))}
                    </ul>
                  )}
                  <button
                    className="link-btn"
                    onClick={() => api.openExternal(hfSearch(lang.name))}
                  >
                    Find {lang.name} models on Hugging Face ↗
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <p className="hint modal-foot">
            Don't see your language, or built a better model? That's exactly what
            Kuma wants to change — contribute one and it lands here.
          </p>
        </div>
      </div>
    </div>
  );
}
