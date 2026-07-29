#!/usr/bin/env python3
"""
Phoneme-injection pronunciation fix for the Antietam BLUEGRAY Quick Strike.

Supersedes generateVoiceover-antietam-pronunciation-fix.py's grapheme
respelling ("An-tee-tuhm" as literal text), which turned out to make things
WORSE: hyphenating the respelling made espeak treat it as one glued-together
fake word, producing double stress peaks and wrong vowels (verified via
tokenizer.phonemize -- see chat history). Kokoro's own phonemization of
"Antietam" is simply wrong (`ˌæntɪˈɛɾæm`, roughly "an-tih-ET-am"),
so instead of respelling and hoping espeak's grapheme guesser lands closer,
this phonemizes each sentence NORMALLY (correct spelling throughout, so
every other word -- including "Maryland", which was already fine and did
NOT need the respelling it got last pass -- keeps its normal, correct
phonemization), then does a straight string substitution of just the
"Antietam" phoneme substring for a hand-built correct one, and feeds the
whole spliced phoneme string back to Kokoro via is_phonemes=True.

  Kokoro's phonemization of "Antietam": æntɪˈɛɾæm  (an-tih-ET-am, wrong)
  Hand-built replacement:               æntˈiːtəm  (an-TEE-tuhm)

Verified via tokenizer.phonemize() that this exact substring
"ˌæntɪˈɛɾæm" appears identically (same segmental content and stress) in
all 4 target sentences, so one substitution per sentence is safe -- no
per-sentence hand-tuning needed.

On-screen captionLines/end-card text in AntietamQS.tsx are untouched by any
of this -- phonemes never reach the screen, only the TTS engine.
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

# Kokoro's own (wrong) phonemization of "Antietam", to be spliced out of
# each sentence's phonemized form -- and the correct replacement.
WRONG_ANTIETAM_PHONEMES = "ˌæntɪˈɛɾæm"
CORRECT_ANTIETAM_PHONEMES = "æntˈiːtəm"

# (output filename stem, ON-SCREEN-CORRECT text -- normal spelling
# throughout; the Antietam phoneme splice happens after phonemization, not
# via any text substitution here)
LINES = [
    ("slide2", "The Battle of Antietam. September seventeenth, eighteen sixty-two, near Sharpsburg, Maryland. Twenty-two thousand seven hundred Americans, dead, wounded, or missing. In twelve hours."),
    ("slide3", "Photographer Alexander Gardner reached the Antietam battlefield before the bodies were buried. No one had ever seen American war dead in a photograph before."),
    ("slide4", "Five days after Antietam, President Lincoln used the Union's strategic success to issue the Preliminary Emancipation Proclamation."),
    ("slide5-endcard", "Comment Sharpsburg. For the five-fact Antietam PDF. Follow for more."),
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
    print("=== Kokoro TTS -- Antietam phoneme-injection pronunciation fix ===\n")

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
        if WRONG_ANTIETAM_PHONEMES not in phonemes:
            print(f"ERROR: expected Antietam phoneme substring not found in {name}'s phonemization:")
            print(f"  {phonemes}")
            sys.exit(1)
        fixed_phonemes = phonemes.replace(WRONG_ANTIETAM_PHONEMES, CORRECT_ANTIETAM_PHONEMES)

        samples, sample_rate = kokoro.create(
            text=fixed_phonemes, voice=VOICE, speed=SPEED, lang=LANG, is_phonemes=True,
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
        print(f"    phonemes: {fixed_phonemes}")
        generated.append((name, out_path, sample_duration))

    print(f"\n=== ffprobe durations ===")
    for name, path, sample_dur in generated:
        dur = probe_duration(path) if (use_ffprobe and path.suffix == ".mp3") else sample_dur
        padded = dur + PAD
        frames = round(padded * FPS)
        print(f"  {name}.mp3  {dur:.3f}s  ->  durationInSeconds: {padded:.3f}  ->  durationInFrames: {frames}")

    print("\nDone. Listen to the 4 regenerated files and confirm pronunciation before proceeding.")


if __name__ == "__main__":
    main()
