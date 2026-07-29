#!/usr/bin/env python3
"""
Pronunciation-fix pass for the Antietam BLUEGRAY Quick Strike.

Regenerates ONLY slides 2, 3, 4, and the end card -- the four audio files
containing "Antietam" (slide 2 also has "Maryland") -- using respelled text
for Kokoro's benefit ONLY. The on-screen captionLines/end-card text in
AntietamQS.tsx keep the correct standard spelling; this script's respelling
never reaches the screen, only the TTS engine.

Respellings under test:
  "Antietam" -> "An-tee-tuhm"
  "Maryland" -> "Mehr-uh-lund"
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

SCRIPT_DIR  = Path(__file__).resolve().parent
REPO_ROOT   = SCRIPT_DIR.parent
MODELS_DIR  = SCRIPT_DIR / "models"
AUDIO_DIR   = REPO_ROOT / "public" / "audio" / "antietam"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG  = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"
FPS   = 30
PAD   = 0.4

# (output filename stem, TTS input text -- respelled for Kokoro only)
LINES = [
    ("slide2", "The Battle of An-tee-tuhm. September seventeenth, eighteen sixty-two, near Sharpsburg, Mehr-uh-lund. Twenty-two thousand seven hundred Americans, dead, wounded, or missing. In twelve hours."),
    ("slide3", "Photographer Alexander Gardner reached the An-tee-tuhm battlefield before the bodies were buried. No one had ever seen American war dead in a photograph before."),
    ("slide4", "Five days after An-tee-tuhm, President Lincoln used the Union's strategic success to issue the Preliminary Emancipation Proclamation."),
    ("slide5-endcard", "Comment Sharpsburg. For the five-fact An-tee-tuhm PDF. Follow for more."),
]


def wav_to_mp3(wav_path: Path, mp3_path: Path) -> None:
    result = subprocess.run(
        [str(FFMPEG), "-y", "-i", str(wav_path), "-ar", "44100", "-ab", "128k", str(mp3_path)],
        capture_output=True, text=True,
    )
    wav_path.unlink(missing_ok=True)
    if result.returncode != 0:
        print(f"ffmpeg error:\n{result.stderr}")
        sys.exit(1)


def probe_duration(mp3_path: Path) -> float:
    result = subprocess.run(
        [str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(mp3_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"ffprobe error:\n{result.stderr}")
        sys.exit(1)
    return float(result.stdout.strip())


def main() -> None:
    print("=== Kokoro TTS -- Antietam pronunciation-fix pass ===\n")

    if not MODEL_FILE.exists() or not VOICES_FILE.exists():
        print("ERROR: Kokoro model/voices not found in scripts/models/")
        sys.exit(1)

    print("Loading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    use_ffmpeg = FFMPEG.exists()
    use_ffprobe = FFPROBE.exists()

    generated = []
    for name, text in LINES:
        samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        sample_duration = len(samples) / sample_rate

        mp3_path = AUDIO_DIR / f"{name}.mp3"
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
        print(f"  {name}: {sample_duration:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")
        generated.append((name, out_path, sample_duration))

    print(f"\n=== ffprobe durations ===")
    total_audio = 0.0
    for name, path, sample_dur in generated:
        dur = probe_duration(path) if (use_ffprobe and path.suffix == ".mp3") else sample_dur
        total_audio += dur
        padded = dur + PAD
        frames = round(padded * FPS)
        print(f"  {name}.mp3  {dur:.3f}s  ->  durationInSeconds: {padded:.3f}  ->  durationInFrames: {frames}")

    print("\nDone. Listen to the 4 regenerated files and confirm pronunciation before proceeding.")


if __name__ == "__main__":
    main()
