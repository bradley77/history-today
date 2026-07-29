#!/usr/bin/env python3
"""
Phoneme-injection pronunciation fix, round 2: Maryland.

Same technique as generateVoiceover-antietam-phoneme-fix.py (which fixed
"Antietam" and is confirmed good) -- phonemize each sentence with correct
spelling, then splice a hand-built correct phoneme sequence over just the
mispronounced word, then regenerate via is_phonemes=True.

Kokoro's native phonemization of "Maryland" is `mˈɛɹɪlˌænd` -- "MEHR-ih-LAND"
(secondary stress AND a full /æ/ vowel on the final syllable). Target is
"MEHR-uh-lund": single primary stress on the first syllable only, both
following syllables reduced (`ə` for the middle "uh", `ʌ` for the final
"-lund", matching the STRUT vowel in "fund"/"under" -- not a repeat of
the earlier "Mehr-uh-lund" GRAPHEME respelling attempt, which produced a
garbled `mˈeɪɚɹˈʌlˈʌnd` and was already reverted).

  Native:  mˈɛɹɪlˌænd   (MEHR-ih-LAND)
  Target:  mˈɛɹəlʌnd    (MEHR-uh-lund)

Only slide2 contains "Maryland" -- the other 3 audio files (already fixed
for "Antietam" by the round-1 script) are untouched by this pass. Applies
BOTH the Antietam and Maryland splices to slide2 in one regeneration
(re-doing the Antietam fix is a no-op there since it's the same phonemes
already verified good, just keeping the two fixes consistent in one file
instead of stacking a second edit onto slide2.mp3).

On-screen captionLines/end-card text in AntietamQS.tsx are untouched --
none of this reaches the screen, only the TTS engine.
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

SUBSTITUTIONS = [
    ("ˌæntɪˈɛɾæm", "æntˈiːtəm"),   # Antietam: an-tih-ET-am -> an-TEE-tuhm
    ("mˈɛɹɪlˌænd", "mˈɛɹəlʌnd"),   # Maryland: MEHR-ih-LAND -> MEHR-uh-lund
]

# Only slide2 contains "Maryland"; re-included here (not just slide2 alone)
# so this script is a complete, standalone regeneration of every file that
# needs either fix -- matches this repo's existing pattern of one script
# per fix pass rather than partial re-runs.
LINES = [
    ("slide2", "The Battle of Antietam. September seventeenth, eighteen sixty-two, near Sharpsburg, Maryland. Twenty-two thousand seven hundred Americans, dead, wounded, or missing. In twelve hours."),
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
    print("=== Kokoro TTS -- Antietam phoneme-injection fix, round 2 (Maryland) ===\n")

    if not MODEL_FILE.exists() or not VOICES_FILE.exists():
        print("ERROR: Kokoro model/voices not found in scripts/models/")
        sys.exit(1)

    print("Loading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    use_ffmpeg = FFMPEG.exists()
    use_ffprobe = FFPROBE.exists()

    generated = []
    for name, text in LINES:
        phonemes = kokoro.tokenizer.phonemize(text, LANG)
        applied = []
        for wrong, correct in SUBSTITUTIONS:
            if wrong in phonemes:
                phonemes = phonemes.replace(wrong, correct)
                applied.append(correct)
        if not applied:
            print(f"ERROR: no known mispronunciation substrings found in {name}'s phonemization:")
            print(f"  {phonemes}")
            sys.exit(1)

        samples, sample_rate = kokoro.create(
            text=phonemes, voice=VOICE, speed=SPEED, lang=LANG, is_phonemes=True,
        )
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
        print(f"    applied fixes: {applied}")
        print(f"    phonemes: {phonemes}")
        generated.append((name, out_path, sample_duration))

    print(f"\n=== ffprobe durations ===")
    for name, path, sample_dur in generated:
        dur = probe_duration(path) if (use_ffprobe and path.suffix == ".mp3") else sample_dur
        padded = dur + PAD
        frames = round(padded * FPS)
        print(f"  {name}.mp3  {dur:.3f}s  ->  durationInSeconds: {padded:.3f}  ->  durationInFrames: {frames}")

    print("\nDone. Listen to slide2.mp3 and confirm Maryland before proceeding.")


if __name__ == "__main__":
    main()
