#!/usr/bin/env python3
"""
Scratch voiceover renderer for a short-form history video, with exact
per-sentence timing for cutting the edit to the audio.

Reuses this repo's standard Kokoro settings (remotion/scripts/generateVoiceover-*.py):
voice "am_adam", speed 0.95, lang "en-us", via kokoro_onnx.Kokoro. Model/voices
files are loaded from remotion/scripts/models/.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

REPO_ROOT = Path(__file__).resolve().parent
MODELS_DIR = REPO_ROOT / "remotion" / "scripts" / "models"
MODEL_FILE = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

VOICE = "am_adam"
SPEED = 0.95
LANG = "en-us"

SENTENCES = [
    "Before they flew, a chaplain blessed the planes and the crews.",
    "When a formation came back, the bombers peeled off and landed.",
    "This is the Memphis Belle.",
    "Twenty-four bombs are painted on her nose.",
    "Yet on May seventeenth, nineteen forty-three, her crew completed their twenty-fifth mission.",
    "That mission was the plane's twenty-fourth.",
    "Her crew had flown five of those missions in other B seventeens.",
]

# Per-sentence pause overrides: the pause AFTER sentence index i (0-based),
# in seconds. Falls back to --pause when not present here.
PAUSE_OVERRIDES: dict[int, float] = {}

END_SILENCE_S = 0.4
SILENCE_THRESHOLD_DBFS = -45.0
SILENCE_KEEP_S = 0.03


def synthesize(kokoro: Kokoro, text: str) -> tuple[np.ndarray, int]:
    """Synthesize one line of text, concatenating every chunk Kokoro
    returns for it into a single mono float32 array. Returns (audio,
    sample_rate) with sample_rate read from the model's own output."""
    chunks: list[np.ndarray] = []
    sample_rate = None
    audio, sr = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG, trim=False)
    sample_rate = sr
    chunks.append(np.asarray(audio, dtype=np.float32))
    combined = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
    return combined.astype(np.float32), sample_rate


def trim_silence(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Trim leading/trailing silence at ~SILENCE_THRESHOLD_DBFS, keeping
    ~SILENCE_KEEP_S of padding on each side."""
    if len(audio) == 0:
        return audio

    threshold = 10.0 ** (SILENCE_THRESHOLD_DBFS / 20.0)
    above = np.abs(audio) > threshold
    if not np.any(above):
        return audio

    first = int(np.argmax(above))
    last = int(len(above) - 1 - np.argmax(above[::-1]))

    keep = int(SILENCE_KEEP_S * sample_rate)
    start = max(0, first - keep)
    end = min(len(audio), last + 1 + keep)
    return audio[start:end]


def main() -> None:
    global VOICE, SPEED

    parser = argparse.ArgumentParser(description="Render a scratch voiceover with exact per-sentence timing.")
    parser.add_argument("--voice", default=VOICE)
    parser.add_argument("--speed", type=float, default=SPEED)
    parser.add_argument("--pause", type=float, default=0.25, help="Default pause between sentences, seconds.")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--out", default=str(REPO_ROOT / "out"))
    args = parser.parse_args()

    VOICE = args.voice
    SPEED = args.speed

    out_dir = Path(args.out)
    sentences_dir = out_dir / "sentences"
    out_dir.mkdir(parents=True, exist_ok=True)
    sentences_dir.mkdir(parents=True, exist_ok=True)

    if not MODEL_FILE.exists():
        print(f"ERROR: Model not found at {MODEL_FILE}")
        raise SystemExit(1)
    if not VOICES_FILE.exists():
        print(f"ERROR: Voices not found at {VOICES_FILE}")
        raise SystemExit(1)

    print("Loading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    sample_rate = None
    trimmed_clips: list[np.ndarray] = []
    for i, text in enumerate(SENTENCES, start=1):
        audio, sr = synthesize(kokoro, text)
        sample_rate = sr
        clip = trim_silence(audio, sr)
        trimmed_clips.append(clip)
        sf.write(str(sentences_dir / f"{i:02d}.wav"), clip, sr)

    assert sample_rate is not None

    pieces: list[np.ndarray] = []
    starts: list[int] = []
    ends: list[int] = []
    cursor = 0
    for i, clip in enumerate(trimmed_clips):
        pieces.append(clip)
        starts.append(cursor)
        cursor += len(clip)
        ends.append(cursor)

        is_last = i == len(trimmed_clips) - 1
        pause_s = END_SILENCE_S if is_last else PAUSE_OVERRIDES.get(i, args.pause)
        pause_samples = int(round(pause_s * sample_rate))
        if pause_samples > 0:
            pieces.append(np.zeros(pause_samples, dtype=np.float32))
            cursor += pause_samples

    full = np.concatenate(pieces).astype(np.float32)
    sf.write(str(out_dir / "voiceover_scratch.wav"), full, sample_rate)

    fps = args.fps
    rows = []
    total_words = 0
    for i, text in enumerate(SENTENCES):
        start_frame = starts[i]
        end_frame = ends[i]
        start_s = start_frame / sample_rate
        end_s = end_frame / sample_rate
        dur_s = end_s - start_s
        words = len(text.split())
        total_words += words
        wps = words / dur_s if dur_s > 0 else 0.0
        rows.append(
            {
                "n": i + 1,
                "start_s": start_s,
                "end_s": end_s,
                "dur_s": dur_s,
                "words": words,
                "wps": wps,
                "start_frame": round(start_s * fps),
                "end_frame": round(end_s * fps),
                "text": text,
            }
        )

    total_duration_s = len(full) / sample_rate
    overall_wps = total_words / total_duration_s if total_duration_s > 0 else 0.0

    header = f"{'#':<3}{'start':>8}{'end':>8}{'dur':>7}{'words':>7}{'w/s':>6}{'sframe':>8}{'eframe':>8}  text"
    print()
    print(header)
    print("-" * len(header))
    lines_out = [header, "-" * len(header)]
    for r in rows:
        line = (
            f"{r['n']:<3}{r['start_s']:>8.2f}{r['end_s']:>8.2f}{r['dur_s']:>7.2f}"
            f"{r['words']:>7}{r['wps']:>6.1f}{r['start_frame']:>8}{r['end_frame']:>8}  {r['text']}"
        )
        print(line)
        lines_out.append(line)

    summary = f"\nTotal duration: {total_duration_s:.2f}s   Total words: {total_words}   Overall words/sec: {overall_wps:.2f}"
    print(summary)
    lines_out.append(summary)

    (out_dir / "timing.txt").write_text("\n".join(lines_out) + "\n", encoding="utf-8")

    print(f"\nWrote {out_dir / 'voiceover_scratch.wav'}")
    print(f"Wrote {sentences_dir}/01.wav .. {len(SENTENCES):02d}.wav")
    print(f"Wrote {out_dir / 'timing.txt'}")


if __name__ == "__main__":
    main()
