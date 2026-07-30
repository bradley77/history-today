#!/usr/bin/env python3
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

# Slide 5's VO script spells the trigger word "seventh cav" (two words) so
# Kokoro doesn't mangle SEVENTHCAV into one run-together token. The on-screen
# trigger word and the actual FB comment trigger both stay the single string
# SEVENTHCAV -- only this spoken line is split for pronunciation.
#
# Slide 4's VO script respells "Lakota" as "Lookota". This kokoro-onnx install
# uses phonemizer-fork/espeak (see tokenizer.py), NOT misaki, so it has no
# support for markdown phonetic overrides -- tested "[Lakota](/ləˈkoʊtə/)" and
# espeak read the bracket/slash syntax as literal English letter names
# instead of applying it (confirmed via kokoro.tokenizer.phonemize(), which
# produced "lækˈoʊɾə(slˈæʃ ˈɛl ʃwːɑː strɛs kˈeɪ ˈoʊ l̩ɛɾɛtˈuːˈeɪttˈeɪ tˈiː ʃwːɑː slˈæʃ)"
# for the bracketed text -- so no override syntax is used here). Plain
# "Lakota" phonemizes to /lækˈoʊɾə/ ("LACK-oh-ruh"): stress already lands
# correctly on the "koʊ" syllable, but the first vowel comes out as æ
# ("cat") instead of the correct ə (schwa, target /ləˈkoʊtə/, "luh-KOH-tuh").
# Tried several respellings (Luhkota, Lukota, Lehkota, hyphenated forms, an
# apostrophe) via phonemize() before landing here -- ALL-CAPS syllables
# (e.g. "KOH") get read as spelled-out acronym letters by espeak, and most
# other vowel substitutions either lost the correct stress placement or
# landed on a worse vowel. "Lookota" phonemizes to /lʊkˈoʊɾə/: stress
# stays on "koʊ" and the first vowel (ʊ, as in "look") is the closest
# unstressed/reduced substitute available in plain English spelling for the
# target's schwa -- the final "ta"->flapped-r is an ordinary, acceptable
# American-English allophone of intervocalic /t/ either way. On-screen
# captionLines text in LittleBighornQS.tsx is untouched -- none of this
# reaches the screen, only the TTS engine.
LINES = [
    ("01-hook", "Their greatest victory destroyed them."),
    ("02-outnumbered", "Custer split his force in three, expecting eight hundred warriors. There were nearly two thousand."),
    ("03-killed", "Two hundred sixty eight soldiers were killed. Their greatest victory in the Plains Indian Wars."),
    ("04-backfired", "The victory backfired. Congress sent two thousand more troops and cut off food until the Lookota signed away the Black Hills."),
    ("05-endcard", "Comment seventh cav for the free Little Bighorn PDF."),
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
    print("=== Kokoro TTS — little-bighorn voiceovers ===\n")

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
    for slide, text in LINES:
        samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        duration_s = len(samples) / sample_rate
        durations.append(duration_s)

        mp3_path = AUDIO_DIR / f"little-bighorn-{slide}-voiceover.mp3"

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
        print(f"  {slide}: {duration_s:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")

    print(f"\nDurations (for durationInSeconds = actual + 0.4s pad):")
    for (slide, _), dur in zip(LINES, durations):
        print(f"  {slide}: {dur:.3f}s  ->  durationInSeconds: {dur + 0.4:.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
