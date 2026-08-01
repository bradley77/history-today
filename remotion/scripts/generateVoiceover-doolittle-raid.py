#!/usr/bin/env python3
import os
import sys
import subprocess
import tempfile
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

SCRIPT_DIR  = Path(__file__).resolve().parent
REPO_ROOT   = SCRIPT_DIR.parent
MODELS_DIR  = SCRIPT_DIR / "models"
AUDIO_DIR   = REPO_ROOT / "public" / "audio"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"

LINES = [
    ("01", "This is what launching medium bombers off a carrier looked like when no one had ever done it before."),
    ("02", "Sixteen bombers. First strike on Tokyo. A one-way flight with no guaranteed way home."),
    ("03", "Eighty men. Sixteen aircraft. Bombs marked for Tokyo."),
    ("04", "Every plane was lost. Doolittle thought he'd be court-martialed. Instead, he received the Medal of Honor."),
]


def wav_to_mp3(wav_path: Path, mp3_path: Path) -> None:
    result = subprocess.run(
        [
            str(FFMPEG), "-y",
            "-i", str(wav_path),
            "-ar", "44100",
            "-ab", "128k",
            str(mp3_path),
        ],
        capture_output=True,
        text=True,
    )
    wav_path.unlink(missing_ok=True)
    if result.returncode != 0:
        print(f"ffmpeg error:\n{result.stderr}")
        sys.exit(1)


def main() -> None:
    print("=== Kokoro TTS — doolittle-raid voiceovers ===\n")

    if not MODEL_FILE.exists():
        print(f"ERROR: Model not found at {MODEL_FILE}")
        sys.exit(1)
    if not VOICES_FILE.exists():
        print(f"ERROR: Voices not found at {VOICES_FILE}")
        sys.exit(1)

    print("Loading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    use_ffmpeg = FFMPEG.exists()
    if not use_ffmpeg:
        print(f"WARNING: ffmpeg not found at {FFMPEG} — will save as WAV")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Generating {len(LINES)} lines (voice='{VOICE}', speed={SPEED})\n")

    durations = []
    for num, text in LINES:
        samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        duration_s = len(samples) / sample_rate
        durations.append(duration_s)

        mp3_path = AUDIO_DIR / f"doolittle-raid-{num}-voiceover.mp3"

        if use_ffmpeg:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            sf.write(str(tmp_path), samples, sample_rate)
            wav_to_mp3(tmp_path, mp3_path)
            out_path = mp3_path
        else:
            out_path = mp3_path.with_suffix(".wav")
            sf.write(str(out_path), samples, sample_rate)

        size_kb = out_path.stat().st_size / 1024
        print(f"  {num}: {duration_s:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")

    print(f"\nDurations (durationInSeconds = actual + 0.4s pad):")
    for (num, _), dur in zip(LINES, durations):
        print(f"  {num}: {dur:.3f}s  ->  durationInSeconds: {dur + 0.4:.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
