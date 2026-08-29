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

FFMPEG  = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"
PAD   = 0.4

# On-screen-correct spelling throughout for "Nuremberg" -- NOT respelled in
# text; that fix happens after phonemization (see PHONEME_SPLICE branch in
# main()). "1945" and "Ohrdruf" below ARE respelled directly in the TTS
# input text (per this project's standing number-formatting rule and a
# by-ear pronunciation fix, respectively) -- on-screen caption/label text
# for both stays exactly as originally written ("1945" as digits, "Ohrdruf"
# correctly spelled); only what Kokoro reads is affected. See the two
# comment blocks below for each fix's derivation.
LINES = [
    ("01", "Eisenhower toured a Nazi camp in April nineteen forty-five. What he did next had nothing to do with winning the war."),
    ("02", "Soldiers found piles of bodies at Ordroof. Eisenhower walked through personally. Patton became physically ill and refused to enter one room."),
    ("03", "Eisenhower said what he saw beggared description. He proposed sending journalists and Congressmen to see it for themselves."),
    ("04", "Seven months later, that kind of documentation became core evidence at the Nuremberg trials."),
]

# "1945" fix (slide 01) -- per the project's locked number-formatting rule,
# ALL numbers in TTS input must be spelled as words; Kokoro reads bare
# digit-years like "1945" as "nineteen hundred forty-five" instead of the
# natural "nineteen forty-five". Grepped all 4 lines above for any other
# literal digits after this was caught by ear -- "1945" was the only one;
# "one room" in slide 02 was already spelled as a word.
#
# "Ohrdruf" fix (slide 02) -- verified via kokoro.tokenizer.phonemize (same
# method used for the Nuremberg fix below): the correct spelling phonemizes
# to ˈoʊədɹˌʌf ("OH-uh-druhf" -- wrong vowel in the second syllable, and a
# diphthong+schwa instead of a clean "or" in the first), not the target
# "OHR-droof" (first syllable rhymes with door/ore, second with roof/spoof,
# stress on the first syllable -- confirmed via howtopronounce.com and
# Wiktionary). Tested respellings by phonemizing each in isolation and in
# the full slide-02 sentence:
#   "Ordruf"    -> ˈɔːɹdɹʌf   -- right first syllable, still wrong vowel in
#                                the second syllable
#   "Or-droof"  -> ɔːɹdɹˈuːf  -- right vowels, but hyphenating splits it into
#                                two words for espeak and moves the stress
#                                onto the SECOND syllable (wrong)
#   "Ordroof"   -> ˈɔːɹdɹuːf  -- exact match: first-syllable stress, "or" +
#                                "droof", confirmed unchanged when phonemized
#                                inside the full sentence too
# "Ordroof" (one word, no hyphen) is the fix used below. Not verified by ear
# (no audio-transcription tool available in this environment to cross-check
# objectively -- faster-whisper failed to load here under an Application
# Control policy blocking one of its native DLLs), so isolated clips of both
# the original and fixed spelling were generated and handed off for a human
# ear-check alongside this phoneme-level analysis.
#
# "Nuremberg" pronunciation fix -- identical substitution already proven on
# generateVoiceover-nuremberg-goering.py and reused verbatim on
# generateVoiceover-hess-amnesia.py (see nuremberg-goering.py's docstring for
# the full derivation: Kokoro's own phonemization doubles the r and stresses
# the wrong syllable -- "nyoo-rr-EM-burg" -- so this splices in a hand-built
# correct phoneme string -- "NOOR-uhm-burg" -- instead). Reused verbatim
# here too, not re-derived, for pronunciation consistency across all three
# videos.
WRONG_NUREMBERG_PHONEMES = "njʊɹɹˈɛmbɜːɡ"
CORRECT_NUREMBERG_PHONEMES = "nˈʊɹəmbɜːɡ"

# Pronunciation-fix pass: 01 (year) and 02 (Ohrdruf respelling) are
# regenerated this pass. 03 is unaffected (no digits, no mispronounced
# names) and 04 was already regenerated + signed off in the prior Nuremberg
# fix pass -- neither is touched here.
REGENERATE = {"01", "02"}
PHONEME_SPLICE = {"04"}


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
    print("=== Kokoro TTS — eisenhower-photographed-evidence voiceovers (1945 + Ohrdruf pronunciation fixes, slides 01/02 only) ===\n")

    if not MODEL_FILE.exists():
        print(f"ERROR: Model not found at {MODEL_FILE}")
        sys.exit(1)
    if not VOICES_FILE.exists():
        print(f"ERROR: Voices not found at {VOICES_FILE}")
        sys.exit(1)

    print("Loading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    use_ffmpeg  = FFMPEG.exists()
    use_ffprobe = FFPROBE.exists()
    if not use_ffmpeg:
        print(f"WARNING: ffmpeg not found at {FFMPEG} — will save as WAV")
    if not use_ffprobe:
        print(f"WARNING: ffprobe not found — will fall back to sample-count duration")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Generating {len(LINES)} lines (voice='{VOICE}', speed={SPEED})\n")

    results = []  # (num, mp3_path, sample_duration_or_None)
    for num, text in LINES:
        mp3_path = AUDIO_DIR / f"eisenhower-photographed-evidence-vo-{num}.mp3"

        if num not in REGENERATE:
            if not mp3_path.exists():
                print(f"ERROR: vo-{num}.mp3 expected to already exist (reused, not regenerated) but is missing")
                sys.exit(1)
            print(f"  vo-{num}: reused as-is (already correct, signed off — not regenerated)")
            results.append((num, mp3_path, None))
            continue

        if num in PHONEME_SPLICE:
            phonemes = kokoro.tokenizer.phonemize(text, LANG)
            if WRONG_NUREMBERG_PHONEMES not in phonemes:
                print(f"ERROR: expected Nuremberg phoneme substring not found in vo-{num}'s phonemization:")
                print(f"  {phonemes}")
                sys.exit(1)
            fixed_phonemes = phonemes.replace(WRONG_NUREMBERG_PHONEMES, CORRECT_NUREMBERG_PHONEMES)
            print(f"  vo-{num}: phonemes: {fixed_phonemes}")
            samples, sample_rate = kokoro.create(
                text=fixed_phonemes, voice=VOICE, speed=SPEED, lang=LANG, is_phonemes=True,
            )
        else:
            samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        sample_duration = len(samples) / sample_rate

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
        print(f"  vo-{num}: {sample_duration:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")
        results.append((num, out_path, sample_duration))

    print(f"\n=== ffprobe durations ===")
    for num, path, sample_dur in results:
        if use_ffprobe and path.suffix == ".mp3":
            dur = probe_duration(path)
        else:
            dur = sample_dur
        tag = "REGENERATED" if num in REGENERATE else "unchanged"
        print(f"  vo-{num}.mp3  {dur:.3f}s  ->  durationInSeconds: {dur + PAD:.3f}  ({tag})")

    print("\nDone.")


if __name__ == "__main__":
    main()
