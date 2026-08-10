#!/usr/bin/env python3
"""
Echo & Chronicle — Per-slide Kokoro TTS voiceover generator
Video: Gulf of Tonkin Quick Strike (Vietnam / RECON series)

Generates 5 SEPARATE audio files, one per slide, per E&C video convention.
Each slide's <Audio> element in Remotion starts at its own frame offset,
and each slide's durationInSeconds = that clip's actual generated length + 0.4s pad.

This SLIDES dictionary is the authoritative source for voiceover text.
Do not pull VO wording from anywhere else.

REVISION NOTE: slide 1 date (August 4, 1964) moved to an on-screen kicker
overlay instead of spoken VO. All slides trimmed for runtime.
"""

import sys
import subprocess
import tempfile
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

SCRIPT_DIR  = Path(__file__).resolve().parent
REPO_ROOT   = SCRIPT_DIR.parent
MODELS_DIR  = SCRIPT_DIR / "models"
AUDIO_DIR   = REPO_ROOT / "public" / "audio" / "GulfOfTonkin"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"

SLIDES = [
    ("vo-01", (
        "The Navy reported a second attack in the Gulf of Tonkin, "
        "giving Johnson broad war powers."
    )),
    ("vo-02", (
        "Navy pilot James Stockdale flew over the reported battle that night. "
        "He recalled seeing no boats or wakes."
    )),
    ("vo-03", (
        "Three days later, the Senate voted eighty-eight to two. "
        "The House already passed it unanimously."
    )),
    ("vo-04", (
        "An NSA historian found intelligence supporting the second "
        "attack had been selectively presented and did not support the reported attack."
    )),
    ("vo-05-cta", (
        "Comment RECON and I'll send you the free Vietnam document."
    )),
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
    print("=== Kokoro TTS — Gulf of Tonkin Quick Strike voiceovers ===\n")

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

    print(f"Generating {len(SLIDES)} slides (voice='{VOICE}', speed={SPEED})\n")

    durations = []
    for slide_id, text in SLIDES:
        samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        duration_s = len(samples) / sample_rate
        durations.append(duration_s)

        mp3_path = AUDIO_DIR / f"{slide_id}.mp3"

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
        print(f"  {slide_id}: {duration_s:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")

    print(f"\nDurations (durationInSeconds = actual + 0.4s pad):")
    for (slide_id, _), dur in zip(SLIDES, durations):
        print(f"  {slide_id}: {dur:.3f}s  ->  durationInSeconds: {dur + 0.4:.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
