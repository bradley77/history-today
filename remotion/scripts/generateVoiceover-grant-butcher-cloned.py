"""Chatterbox Turbo voice-cloning test for the grant-butcher Quick Strike,
using the despotism-ref.wav reference clip. Uses the chatterbox-env venv.
Does not touch the Kokoro pipeline (kokoro_pipeline.py) or any other
existing script."""

import subprocess
import sys
from pathlib import Path

import soundfile as sf
from chatterbox.tts import ChatterboxTTS

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
AUDIO_DIR = REPO_ROOT / "public" / "audio"
REF_WAV = REPO_ROOT.parent / "chatterbox-env" / "reference-clips" / "despotism-ref.wav"

FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

SLUG = "grant-butcher"

SLIDES = [
    "Grant is remembered as the butcher of the Civil War, a general who won by grinding up his own men.",
    "But at the Wilderness, Spotsylvania, and North Anna, he kept moving south around Lee's flank instead of storming every position in his path.",
    "After Cold Harbor, Grant wrote that no advantage whatever had been gained to compensate for the loss. He abandoned another direct drive on Richmond and turned toward Petersburg.",
    "A butcher keeps repeating the same mistake. Grant changed his approach when the cost proved unacceptable.",
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
    if not REF_WAV.exists():
        print(f"ERROR: reference clip not found at {REF_WAV}")
        sys.exit(1)

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading Chatterbox Turbo model...")
    model = ChatterboxTTS.from_pretrained(device="cuda")
    print("Model loaded.")

    for i, text in enumerate(SLIDES, start=1):
        stem = f"{SLUG}-vo-{i:02d}"
        wav_path = AUDIO_DIR / f"{stem}.wav"
        mp3_path = AUDIO_DIR / f"{stem}.mp3"

        print(f"Generating {stem} (cloned voice)...")
        wav = model.generate(
            text,
            audio_prompt_path=str(REF_WAV),
            exaggeration=0.4,
            cfg_weight=0.3,
        )
        sf.write(str(wav_path), wav.squeeze(0).cpu().numpy(), model.sr)
        wav_to_mp3(wav_path, mp3_path)

        duration = probe_duration(mp3_path)
        print(f"  Saved {mp3_path.name} ({duration:.2f}s)")


if __name__ == "__main__":
    main()
