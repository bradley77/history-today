#!/usr/bin/env python3
"""
Chatterbox Turbo voiceover generator for the Operation Menu Quick Strike.

Reuses the exact model loading and generate() call from
../../chatterbox_narrator_test.py that produced voice-tests/passageA_temp_t0.60.wav:
  - chatterbox.tts_turbo.ChatterboxTurboTTS.from_pretrained(device="cuda")
  - reference clip: voice-tests/adam_ref.wav (Demucs vocal-isolated ADAM.mp3)
  - model.prepare_conditionals(ref) once, then generate(text, audio_prompt_path=None,
    temperature=0.6) per line -- exaggeration/cfg_weight are left at generate()'s
    defaults since Turbo ignores both entirely (confirmed via source inspection).

One fixed seed per slide (printed at generation time) so any single slide can be
regenerated identically without re-running the whole batch. Run from chatterbox-env:
  ./chatterbox-env/Scripts/python.exe remotion/scripts/generate_vo_operation_menu_chatterbox.py
"""
import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch
from chatterbox.tts_turbo import ChatterboxTurboTTS

SCRIPT_DIR = Path(__file__).resolve().parent
REMOTION_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = REMOTION_ROOT.parent
AUDIO_DIR = REMOTION_ROOT / "public" / "audio"
REF_WAV = PROJECT_ROOT / "voice-tests" / "adam_ref.wav"
SCRATCH_DIR = PROJECT_ROOT / "voice-tests" / "operation-menu-scratch"

FFMPEG = REMOTION_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REMOTION_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

TEMPERATURE = 0.6  # settings from voice-tests/passageA_temp_t0.60.wav
SEED_BASE = 42     # same base seed used in chatterbox_narrator_test.py

PAD = 0.4
FPS = 30

# --- dead-air tightening (also used standalone by tighten_operation_menu_vo.py) ---
FRAME_MS = 10
LEAD_KEEP_S = 0.04
TRAIL_KEEP_S = 0.10
INTERNAL_GAP_MAX_S = 0.40
INTERNAL_GAP_KEEP_EACH_S = 0.20
FADE_S = 0.005
GATE_MIN_DB = -55
GATE_MAX_DB = -38
GATE_OFFSET_DB = 10
REPORT_GAP_MIN_S = 0.15

# --- verification thresholds for the --seeds candidate-selection path ---
VERIFY_MAX_LEAD_S = 0.06
VERIFY_MAX_TRAIL_S = 0.12
VERIFY_MAX_INTERNAL_GAP_S = 0.42
SEED_FALLBACK_OFFSET = 500  # if all candidate seeds fail verification, retry seed+500

# --- tone matching (pitch) so a regenerated slide sounds consistent with the rest ---
PITCH_FMIN_HZ = 50
PITCH_FMAX_HZ = 350
PITCH_FRAME_LENGTH = 1024
PITCH_HOP_LENGTH = 512
PITCH_GATE_PERCENTILE = 20
PITCH_GATE_OFFSET_DB = 15

# Slide 3 is built from two separately generated parts. Generated as one passage,
# Chatterbox dropped "hundred" from "three thousand, eight hundred seventy-five" in
# every seed and wording tried (12 takes), so the number sentence is generated on
# its own -- short inputs skip words far less -- using the exact take chosen by ear
# (the "and" wording, temperature 0.8, seed 146; voice-tests/operation-menu-scratch/
# number-tests/num-B-and-t0.8-s146.wav). The rest of the passage is generated at the
# standard temperature across the --seeds candidates and joined after gap_s of silence.
# NOTE: the spoken number has "and" where SLIDES' text does not.
STITCHED_SLIDES = {
    3: dict(
        number=("Three thousand eight hundred and seventy-five B fifty-two sorties.", 0.8, 146),
        rest_text=("In nineteen seventy-three, former Air Force major Hal Knight told the Senate "
                   "he helped falsify the reports."),
        rest_temperature=TEMPERATURE,
        gap_s=0.25,
    ),
}

SLIDES = [
    (1, "Nixon told the nation American policy was to respect Cambodia's neutrality. "
        "B fifty-twos had been bombing it for over a year."),
    (2, "The reports said South Vietnam. The bombs fell on Cambodia. "
        "The real records were burned."),
    (3, "Three thousand, eight hundred seventy-five B fifty-two sorties. "
        "In nineteen seventy-three, former Air Force major Hal Knight told the Senate "
        "he helped falsify the reports."),
    (4, "Comment RECON for the free PDF on Vietnam."),
]


def set_seed(seed: int) -> None:
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def generate_slide(model, text: str, seed: int, temperature: float = TEMPERATURE):
    """Reuses generate() exactly as chatterbox_narrator_test.py's generate_clip() does.
    If generate() ever returns multiple chunks instead of one tensor, concatenate
    them so nothing is truncated."""
    set_seed(seed)
    result = model.generate(
        text,
        audio_prompt_path=None,  # conditionals already prepared once, reused
        temperature=temperature,
    )
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


def analyze_silence(y: np.ndarray, sr: int) -> dict:
    """Reports noise floor, gate threshold, leading/trailing silence, and every
    internal silent gap longer than REPORT_GAP_MIN_S, all frame-gated at 10ms."""
    frames_db, frame_len = compute_frame_db(y, sr)
    frame_dur = frame_len / sr
    total_duration = len(y) / sr
    noise_floor_db, threshold_db = gate_threshold(frames_db)
    voiced = frames_db > threshold_db

    if not voiced.any():
        return dict(noise_floor_db=noise_floor_db, threshold_db=threshold_db,
                    leading_silence_s=total_duration, trailing_silence_s=0.0,
                    internal_gaps=[], total_duration=total_duration)

    first_voiced = int(np.argmax(voiced))
    last_voiced = len(voiced) - 1 - int(np.argmax(voiced[::-1]))
    leading_silence_s = first_voiced * frame_dur
    trailing_silence_s = total_duration - (last_voiced + 1) * frame_dur

    gaps = []
    i = first_voiced
    while i <= last_voiced:
        if not voiced[i]:
            run_start = i
            while i <= last_voiced and not voiced[i]:
                i += 1
            duration = (i - run_start) * frame_dur
            if duration > REPORT_GAP_MIN_S:
                gaps.append((run_start * frame_dur, duration))
        else:
            i += 1

    return dict(noise_floor_db=noise_floor_db, threshold_db=threshold_db,
                leading_silence_s=leading_silence_s, trailing_silence_s=trailing_silence_s,
                internal_gaps=gaps, total_duration=total_duration)


def trim_silence(y: np.ndarray, sr: int) -> np.ndarray:
    """Tighten dead air: keep LEAD_KEEP_S before the first voiced frame and
    TRAIL_KEEP_S after the last, cut internal silent runs longer than
    INTERNAL_GAP_MAX_S down to that length (half from each side of the run),
    and apply a FADE_S linear fade at the very ends to avoid clicks."""
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


def wav_to_mp3(wav_path: Path, mp3_path: Path, bitrate: str = "128k") -> None:
    result = subprocess.run(
        [str(FFMPEG), "-y", "-i", str(wav_path), "-ar", "44100", "-ab", bitrate, str(mp3_path)],
        capture_output=True,
        text=True,
    )
    wav_path.unlink(missing_ok=True)
    if result.returncode != 0:
        print(f"ffmpeg error:\n{result.stderr}")
        sys.exit(1)


def decode_mp3_to_mono(mp3_path: Path):
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


def verify_clip(y: np.ndarray, sr: int):
    info = analyze_silence(y, sr)
    max_gap = max((d for _, d in info["internal_gaps"]), default=0.0)
    ok = (info["leading_silence_s"] <= VERIFY_MAX_LEAD_S
          and info["trailing_silence_s"] <= VERIFY_MAX_TRAIL_S
          and max_gap <= VERIFY_MAX_INTERNAL_GAP_S)
    return ok, info, max_gap


def generate_candidates(model, text: str, seeds):
    """Generate one RAW (untrimmed) candidate per seed and analyze it."""
    candidates = []
    for seed in seeds:
        raw = generate_slide(model, text, seed)
        info = analyze_silence(raw, model.sr)
        total_internal = sum(d for _, d in info["internal_gaps"])
        candidates.append(dict(seed=seed, raw=raw, sr=model.sr, info=info,
                                total_internal=total_internal))
    return candidates


def print_candidate_table(candidates):
    header = (f"{'Seed':>6s} {'Dur(s)':>8s} {'Lead(s)':>8s} {'Trail(s)':>9s} "
              f"{'TotalIntSilence(s)':>19s}  InternalGaps>0.15s")
    print(header)
    print("-" * len(header))
    for c in candidates:
        info = c["info"]
        gaps_str = ", ".join(f"{s:.3f}+{d:.3f}" for s, d in info["internal_gaps"]) or "none"
        print(f"{c['seed']:>6d} {info['total_duration']:>8.3f} {info['leading_silence_s']:>8.3f} "
              f"{info['trailing_silence_s']:>9.3f} {c['total_internal']:>19.3f}  {gaps_str}")


def estimate_pitch_hz(y: np.ndarray, sr: int) -> float:
    """Median YIN pitch over frames that are actually voiced, gated by our own
    RMS threshold rather than librosa's own voicing heuristic (which misfires on
    this synthetic voice -- see the tone-matching investigation for slide 2)."""
    if sr != 22050:
        y = librosa.resample(y, orig_sr=sr, target_sr=22050)
        sr = 22050
    rms = librosa.feature.rms(y=y, frame_length=PITCH_FRAME_LENGTH, hop_length=PITCH_HOP_LENGTH)[0]
    rms_db = 20 * np.log10(rms + 1e-12)
    thresh = np.percentile(rms_db, PITCH_GATE_PERCENTILE) + PITCH_GATE_OFFSET_DB
    voiced = rms_db > thresh

    f0 = librosa.yin(y, fmin=PITCH_FMIN_HZ, fmax=PITCH_FMAX_HZ, sr=sr,
                      frame_length=PITCH_FRAME_LENGTH, hop_length=PITCH_HOP_LENGTH)
    f0v = f0[voiced[:len(f0)]]
    return float(np.median(f0v)) if len(f0v) else float("nan")


def reference_pitch_hz(other_slide_nums) -> float:
    """Average median pitch of the other slides' current files, used as the tone
    target so a regenerated slide matches the rest of the voiceover."""
    pitches = []
    for n in other_slide_nums:
        mp3_path = AUDIO_DIR / f"operation-menu-vo-{n:02d}.mp3"
        if not mp3_path.exists():
            continue
        y, sr = decode_mp3_to_mono(mp3_path)
        p = estimate_pitch_hz(y, sr)
        if not np.isnan(p):
            pitches.append(p)
            print(f"  reference pitch from slide {n}: {p:.1f}Hz")
    if not pitches:
        return float("nan")
    return float(np.mean(pitches))


def regenerate_with_seed_search(model, slide_num: int, text: str, seed_batches, target_pitch_hz=None):
    """Try each batch of seeds in order. Within a batch, trim + encode every
    candidate into SCRATCH_DIR and verify the encoded result (dead-air limits).
    Among the candidates that pass verification, pick the one whose pitch is
    closest to target_pitch_hz (tie-break: lowest total internal silence, then
    shorter duration); if target_pitch_hz is None, pick lowest total internal
    silence directly (original behavior). If an entire batch has no passing
    candidate, move on to the next batch (the fallback seeds)."""
    stem = f"operation-menu-vo-{slide_num:02d}"
    final_mp3 = AUDIO_DIR / f"{stem}.mp3"
    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)

    for batch_num, seeds in enumerate(seed_batches, start=1):
        print(f"\n=== Candidate batch {batch_num}: seeds {seeds} ===")
        candidates = generate_candidates(model, text, seeds)
        print_candidate_table(candidates)

        print("\nTrimming, encoding, and verifying every candidate in this batch:")
        passing = []
        for c in candidates:
            trimmed = trim_silence(c["raw"], c["sr"])
            scratch_wav = SCRATCH_DIR / f"{stem}-seed{c['seed']}.wav"
            scratch_mp3 = SCRATCH_DIR / f"{stem}-seed{c['seed']}.mp3"
            sf.write(str(scratch_wav), trimmed, c["sr"])
            wav_to_mp3(scratch_wav, scratch_mp3, bitrate="192k")

            check_y, check_sr = decode_mp3_to_mono(scratch_mp3)
            ok, check_info, max_gap = verify_clip(check_y, check_sr)
            pitch = estimate_pitch_hz(check_y, check_sr)
            status = "PASS" if ok else "FAIL"
            pitch_str = f"pitch={pitch:.1f}Hz" if not np.isnan(pitch) else "pitch=n/a"
            print(f"  seed={c['seed']}: lead={check_info['leading_silence_s']:.3f}s "
                  f"trail={check_info['trailing_silence_s']:.3f}s max_gap={max_gap:.3f}s "
                  f"{pitch_str} -> {status}")

            if ok:
                passing.append(dict(seed=c["seed"], scratch_mp3=scratch_mp3, info=c["info"],
                                     total_internal=c["total_internal"], pitch=pitch))

        if passing:
            if target_pitch_hz is not None and not np.isnan(target_pitch_hz):
                def sort_key(p):
                    dev = abs(p["pitch"] - target_pitch_hz) if not np.isnan(p["pitch"]) else float("inf")
                    return (dev, p["total_internal"], p["info"]["total_duration"])
                winner = min(passing, key=sort_key)
                print(f"\nTarget pitch: {target_pitch_hz:.1f}Hz")
                print(f"Winner: seed={winner['seed']} (batch {batch_num}) -- pitch {winner['pitch']:.1f}Hz "
                      f"(closest match, |dev|={abs(winner['pitch'] - target_pitch_hz):.1f}Hz) among "
                      f"candidates that passed verification.")
            else:
                winner = min(passing, key=lambda p: (p["total_internal"], p["info"]["total_duration"]))
                print(f"\nWinner: seed={winner['seed']} (batch {batch_num}) -- lowest total internal "
                      f"silence ({winner['total_internal']:.3f}s) among candidates that passed verification.")

            shutil.copy2(winner["scratch_mp3"], final_mp3)
            return winner["seed"], winner["info"], winner["total_internal"]

    print("ERROR: no candidate passed verification across all seed batches.")
    sys.exit(1)


def regenerate_stitched(model, slide_num: int, seeds):
    """Build a slide from STITCHED_SLIDES parts: the fixed number clip + one
    candidate 'rest' clip per seed, each trimmed, joined after gap_s of silence,
    trimmed again as a whole, encoded at 192k into SCRATCH_DIR, and dead-air
    verified on the ENCODED file. Among candidates that pass, the one whose pitch
    is closest to the number clip's wins (so the seam doesn't jump in tone).
    Only a verified file is copied to AUDIO_DIR."""
    cfg = STITCHED_SLIDES[slide_num]
    stem = f"operation-menu-vo-{slide_num:02d}"
    final_mp3 = AUDIO_DIR / f"{stem}.mp3"
    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    sr = model.sr

    number_text, number_temp, number_seed = cfg["number"]
    number_clip = trim_silence(generate_slide(model, number_text, number_seed, number_temp), sr)
    number_pitch = estimate_pitch_hz(number_clip, sr)
    print(f"\nNumber clip: seed={number_seed} temp={number_temp} {len(number_clip) / sr:.2f}s "
          f"pitch={number_pitch:.1f}Hz\n  {number_text}")
    print(f"Rest text ({cfg['rest_temperature']} temp, seeds {seeds}):\n  {cfg['rest_text']}")

    gap = np.zeros(int(cfg["gap_s"] * sr), dtype=number_clip.dtype)
    print(f"\n{'Seed':>5s} {'Dur':>6s} {'Lead':>6s} {'Trail':>6s} {'MaxGap':>7s} {'IntSil':>7s} {'RestHz':>7s}  Result")
    passing = []
    for seed in seeds:
        rest_clip = trim_silence(generate_slide(model, cfg["rest_text"], seed, cfg["rest_temperature"]), sr)
        stitched = trim_silence(np.concatenate([number_clip, gap, rest_clip]), sr)
        scratch_wav = SCRATCH_DIR / f"{stem}-stitched-seed{seed}.wav"
        scratch_mp3 = SCRATCH_DIR / f"{stem}-stitched-seed{seed}.mp3"
        sf.write(str(scratch_wav), stitched, sr)
        wav_to_mp3(scratch_wav, scratch_mp3, bitrate="192k")

        y, y_sr = decode_mp3_to_mono(scratch_mp3)
        ok, info, max_gap = verify_clip(y, y_sr)
        total_internal = sum(d for _, d in info["internal_gaps"])
        rest_pitch = estimate_pitch_hz(rest_clip, sr)
        print(f"{seed:>5d} {info['total_duration']:>6.2f} {info['leading_silence_s']:>6.3f} "
              f"{info['trailing_silence_s']:>6.3f} {max_gap:>7.3f} {total_internal:>7.3f} "
              f"{rest_pitch:>7.1f}  {'PASS' if ok else 'FAIL'}")
        if ok:
            passing.append(dict(seed=seed, mp3=scratch_mp3, pitch=rest_pitch, total_internal=total_internal,
                                duration=info["total_duration"]))

    if not passing:
        print("\nERROR: no stitched candidate passed dead-air verification. Nothing was saved.")
        sys.exit(1)
    winner = min(passing, key=lambda p: (abs(p["pitch"] - number_pitch), p["total_internal"], p["duration"]))
    shutil.copy2(winner["mp3"], final_mp3)
    print(f"\nWinner: rest seed={winner['seed']} -- rest pitch {winner['pitch']:.1f}Hz vs number clip "
          f"{number_pitch:.1f}Hz (closest among candidates that passed verification).")
    return winner["seed"]


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
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", type=int, default=None,
                         help="Generate only this slide number (1-4)")
    parser.add_argument("--seeds", type=str, default=None,
                         help="Comma-separated candidate seeds for --only: generates one "
                              "raw candidate per seed, picks the one with the lowest total "
                              "internal silence, trims it, and verifies the result before "
                              "saving. Requires --only.")
    args = parser.parse_args()

    if args.seeds and args.only is None:
        print("ERROR: --seeds requires --only")
        sys.exit(1)

    if not REF_WAV.exists():
        print(f"ERROR: reference clip not found at {REF_WAV}")
        sys.exit(1)

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    slides_to_run = SLIDES if args.only is None else [(n, t) for n, t in SLIDES if n == args.only]
    if args.only is not None and not slides_to_run:
        print(f"ERROR: no slide numbered {args.only} in SLIDES")
        sys.exit(1)

    print("Loading Chatterbox Turbo model (cuda)...")
    model = ChatterboxTurboTTS.from_pretrained(device="cuda")
    print("Model loaded.")

    print(f"Preparing voice conditioning from {REF_WAV} ...")
    model.prepare_conditionals(str(REF_WAV))
    print("Conditioning ready.\n")

    results = []  # (slide_num, mp3_path, duration_s)
    for slide_num, text in slides_to_run:
        stem = f"operation-menu-vo-{slide_num:02d}"
        mp3_path = AUDIO_DIR / f"{stem}.mp3"

        if args.seeds and slide_num in STITCHED_SLIDES:
            seeds = [int(s.strip()) for s in args.seeds.split(",")]
            regenerate_stitched(model, slide_num, seeds)
        elif args.seeds:
            seeds = [int(s.strip()) for s in args.seeds.split(",")]
            fallback_seeds = [s + SEED_FALLBACK_OFFSET for s in seeds]
            other_slides = [n for n, _ in SLIDES if n != slide_num]
            print(f"Computing tone-match target pitch from slides {other_slides} ...")
            target_pitch = reference_pitch_hz(other_slides)
            regenerate_with_seed_search(model, slide_num, text, [seeds, fallback_seeds],
                                         target_pitch_hz=target_pitch)
        else:
            seed = SEED_BASE + slide_num
            wav_path = AUDIO_DIR / f"{stem}.wav"
            print(f"Generating {stem} (seed={seed}, temperature={TEMPERATURE}) ...")
            wav = generate_slide(model, text, seed)
            wav = trim_silence(wav, model.sr)
            sf.write(str(wav_path), wav, model.sr)
            wav_to_mp3(wav_path, mp3_path)

        duration = probe_duration(mp3_path)
        print(f"  Saved {mp3_path.name} ({duration:.3f}s)")
        results.append((slide_num, mp3_path, duration))

    print("\n=== Report ===")
    header = f"{'Slide':>5s} {'Audio (s)':>10s} {'+0.4 pad':>10s} {'Frames@30fps':>13s}"
    print(header)
    print("-" * len(header))
    total_audio = 0.0
    total_frames = 0
    for slide_num, mp3_path, duration in results:
        padded = duration + PAD
        frames = int(-(-(padded * FPS) // 1))  # ceil
        print(f"{slide_num:>5d} {duration:>10.3f} {padded:>10.3f} {frames:>13d}")
        total_audio += duration
        total_frames += frames
    print("-" * len(header))
    print(f"{'TOTAL':>5s} {total_audio:>10.3f} {total_audio + PAD * len(results):>10.3f} {total_frames:>13d}")


if __name__ == "__main__":
    main()
