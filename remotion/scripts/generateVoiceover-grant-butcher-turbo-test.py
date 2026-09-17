"""Slide-1-only comparison test using the REAL Chatterbox Turbo class
(chatterbox.tts_turbo.ChatterboxTurboTTS), not the base ChatterboxTTS used
for the locked grant-butcher-vo-*.mp3 files. Turbo's generate() ignores
exaggeration/cfg_weight/min_p entirely (confirmed via source inspection) --
only temperature/top_k/top_p/repetition_penalty affect output. Writes
test variants only; never touches the locked vo files."""

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

TEXT = "Grant is remembered as the butcher of the Civil War, a general who won by grinding up his own men."

VARIANTS = [
    # (suffix, kwargs, description)
    ("test-a", dict(temperature=0.8, top_k=1000, top_p=0.95, repetition_penalty=1.2), "baseline (Turbo defaults)"),
    ("test-b", dict(temperature=0.6, top_k=1000, top_p=0.95, repetition_penalty=1.2), "lower temperature -- more controlled/less erratic"),
    ("test-c", dict(temperature=0.5, top_k=1000, top_p=0.85, repetition_penalty=1.2), "lower temperature + tighter top_p -- most conservative/deliberate"),
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

    print("Loading REAL Chatterbox Turbo model (ChatterboxTurboTTS)...")
    model = ChatterboxTurboTTS.from_pretrained(device="cuda")
    print("Model loaded.")

    for suffix, kwargs, desc in VARIANTS:
        stem = f"grant-butcher-vo-01-{suffix}"
        wav_path = AUDIO_DIR / f"{stem}.wav"
        mp3_path = AUDIO_DIR / f"{stem}.mp3"

        print(f"Generating {stem} ({desc}) -- {kwargs}")
        wav = model.generate(
            TEXT,
            audio_prompt_path=str(REF_WAV),
            **kwargs,
        )
        sf.write(str(wav_path), wav.squeeze(0).cpu().numpy(), model.sr)
        wav_to_mp3(wav_path, mp3_path)

        duration = probe_duration(mp3_path)
        print(f"  Saved {mp3_path.name} ({duration:.2f}s)")


if __name__ == "__main__":
    main()
