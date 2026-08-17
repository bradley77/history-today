#!/usr/bin/env python3
"""
Phoneme-injection pronunciation fix for kerry-testimony slide 4 -- "testimony".

Kokoro/espeak mispronounces "testimony" (and the whole -mony word class:
ceremony, harmony, matrimony all phonemize the same way) by reducing the
"mo" syllable to a schwa instead of the stressed "oʊ" diphthong American
English actually uses there:

  Native (wrong):  tˈɛstᵻməni      (TES-tuh-muh-nee)
  Candidate fix:   tˈɛstɪmˌoʊni    (TES-tih-MOH-nee)

The candidate substitutes espeak's own natural "oʊ" encoding (confirmed
against "moment" -> mˈoʊmənt, "phone" -> fˈoʊn in this same tokenizer) for
the wrong "ə" ending, and adds a secondary stress mark on that syllable.

The originally-requested `[testimony](/ˈtɛstɪmoʊni/)` markdown/IPA override
syntax does NOT work with this pipeline -- kokoro-onnx 0.4.7 phonemizes via
phonemizer-fork/espeak directly (kokoro.tokenizer.phonemize()), with no
markdown-parsing step. Confirmed by feeding that literal string through the
phonemizer: "testimony" phonemized identically wrong, and everything inside
the brackets/parens/slashes got read aloud as garbled extra speech ("slash
stress tie oh-pen..."). That syntax is a misaki (the official kokoro
package's G2P) feature, not a kokoro-onnx one.

IMPORTANT: this candidate has NOT been confirmed by ear -- this environment
has no audio playback or speech-to-text tooling, unlike the Antietam
phoneme-fix precedent (generateVoiceover-antietam-phoneme-fix-v3.py), which
took 3 listen-and-adjust rounds by a human before landing on a confirmed-
correct substitution. Brad needs to listen to the output and confirm before
this is treated as final.
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
AUDIO_DIR   = REPO_ROOT / "public" / "audio"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG  = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"
FPS   = 30
PAD   = 0.4

# Plain text, unaffected by the failed markdown/IPA syntax -- this is what's
# actually spoken (and phonemized) before the substitution below is applied.
TEXT = "The testimony is in the Congressional Record. So is the memo Nixon's counsel wrote."

SUBSTITUTIONS = [
    ("tˈɛstᵻməni", "tˈɛstɪmˌoʊni"),  # testimony: TES-tuh-muh-nee -> TES-tih-MOH-nee (candidate, unconfirmed by ear)
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
    print("=== Kokoro TTS -- kerry-testimony slide 4 phoneme fix (testimony) ===\n")

    if not MODEL_FILE.exists() or not VOICES_FILE.exists():
        print("ERROR: Kokoro model/voices not found in scripts/models/")
        sys.exit(1)

    print("Loading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    phonemes = kokoro.tokenizer.phonemize(TEXT, LANG)
    applied = []
    for wrong, correct in SUBSTITUTIONS:
        if wrong in phonemes:
            phonemes = phonemes.replace(wrong, correct)
            applied.append(correct)
    if not applied:
        print("ERROR: expected mispronunciation substring not found in phonemization:")
        print(f"  {phonemes}")
        sys.exit(1)

    samples, sample_rate = kokoro.create(
        text=phonemes, voice=VOICE, speed=SPEED, lang=LANG, is_phonemes=True,
    )
    sample_duration = len(samples) / sample_rate

    mp3_path = AUDIO_DIR / "kerry-testimony-vo-04.mp3"
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    sf.write(str(tmp_path), samples, sample_rate)
    wav_to_mp3(tmp_path, mp3_path)

    size_kb = mp3_path.stat().st_size / 1024
    print(f"  vo-04: {sample_duration:.3f}s  ({size_kb:.0f} KB)  {mp3_path.name}")
    print(f"    applied fix: {applied[0]}")

    dur = probe_duration(mp3_path)
    padded = dur + PAD
    frames = round(padded * FPS)
    print(f"\nffprobe duration: {dur:.3f}s  ->  durationInSeconds: {padded:.3f}  ->  durationInFrames: {frames}")

    print("\nDone. NOT confirmed by ear -- listen to the output before treating this as final.")


if __name__ == "__main__":
    main()
