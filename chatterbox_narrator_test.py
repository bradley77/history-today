#!/usr/bin/env python
"""
Chatterbox Turbo narrator delivery test.

Generates a set of test renders from a fixed voice reference (ADAM.mp3) so
the best "history documentary narrator" delivery settings can be picked by
ear. Must be run from the chatterbox-env venv:

    ./chatterbox-env/Scripts/python.exe chatterbox_narrator_test.py
    ./chatterbox-env/Scripts/python.exe chatterbox_narrator_test.py --post

--- What was confirmed against the installed chatterbox package before writing
    this script (chatterbox-tts==0.1.7, ResembleAI/chatterbox-turbo weights) ---

ChatterboxTurboTTS.generate() (chatterbox/tts_turbo.py) signature:
    generate(text, repetition_penalty=1.2, min_p=0.00, top_p=0.95,
              audio_prompt_path=None, exaggeration=0.0, cfg_weight=0.0,
              temperature=0.8, top_k=1000, norm_loudness=True)

The Turbo model explicitly IGNORES exaggeration, cfg_weight, and min_p --
the source logs "CFG, min_p and exaggeration are not supported by Turbo
version and will be ignored" whenever any of them are non-zero. There is
no seed argument and no paralinguistic tag support (punc_norm() only does
punctuation cleanup, no bracket-tag parsing like [laugh]/[sigh]).

The only delivery knob Turbo actually respects is `temperature` (plus the
sampling knobs top_p / top_k / repetition_penalty, which we leave at
their defaults). So this script sweeps temperature only, and does not
sweep exaggeration/cfg_weight as the original ask assumed -- see the
"Delivery parameter support" printout below for the live confirmation.

Reference audio: prepare_conditionals() loads the prompt wav at S3GEN_SR
(24000 Hz) and only uses up to ~15s of it (ENC_COND_LEN = 15 * 16000 for
the T3 conditioning tokens, DEC_COND_LEN = 10 * 24000 for the S3Gen
reference), and asserts it must be longer than 5 seconds.

ADAM.mp3 was found to be a stereo file with a background music/tone bed
mixed under the narration throughout (side/mid stereo ratio ~0.31, no true
silence anywhere in the file). Chatterbox's S3Gen vocoder conditions on
the acoustic content of the reference clip, not just a speaker embedding,
so that bed bleeds into every generated render. This script runs the
reference through Demucs (htdemucs, two-stem vocals/no_vocals split,
free/open-source, Meta) first and builds adam_ref.wav from the isolated
vocal stem instead of the raw file.
"""

import argparse
import inspect
import shutil
import subprocess
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch

PROJECT_ROOT = Path(__file__).resolve().parent
ADAM_MP3 = PROJECT_ROOT / "ADAM.mp3"
VOICE_TESTS_DIR = PROJECT_ROOT / "voice-tests"
ADAM_REF_WAV = VOICE_TESTS_DIR / "adam_ref.wav"
DEMUCS_OUT_DIR = VOICE_TESTS_DIR / "demucs_out"
ADAM_VOCALS_WAV = VOICE_TESTS_DIR / "adam_vocals_isolated.wav"

SEED = 42
TEMPERATURES = [0.6, 0.7, 0.8]
PAUSE_TEMPERATURE = 0.7
SENTENCE_GAP_S = 0.40          # 350-450ms between sentences
FINAL_SENTENCE_GAP_S = 0.65    # slightly longer beat before the final sentence

PASSAGES = {
    "passageA": {
        "text": (
            "On the afternoon of July third, 1863, the guns fell silent. "
            "Across nearly a mile of open ground, thousands of Confederate "
            "infantry stepped out of the tree line and began to walk. "
            "They would not all come back."
        ),
        "sentences": [
            "On the afternoon of July third, 1863, the guns fell silent.",
            "Across nearly a mile of open ground, thousands of Confederate "
            "infantry stepped out of the tree line and began to walk.",
            "They would not all come back.",
        ],
    },
    "passageB": {
        "text": (
            "By the winter of 1864, the war had become a test of endurance. "
            "Supplies dwindled, railroads failed, and the outcome no longer "
            "rested on a single battle, but on the will of a nation to continue."
        ),
        "sentences": [
            "By the winter of 1864, the war had become a test of endurance.",
            "Supplies dwindled, railroads failed, and the outcome no longer "
            "rested on a single battle, but on the will of a nation to continue.",
        ],
    },
}


def set_seed(seed: int = SEED) -> None:
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def confirm_turbo_support(TurboClass) -> None:
    print("\n=== Delivery parameter support (installed package) ===")
    sig = inspect.signature(TurboClass.generate)
    params = list(sig.parameters)
    print(f"ChatterboxTurboTTS.generate() parameters: {params}")

    src = inspect.getsource(TurboClass.generate)
    ignores_cfg_ex = "not supported by Turbo version and will be ignored" in src
    print(f"exaggeration : accepted by signature, but source shows it is IGNORED "
          f"by Turbo ({ignores_cfg_ex})")
    print(f"cfg_weight   : accepted by signature, but source shows it is IGNORED "
          f"by Turbo ({ignores_cfg_ex})")
    print("temperature  : SUPPORTED (actually affects T3 sampling) -> sweeping this")
    print("paralinguistic tags ([laugh], [sigh], etc.): NOT supported -- "
          "punc_norm() only normalizes punctuation, no tag parsing")
    print(f"=> Sweeping temperature over {TEMPERATURES}, fixed seed={SEED} for every render.\n")


def isolate_vocals() -> Path:
    """Run Demucs two-stem separation on ADAM.mp3 and return the vocals-only wav path."""
    if ADAM_VOCALS_WAV.exists():
        print(f"Isolated vocal stem already exists at {ADAM_VOCALS_WAV}, reusing it.")
        return ADAM_VOCALS_WAV

    if not ADAM_MP3.exists():
        print(f"ERROR: {ADAM_MP3} not found. Place ADAM.mp3 in the project root and re-run.")
        sys.exit(1)

    print(f"Running Demucs vocal separation on {ADAM_MP3} ...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    cmd = [
        sys.executable, "-m", "demucs",
        "--two-stems=vocals", "-n", "htdemucs", "-d", device,
        "-o", str(DEMUCS_OUT_DIR), str(ADAM_MP3),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        print("ERROR: Demucs separation failed.")
        sys.exit(1)

    vocals_src = DEMUCS_OUT_DIR / "htdemucs" / ADAM_MP3.stem / "vocals.wav"
    if not vocals_src.exists():
        print(f"ERROR: expected Demucs output not found at {vocals_src}")
        sys.exit(1)

    shutil.copy(vocals_src, ADAM_VOCALS_WAV)
    print(f"Isolated vocal stem saved to {ADAM_VOCALS_WAV}")
    return ADAM_VOCALS_WAV


def prepare_reference_clip() -> None:
    if ADAM_REF_WAV.exists():
        print(f"Reference clip already exists at {ADAM_REF_WAV}, reusing it.")
        return

    vocals_wav = isolate_vocals()

    print(f"Loading {vocals_wav} ...")
    y, sr = librosa.load(str(vocals_wav), sr=24000, mono=True)
    total_dur = len(y) / sr
    print(f"Loaded {total_dur:.2f}s of audio at {sr} Hz.")

    # Find non-silent intervals, then merge ones close together into
    # continuous "runs" of speech (no long pauses inside a run).
    intervals = librosa.effects.split(y, top_db=30)
    if len(intervals) == 0:
        print("ERROR: no non-silent audio detected in ADAM.mp3.")
        sys.exit(1)

    gap_samples = int(0.35 * sr)
    runs = []
    run_start, run_end = intervals[0]
    for start, end in intervals[1:]:
        if start - run_end <= gap_samples:
            run_end = end
        else:
            runs.append((run_start, run_end))
            run_start, run_end = start, end
    runs.append((run_start, run_end))

    # Prefer the longest run; cap the chosen window to 15s from its start
    # if it runs long, and require at least 10s if possible.
    runs_sorted = sorted(runs, key=lambda r: r[1] - r[0], reverse=True)
    target_min = int(10.0 * sr)
    target_max = int(15.0 * sr)

    best = None
    for start, end in runs_sorted:
        length = end - start
        if length >= target_min:
            best = (start, min(end, start + target_max))
            break
    if best is None:
        # No run reaches 10s; fall back to the single longest run available.
        start, end = runs_sorted[0]
        best = (start, end)
        print(f"WARNING: no continuous run >= 10s found; using longest available "
              f"run ({(end - start) / sr:.2f}s).")

    start, end = best
    segment = y[start:end]
    peak = float(np.max(np.abs(segment))) if len(segment) else 0.0

    VOICE_TESTS_DIR.mkdir(exist_ok=True)
    sf.write(str(ADAM_REF_WAV), segment, sr)

    print(f"Selected clean speech range: {start / sr:.2f}s - {end / sr:.2f}s "
          f"({(end - start) / sr:.2f}s) out of {total_dur:.2f}s total.")
    print(f"Peak amplitude in selected segment: {peak:.3f} "
          f"({'OK, no clipping' if peak < 0.99 else 'WARNING: near/at clipping'})")
    print(f"Saved reference clip to {ADAM_REF_WAV}\n")


def generate_clip(model, text: str, temperature: float) -> np.ndarray:
    set_seed(SEED)
    wav = model.generate(
        text,
        audio_prompt_path=None,  # conditionals already prepared once, reused
        temperature=temperature,
    )
    return wav.squeeze(0).detach().cpu().numpy()


def generate_pause_shaped(model, sentences, sr: int) -> np.ndarray:
    pieces = []
    n = len(sentences)
    for i, sentence in enumerate(sentences):
        clip = generate_clip(model, sentence, PAUSE_TEMPERATURE)
        pieces.append(clip)
        if i < n - 1:
            gap = FINAL_SENTENCE_GAP_S if i == n - 2 else SENTENCE_GAP_S
            pieces.append(np.zeros(int(gap * sr), dtype=clip.dtype))
    return np.concatenate(pieces)


def run_ffmpeg_post(raw_path: Path, post_path: Path) -> None:
    filt = "highpass=f=70,acompressor=threshold=-18dB:ratio=3:attack=5:release=50,loudnorm=I=-16:TP=-1.5:LRA=11"
    cmd = ["ffmpeg", "-y", "-i", str(raw_path), "-af", filt, str(post_path)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"WARNING: ffmpeg post-processing failed for {raw_path.name}:\n{result.stderr[-800:]}")
    else:
        print(f"  -> post-processed: {post_path.name}")


def ffprobe_duration(path: Path) -> float:
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration",
           "-of", "csv=p=0", str(path)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return float(result.stdout.strip())
    except ValueError:
        return -1.0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--post", action="store_true",
                         help="Also render ffmpeg post-processed versions (*_post.wav)")
    args = parser.parse_args()

    VOICE_TESTS_DIR.mkdir(exist_ok=True)
    prepare_reference_clip()

    from chatterbox.tts_turbo import ChatterboxTurboTTS
    confirm_turbo_support(ChatterboxTurboTTS)

    print("Loading Chatterbox Turbo model (cuda)...")
    model = ChatterboxTurboTTS.from_pretrained(device="cuda")
    print("Model loaded.")

    set_seed(SEED)
    print(f"Preparing voice conditioning from {ADAM_REF_WAV} ...")
    model.prepare_conditionals(str(ADAM_REF_WAV))
    print("Conditioning ready.\n")

    manifest = []  # (path, description)

    for passage_name, passage in PASSAGES.items():
        for temp in TEMPERATURES:
            fname = f"{passage_name}_temp_t{temp:.2f}.wav"
            path = VOICE_TESTS_DIR / fname
            print(f"Generating {fname} (temperature={temp}) ...")
            wav = generate_clip(model, passage["text"], temp)
            sf.write(str(path), wav, model.sr)
            manifest.append((path, f"temperature={temp}"))

        pause_fname = f"{passage_name}_pause.wav"
        pause_path = VOICE_TESTS_DIR / pause_fname
        print(f"Generating {pause_fname} (pause-shaped, temperature={PAUSE_TEMPERATURE}) ...")
        wav = generate_pause_shaped(model, passage["sentences"], model.sr)
        sf.write(str(pause_path), wav, model.sr)
        manifest.append((pause_path, f"pause-shaped, temperature={PAUSE_TEMPERATURE}, "
                                      f"{SENTENCE_GAP_S*1000:.0f}ms/{FINAL_SENTENCE_GAP_S*1000:.0f}ms gaps"))

    if args.post:
        print("\nRunning ffmpeg post-processing (--post) ...")
        for path, _desc in list(manifest):
            post_path = path.with_name(path.stem + "_post.wav")
            run_ffmpeg_post(path, post_path)
            manifest.append((post_path, f"post-processed: {_desc}"))

    print("\n=== Render report ===")
    header = f"{'File':45s} {'Duration (s)':>12s}   Settings"
    print(header)
    print("-" * len(header))
    for path, desc in manifest:
        dur = ffprobe_duration(path)
        dur_str = f"{dur:.2f}" if dur >= 0 else "?"
        print(f"{path.name:45s} {dur_str:>12s}   {desc}")

    print(f"\nAll renders are in {VOICE_TESTS_DIR}/")
    print("Run again with the venv python:")
    print(r"  .\chatterbox-env\Scripts\python.exe chatterbox_narrator_test.py")
    print(r"  .\chatterbox-env\Scripts\python.exe chatterbox_narrator_test.py --post   # also render A/B post-processed versions")


if __name__ == "__main__":
    main()
