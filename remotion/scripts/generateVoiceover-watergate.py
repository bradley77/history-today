"""
Echo & Chronicle — Per-slide Kokoro TTS voiceover generator
Article: "The Morning the Post Didn't Know What It Had" (Watergate)

Generates 8 SEPARATE audio files, one per slide, per E&C video convention.
Each slide's <Audio> element in Remotion starts at its own frame offset,
and each slide's durationInSeconds = that clip's actual generated length + 0.4s pad.

Voice: am_adam | Speed: 0.95 | Lang: en-us | Model: kokoro-v1.0.int8.onnx
Output: public/audio/watergate-vo-01.mp3 through watergate-vo-08.mp3
"""

import os
import tempfile
from pathlib import Path
from kokoro_onnx import Kokoro
import soundfile as sf
import subprocess

SCRIPT_DIR  = Path(__file__).resolve().parent
REPO_ROOT   = SCRIPT_DIR.parent
MODELS_DIR  = SCRIPT_DIR / "models"
AUDIO_DIR   = REPO_ROOT / "public" / "audio"
FFMPEG      = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

MODEL_PATH  = str(MODELS_DIR / "kokoro-v1.0.int8.onnx")
VOICES_PATH = str(MODELS_DIR / "voices-v1.0.bin")
OUTPUT_DIR  = str(AUDIO_DIR)
VOICE = "am_adam"
SPEED = 0.95
LANG = "en-us"

SLIDES = {
    "01": "This building ended a presidency. Not the man inside it. The building itself.",
    "02": "At one forty seven in the morning, a guard found tape on a door. He called the police. His name was Frank Wills.",
    "03": "You will not see his face in this video. History remembers his call. It forgot his face. So instead, you are seeing what he saw.",
    "04": "Inside, police found a tape recorder built to capture every phone call in the office.",
    "05": "This exact recorder became Government Exhibit forty seven, the centerpiece of a federal trial.",
    "06": "Microphones disguised as lip balm, built to listen to the Democratic Party without anyone noticing.",
    "07": "Two years later, the cover up unraveled completely, and the country demanded answers.",
    "08": "On August ninth, nineteen seventy four, he became the only president to resign. It started with a guard, and some tape.",
}

def main():
    print("=== Kokoro TTS — Watergate per-slide voiceover ===")
    print(f"Model   : {MODEL_PATH}")
    print(f"Voice   : {VOICE}  Speed: {SPEED}  Lang: {LANG}")
    print()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    use_ffmpeg = FFMPEG.exists()
    if not use_ffmpeg:
        print(f"WARNING: ffmpeg not found at {FFMPEG} — will save WAV files instead.\n")

    print("Loading model ...")
    kokoro = Kokoro(MODEL_PATH, VOICES_PATH)

    total_duration = 0.0

    for slide_num, text in SLIDES.items():
        word_count = len(text.split())
        print(f"Slide {slide_num}: generating ({word_count} words) ...")

        samples, sample_rate = kokoro.create(
            text, voice=VOICE, speed=SPEED, lang=LANG
        )

        duration = len(samples) / sample_rate
        total_duration += duration

        mp3_path = AUDIO_DIR / f"watergate-vo-{slide_num}.mp3"

        if use_ffmpeg:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            sf.write(str(tmp_path), samples, sample_rate)
            result = subprocess.run(
                [str(FFMPEG), "-y", "-i", str(tmp_path), "-ar", "44100", "-ab", "128k", str(mp3_path)],
                capture_output=True, text=True,
            )
            tmp_path.unlink(missing_ok=True)
            if result.returncode != 0:
                print(f"ffmpeg error:\n{result.stderr}")
        else:
            wav_path = AUDIO_DIR / f"watergate-vo-{slide_num}.wav"
            sf.write(str(wav_path), samples, sample_rate)
            mp3_path = wav_path

        size_kb = os.path.getsize(str(mp3_path)) / 1024
        print(f"  Saved : {mp3_path}")
        print(f"  Duration: {duration:.2f}s   Size: {size_kb:.0f} KB")
        print()

    print("=== Done ===")
    print(f"Total spoken duration across 8 files: {total_duration:.2f}s")
    print("Note: actual on-screen video length will be longer once 0.4s pad")
    print("per slide and any title/transition frames are added in Remotion.")

if __name__ == "__main__":
    main()
