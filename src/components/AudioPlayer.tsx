import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { clock } from "../format";

export interface AudioPlayerHandle {
  /** Seek to a position (ms) and start playing. */
  seek: (ms: number) => void;
}

interface Props {
  src: string;
  onTime: (ms: number) => void;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, Props>(
  ({ src, onTime }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);

    useImperativeHandle(ref, () => ({
      seek(ms: number) {
        const a = audioRef.current;
        if (!a) return;
        a.currentTime = ms / 1000;
        a.play();
      },
    }));

    // Reset when the source changes.
    useEffect(() => {
      setPlaying(false);
      setCurrent(0);
      setDuration(0);
    }, [src]);

    function toggle() {
      const a = audioRef.current;
      if (!a) return;
      if (a.paused) a.play();
      else a.pause();
    }

    function onScrub(e: React.ChangeEvent<HTMLInputElement>) {
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = Number(e.target.value);
    }

    return (
      <div className="player">
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setCurrent(t);
            onTime(Math.floor(t * 1000));
          }}
        />
        <button className="play-btn" onClick={toggle} aria-label="Play/pause">
          {playing ? "⏸" : "▶"}
        </button>
        <span className="player-time">{clock(current * 1000)}</span>
        <input
          className="scrub"
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={current}
          onChange={onScrub}
        />
        <span className="player-time">{clock(duration * 1000)}</span>
      </div>
    );
  },
);

AudioPlayer.displayName = "AudioPlayer";
export default AudioPlayer;
