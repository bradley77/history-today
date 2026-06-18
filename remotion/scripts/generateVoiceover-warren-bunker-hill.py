#!/usr/bin/env python3
"""
Kokoro TTS voiceover generator for the Warren Bunker Hill composition.
Generates one MP3 per slide line (warren-bunker-hill-vo-01.mp3 … -08.mp3).
"""
import sys
import urllib.request
import subprocess
import tempfile
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR  = Path(__file__).resolve().parent
REPO_ROOT   = SCRIPT_DIR.parent
MODELS_DIR  = SCRIPT_DIR / "models"
AUDIO_DIR   = REPO_ROOT / "public" / "audio"

MODEL_URL   = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx"
VOICES_URL  = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

# ── Voice settings ────────────────────────────────────────────────────────────

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"

# ── Script lines (one per slide, in order) ────────────────────────────────────

LINES = [
    ("01", "Two generals begged him to take command. He said no."),
    ("02", "Joseph Warren ran the largest medical practice in Boston."),
    ("03", "He's the one who sent Paul Revere riding into the night."),
    ("04", "Three days before the battle, Warren was commissioned a major general."),
    ("05", "He turned down command. Picked up a musket. Got in line as a private."),
    ("06", "Twice, the colonists held the line and threw the British back."),
    ("07", "On the third assault, out of ammunition, Warren was killed instantly."),
    ("08", "His body was unrecognizable. Paul Revere identified him by a tooth he made himself. Would you have done what he did? Drop a comment and let me know. Follow the page for more stories like this one."),
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
        [str(FFMPEG), "-y", "-i", str(tmp_path), "-ar", "44100", "-ab", "128k", str(out_path)],
        capture_output=True,
        text=True,
    )
    tmp_path.unlink(missing_ok=True)
    if result.returncode != 0:
        print(f"ffmpeg error:\n{result.stderr}")
        sys.exit(1)


def main() -> None:
    print("=== Kokoro TTS — Warren Bunker Hill per-slide voiceovers ===\n")

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

    print("\nLoading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    available = kokoro.get_voices()
    if VOICE not in available:
        print(f"ERROR: Voice '{VOICE}' not found.")
        sys.exit(1)

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    use_ffmpeg = FFMPEG.exists()
    if not use_ffmpeg:
        print(f"WARNING: ffmpeg not found at {FFMPEG} — will save WAV files instead.\n")

    print(f"Generating {len(LINES)} slide voiceovers (voice='{VOICE}', speed={SPEED}) ...\n")

    durations = []
    for num, text in LINES:
        samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        duration_s = len(samples) / sample_rate
        durations.append(duration_s)

        out_file = AUDIO_DIR / f"warren-bunker-hill-vo-{num}.mp3"
        if use_ffmpeg:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            sf.write(str(tmp_path), samples, sample_rate)
            wav_to_mp3(tmp_path, out_file)
        else:
            out_file = out_file.with_suffix(".wav")
            sf.write(str(out_file), samples, sample_rate)

        size_kb = out_file.stat().st_size / 1024
        print(f"  Slide {num}: {duration_s:.3f}s  ({size_kb:.0f} KB)  {out_file.name}")

    total = sum(durations)
    print(f"\nTotal voiceover duration: {total:.3f}s")
    print("\nDone.")


if __name__ == "__main__":
    main()
