#!/usr/bin/env python3
"""Scratch voiceover renderer for the B-17/Memphis Belle short, using the
cloned Chatterbox narrator voice (am_michael reference, voice-audition
round: out/voice-auditions/scorecard.md and stage3/authority/), with exact
per-sentence timing for cutting the edit to the audio.

Same sentence list, trim/pause/timing conventions as make_voiceover.py
(Kokoro version) -- this is the Chatterbox counterpart, not a replacement.
Must be run with chatterbox-env's python (chatterbox-env/Scripts/python.exe),
not the system python make_voiceover.py uses.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch
from chatterbox.tts import ChatterboxTTS

REPO_ROOT = Path(__file__).resolve().parent
REF_WAV = REPO_ROOT / "chatterbox-env" / "reference-clips" / "michael-narrator-ref.wav"

# Approved in the voice-audition round (out/voice-auditions/stage3/authority/
# michael__exag0.4_cfg0.5_temp0.75.wav).
EXAGGERATION = 0.4
CFG_WEIGHT = 0.5
TEMPERATURE = 0.75
SEED = 301

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


def set_seed(seed: int) -> None:
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def synthesize(model: ChatterboxTTS, text: str, stretch: float) -> tuple[np.ndarray, int]:
    """Synthesize one line with the cloned narrator voice. Returns (audio,
    sample_rate), sample_rate read from the model. `stretch` > 1.0 speeds
    the line up (pitch-preserving) to help hit a target pace; 1.0 = no
    change."""
    set_seed(SEED)
    wav_t = model.generate(
        text,
        audio_prompt_path=str(REF_WAV),
        exaggeration=EXAGGERATION,
        cfg_weight=CFG_WEIGHT,
        temperature=TEMPERATURE,
    )
    audio = wav_t.squeeze(0).cpu().numpy().astype(np.float32)
    sample_rate = model.sr
    if stretch != 1.0:
        audio = librosa.effects.time_stretch(audio, rate=stretch)
    return audio, sample_rate


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
    parser = argparse.ArgumentParser(description="Render the scratch voiceover with the cloned narrator voice.")
    parser.add_argument("--pause", type=float, default=0.25, help="Default pause between sentences, seconds.")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--out", default=str(REPO_ROOT / "out"))
    parser.add_argument("--stretch", type=float, default=1.0, help="Pitch-preserving time-stretch factor (>1 = faster). Use to nudge pace toward a wpm target.")
    args = parser.parse_args()

    out_dir = Path(args.out)
    sentences_dir = out_dir / "sentences"
    out_dir.mkdir(parents=True, exist_ok=True)
    sentences_dir.mkdir(parents=True, exist_ok=True)

    if not REF_WAV.exists():
        print(f"ERROR: reference clip not found at {REF_WAV}")
        raise SystemExit(1)

    print("Loading ChatterboxTTS (base, cloned narrator voice)...", flush=True)
    model = ChatterboxTTS.from_pretrained(device="cuda")

    sample_rate = None
    trimmed_clips: list[np.ndarray] = []
    for i, text in enumerate(SENTENCES, start=1):
        print(f"Generating line {i}/{len(SENTENCES)}...", flush=True)
        audio, sr = synthesize(model, text, args.stretch)
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

    summary = f"\nTotal duration: {total_duration_s:.2f}s   Total words: {total_words}   Overall words/sec: {overall_wps:.2f}   (words/min: {overall_wps*60:.1f})"
    print(summary)
    lines_out.append(summary)

    (out_dir / "timing.txt").write_text("\n".join(lines_out) + "\n", encoding="utf-8")

    print(f"\nWrote {out_dir / 'voiceover_scratch.wav'}")
    print(f"Wrote {sentences_dir}/01.wav .. {len(SENTENCES):02d}.wav")
    print(f"Wrote {out_dir / 'timing.txt'}")


if __name__ == "__main__":
    main()
