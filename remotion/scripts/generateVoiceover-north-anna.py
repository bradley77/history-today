#!/usr/bin/env python3
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
AUDIO_DIR   = REPO_ROOT / "public" / "audio" / "north-anna"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG  = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

SLUG  = "north-anna"
VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"
PAD   = 0.4  # seconds added per slide for breathing room

GUARDRAIL_MIN = 30.0
GUARDRAIL_MAX = 60.0

LINES = [
    (1, "Lee built the best trap of his career at North Anna. Then he couldn't leave his cot to use it."),
    (2, "Too sick to ride, Lee sees the movement upstream and calls it a feint. Hill doesn't move."),
    (3, "Hancock takes a redoubt in minutes. Hill's attack breaks the Iron Brigade, then collapses."),
    (4, "That night, Lee lays out a trap shaped like an inverted V, splitting Grant's army in three."),
    (5, "By afternoon, Lee can't leave his tent. His aide remembers the words: we must strike them a blow."),
    (6, "Grant recognizes the trap, pulls out by May 26, and turns toward Cold Harbor. Follow for more."),
]

# Slide ids to regenerate. Leave as None (or empty set) to regenerate everything.
# For a targeted re-run: REGENERATE = {3, 4, 5}
REGENERATE = {4, 5}


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
    print("=== Kokoro TTS -- north-anna voiceovers ===\n")

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

    targets = set(REGENERATE) if REGENERATE else {slide_id for slide_id, _ in LINES}
    skipped = [slide_id for slide_id, _ in LINES if slide_id not in targets]

    print(f"Generating {len(targets)} of {len(LINES)} slides (voice='{VOICE}', speed={SPEED})")
    if skipped:
        print(f"Skipping (untouched): {', '.join(f'{s:02d}' for s in skipped)}")
    print()

    generated = []  # (slide_id, out_path, sample_duration_s or None)
    for slide_id, text in LINES:
        filename = f"{slide_id:02d}-{SLUG}.mp3"
        mp3_path = AUDIO_DIR / filename

        if slide_id not in targets:
            if not mp3_path.exists():
                print(f"ERROR: {mp3_path} does not exist but slide {slide_id:02d} was not selected for regeneration")
                sys.exit(1)
            print(f"  Slide {slide_id:02d}: unchanged  {mp3_path.name}")
            generated.append((slide_id, mp3_path, None))
            continue

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
        print(f"  Slide {slide_id:02d}: {sample_duration:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")
        generated.append((slide_id, out_path, sample_duration))

    # ffprobe pass -- exact MP3 durations
    print(f"\n=== ffprobe durations ===")
    slides = []
    total_audio = 0.0
    for slide_id, path, sample_dur in generated:
        if use_ffprobe and path.suffix == ".mp3":
            dur = probe_duration(path)
        else:
            dur = sample_dur
        padded = dur + PAD
        total_audio += dur
        print(f"  {path.name}  {dur:.3f}s  ->  slideDuration: {padded:.3f}")
        slides.append({
            "id": slide_id,
            "audioFile": path.name,
            "audioDuration": round(dur, 3),
            "slideDuration": round(padded, 3),
        })

    total_duration = round(sum(s["slideDuration"] for s in slides), 3)

    timing = {
        "slug": SLUG,
        "slides": slides,
        "totalDuration": total_duration,
    }

    timing_path = AUDIO_DIR / "timing.json"
    timing_path.write_text(json.dumps(timing, indent=2) + "\n", encoding="utf-8")

    print("\n=== Summary Table ===")
    print(f"  {'Slide':<6} {'Audio (s)':>10} {'Padded (s)':>12} {'Running total (s)':>20}")
    running = 0.0
    for s in slides:
        running += s["slideDuration"]
        print(f"  {s['id']:<6} {s['audioDuration']:>10.3f} {s['slideDuration']:>12.3f} {running:>20.3f}")

    print(f"\n  Total duration: {total_duration:.3f}s")
    print(f"  Timing file   : {timing_path}")

    if total_duration < GUARDRAIL_MIN or total_duration > GUARDRAIL_MAX:
        print(f"\n  ⚠️  GUARDRAIL: totalDuration {total_duration:.3f}s is OUTSIDE the 30-60s Quick Strike range!")
    else:
        print(f"\n  Guardrail OK: {GUARDRAIL_MIN:.0f}-{GUARDRAIL_MAX:.0f}s range satisfied.")

    print("\nDone.")


if __name__ == "__main__":
    main()
