#!/usr/bin/env python3
"""
Voiceover generation script — MCCLELLANLOSTORDER (BLUEGRAY Quick Strike)

Locked TTS settings:
  - Voice: am_adam
  - Speed: 0.95
  - Lang: en-us

Output: one MP3 per slide to public/audio/LostOrders/
Naming: LostOrders-vo-01.mp3, -02.mp3, -03.mp3, -04.mp3 (CTA)
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
AUDIO_DIR   = REPO_ROOT / "public" / "audio" / "LostOrders"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"

# Phoneme-injection pronunciation fix for "Maryland" (slide 01) — reusing the
# exact substitution already confirmed correct in
# generateVoiceover-antietam-phoneme-fix-v3.py (round 3, final), not a new
# guess. Kokoro's native phonemization stresses the last syllable
# (mˈɛɹɪlˌænd, "MEHR-ih-LAND"); the confirmed fix respells it unstressed
# (mˈɛɹɪlənd, "MEHR-ih-luhnd"). Applied generically below (phonemize, check
# for a known-wrong substring, substitute if found) so slides 02-04 -- which
# don't contain "Maryland" -- fall through to the original plain
# kokoro.create() call, unchanged.
SUBSTITUTIONS = [
    ("mˈɛɹɪlˌænd", "mˈɛɹɪlənd"),  # Maryland: MEHR-ih-LAND -> MEHR-ih-luhnd (confirmed good)
]

LINES = [
    (
        "01",
        "George McClellan is remembered as the general who threw away victory. "
        "His soldiers found Lee's campaign orders wrapped around cigars in a "
        "Maryland field.",
    ),
    (
        "02",
        "The order revealed Lee had split his army into four scattered pieces. "
        "McClellan said he had the paper to beat Lee.",
    ),
    (
        "03",
        "He waited eighteen hours to move. Lee reunited his army in time, "
        "and the battle became the bloodiest day in American history.",
    ),
    (
        "04",
        "Comment BLUEGRAY for the free five fact Civil War PDF.",
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


def main() -> None:
    print("=== Kokoro TTS — mcclellan-lost-order voiceovers ===\n")

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

    print(f"Generating {len(LINES)} slides (voice='{VOICE}', speed={SPEED})\n")

    durations = []
    for num, text in LINES:
        phonemes = kokoro.tokenizer.phonemize(text, LANG)
        applied_fix = False
        for wrong, correct in SUBSTITUTIONS:
            if wrong in phonemes:
                phonemes = phonemes.replace(wrong, correct)
                applied_fix = True

        if applied_fix:
            samples, sample_rate = kokoro.create(text=phonemes, voice=VOICE, speed=SPEED, lang=LANG, is_phonemes=True)
        else:
            samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        duration_s = len(samples) / sample_rate
        durations.append(duration_s)

        mp3_path = AUDIO_DIR / f"LostOrders-vo-{num}.mp3"

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
        print(f"  Slide {num}: {duration_s:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")

    print(f"\nDurations (for durationInSeconds = actual + 0.4s pad):")
    for (num, _), dur in zip(LINES, durations):
        print(f"  Slide {num}: {dur:.3f}s  ->  durationInSeconds: {dur + 0.4:.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
