#!/usr/bin/env python3
"""
RECON Quick Strike -- "Denton POW" (Jeremiah Denton's 1966 forced propaganda
interview and 1973 release). Standard follow CTA only -- no trigger-word/
lead-magnet DM funnel on this one.

Flat filenames in public/audio/ (denton-pow-vo-*.mp3), matching the
Dunkirk-Halt-Order convention, not the North-Anna subfolder-plus-timing.json
convention -- this composition has no timing.json; measured durations are
hand-copied into DentonPOWQuickStrike.tsx as commented constants instead.

Slides 2 and 3 are each split into two sub-clips (a/b) for the caption-swap
device: one image holds across both, only the overlay/caption text changes
between them -- see DentonPOWQuickStrike.tsx for how the audio timing below
gets consumed.

Numbers are already spelled as words in the locked script (Brad's brief) --
not re-spelled here.

vo-03a text-level fix: "U.S. Naval Intelligence" mid-sentence hits the same
issue documented in generateVoiceover-mcnamara-confession.py -- Kokoro's
phonemizer treats the internal periods in "U.S." as sentence-ending
punctuation and inserts an awkward pause between "U" and "S" no phoneme
splice can patch. Synthesized as "United States Naval Intelligence" instead;
the on-screen caption/overlay text stays "U.S." (that's just text, no TTS
involved) -- see DentonPOWQuickStrike.tsx's captionLines for vo-03a.
"""
import json
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
PAD   = 0.4  # seconds added per slide/sub-clip group for breathing room

# (output filename stem, synthesized text)
LINES = [
    # Trimmed per Brad's second pass (runtime was 27.6s vs ~19-20s target) --
    # vo-01, vo-02b, vo-03a shortened; vo-02a/vo-03b/vo-04 unchanged from the
    # original brief at that point.
    ("denton-pow-vo-01",  "North Vietnam put a POW on television to break him."),
    # Naturalness pass (3rd pass): letter-by-letter "T, O, R, T, U, R, E" read
    # choppy spoken aloud -- changed to "the word TORTURE" spoken as a word.
    # The letter-by-letter detail is still communicated visually via the
    # overlay text ("HIS EYES SPELLED TORTURE IN MORSE CODE"), just not
    # fought through in the VO. Confirmed with Brad before this change.
    ("denton-pow-vo-02a", "His eyes blinked out the word TORTURE in Morse code."),
    ("denton-pow-vo-02b", "His mouth said he supported his government."),
    # "U.S." -> "United States" for synthesis only -- see file header note.
    ("denton-pow-vo-03a", "It was the first confirmation United States Naval Intelligence had of POW torture."),
    ("denton-pow-vo-03b", "He paid for it with more torture, then walked off a plane a free man almost eight years later."),
    ("denton-pow-vo-04",  "Follow the page for more history they didn't teach you."),
]


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


def main() -> None:
    print("=== Kokoro TTS -- denton-pow voiceovers ===\n")

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
        print(f"WARNING: ffmpeg not found at {FFMPEG} -- will save as WAV")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Generating {len(LINES)} clips (voice='{VOICE}', speed={SPEED}, lang='{LANG}')\n")

    results = []  # (name, path, ffprobe_duration_s)
    for name, text in LINES:
        mp3_path = AUDIO_DIR / f"{name}.mp3"

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

        dur = probe_duration(out_path) if (use_ffmpeg and out_path.suffix == ".mp3") else sample_duration
        size_kb = out_path.stat().st_size / 1024
        print(f"  {out_path.name:<28} synth={sample_duration:.3f}s  ffprobe={dur:.3f}s  ({size_kb:.0f} KB)")
        results.append((name, out_path, dur))

    print("\n=== ffprobe-measured durations (copy these into DentonPOWQuickStrike.tsx) ===")
    for name, path, dur in results:
        print(f"  {name}.mp3  {dur:.3f}s  (+{PAD}s pad = {dur + PAD:.3f}s)")

    timing = {
        "slug": "denton-pow",
        "voice": VOICE,
        "speed": SPEED,
        "lang": LANG,
        "pad": PAD,
        "files": [{"name": n, "audioDuration": round(d, 3)} for n, _, d in results],
    }
    timing_path = AUDIO_DIR / "denton-pow-timing.json"
    timing_path.write_text(json.dumps(timing, indent=2) + "\n", encoding="utf-8")
    print(f"\n  Timing file: {timing_path}")


if __name__ == "__main__":
    main()
