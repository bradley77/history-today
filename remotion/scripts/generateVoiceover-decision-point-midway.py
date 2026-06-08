#!/usr/bin/env python3
"""
Kokoro TTS voiceover generator for the Decision Point: Midway composition.
Model files are downloaded automatically on first run (~88 MB, cached in scripts/models/).
"""
import os
import sys
import urllib.request
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR  = Path(__file__).resolve().parent
REPO_ROOT   = SCRIPT_DIR.parent
MODELS_DIR  = SCRIPT_DIR / "models"
OUTPUT_FILE = REPO_ROOT / "public" / "audio" / "decision-point-midway-voiceover.mp3"

# int8 model — 88 MB, good quality, fast inference
MODEL_URL   = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx"
VOICES_URL  = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

# Remotion's bundled ffmpeg — used for WAV → MP3 conversion
FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

# ── Voice settings ────────────────────────────────────────────────────────────

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"

# ── Script text ───────────────────────────────────────────────────────────────

# Each list entry is one slide's worth of voiceover text.
# They are concatenated for the final MP3, and measured individually for slide timing.
SEGMENTS = [
    # Slide 1
    "On June four, nineteen forty-two, the Japanese navy had every advantage — more ships, more planes, more experience.",
    # Slide 2
    "But one admiral made a decision three weeks earlier that handed the Americans the entire Pacific War.",
    # Slide 3
    "Isoroku Yamamoto ordered his strike force to maintain complete radio silence crossing the North Pacific. No transmissions. No position updates. No coordination with his own fleet.",
    # Slide 4
    "The problem: his carrier strike force and his battleship support group were eight hundred miles apart — and neither could talk to the other.",
    # Slide 5
    "When Commander Joseph Rochefort's codebreakers at Station Hypo confirmed the target was Midway, Admiral Nimitz knew exactly where to position three American carriers.",
    # Slide 6
    "The Japanese never knew they were there. Radio silence had hidden the Americans too.",
    # Slide 7
    "At ten twenty-two AM, thirty-seven dive bombers found three Japanese carriers with their decks loaded with armed aircraft and fuel lines running.",
    # Slide 8
    "In six minutes, the battle — and the war — turned.",
    # Slide 9
    "The decision that lost Midway wasn't made on June fourth. It was made in May, in silence.",
]

TEXT = "\n\n".join(SEGMENTS)

# ─────────────────────────────────────────────────────────────────────────────


def download_with_progress(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  Downloading {dest.name} ...", flush=True)

    def _progress(count, block_size, total):
        if total > 0:
            pct = min(100, count * block_size * 100 // total)
            print(f"\r  {pct:3d}%", end="", flush=True)

    urllib.request.urlretrieve(url, dest, reporthook=_progress)
    size_mb = dest.stat().st_size / 1024 / 1024
    print(f"\r  Done — {size_mb:.1f} MB        ")


def main() -> None:
    print("=== Kokoro TTS — Decision Point: Midway voiceover ===\n")

    # 1. Download model files if not already cached
    if not MODEL_FILE.exists():
        print("Model not cached. Downloading kokoro-v1.0.int8.onnx (88 MB) ...")
        download_with_progress(MODEL_URL, MODEL_FILE)
    else:
        print(f"Model   : {MODEL_FILE.name} (cached)")

    if not VOICES_FILE.exists():
        print("Voices not cached. Downloading voices-v1.0.bin ...")
        download_with_progress(VOICES_URL, VOICES_FILE)
    else:
        print(f"Voices  : {VOICES_FILE.name} (cached)")

    # 2. Load model
    print("\nLoading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    available = kokoro.get_voices()
    print(f"Voices available: {len(available)}  ({', '.join(sorted(available)[:8])} ...)")

    if VOICE not in available:
        female = [v for v in available if v.startswith("af_")]
        male   = [v for v in available if v.startswith("am_")]
        print(f"\nERROR: Voice '{VOICE}' not found in voices file.")
        print(f"  American female: {female}")
        print(f"  American male  : {male}")
        sys.exit(1)

    # 3. Generate audio
    word_count = len(TEXT.split())
    print(f"\nGenerating audio ({word_count} words, voice='{VOICE}', speed={SPEED}) ...", flush=True)

    samples, sample_rate = kokoro.create(
        text=TEXT,
        voice=VOICE,
        speed=SPEED,
        lang=LANG,
    )

    duration_s = len(samples) / sample_rate
    print(f"Generated {duration_s:.1f}s of audio at {sample_rate} Hz")

    # Per-segment timing — generate each slide's text separately and measure
    print("\n-- Per-segment timing (use these for slide durations in decision-point-midway.js) --")
    slide_names = [
        "Slide 1 (japanese-advantage)",
        "Slide 2 (one-decision)",
        "Slide 3 (radio-silence-order)",
        "Slide 4 (the-problem)",
        "Slide 5 (codebreakers)",
        "Slide 6 (hidden-americans)",
        "Slide 7 (dive-bombers)",
        "Slide 8 (six-minutes)",
        "Slide 9 (outro)",
    ]
    total_seg_frames = 0
    for i, (seg_text, name) in enumerate(zip(SEGMENTS, slide_names)):
        seg_samples, _ = kokoro.create(text=seg_text, voice=VOICE, speed=SPEED, lang=LANG)
        seg_s = len(seg_samples) / sample_rate
        seg_frames = round(seg_s * 30)
        total_seg_frames += seg_frames
        print(f"  {name}: {seg_s:.2f}s = {seg_frames} frames")
    print(f"  Total (segments): {total_seg_frames} frames = {total_seg_frames/30:.1f}s")
    total_frames = round(duration_s * 30)
    print(f"  Total (combined): {total_frames} frames = {duration_s:.1f}s")

    # 4. Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    if FFMPEG.exists():
        # Write temp WAV, convert to MP3 with Remotion's bundled ffmpeg, delete temp
        print("\nConverting to MP3 via Remotion ffmpeg ...", flush=True)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)

        sf.write(str(tmp_path), samples, sample_rate)

        result = subprocess.run(
            [
                str(FFMPEG), "-y",
                "-i", str(tmp_path),
                "-ar", "44100",
                "-ab", "128k",
                str(OUTPUT_FILE),
            ],
            capture_output=True,
            text=True,
        )
        tmp_path.unlink(missing_ok=True)

        if result.returncode != 0:
            print(f"ffmpeg error:\n{result.stderr}")
            sys.exit(1)

        size_kb = OUTPUT_FILE.stat().st_size / 1024
        print(f"Saved  : {OUTPUT_FILE}")
        print(f"Size   : {size_kb:.0f} KB")

    else:
        # No ffmpeg — write WAV and warn
        wav_out = OUTPUT_FILE.with_suffix(".wav")
        sf.write(str(wav_out), samples, sample_rate)
        size_kb = wav_out.stat().st_size / 1024
        print(f"\nWARNING: ffmpeg not found at expected path:")
        print(f"  {FFMPEG}")
        print(f"Saved as WAV instead: {wav_out} ({size_kb:.0f} KB)")
        print("Update the audio src in the Midway composition to the .wav path if using this file.")

    print("\nDone.")


if __name__ == "__main__":
    main()
