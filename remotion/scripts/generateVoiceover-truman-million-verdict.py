#!/usr/bin/env python3
"""
Voiceover generation script — TRUMAN-MILLION-VERDICT (ONE FRAME format)

Locked TTS settings:
  - Voice: am_adam
  - Speed: 0.95
  - Lang: en-us

Output: one MP3 per line to public/audio/, NOT concatenated.
Naming: truman-million-verdict-voiceover-1.mp3 .. -4.mp3
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
AUDIO_DIR   = REPO_ROOT / "public" / "audio"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG  = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"
PAD   = 0.4  # seconds added per line for breathing room (reported alongside raw duration)

LINES = [
    (
        "1",
        "It's often said an invasion of Japan could cost a million American lives.",
    ),
    (
        "2",
        "The declassified minutes never mention a million. They discuss thirty one thousand "
        "casualties for the invasion's opening phase.",
    ),
    (
        "3",
        "That meeting was about invading Japan, not the bomb. It's barely mentioned in the minutes.",
    ),
    (
        "4",
        "If Truman wasn't shown that casualty estimate at the meeting, did he still make the right "
        "call? Comment your verdict.",
    ),
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
    print("=== Kokoro TTS — truman-million-verdict voiceovers ===\n")

    if not MODEL_FILE.exists():
        print(f"ERROR: Model not found at {MODEL_FILE}")
        sys.exit(1)
    if not VOICES_FILE.exists():
        print(f"ERROR: Voices not found at {VOICES_FILE}")
        sys.exit(1)

    print("Loading model (cached, no download) ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    use_ffmpeg  = FFMPEG.exists()
    use_ffprobe = FFPROBE.exists()

    if not use_ffmpeg:
        print(f"WARNING: ffmpeg not found at {FFMPEG} — will save as WAV")
    if not use_ffprobe:
        print(f"WARNING: ffprobe not found — will fall back to sample-count duration")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Generating {len(LINES)} lines (voice='{VOICE}', speed={SPEED})\n")

    generated = []  # (num, out_path, sample_duration_s)
    for num, text in LINES:
        samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        sample_duration = len(samples) / sample_rate

        mp3_path = AUDIO_DIR / f"truman-million-verdict-voiceover-{num}.mp3"

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
        print(f"  Line {num}: {sample_duration:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")
        generated.append((num, out_path, sample_duration))

    # ffprobe pass — exact MP3 durations, independent of the sample-count estimate above.
    print(f"\n=== ffprobe durations ===")
    for num, path, sample_dur in generated:
        if use_ffprobe and path.suffix == ".mp3":
            dur = probe_duration(path)
        else:
            dur = sample_dur
        padded = dur + PAD
        print(f"  {path.name}  {dur:.3f}s  ->  durationInSeconds (with {PAD}s pad): {padded:.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
