#!/usr/bin/env python3
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
PAD   = 0.4  # seconds added per slide for breathing room

# Full script replacement (fact-checking pass) -- every slide's text below is
# different from the prior 4-slide script; all four are regenerated fresh,
# no reuse. On-screen-correct spelling throughout -- NOT respelled. The
# phoneme splice for "Nuremberg" (slide 1 only -- it's the only slide whose
# script mentions Nuremberg) happens after phonemization, in the
# PHONEME_SPLICE branch of main() below, using the exact same substitution
# already proven on generateVoiceover-nuremberg-goering.py.
LINES = [
    ("hess-amnesia-vo-01", "Every defendant at Nuremberg fought for his life. One argued he couldn't be tried at all."),
    ("hess-amnesia-vo-02", "Rudolf Hess claimed his memory was gone, especially when questioned about potentially incriminating actions."),
    ("hess-amnesia-vo-03", "If ruled incompetent, he could be excluded from trial. Then in open court, Hess announced his memory had returned and the amnesia was tactical."),
    ("hess-amnesia-vo-04", "He was ruled fit to stand trial and sentenced to life in prison."),
]

# "Nuremberg" pronunciation fix -- identical substitution to the one proven on
# generateVoiceover-nuremberg-goering.py (see that file's docstring for the
# full derivation: Kokoro's own phonemization doubles the r and stresses the
# wrong syllable -- "nyoo-rr-EM-burg" -- so this splices in a hand-built
# correct phoneme string -- "NOOR-uhm-burg" -- instead). Reused verbatim, not
# re-derived, for pronunciation consistency across both videos.
WRONG_NUREMBERG_PHONEMES = "njʊɹɹˈɛmbɜːɡ"
CORRECT_NUREMBERG_PHONEMES = "nˈʊɹəmbɜːɡ"

# Full-script pass: every slide's text changed, so every file is regenerated.
REGENERATE = {"hess-amnesia-vo-01", "hess-amnesia-vo-02", "hess-amnesia-vo-03", "hess-amnesia-vo-04"}
PHONEME_SPLICE = {"hess-amnesia-vo-01"}


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
    print("=== Kokoro TTS -- hess-amnesia voiceovers (full script replacement) ===\n")

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
        print(f"WARNING: ffmpeg not found at {FFMPEG} -- will save as WAV")
    if not use_ffprobe:
        print(f"WARNING: ffprobe not found -- will fall back to sample-count duration")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Generating {len(LINES)} segments (voice='{VOICE}', speed={SPEED})\n")

    generated = []  # (name, out_path, sample_duration_s)
    for name, text in LINES:
        mp3_path = AUDIO_DIR / f"{name}.mp3"

        if name not in REGENERATE:
            if not mp3_path.exists():
                print(f"ERROR: {name}.mp3 expected to already exist (reused, not regenerated) but is missing")
                sys.exit(1)
            print(f"  {name}: reused as-is (text unchanged)")
            generated.append((name, mp3_path, None))
            continue

        if name in PHONEME_SPLICE:
            phonemes = kokoro.tokenizer.phonemize(text, LANG)
            if WRONG_NUREMBERG_PHONEMES not in phonemes:
                print(f"ERROR: expected Nuremberg phoneme substring not found in {name}'s phonemization:")
                print(f"  {phonemes}")
                sys.exit(1)
            fixed_phonemes = phonemes.replace(WRONG_NUREMBERG_PHONEMES, CORRECT_NUREMBERG_PHONEMES)
            print(f"  {name}: phonemes: {fixed_phonemes}")
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
        print(f"  {name}: {sample_duration:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")
        generated.append((name, out_path, sample_duration))

    # ffprobe pass -- exact MP3 durations and frame counts
    print(f"\n=== ffprobe durations ===")
    total_audio = 0.0
    frame_results = []
    for name, path, sample_dur in generated:
        if use_ffprobe and path.suffix == ".mp3":
            dur = probe_duration(path)
        else:
            dur = sample_dur
        total_audio += dur
        padded = dur + PAD
        frames = round(padded * FPS)
        frame_results.append((name, dur, padded, frames))
        print(f"  {name}.mp3  {dur:.3f}s  ->  durationInSeconds: {padded:.3f}  (durationInFrames: {frames})")

    total_frames = sum(f for _, _, _, f in frame_results)
    print(f"\n  Total audio    : {total_audio:.3f}s")
    print(f"  Total + pads   : {total_audio + PAD * len(LINES):.3f}s")
    print(f"  Total frames   : {total_frames}  ({total_frames / FPS:.2f}s)")

    print("\n=== Summary Table ===")
    print(f"  {'Filename':<28} {'Raw (s)':>10} {'Padded (s)':>12}")
    for name, dur, padded, frames in frame_results:
        print(f"  {name + '.mp3':<28} {dur:>10.3f} {padded:>12.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
