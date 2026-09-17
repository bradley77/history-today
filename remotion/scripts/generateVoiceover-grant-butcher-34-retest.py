"""Regenerate Slides 3 and 4 for grant-butcher as test-a variants, using the
same ChatterboxTurboTTS settings as grant-butcher-vo-01-test-a.mp3 (Turbo
defaults: temperature=0.8, top_k=1000, top_p=0.95, repetition_penalty=1.2)
and the same despotism-ref.wav reference clip, for voice consistency.
Slides 3/4 had confirmed TTS artifacts (stuttering gap / dead-silence
dropout) in the locked files -- this writes test-a variants only, does not
touch the locked grant-butcher-vo-0{1,2,3,4}.mp3 files or any composition."""

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

SLIDES = [
    (
        "grant-butcher-vo-03-test-a",
        "After Cold Harbor, Grant wrote that no advantage whatever had been gained to compensate for the loss. "
        "He abandoned another direct drive on Richmond and turned toward Petersburg.",
    ),
    (
        "grant-butcher-vo-04-test-a",
        "A butcher keeps repeating the same mistake. Grant changed his approach when the cost proved unacceptable.",
    ),
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

    print("Loading Chatterbox Turbo model (ChatterboxTurboTTS)...")
    model = ChatterboxTurboTTS.from_pretrained(device="cuda")
    print("Model loaded.")

    for stem, text in SLIDES:
        wav_path = AUDIO_DIR / f"{stem}.wav"
        mp3_path = AUDIO_DIR / f"{stem}.mp3"

        print(f"Generating {stem}...")
        wav = model.generate(
            text,
            audio_prompt_path=str(REF_WAV),
            **GEN_KWARGS,
        )
        sf.write(str(wav_path), wav.squeeze(0).cpu().numpy(), model.sr)
        wav_to_mp3(wav_path, mp3_path)

        duration = probe_duration(mp3_path)
        print(f"  Saved {mp3_path.name} ({duration:.2f}s)")


if __name__ == "__main__":
    main()
