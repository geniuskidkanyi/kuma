import { useEffect, useRef } from "react";
import { clock } from "../format";
import type { Segment } from "../types";

interface Props {
  segments: Segment[];
  onEdit: (id: number, text: string) => void;
  /** Segment currently playing, for highlight + auto-scroll. */
  activeId?: number | null;
  /** Seek the audio to a timestamp (ms). */
  onSeek?: (ms: number) => void;
  /** Ids of segments matching the current search. */
  matchIds?: Set<number>;
  /** The focused search match, scrolled into view. */
  currentMatchId?: number | null;
}

export default function TranscriptView({
  segments,
  onEdit,
  activeId,
  onSeek,
  matchIds,
  currentMatchId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the playing segment visible.
  useEffect(() => {
    containerRef.current
      ?.querySelector(".segment.active")
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  // Keep the current search match visible.
  useEffect(() => {
    containerRef.current
      ?.querySelector(".segment.match-current")
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentMatchId]);

  if (segments.length === 0) {
    return (
      <div className="transcript empty">
        <p>No transcript yet.</p>
      </div>
    );
  }

  return (
    <div className="transcript" ref={containerRef}>
      {segments.map((seg) => {
        const classes = ["segment"];
        if (seg.id === activeId) classes.push("active");
        if (matchIds?.has(seg.id)) classes.push("match");
        if (seg.id === currentMatchId) classes.push("match-current");
        return (
          <div className={classes.join(" ")} key={seg.id}>
            <span
              className="ts"
              onClick={() => onSeek?.(seg.start)}
              title="Jump to this point"
            >
              {clock(seg.start)}
            </span>
            <div
              className="seg-text"
              // Re-mount when the text changes programmatically (e.g. find &
              // replace) so the contentEditable DOM reflects the new value.
              key={`${seg.id}:${seg.text}`}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onBlur={(e) => onEdit(seg.id, e.currentTarget.textContent ?? "")}
            >
              {seg.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}
