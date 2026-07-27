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
AUDIO_DIR   = REPO_ROOT / "public" / "audio" / "ia-drang-valley"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG  = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"
FPS   = 30
PAD   = 0.4  # seconds added per slide for breathing room

LINES = [
    ("01-chopper-landing", "America called it a victory. The North Vietnamese called it proof they could beat American tactics."),
    ("02-troop-scale-map", "Four hundred fifty Americans landed here. Up to two thousand North Vietnamese troops were concentrated about two hundred meters away."),
    ("03-smoke-escalation", "Thirty minutes after landing, a captured soldier revealed they were badly outnumbered."),
    ("04-lz-albany", "Three days later, those lessons were put into practice. One hundred fifty-five Americans died in the ambush that followed."),
    # CTA end-card VO — matches the spoken trigger line used on every other
    # RECON QuickStrike end card (SonTayQS, OperationFrequentWindQS), so this
    # video's comment-trigger reads identically across the series.
    ("05-cta", "Comment RECON to get the free Vietnam fact sheet."),
]


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
    print("=== Kokoro TTS -- ia-drang-valley voiceovers ===\n")

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

    print(f"Generating {len(LINES)} slides (voice='{VOICE}', speed={SPEED})\n")

    generated = []  # (name, out_path, sample_duration_s)
    for name, text in LINES:
        samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
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
