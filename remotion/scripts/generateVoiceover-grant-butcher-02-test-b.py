"""Regenerate Slide 2 for grant-butcher with the corrected script, using the
same locked ChatterboxTurboTTS settings as the other three slides
(temperature=0.8, top_k=1000, top_p=0.95, repetition_penalty=1.2,
despotism-ref.wav). Writes a test-b variant only -- does not touch the
locked grant-butcher-vo-02.mp3 or any composition."""

import subprocess
import sys
from pathlib import Path

import soundfile as sf
from chatterbox.tts_turbo import ChatterboxTurboTTS

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
AUDIO_DIR = REPO_ROOT / "public" / "audio"
REF_WAV = REPO_ROOT.parent / "chatterbox-env" / "reference-clips" / "despotism-ref.wav"

FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

GEN_KWARGS = dict(temperature=0.8, top_k=1000, top_p=0.95, repetition_penalty=1.2)

STEM = "grant-butcher-vo-02-test-b"
TEXT = (
    "But after each costly engagement at the Wilderness, Spotsylvania, and North Anna, "
    "he kept sliding south around Lee's flank instead of pulling back."
)


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

    print("Loading Chatterbox Turbo model (ChatterboxTurboTTS)...")
    model = ChatterboxTurboTTS.from_pretrained(device="cuda")
    print("Model loaded.")

    wav_path = AUDIO_DIR / f"{STEM}.wav"
    mp3_path = AUDIO_DIR / f"{STEM}.mp3"

    print(f"Generating {STEM}...")
    wav = model.generate(
        TEXT,
        audio_prompt_path=str(REF_WAV),
        **GEN_KWARGS,
    )
    sf.write(str(wav_path), wav.squeeze(0).cpu().numpy(), model.sr)
    wav_to_mp3(wav_path, mp3_path)

    duration = probe_duration(mp3_path)
    print(f"  Saved {mp3_path.name} ({duration:.2f}s)")


if __name__ == "__main__":
    main()
