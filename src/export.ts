// Transcript -> subtitle/text serialization. Pure functions, easy to test.
import type { ExportFormat, Segment, TranscriptResult } from "./types";

function pad(n: number, width = 2): string {
  return n.toString().padStart(width, "0");
}

/** Format milliseconds as SRT timestamp: HH:MM:SS,mmm */
export function srtTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const millis = Math.floor(ms % 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(millis, 3)}`;
}

/** Format milliseconds as WebVTT timestamp: HH:MM:SS.mmm */
export function vttTime(ms: number): string {
  return srtTime(ms).replace(",", ".");
}

export function toSrt(segments: Segment[]): string {
  return segments
    .map((seg, i) => {
      const idx = i + 1;
      return `${idx}\n${srtTime(seg.start)} --> ${srtTime(seg.end)}\n${seg.text.trim()}\n`;
    })
    .join("\n");
}

export function toVtt(segments: Segment[]): string {
  const body = segments
    .map(
      (seg) =>
        `${vttTime(seg.start)} --> ${vttTime(seg.end)}\n${seg.text.trim()}\n`,
    )
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

export function toTxt(segments: Segment[]): string {
  return segments
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function serialize(
  result: TranscriptResult,
  format: ExportFormat,
): string {
  switch (format) {
    case "srt":
      return toSrt(result.segments);
    case "vtt":
      return toVtt(result.segments);
    case "txt":
      return toTxt(result.segments);
  }
}

export const EXTENSIONS: Record<ExportFormat, string> = {
  srt: "srt",
  vtt: "vtt",
  txt: "txt",
};
