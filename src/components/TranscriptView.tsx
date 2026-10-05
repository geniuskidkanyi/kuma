import { clock } from "../format";
import type { Segment } from "../types";

interface Props {
  segments: Segment[];
  onEdit: (id: number, text: string) => void;
}

export default function TranscriptView({ segments, onEdit }: Props) {
  if (segments.length === 0) {
    return (
      <div className="transcript empty">
        <p>No transcript yet.</p>
      </div>
    );
  }

  return (
    <div className="transcript">
      {segments.map((seg) => (
        <div className="segment" key={seg.id}>
          <span className="ts">{clock(seg.start)}</span>
          <div
            className="seg-text"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(e) => onEdit(seg.id, e.currentTarget.textContent ?? "")}
          >
            {seg.text}
          </div>
        </div>
      ))}
    </div>
  );
}
