#!/usr/bin/env python3
"""
One-off fix for saigon-execution-vo-04.mp3 (the slide 4 CTA): inserts an
explicit, deliberate silence between "Follow for more." and "Like. Save.
Share." instead of relying on Kokoro's default sentence-break timing for
that gap.

Approach (per the build brief): render the two halves as SEPARATE Kokoro
calls (same voice/speed/lang as every other line in this composition),
splice in an explicit silence of PAUSE_MS between them at the raw-sample
level, then encode the concatenated result to MP3 -- rather than trying to
tune punctuation/timing in a single Kokoro pass over the whole line.
"""
import sys
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

SCRIPT_DIR  = Path(__file__).resolve().parent
REPO_ROOT   = SCRIPT_DIR.parent
MODELS_DIR  = SCRIPT_DIR / "models"
AUDIO_DIR   = REPO_ROOT / "public" / "audio"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG  = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"

SEGMENT_A = "Follow for more."
SEGMENT_B = "Like. Save. Share."
PAUSE_MS = 275  # within the requested 250-300ms range

OUTPUT_FILE = AUDIO_DIR / "saigon-execution-vo-04.mp3"


def wav_to_mp3(wav_path: Path, mp3_path: Path) -> None:
    result = subprocess.run(
        [str(FFMPEG), "-y", "-i", str(wav_path), "-ar", "44100", "-ab", "128k", str(mp3_path)],
        capture_output=True,
        text=True,
    )
    wav_path.unlink(missing_ok=True)
    if result.returncode != 0:
        print(f"ffmpeg error:\n{result.stderr}")
        sys.exit(1)


def probe_duration(mp3_path: Path) -> float:
    result = subprocess.run(
        [
            str(FFPROBE), "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(mp3_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"ffprobe error:\n{result.stderr}")
        sys.exit(1)
    return float(result.stdout.strip())


def main() -> None:
    print("=== Kokoro TTS — saigon-execution-vo-04 pause fix ===\n")

    for f in (MODEL_FILE, VOICES_FILE, FFMPEG, FFPROBE):
        if not f.exists():
            print(f"ERROR: not found: {f}")
            sys.exit(1)

    print("Loading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    print(f"Rendering segment A: {SEGMENT_A!r}")
    samples_a, sample_rate = kokoro.create(text=SEGMENT_A, voice=VOICE, speed=SPEED, lang=LANG)
    dur_a = len(samples_a) / sample_rate
    print(f"  -> {dur_a:.3f}s")

    print(f"Rendering segment B: {SEGMENT_B!r}")
    samples_b, sample_rate_b = kokoro.create(text=SEGMENT_B, voice=VOICE, speed=SPEED, lang=LANG)
    assert sample_rate_b == sample_rate, "sample rate mismatch between segments"
    dur_b = len(samples_b) / sample_rate
    print(f"  -> {dur_b:.3f}s")

    silence_samples = int(round(sample_rate * PAUSE_MS / 1000))
    silence = np.zeros(silence_samples, dtype=samples_a.dtype)
    print(f"Inserting {PAUSE_MS}ms of explicit silence ({silence_samples} samples @ {sample_rate}Hz)")

    combined = np.concatenate([samples_a, silence, samples_b])

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    sf.write(str(tmp_path), combined, sample_rate)
    wav_to_mp3(tmp_path, OUTPUT_FILE)

    total_duration = probe_duration(OUTPUT_FILE)
    pause_start = dur_a
    pause_end = dur_a + PAUSE_MS / 1000

    size_kb = OUTPUT_FILE.stat().st_size / 1024
    print(f"\nSaved: {OUTPUT_FILE} ({size_kb:.0f} KB)")
    print(f"Segment A duration : {dur_a:.3f}s")
    print(f"Pause              : {PAUSE_MS}ms  (from ~{pause_start:.3f}s to ~{pause_end:.3f}s)")
    print(f"Segment B duration : {dur_b:.3f}s")
    print(f"Total (ffprobe)    : {total_duration:.3f}s")
    print("\nDone.")


if __name__ == "__main__":
    main()
