#!/usr/bin/env python3
"""
One-off: tighten dead air in the already-generated Operation Menu voiceover MP3s
(remotion/public/audio/operation-menu-vo-01..04.mp3) WITHOUT re-running Chatterbox
generation. Backs up the untrimmed originals to voice-tests/operation-menu-untrimmed/
first, analyzes each clip's silence against a noise-floor-relative gate, then
re-encodes a trimmed version in place using the same trim_silence()/analyze_silence()
that generate_vo_operation_menu_chatterbox.py now calls for future regenerations.

Decoding/encoding both go through Remotion's bundled ffmpeg (same FFMPEG path the
generator script uses). Run inside chatterbox-env:
  ./chatterbox-env/Scripts/python.exe remotion/scripts/tighten_operation_menu_vo.py
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import soundfile as sf

SCRIPT_DIR = Path(__file__).resolve().parent
REMOTION_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = REMOTION_ROOT.parent
AUDIO_DIR = REMOTION_ROOT / "public" / "audio"
BACKUP_DIR = PROJECT_ROOT / "voice-tests" / "operation-menu-untrimmed"

sys.path.insert(0, str(SCRIPT_DIR))
from generate_vo_operation_menu_chatterbox import (  # noqa: E402
    FFMPEG, FFPROBE, PAD, FPS, analyze_silence, trim_silence,
)

SLIDE_NUMS = [1, 2, 3, 4]


def decode_to_float_mono(mp3_path: Path):
    """Decode via Remotion's bundled ffmpeg to mono PCM (pcm_f32le isn't in that
    build's encoder list, so we go through pcm_s16le) then let soundfile upcast
    to float32 on read."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    result = subprocess.run(
        [str(FFMPEG), "-y", "-i", str(mp3_path), "-ac", "1", "-c:a", "pcm_s16le", str(tmp_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"ffmpeg decode error:\n{result.stderr}")
        sys.exit(1)
    y, sr = sf.read(str(tmp_path), dtype="float32")
    tmp_path.unlink(missing_ok=True)
    return y, sr


def encode_from_float_mono(y, sr: int, mp3_path: Path) -> None:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    sf.write(str(tmp_path), y, sr)
    result = subprocess.run(
        [str(FFMPEG), "-y", "-i", str(tmp_path), "-ar", "44100", "-ab", "192k", str(mp3_path)],
        capture_output=True, text=True,
    )
    tmp_path.unlink(missing_ok=True)
    if result.returncode != 0:
        print(f"ffmpeg encode error:\n{result.stderr}")
        sys.exit(1)


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"ffprobe error:\n{result.stderr}")
        sys.exit(1)
    return float(result.stdout.strip())


def main() -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    print("=== Backing up originals ===")
    mp3_paths = {}
    for n in SLIDE_NUMS:
        stem = f"operation-menu-vo-{n:02d}"
        src = AUDIO_DIR / f"{stem}.mp3"
        if not src.exists():
            print(f"ERROR: {src} not found.")
            sys.exit(1)
        dst = BACKUP_DIR / f"{stem}.mp3"
        shutil.copy2(src, dst)
        print(f"  Backed up {src.name} -> {dst}")
        mp3_paths[n] = src

    print("\n=== Analysis (before trimming) ===")
    header = (f"{'Slide':>5s} {'NoiseFloor':>11s} {'Threshold':>10s} {'Lead(s)':>8s} "
              f"{'Trail(s)':>9s} {'Total(s)':>9s}  InternalGaps>0.15s (start+dur)")
    print(header)
    print("-" * len(header))

    decoded = {}
    before_durations = {}
    for n in SLIDE_NUMS:
        y, sr = decode_to_float_mono(mp3_paths[n])
        info = analyze_silence(y, sr)
        decoded[n] = (y, sr)
        before_durations[n] = probe_duration(mp3_paths[n])
        gaps_str = ", ".join(f"{start:.3f}s+{dur:.3f}s" for start, dur in info["internal_gaps"]) or "none"
        print(f"{n:>5d} {info['noise_floor_db']:>9.1f}dB {info['threshold_db']:>8.1f}dB "
              f"{info['leading_silence_s']:>8.3f} {info['trailing_silence_s']:>9.3f} "
              f"{info['total_duration']:>9.3f}  {gaps_str}")

    print("\n=== Tightening ===")
    after_durations = {}
    removed_seconds = {}
    for n in SLIDE_NUMS:
        y, sr = decoded[n]
        trimmed = trim_silence(y, sr)
        mp3_path = mp3_paths[n]
        encode_from_float_mono(trimmed, sr, mp3_path)
        after_durations[n] = probe_duration(mp3_path)
        removed_seconds[n] = before_durations[n] - after_durations[n]
        print(f"  operation-menu-vo-{n:02d}.mp3: {before_durations[n]:.3f}s -> "
              f"{after_durations[n]:.3f}s (removed {removed_seconds[n]:.3f}s)")

    print("\n=== Before / After Report ===")
    hdr = (f"{'Slide':>5s} {'Before(s)':>10s} {'+0.4(s)':>8s} {'BeforeFr':>9s}   "
           f"{'After(s)':>9s} {'+0.4(s)':>8s} {'AfterFr':>8s}   {'Removed(s)':>11s}")
    print(hdr)
    print("-" * len(hdr))
    total_before = total_after = total_removed = 0.0
    total_before_frames = total_after_frames = 0
    for n in SLIDE_NUMS:
        b = before_durations[n]
        a = after_durations[n]
        bp = b + PAD
        ap = a + PAD
        bf = int(-(-(bp * FPS) // 1))
        af = int(-(-(ap * FPS) // 1))
        print(f"{n:>5d} {b:>10.3f} {bp:>8.3f} {bf:>9d}   {a:>9.3f} {ap:>8.3f} {af:>8d}   {removed_seconds[n]:>11.3f}")
        total_before += b
        total_after += a
        total_removed += removed_seconds[n]
        total_before_frames += bf
        total_after_frames += af
    print("-" * len(hdr))
    tbp = total_before + PAD * len(SLIDE_NUMS)
    tap = total_after + PAD * len(SLIDE_NUMS)
    print(f"{'TOTAL':>5s} {total_before:>10.3f} {tbp:>8.3f} {total_before_frames:>9d}   "
          f"{total_after:>9.3f} {tap:>8.3f} {total_after_frames:>8d}   {total_removed:>11.3f}")


if __name__ == "__main__":
    main()
