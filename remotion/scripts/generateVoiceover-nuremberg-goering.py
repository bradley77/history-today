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

# --- "Nuremberg" pronunciation fix -----------------------------------------
# First attempt was a literal hyphenated respelling ("Noor-em-burg" as text)
# fed straight to Kokoro. Confirmed WAY WORSE by ear: espeak glued the
# hyphenated respelling into one fake word with THREE separate stress peaks
# and a wrong vowel (verified via tokenizer.phonemize: nˈɔːɹˈɛmbˈɜːɡ) instead
# of fixing anything. This is the exact same failure mode already diagnosed
# and fixed for "Antietam" in generateVoiceover-antietam-phoneme-fix.py --
# see that file's docstring. So this uses that same proven technique instead:
# phonemize the sentence NORMALLY (correct spelling "Nuremberg" throughout,
# so every other word keeps its normal correct phonemization), then do a
# straight string substitution of just the "Nuremberg" phoneme substring for
# a hand-built correct one, and feed the whole spliced phoneme string back to
# Kokoro via is_phonemes=True.
#
#   Kokoro's own phonemization of "Nuremberg" (wrong): njʊɹɹˈɛmbɜːɡ
#     -- doubled r, stress on the SECOND syllable -> "nyoo-rr-EM-burg"
#   Hand-built replacement (correct):                 nˈʊɹəmbɜːɡ
#     -- single r, stress on the FIRST syllable -> "NOOR-uhm-burg"
#
# Every phoneme symbol in the replacement (ʊ, ɹ, ə, m, b, ɜː, ɡ, ˈ) already
# appears elsewhere in this exact sentence's own phonemization (e.g.
# "prosecutor", "Hermann"), so none of it is invented outside Kokoro's actual
# vocabulary for this voice/language.
WRONG_NUREMBERG_PHONEMES = "njʊɹɹˈɛmbɜːɡ"
CORRECT_NUREMBERG_PHONEMES = "nˈʊɹəmbɜːɡ"

# On-screen-correct text throughout -- NOT respelled. The phoneme splice
# happens after phonemization (see the PHONEME_SPLICE branch in main()
# below), not via any text substitution here.
LINES = [
    ("01", "The lead prosecutor at Nuremberg was supposed to destroy Hermann Göring on the stand."),
    ("02", "Instead Göring outwitted him for three days, once mocking America's own secrecy in open court."),
    ("03", "It took a British lawyer to finally rattle him, and sweat broke out on Göring's brow."),
]

# Pronunciation-fix pass: only slide 1 contains "Nuremberg", so only it needs
# regenerating. Slides 2/3 are left in LINES above (for a future full
# regeneration) but skipped below so -02.mp3/-03.mp3 are never touched.
REGENERATE = {"01"}
# Slides that need the phoneme splice above instead of a plain text pass.
PHONEME_SPLICE = {"01"}


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
    print("=== Kokoro TTS — nuremberg-goering voiceovers ===\n")

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

    durations = []  # (num, duration_s) pairs -- only for regenerated slides
    for num, text in LINES:
        if num not in REGENERATE:
            print(f"  {num}: skipped (not in this pronunciation-fix pass)")
            continue

        if num in PHONEME_SPLICE:
            phonemes = kokoro.tokenizer.phonemize(text, LANG)
            if WRONG_NUREMBERG_PHONEMES not in phonemes:
                print(f"ERROR: expected Nuremberg phoneme substring not found in {num}'s phonemization:")
                print(f"  {phonemes}")
                sys.exit(1)
            fixed_phonemes = phonemes.replace(WRONG_NUREMBERG_PHONEMES, CORRECT_NUREMBERG_PHONEMES)
            print(f"  {num}: phonemes: {fixed_phonemes}")
            samples, sample_rate = kokoro.create(
                text=fixed_phonemes, voice=VOICE, speed=SPEED, lang=LANG, is_phonemes=True,
            )
        else:
            samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)

        duration_s = len(samples) / sample_rate
        durations.append((num, duration_s))

        mp3_path = AUDIO_DIR / f"nuremberg-goering-vo-{num}.mp3"

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
        print(f"  {num}: {duration_s:.2f}s  ({size_kb:.0f} KB)  {out_path.name}")

    print(f"\nDurations (for durationInSeconds = actual + 0.4s pad):")
    for num, dur in durations:
        print(f"  {num}: {dur:.2f}s  ->  durationInSeconds: {dur + 0.4:.2f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
