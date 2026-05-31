#!/usr/bin/env python3
"""
Kokoro TTS voiceover generator for the Korematsu composition.
Model files are downloaded automatically on first run (~88 MB, cached in scripts/models/).
"""
import os
import sys
import urllib.request
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR  = Path(__file__).resolve().parent
REPO_ROOT   = SCRIPT_DIR.parent
MODELS_DIR  = SCRIPT_DIR / "models"
OUTPUT_FILE = REPO_ROOT / "public" / "audio" / "korematsu-voiceover.mp3"

# int8 model — 88 MB, good quality, fast inference
MODEL_URL   = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.int8.onnx"
VOICES_URL  = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"
MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

# Remotion's bundled ffmpeg — used for WAV → MP3 conversion
FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

# ── Voice settings ────────────────────────────────────────────────────────────

VOICE = "am_adam"    # American English male; try "af_sarah" for female
SPEED = 0.95
LANG  = "en-us"

# ── Script text ───────────────────────────────────────────────────────────────

TEXT = """
He was 23. Born in Oakland. An American. And the U.S. government put him in a prison camp.

His name was Fred Korematsu. And he said no.

In 1942, President Roosevelt signed Executive Order nine zero six six. One hundred twenty thousand Japanese Americans, ordered out of their homes, ordered into camps.

Fred refused. He was arrested. Convicted. He took it to the Supreme Court. And lost.

Here is what the government did not tell the Court. Their own military intelligence had already concluded there was no threat. Japanese Americans were not a security risk. The report existed. They buried it.

The Supreme Court ruled against Fred Korematsu based on a lie.

For forty years, nobody knew.

Then in 1983, a legal researcher found that buried report in the National Archives. A federal court vacated Fred's conviction. The government had submitted false evidence to the highest court in the country.

In 2018, the Supreme Court officially declared their own ruling wrong.

Fred did not live to see that. He died in 2005.

But before he died, he said this. If you have the feeling that something is wrong, don't be afraid to speak up.

He did. It cost him everything. Then it changed everything.

Follow for more history they didn't teach you.
""".strip()

# ─────────────────────────────────────────────────────────────────────────────


def download_with_progress(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  Downloading {dest.name} ...", flush=True)

    def _progress(count, block_size, total):
        if total > 0:
            pct = min(100, count * block_size * 100 // total)
            print(f"\r  {pct:3d}%", end="", flush=True)

    urllib.request.urlretrieve(url, dest, reporthook=_progress)
    size_mb = dest.stat().st_size / 1024 / 1024
    print(f"\r  Done — {size_mb:.1f} MB        ")


def main() -> None:
    print("=== Kokoro TTS — Korematsu voiceover ===\n")

    # 1. Download model files if not already cached
    if not MODEL_FILE.exists():
        print("Model not cached. Downloading kokoro-v1.0.int8.onnx (88 MB) ...")
        download_with_progress(MODEL_URL, MODEL_FILE)
    else:
        print(f"Model   : {MODEL_FILE.name} (cached)")

    if not VOICES_FILE.exists():
        print("Voices not cached. Downloading voices-v1.0.bin ...")
        download_with_progress(VOICES_URL, VOICES_FILE)
    else:
        print(f"Voices  : {VOICES_FILE.name} (cached)")

    # 2. Load model
    print("\nLoading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    available = kokoro.get_voices()
    print(f"Voices available: {len(available)}  ({', '.join(sorted(available)[:8])} ...)")

    if VOICE not in available:
        female = [v for v in available if v.startswith("af_")]
        male   = [v for v in available if v.startswith("am_")]
        print(f"\nERROR: Voice '{VOICE}' not found in voices file.")
        print(f"  American female: {female}")
        print(f"  American male  : {male}")
        sys.exit(1)

    # 3. Generate audio
    word_count = len(TEXT.split())
    print(f"\nGenerating audio ({word_count} words, voice='{VOICE}', speed={SPEED}) ...", flush=True)

    samples, sample_rate = kokoro.create(
        text=TEXT,
        voice=VOICE,
        speed=SPEED,
        lang=LANG,
    )

    duration_s = len(samples) / sample_rate
    print(f"Generated {duration_s:.1f}s of audio at {sample_rate} Hz")

    # 4. Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    if FFMPEG.exists():
        # Write temp WAV, convert to MP3 with Remotion's bundled ffmpeg, delete temp
        print("\nConverting to MP3 via Remotion ffmpeg ...", flush=True)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)

        sf.write(str(tmp_path), samples, sample_rate)

        result = subprocess.run(
            [
                str(FFMPEG), "-y",
                "-i", str(tmp_path),
                "-ar", "44100",
                "-ab", "128k",
                str(OUTPUT_FILE),
            ],
            capture_output=True,
            text=True,
        )
        tmp_path.unlink(missing_ok=True)

        if result.returncode != 0:
            print(f"ffmpeg error:\n{result.stderr}")
            sys.exit(1)

        size_kb = OUTPUT_FILE.stat().st_size / 1024
        print(f"Saved  : {OUTPUT_FILE}")
        print(f"Size   : {size_kb:.0f} KB")

    else:
        # No ffmpeg — write WAV and warn
        wav_out = OUTPUT_FILE.with_suffix(".wav")
        sf.write(str(wav_out), samples, sample_rate)
        size_kb = wav_out.stat().st_size / 1024
        print(f"\nWARNING: ffmpeg not found at expected path:")
        print(f"  {FFMPEG}")
        print(f"Saved as WAV instead: {wav_out} ({size_kb:.0f} KB)")
        print("Update the audio src in korematsu.js to korematsu-voiceover.wav if using this file.")

    print("\nDone.")


if __name__ == "__main__":
    main()
