#!/usr/bin/env python3
"""
Kokoro TTS voiceover generator — Union Sherman Scorched Earth (Quick Strike).
Generates 4 separate MP3 files, one per slide.
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

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT  = SCRIPT_DIR.parent
MODELS_DIR = SCRIPT_DIR / "models"
OUTPUT_DIR = REPO_ROOT / "public" / "audio"

MODEL_URL  = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx"
VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

# ── Voice settings ────────────────────────────────────────────────────────────

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"
SLUG  = "union-sherman-scorched-earth"

# ── Script lines (one per output file) ───────────────────────────────────────

SEGMENTS = [
    (f"{SLUG}-01.mp3", "Georgia wasn't Sherman's first march of destruction."),
    (f"{SLUG}-02.mp3", "Nine months before Georgia, he marched through Mississippi. His men destroyed one hundred fifteen miles of railroad and leveled Meridian's military infrastructure."),
    (f"{SLUG}-03.mp3", "Then came South Carolina. Columbia burned in February 1865."),
    (f"{SLUG}-04.mp3", "Comment UNION below and follow the page."),
]

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


def wav_to_mp3(tmp_path: Path, out_path: Path) -> None:
    result = subprocess.run(
        [
            str(FFMPEG), "-y",
            "-i", str(tmp_path),
            "-ar", "44100",
            "-ab", "128k",
            str(out_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"ffmpeg error:\n{result.stderr}")
        sys.exit(1)


def main() -> None:
    print("=== Kokoro TTS — Union Sherman Scorched Earth ===\n")

    # 1. Download model files if not cached
    if not MODEL_FILE.exists():
        print("Model not cached. Downloading kokoro-v1.0.int8.onnx (88 MB) ...")
        download_with_progress(MODEL_URL, MODEL_FILE)
    else:
        print(f"Model  : {MODEL_FILE.name} (cached)")

    if not VOICES_FILE.exists():
        print("Voices not cached. Downloading voices-v1.0.bin ...")
        download_with_progress(VOICES_URL, VOICES_FILE)
    else:
        print(f"Voices : {VOICES_FILE.name} (cached)")

    # 2. Load model
    print("\nLoading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    available = kokoro.get_voices()
    if VOICE not in available:
        print(f"\nERROR: Voice '{VOICE}' not found.")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 3. Generate each segment
    print(f"\nGenerating {len(SEGMENTS)} segments (voice='{VOICE}', speed={SPEED}) ...\n")

    for filename, text in SEGMENTS:
        out_path = OUTPUT_DIR / filename
        print(f"  [{filename}]")
        print(f"  Text: {text[:80]}{'...' if len(text) > 80 else ''}")

        samples, sample_rate = kokoro.create(
            text=text,
            voice=VOICE,
            speed=SPEED,
            lang=LANG,
        )

        duration_s = len(samples) / sample_rate
        print(f"  Duration: {duration_s:.3f}s", flush=True)

        if FFMPEG.exists():
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            sf.write(str(tmp_path), samples, sample_rate)
            wav_to_mp3(tmp_path, out_path)
            tmp_path.unlink(missing_ok=True)
            size_kb = out_path.stat().st_size / 1024
            print(f"  Saved: {out_path.name} ({size_kb:.0f} KB)\n")
        else:
            wav_out = out_path.with_suffix(".wav")
            sf.write(str(wav_out), samples, sample_rate)
            print(f"  WARNING: ffmpeg not found — saved as WAV: {wav_out.name}\n")

    print("Done.")


if __name__ == "__main__":
    main()
