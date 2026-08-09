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
AUDIO_DIR   = REPO_ROOT / "public" / "audio" / "guadalcanal"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"

# NOTE: kokoro_onnx (the library actually installed/used here, v0.4.7) has NO
# markdown phonetic-override parser — "[word](/phonemes/)" is NOT supported.
# It was tried first and confirmed broken: kokoro_onnx.tokenizer.phonemize()
# just runs the raw text through espeak with preserve_punctuation=True, so
# the brackets/slashes/IPA characters get read as literal English text (e.g.
# "slash second-district lets to sixty one double-u..."), which is why an
# earlier generation of slide 1 ballooned from 6.9s to 14.6s of garbled
# audio instead of shrinking.
#
# "Guadalcanal" itself was subsequently fixed via the direct phoneme-splice
# technique below (same pattern as GETTYSBURG_FIXED_PHONEMES in
# generateVoiceover-gettysburg-day3-qs.py) and the phonemes were confirmed
# correct (ˌɡwɑːdəlkəˈnæl, matching Wikipedia's IPA) — but a follow-up
# diagnostic pass (see the now-deleted scripts/_pronunciation-test-*.py and
# public/audio/guadalcanal/pronunciation-tests/) found the remaining quality
# problem was a kokoro_onnx SPLICING/PROSODY artifact, not a wrong-phoneme
# problem: Kokoro.create() hard-splits its input on every ".", ",", "!",
# "?", ";" into separate synthesis batches, each independently silence-
# trimmed and concatenated — and "Guadalcanal" happened to land as the last
# word before a sentence-ending period in both slides 1 and 4, right at one
# of those batch boundaries. That's not fixable at the phoneme level, so the
# word was removed from narration entirely instead (see LINES below) —
# script-level fix, no more TTS workarounds needed for this word.
#
# Same technique, second place name. Default phonemization of "Savo" from
# this voice/lang is sˈeɪvoʊ — stressed EY vowel (rhymes with "gravy"), i.e.
# "SAY-voh". Confirmed via kokoro.tokenizer.phonemize("Savo", lang="en-us").
# Correct real-world pronunciation is "SAH-voh": stress still on the first
# syllable, but with the "father" vowel (ɑː) instead of "day" (eɪ), and the
# second syllable like "vote" without the t (voʊ, unchanged from default) —
# sˈɑːvoʊ. Every character in the fixed string is present in Kokoro's vocab
# (verified), so this is a clean 1:1 swap with no vocab gaps, same as the
# Guadalcanal fix above.
SAVO_DEFAULT_PHONEMES = "sˈeɪvoʊ"
SAVO_FIXED_PHONEMES = "sˈɑːvoʊ"

# (word, default phonemes, fixed phonemes) — applied in order to whichever
# slide's phonemized text contains the default substring. "Island" (slide 3)
# needs no entry: it's already pronounced correctly by default. No
# Guadalcanal entry anymore — the word was removed from narration instead
# (see the note above).
PHONEME_FIXES = [
    ("Savo", SAVO_DEFAULT_PHONEMES, SAVO_FIXED_PHONEMES),
]

# Slides whose final synthesis input gets printed before the call, so a
# correction's presence (or a garbled fallback) can be confirmed from the
# script's own output rather than assumed.
DEBUG_SLIDES = {"01", "03", "04"}

LINES = [
    # "Guadalcanal" removed from slides 01/04 narration entirely — see the
    # PHONEME_FIXES note above. The word is no longer spoken anywhere in this
    # video; it's shown on screen instead via slide 1's ContextTag.
    # "...had largely withdrawn" replaced with a more factually precise close
    # ("Most of the people around the airfield were construction workers,
    # and they'd fled into the jungle") — the defenders weren't combat troops
    # who withdrew, they were largely unarmed construction personnel.
    ("01", "Thousands of Marines stormed the island. Almost nobody shot back. Most of the people around the airfield were construction workers, and they'd fled into the jungle."),
    # Rewritten to stop conflating the airfield capture (Aug 7-8, within a
    # day) with the renaming to Henderson Field (Aug 12-16, over a week
    # later) — the old line's "...and renamed it Henderson Field" made both
    # sound simultaneous.
    ("02", "Within a day, they'd captured the nearly finished airfield the Japanese had been building. It would soon become Henderson Field."),
    ("03", "Then, after the disaster at Savo Island, the Navy pulled its transports out, leaving the Marines with only a fraction of their supplies."),
    ("04", "Jungle disease put more Marines out of action than enemy fire. Henderson Field never fell, and this campaign marked the end of Japan's southward advance."),
    # Audio-source text ONLY — Kokoro/espeak reads the acronym "WWII"
    # ambiguously (not a real word it can sound out reliably). On-screen
    # text is UNCHANGED: GuadalcanalQS.tsx's end-card CaptionOverlay still
    # reads "...free WWII document." (house style for on-screen abbreviations),
    # only this spoken-audio source string was spelled out.
    ("05", "Comment FRONT and I'll send you the free World War Two document."),
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
    print("=== Kokoro TTS — guadalcanal voiceovers ===\n")

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

    only = set(sys.argv[1:]) or None
    lines = [pair for pair in LINES if only is None or pair[0] in only]

    print(f"Generating {len(lines)} slides (voice='{VOICE}', speed={SPEED})\n")

    durations = []
    for num, text in lines:
        phonemes = kokoro.tokenizer.phonemize(text, lang=LANG)
        applied = []
        for word, default, fixed in PHONEME_FIXES:
            if default in phonemes:
                phonemes = phonemes.replace(default, fixed)
                applied.append(word)

        if applied:
            # Debug: exact final string handed to the synthesis call — proves
            # whether each correction survives intact to this point
            # (kokoro_onnx has no "pipeline()"; Kokoro.create() below, called
            # with is_phonemes=True, IS the actual synthesis entrypoint and
            # bypasses re-phonemization entirely — text is used as raw
            # phonemes, verbatim).
            if num in DEBUG_SLIDES:
                print(f"[DEBUG] slide {num} final phonemes passed to kokoro.create(is_phonemes=True) (fixed: {', '.join(applied)}):")
                print(repr(phonemes))
            samples, sample_rate = kokoro.create(
                text=phonemes, voice=VOICE, speed=SPEED, lang=LANG, is_phonemes=True
            )
        else:
            if num in DEBUG_SLIDES:
                print(f"[DEBUG] slide {num} final text passed to kokoro.create(text=...):")
                print(repr(text))
            samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        duration_s = len(samples) / sample_rate
        durations.append(duration_s)

        mp3_path = AUDIO_DIR / f"guadalcanal-vo-{num}.mp3"

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
    for (num, _), dur in zip(lines, durations):
        print(f"  Slide {num}: {dur:.3f}s  ->  durationInSeconds: {dur + 0.4:.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
