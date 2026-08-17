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

LINES = [
    ("01", "At twenty-seven, Kerry testified against the war. The White House fought back."),
    ("02", "Nixon's White House counsel put it in writing: destroy this young demagogue before he becomes another Ralph Nader."),
    ("03", "Two months later, the president personally met a rival veteran in the Oval Office."),
    ("04", "The testimony is in the Congressional Record. So is the memo Nixon's counsel wrote."),
]

# Per-slide phoneme-injection fixes for words Kokoro/espeak mispronounces.
# NOT applied to the raw text above — applied to that slide's PHONEMIZED
# output as a string substitution, then synthesized via is_phonemes=True
# (see generateVoiceover-antietam-phoneme-fix-v3.py for the original version
# of this technique). Slide 4's "testimony" phonemizes as tˈɛstᵻməni
# (TES-tuh-muh-nee) natively — the whole "-mony" word class does the same
# thing (ceremony, harmony, matrimony all reduce that syllable to a schwa) —
# corrected here to tˈɛstɪmˌoʊni (TES-tih-MOH-nee), matching espeak's own
# "oʊ" encoding confirmed against "moment" -> mˈoʊmənt in this same
# tokenizer. NOTE: this candidate has NOT been confirmed by ear (no audio
# playback/STT tooling in this environment) — unlike the Antietam precedent,
# which took 3 human-listened rounds to land on a confirmed-correct
# substitution. Listen to vo-04.mp3 and update this table if it's off.
#
# A `[word](/ipa/)` markdown/IPA override was tried first per the original
# ask and does NOT work with this pipeline — kokoro-onnx 0.4.7 phonemizes
# via phonemizer-fork/espeak directly with no markdown-parsing step (that
# syntax is a misaki/official-kokoro feature). Confirmed by testing: the
# target word still phonemized wrong, and the bracket/slash/IPA characters
# got read aloud as extra garbled speech.
PHONEME_SUBSTITUTIONS = {
    "04": [("tˈɛstᵻməni", "tˈɛstɪmˌoʊni")],
}


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
    print("=== Kokoro TTS — kerry-testimony voiceovers ===\n")

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

    print(f"Generating {len(LINES)} lines (voice='{VOICE}', speed={SPEED})\n")

    durations = []
    for num, text in LINES:
        subs = PHONEME_SUBSTITUTIONS.get(num)
        if subs:
            phonemes = kokoro.tokenizer.phonemize(text, LANG)
            for wrong, correct in subs:
                if wrong not in phonemes:
                    print(f"WARNING: expected mispronunciation substring not found for vo-{num}, using native phonemization:")
                    print(f"  {phonemes}")
                    break
                phonemes = phonemes.replace(wrong, correct)
            samples, sample_rate = kokoro.create(text=phonemes, voice=VOICE, speed=SPEED, lang=LANG, is_phonemes=True)
        else:
            samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        duration_s = len(samples) / sample_rate
        durations.append(duration_s)

        mp3_path = AUDIO_DIR / f"kerry-testimony-vo-{num}.mp3"

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
        print(f"  vo-{num}: {duration_s:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")

    print(f"\nDurations (durationInSeconds = actual + 0.4s pad):")
    for (num, _), dur in zip(LINES, durations):
        print(f"  vo-{num}: {dur:.3f}s  ->  durationInSeconds: {dur + 0.4:.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
