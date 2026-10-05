// Curated catalog of African-language transcription options.
//
// Honesty policy: every URL here points to a resource that actually exists.
// We do NOT invent "one-click GGML" downloads for languages that have none.
// Stock Whisper uses ONE shared multilingual model for every language it
// supports, so the download action is "get a multilingual model" (reused from
// the normal model manager). Community fine-tunes are linked to their real
// Hugging Face pages with an honest format label — most are in Transformers or
// faster-whisper format and must be converted to GGML before Kuma can load
// them (see CONVERT_GUIDE_URL).

export type ModelFormat = "ggml" | "transformers" | "faster-whisper";

/** How well stock (unmodified) multilingual Whisper handles a language. */
export type StockSupport = "fair" | "limited" | "none";

export interface CommunityModel {
  label: string;
  /** Real Hugging Face model page. */
  url: string;
  format: ModelFormat;
  /** Direct importable .bin URL — ONLY set when verified to be GGML format. */
  ggmlUrl?: string;
}

export interface AfricanLanguage {
  name: string;
  /** Endonym (what speakers call it). */
  localName?: string;
  /** ISO code Whisper uses, or null if stock Whisper has no support. */
  code: string | null;
  support: StockSupport;
  note?: string;
  community: CommunityModel[];
}

/** whisper.cpp's script for converting HF/Transformers models to GGML. */
export const CONVERT_GUIDE_URL =
  "https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md";

/** Flagship multi-language African resources, shown at the top. */
export const FEATURED: CommunityModel[] = [
  {
    label: "Sunbird — Whisper for 51 African languages",
    url: "https://huggingface.co/Sunbird/asr-whisper-51-african-languages",
    format: "transformers",
  },
  {
    label: "Sunbird — same model, faster-whisper build",
    url: "https://huggingface.co/Sunbird/faster-whisper-51-african-languages",
    format: "faster-whisper",
  },
];

/**
 * Multilingual stock models worth downloading for African languages. These are
 * ids from the built-in model catalog (see models.rs). Bigger = more accurate.
 */
export const RECOMMENDED_STOCK = ["small", "medium", "large-v3-turbo", "large-v3"];

/** Build a real Hugging Face search URL for a language's Whisper models. */
export function hfSearch(term: string): string {
  const q = encodeURIComponent(`whisper ${term}`);
  return `https://huggingface.co/models?pipeline_tag=automatic-speech-recognition&search=${q}`;
}

export const LANGUAGES: AfricanLanguage[] = [
  {
    name: "Swahili",
    localName: "Kiswahili",
    code: "sw",
    support: "fair",
    note: "One of the better-supported African languages in stock Whisper.",
    community: [
      {
        label: "dmusingu — Whisper Medium Swahili (Common Voice 14)",
        url: "https://huggingface.co/dmusingu/WHISPER-MEDIUM-SWAHILI-ASR-CV-14",
        format: "transformers",
      },
      {
        label: "RafatK — Whisper Large-v2 Swahili",
        url: "https://huggingface.co/RafatK/Whisper_Largev2-Swahili-Decodis_Comb_FT",
        format: "transformers",
      },
    ],
  },
  {
    name: "Yoruba",
    localName: "Èdè Yorùbá",
    code: "yo",
    support: "limited",
    community: [
      {
        label: "Africanvoice — Yoruba (Small)",
        url: "https://huggingface.co/Africanvoice/african_voices_yoruba_small",
        format: "transformers",
      },
      {
        label: "Africanvoice — Yoruba (Large)",
        url: "https://huggingface.co/Africanvoice/african_voices_yoruba_large",
        format: "transformers",
      },
      {
        label: "Africanvoice — Yoruba (Turbo)",
        url: "https://huggingface.co/Africanvoice/african_voices_yoruba_turbo",
        format: "transformers",
      },
    ],
  },
  { name: "Hausa", localName: "Harshen Hausa", code: "ha", support: "limited", community: [] },
  { name: "Amharic", localName: "አማርኛ", code: "am", support: "limited", community: [] },
  { name: "Afrikaans", code: "af", support: "fair", community: [] },
  { name: "Somali", localName: "Af-Soomaali", code: "so", support: "limited", community: [] },
  { name: "Shona", localName: "chiShona", code: "sn", support: "limited", community: [] },
  { name: "Lingala", localName: "Lingála", code: "ln", support: "limited", community: [] },
  { name: "Malagasy", code: "mg", support: "limited", community: [] },
  {
    name: "Arabic",
    localName: "العربية",
    code: "ar",
    support: "fair",
    note: "Widely spoken across North Africa.",
    community: [],
  },

  // --- Community / conversion only (not supported by stock Whisper) ---
  // Including The Gambia's languages — the reason Kuma exists.
  {
    name: "Wolof",
    code: null,
    support: "none",
    note: "Spoken in The Gambia & Senegal. Not in stock Whisper — needs a community model.",
    community: [],
  },
  {
    name: "Mandinka",
    localName: "Mandinka",
    code: null,
    support: "none",
    note: "Widely spoken in The Gambia. Community model + conversion required.",
    community: [],
  },
  {
    name: "Fula / Pulaar",
    code: null,
    support: "none",
    note: "Spoken across the Sahel. Community model + conversion required.",
    community: [],
  },
  {
    name: "Luganda",
    code: null,
    support: "none",
    note: "Covered by the Sunbird 51-language model above.",
    community: [],
  },
  { name: "Zulu", localName: "isiZulu", code: null, support: "none", community: [] },
  { name: "Igbo", localName: "Asụsụ Igbo", code: null, support: "none", community: [] },
  { name: "Twi / Akan", code: null, support: "none", community: [] },
  { name: "Kinyarwanda", code: null, support: "none", community: [] },
  { name: "Oromo", localName: "Afaan Oromoo", code: null, support: "none", community: [] },
];
