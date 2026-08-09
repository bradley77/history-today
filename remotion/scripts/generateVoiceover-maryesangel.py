#!/usr/bin/env python3
import subprocess
import sys
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
PAD   = 0.4  # seconds added per slide for breathing room

# (output filename stem, VO text) — filenames match each slide per the brief.
#
# 04-endcard: Kokoro/espeak was reading "MARYESANGEL" as "Mary's Angel" —
# the correct historical pronunciation of Marye's Heights is like the name
# "Marie" plus a possessive s (muh-REEZ), not "Mary's". The first respelling
# attempt ("Mahreez") didn't land right either, so this uses the real word
# "Marie's" instead, trusting Kokoro's normal dictionary pronunciation of
# that name. Respelled for THIS audio-generation input only — the on-screen
# trigger word/overlay text (CTA_CONFIG.MARYESANGEL, MaryesAngelQS.tsx) is
# untouched, since that's the literal string viewers need to type in a
# comment.
LINES = [
    ("01-battlefield", "All night, wounded men scream for water between the lines at Fredericksburg."),
    ("02-stonewall", "A Confederate sergeant can't take it. He climbs the wall unarmed, carrying water to wounded Union soldiers."),
    ("03-kirkland-monument", "Later accounts describe both sides holding their fire to let him work. Amid all that bloodshed, humanity still existed."),
    ("04-endcard", "Comment Marie's Angel for the free 5-fact Civil War PDF."),
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


def ffprobe_duration(mp3_path: Path) -> float:
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
    print("=== Kokoro TTS — MARYESANGEL (Angel of Marye's Heights) voiceovers ===\n")

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

    # Optional CLI args restrict generation to matching stems, e.g.
    # `python generateVoiceover-maryesangel.py 04-endcard` regenerates only
    # that file instead of clobbering the other three already-good takes.
    only = set(sys.argv[1:]) or None
    lines = [pair for pair in LINES if only is None or pair[0] in only]

    print(f"Generating {len(lines)} lines (voice='{VOICE}', speed={SPEED})\n")

    results = []
    for stem, text in lines:
        samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)

        mp3_path = AUDIO_DIR / f"{stem}.mp3"

        if use_ffmpeg:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            sf.write(str(tmp_path), samples, sample_rate)
            wav_to_mp3(tmp_path, mp3_path)
            out_path = mp3_path
        else:
            out_path = mp3_path.with_suffix(".wav")
            sf.write(str(out_path), samples, sample_rate)

        # Prefer ffprobe against the actual encoded file (matches every other
        # script's measured-duration convention) over the raw sample count.
        duration_s = ffprobe_duration(out_path) if use_ffmpeg else len(samples) / sample_rate
        results.append((stem, duration_s))

        size_kb = out_path.stat().st_size / 1024
        print(f"  {stem}: {duration_s:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")

    print(f"\nDurations (durationInSeconds = actual + {PAD}s pad):")
    for stem, dur in results:
        print(f"  {stem}: {dur:.3f}s  ->  durationInSeconds: {dur + PAD:.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
