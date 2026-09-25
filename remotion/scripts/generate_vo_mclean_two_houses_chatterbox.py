#!/usr/bin/env python3
"""
Chatterbox Turbo voiceover generator for the McLean House ("Two Houses")
Quick Strike.

Voice cloned from voice_clean.wav (project root) via
ChatterboxTurboTTS.prepare_conditionals(). Turbo ignores exaggeration/cfg_weight
entirely (see chatterbox/tts_turbo.py generate(): both trigger a "not supported
by Turbo" warning and are no-ops) -- the only pacing lever that actually affects
inter-clause dead air is temperature. temperature=0.6 was the value found to
minimize unnatural pauses in prior narration work on this voice
(voice-tests/passageA_temp_t0.60.wav), so it's the default here too.

Generates one MP3 per slide (no concatenation), tightens internal dead air with
the same RMS-gated trim used for other Quick Strikes, then verifies the FINAL
encoded file with ffmpeg's own `silencedetect` filter (not the internal RMS
gate) so the reported gaps are from the same tool the user would check by hand.

Run from chatterbox-env:
  ./chatterbox-env/Scripts/python.exe remotion/scripts/generate_vo_mclean_two_houses_chatterbox.py
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from chatterbox.tts_turbo import ChatterboxTurboTTS

SCRIPT_DIR = Path(__file__).resolve().parent
REMOTION_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = REMOTION_ROOT.parent
AUDIO_DIR = REMOTION_ROOT / "public" / "audio"
REF_WAV = PROJECT_ROOT / "voice_clean.wav"
SCRATCH_DIR = PROJECT_ROOT / "voice-tests" / "mclean-two-houses-scratch"

FFMPEG = REMOTION_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REMOTION_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

TEMPERATURE = 0.6
SEED_BASE = 42

STEM = "mclean-two-houses-vo"
SILENCE_REPORT_THRESHOLD_S = 0.4  # user-requested reporting threshold
SILENCEDETECT_NOISE_DB = "-35dB"  # gate for ffmpeg's own silencedetect

# --- dead-air tightening (same approach as generate_vo_operation_menu_chatterbox.py) ---
FRAME_MS = 10
LEAD_KEEP_S = 0.04
TRAIL_KEEP_S = 0.10
INTERNAL_GAP_MAX_S = 0.40
INTERNAL_GAP_KEEP_EACH_S = 0.20
FADE_S = 0.005
GATE_MIN_DB = -55
GATE_MAX_DB = -38
GATE_OFFSET_DB = 10

PAD = 0.4
FPS = 30

SLIDES = [
    (1, "You would think the war's first battle and the surrender that ended it "
        "happened nowhere near each other."),
    (2, "But one man's house was hit by a shell at Bull Run. Later, he moved his "
        "family to Appomattox Court House."),
    (3, "The owner? Wilmer McLean. His first house saw Bull Run. His second saw "
        "Lee surrender to Grant."),
]


def set_seed(seed: int) -> None:
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def generate_slide(model, text: str, seed: int, temperature: float = TEMPERATURE):
    set_seed(seed)
    result = model.generate(text, audio_prompt_path=None, temperature=temperature)
    chunks = result if isinstance(result, (list, tuple)) else [result]
    wavs = [c.squeeze(0).detach().cpu().numpy() for c in chunks]
    return wavs[0] if len(wavs) == 1 else np.concatenate(wavs)


def compute_frame_db(y: np.ndarray, sr: int, frame_ms: float = FRAME_MS):
    frame_len = max(1, int(sr * frame_ms / 1000))
    n_frames = len(y) // frame_len
    frames_db = np.empty(n_frames)
    for i in range(n_frames):
        chunk = y[i * frame_len:(i + 1) * frame_len]
        rms = np.sqrt(np.mean(chunk.astype(np.float64) ** 2) + 1e-12)
        frames_db[i] = 20 * np.log10(rms + 1e-12)
    return frames_db, frame_len


def gate_threshold(frames_db: np.ndarray):
    noise_floor_db = float(np.percentile(frames_db, 5))
    threshold_db = max(GATE_MIN_DB, min(GATE_MAX_DB, noise_floor_db + GATE_OFFSET_DB))
    return noise_floor_db, threshold_db


def trim_silence(y: np.ndarray, sr: int) -> np.ndarray:
    """Tighten dead air: keep LEAD_KEEP_S before the first voiced frame and
    TRAIL_KEEP_S after the last, cut internal silent runs longer than
    INTERNAL_GAP_MAX_S down to that length, fade the very ends."""
    frames_db, frame_len = compute_frame_db(y, sr)
    frame_dur = frame_len / sr
    _, threshold_db = gate_threshold(frames_db)
    voiced = frames_db > threshold_db

    if not voiced.any():
        return y

    first_voiced = int(np.argmax(voiced))
    last_voiced = len(voiced) - 1 - int(np.argmax(voiced[::-1]))

    lead_keep = int(LEAD_KEEP_S * sr)
    trail_keep = int(TRAIL_KEEP_S * sr)
    first_voice_start = first_voiced * frame_len
    last_voice_end = (last_voiced + 1) * frame_len

    start_sample = max(0, first_voice_start - lead_keep)
    end_sample = min(len(y), last_voice_end + trail_keep)

    keep_each = int(INTERNAL_GAP_KEEP_EACH_S * sr)
    cuts = []
    i = first_voiced
    while i <= last_voiced:
        if not voiced[i]:
            run_start = i
            while i <= last_voiced and not voiced[i]:
                i += 1
            run_end = i
            duration = (run_end - run_start) * frame_dur
            if duration > INTERNAL_GAP_MAX_S:
                run_start_sample = run_start * frame_len
                run_end_sample = run_end * frame_len
                cut_start = run_start_sample + keep_each
                cut_end = run_end_sample - keep_each
                if cut_end > cut_start:
                    cuts.append((cut_start, cut_end))
        else:
            i += 1

    segments = []
    pos = start_sample
    for cut_start, cut_end in cuts:
        if cut_start > pos:
            segments.append(y[pos:cut_start])
        pos = max(pos, cut_end)
    segments.append(y[pos:end_sample])
    trimmed = np.concatenate(segments) if len(segments) > 1 else segments[0]
    trimmed = trimmed.copy()

    fade_len = int(FADE_S * sr)
    if fade_len > 0 and len(trimmed) > 2 * fade_len:
        trimmed[:fade_len] *= np.linspace(0.0, 1.0, fade_len, dtype=trimmed.dtype)
        trimmed[-fade_len:] *= np.linspace(1.0, 0.0, fade_len, dtype=trimmed.dtype)

    return trimmed


def wav_to_mp3(wav_path: Path, mp3_path: Path, bitrate: str = "192k") -> None:
    result = subprocess.run(
        [str(FFMPEG), "-y", "-i", str(wav_path), "-ar", "44100", "-ab", bitrate, str(mp3_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"ffmpeg error:\n{result.stderr}")
        sys.exit(1)


def probe_duration(mp3_path: Path) -> float:
    result = subprocess.run(
        [str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(mp3_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"ffprobe error:\n{result.stderr}")
        sys.exit(1)
    return float(result.stdout.strip())


SILENCE_START_RE = re.compile(r"silence_start:\s*([0-9.]+)")
SILENCE_END_RE = re.compile(r"silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)")


def run_silencedetect(mp3_path: Path):
    """Runs ffmpeg's silencedetect filter and returns a list of (start_s, duration_s)
    for every detected silent run in the file (leading, trailing, and internal)."""
    result = subprocess.run(
        [str(FFMPEG), "-i", str(mp3_path), "-af",
         f"silencedetect=noise={SILENCEDETECT_NOISE_DB}:d=0.05", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    stderr = result.stderr
    starts = [float(m.group(1)) for m in SILENCE_START_RE.finditer(stderr)]
    ends = [(float(m.group(1)), float(m.group(2))) for m in SILENCE_END_RE.finditer(stderr)]
    # pair by order; ffmpeg emits start/end alternately
    gaps = []
    for i, start in enumerate(starts):
        if i < len(ends):
            end_time, duration = ends[i]
            gaps.append((start, duration))
    return gaps


def decode_mp3_to_mono(mp3_path: Path):
    tmp_path = SCRATCH_DIR / f"_decode_{mp3_path.stem}.wav"
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


def tighten_via_silencedetect(mp3_path: Path, target_gap_s: float = 0.30, max_passes: int = 4):
    """Iteratively crops any internal gap that ffmpeg's own silencedetect still
    flags as longer than SILENCE_REPORT_THRESHOLD_S, down to target_gap_s
    (keeping half on each side, so the cut doesn't land on a word boundary
    abruptly), then re-encodes and re-checks. Operates directly on the encoded
    mp3 the user will hear, using the same tool used to report gaps."""
    for _ in range(max_passes):
        gaps = run_silencedetect(mp3_path)
        flagged = [g for g in gaps if g[1] > SILENCE_REPORT_THRESHOLD_S]
        if not flagged:
            return
        y, sr = decode_mp3_to_mono(mp3_path)
        keep_each = int((target_gap_s / 2) * sr)
        cuts = []
        for start, duration in flagged:
            start_sample = int(start * sr)
            end_sample = int((start + duration) * sr)
            cut_start = start_sample + keep_each
            cut_end = end_sample - keep_each
            if cut_end > cut_start:
                cuts.append((cut_start, cut_end))
        cuts.sort()
        segments = []
        pos = 0
        for cut_start, cut_end in cuts:
            if cut_start > pos:
                segments.append(y[pos:cut_start])
            pos = max(pos, cut_end)
        segments.append(y[pos:])
        tightened = np.concatenate(segments) if len(segments) > 1 else segments[0]

        fade_len = int(FADE_S * sr)
        tightened = tightened.copy()
        if fade_len > 0 and len(tightened) > 2 * fade_len:
            tightened[:fade_len] *= np.linspace(0.0, 1.0, fade_len, dtype=tightened.dtype)
            tightened[-fade_len:] *= np.linspace(1.0, 0.0, fade_len, dtype=tightened.dtype)

        tmp_wav = SCRATCH_DIR / f"_tighten_{mp3_path.stem}.wav"
        sf.write(str(tmp_wav), tightened, sr)
        wav_to_mp3(tmp_wav, mp3_path)
        tmp_wav.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", type=int, default=None,
                         help="Generate only this slide number (regenerating one line "
                              "after a text change, without re-running the whole batch).")
    args = parser.parse_args()

    if not REF_WAV.exists():
        print(f"ERROR: reference clip not found at {REF_WAV}")
        sys.exit(1)

    slides_to_run = SLIDES if args.only is None else [(n, t) for n, t in SLIDES if n == args.only]
    if args.only is not None and not slides_to_run:
        print(f"ERROR: no slide numbered {args.only} in SLIDES")
        sys.exit(1)

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading Chatterbox Turbo model (cuda)...")
    model = ChatterboxTurboTTS.from_pretrained(device="cuda")
    print("Model loaded.")

    print(f"Preparing voice conditioning from {REF_WAV} ...")
    model.prepare_conditionals(str(REF_WAV))
    print("Conditioning ready.\n")

    results = []  # (slide_num, mp3_path, duration_s, silence_gaps)
    for slide_num, text in slides_to_run:
        stem = f"{STEM}-{slide_num:02d}"
        seed = SEED_BASE + slide_num
        wav_path = SCRATCH_DIR / f"{stem}.wav"
        mp3_path = SCRATCH_DIR / f"{stem}.mp3"

        print(f"Generating {stem} (seed={seed}, temperature={TEMPERATURE}) ...")
        print(f"  Text: {text}")
        wav = generate_slide(model, text, seed)
        wav = trim_silence(wav, model.sr)
        sf.write(str(wav_path), wav, model.sr)
        wav_to_mp3(wav_path, mp3_path)

        gaps = run_silencedetect(mp3_path)
        if any(d > SILENCE_REPORT_THRESHOLD_S for _, d in gaps):
            print(f"  Gaps over {SILENCE_REPORT_THRESHOLD_S}s detected -- tightening ...")
            tighten_via_silencedetect(mp3_path)
            gaps = run_silencedetect(mp3_path)

        duration = probe_duration(mp3_path)
        print(f"  Saved (scratch) {mp3_path.name} ({duration:.3f}s)")
        results.append((slide_num, mp3_path, duration, gaps))

    print("\n=== silencedetect report (ffmpeg silencedetect, noise="
          f"{SILENCEDETECT_NOISE_DB}) ===")
    any_over_threshold = False
    for slide_num, mp3_path, duration, gaps in results:
        flagged = [g for g in gaps if g[1] > SILENCE_REPORT_THRESHOLD_S]
        if flagged:
            any_over_threshold = True
            print(f"Slide {slide_num} ({mp3_path.name}): {len(flagged)} gap(s) over "
                  f"{SILENCE_REPORT_THRESHOLD_S}s:")
            for start, dur in flagged:
                print(f"    start={start:.3f}s duration={dur:.3f}s")
        else:
            all_gaps_str = ", ".join(f"{d:.3f}s" for _, d in gaps) or "none"
            print(f"Slide {slide_num} ({mp3_path.name}): no gaps over "
                  f"{SILENCE_REPORT_THRESHOLD_S}s (all detected silence: {all_gaps_str})")

    if not any_over_threshold:
        print("\nAll clips clean -- no internal silence longer than "
              f"{SILENCE_REPORT_THRESHOLD_S}s. Safe to copy into public/audio.")
    else:
        print("\nSome clips have long internal silence -- consider regenerating "
              "before copying into public/audio.")

    print("\n=== Duration report ===")
    header = f"{'Slide':>5s} {'Audio (s)':>10s} {'+0.4 pad':>10s} {'Frames@30fps':>13s}"
    print(header)
    print("-" * len(header))
    total_audio = 0.0
    total_frames = 0
    for slide_num, mp3_path, duration, _ in results:
        padded = duration + PAD
        frames = int(-(-(padded * FPS) // 1))
        print(f"{slide_num:>5d} {duration:>10.3f} {padded:>10.3f} {frames:>13d}")
        total_audio += duration
        total_frames += frames
    print("-" * len(header))
    print(f"{'TOTAL':>5s} {total_audio:>10.3f} {total_audio + PAD * len(results):>10.3f} {total_frames:>13d}")

    print(f"\nScratch files are in {SCRATCH_DIR}. Not copied to {AUDIO_DIR} yet.")


if __name__ == "__main__":
    main()
