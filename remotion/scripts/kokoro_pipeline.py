#!/usr/bin/env python3
"""
Shared Kokoro TTS pipeline init for the generateVoiceover-*.py scripts.

Centralizes model/voices paths, Kokoro construction, and ffmpeg/ffprobe
helpers that were previously duplicated by hand at the top of every script
-- and, the reason this module exists, a pronunciation-fix table
(PRONUNCIATION_FIXES) that gets applied automatically whenever a known term
appears in a line, instead of a one-off fix hand-written into whichever
script happens to hit the word next.

API note: the build brief that prompted this module described the fix as
`pipeline.g2p.lexicon.golds['luftwaffe'] = 'lˈʊftvˌɑfə'` -- that's the API
of the separate `kokoro` PyPI package (KPipeline), whose G2P is misaki-based
and does expose a lexicon.golds override dict. This codebase's scripts use
`kokoro_onnx` instead (see every generateVoiceover-*.py), whose Kokoro
object has no `.g2p`/`.lexicon` at all -- it phonemizes via the `phonemizer`
package (espeak-ng backend) through `Kokoro.tokenizer.phonemize()`. There is
no golds-style lexicon to inject into on this library.
PRONUNCIATION_FIXES reproduces the same INTENT (a word -> correct-phoneme
override table, consulted automatically at synthesis time) using the
phoneme-splice technique already proven in
generateVoiceover-nuremberg-goering.py / generateVoiceover-hess-amnesia.py:
phonemize the text, find the mis-pronounced word's own phoneme span (by
phonemizing that word alone), and substitute the corrected phonemes before
synthesis (kokoro.create(..., is_phonemes=True)).

Keyed by `lang` (the same string passed to create_audio/phonemize -- "en-us",
"fr-fr", "es", ...), not a single flat table -- a mispronunciation is
language-specific: German loanwords need fixing when spoken in English, but
a proper noun mispronounced by ONE target language's phonemizer (e.g. French
espeak's language-switch heuristic flagging "Göring" as English mid-sentence
-- confirmed during the dunkirk-halt-order dub build) needs a different
correct-phoneme target than the same word spoken in English, so the same
word can appear under multiple languages with different corrections.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from kokoro_onnx import Kokoro

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
MODELS_DIR = SCRIPT_DIR / "models"
AUDIO_DIR = REPO_ROOT / "public" / "audio"

MODEL_FILE = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

# ---------------------------------------------------------------------------
# PRONUNCIATION_FIXES -- lang -> {word (lowercase): corrected phoneme string},
# in kokoro_onnx's own vocab alphabet. Add one line under the relevant lang
# as new mispronunciations turn up -- no other code changes needed;
# apply_pronunciation_fixes() below picks it up automatically for any script
# that calls create_audio() from this module.
#
# Matching is by whole word (case-insensitive) against the ORIGINAL text,
# not the phonemized output -- see apply_pronunciation_fixes().
# ---------------------------------------------------------------------------
PRONUNCIATION_FIXES: dict[str, dict[str, str]] = {
    "en-us": {
        # Default espeak-ng phonemization was "lˈʌftwɑːf" (wrong vowel/stress,
        # roughly "LUFF-twahf") -- confirmed against kokoro_onnx's own
        # phonemizer output. All characters in the corrected string are
        # present in kokoro_onnx's vocab (verified before use).
        "luftwaffe": "lˈʊftvˌɑfə",
    },
    "fr-fr": {
        # espeak-fr's language-switch heuristic doesn't recognize "Göring"
        # as French (confirmed: ANY spelling tried -- Göring, Goering,
        # Gœring, Guéring -- got flagged) and renders it in English mid-
        # sentence instead: "(en)ɡˈɜːɹɪŋ(fr)". Replaced with a hand-built
        # French-accented approximation (roughly "gueu-RING", uvular R,
        # rounded eu vowel) -- all characters confirmed present in
        # kokoro_onnx's vocab.
        "göring": "ɡøʁˈiŋ",
    },
}


def load_kokoro() -> Kokoro:
    """Construct the one Kokoro instance a script needs, with the same
    fail-fast missing-file checks every script used to duplicate by hand."""
    if not MODEL_FILE.exists():
        print(f"ERROR: Model not found at {MODEL_FILE}")
        sys.exit(1)
    if not VOICES_FILE.exists():
        print(f"ERROR: Voices not found at {VOICES_FILE}")
        sys.exit(1)
    print("Loading model ...", flush=True)
    return Kokoro(str(MODEL_FILE), str(VOICES_FILE))


def _wrong_phoneme_for(kokoro: Kokoro, word: str, lang: str) -> str:
    """What kokoro_onnx's own phonemizer currently produces for `word` in
    isolation -- used as the splice's search target, so this keeps working
    even if a future phonemizer/espeak-ng upgrade changes the wrong output."""
    return kokoro.tokenizer.phonemize(word, lang).strip(".,!?;: ")


def apply_pronunciation_fixes(kokoro: Kokoro, text: str, lang: str) -> tuple[str, bool]:
    """Phonemize `text`, then splice in any PRONUNCIATION_FIXES[lang] entry
    whose word actually appears in it. Returns (phonemes, was_patched) --
    was_patched is False when none of the known terms are present for this
    `lang`, so callers can fall back to plain-text synthesis unchanged for
    every ordinary line."""
    fixes = PRONUNCIATION_FIXES.get(lang, {})
    words_present = [
        word
        for word in fixes
        if re.search(rf"\b{re.escape(word)}\b", text, re.IGNORECASE)
    ]
    if not words_present:
        return text, False

    phonemes = kokoro.tokenizer.phonemize(text, lang)
    for word in words_present:
        wrong = _wrong_phoneme_for(kokoro, word, lang)
        correct = fixes[word]
        if wrong not in phonemes:
            print(
                f"WARNING: expected phoneme substring for {word!r} ({wrong!r}) "
                f"not found in phonemization of: {text!r} -- pronunciation fix skipped"
            )
            continue
        phonemes = phonemes.replace(wrong, correct)
    return phonemes, True


def create_audio(kokoro: Kokoro, text: str, voice: str, speed: float, lang: str):
    """Drop-in replacement for kokoro.create(text=..., voice=..., speed=...,
    lang=...) that transparently applies PRONUNCIATION_FIXES[lang] fixes
    when a known term is present in `text`. Returns the same (samples,
    sample_rate) tuple as kokoro.create()."""
    phonemes, patched = apply_pronunciation_fixes(kokoro, text, lang)
    if patched:
        print(f"  (pronunciation fix applied -- phonemes: {phonemes})")
        return kokoro.create(text=phonemes, voice=voice, speed=speed, lang=lang, is_phonemes=True)
    return kokoro.create(text=text, voice=voice, speed=speed, lang=lang)


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
