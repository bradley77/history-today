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
AUDIO_DIR   = REPO_ROOT / "public" / "audio"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG  = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"
FPS   = 30
PAD   = 0.4  # seconds added per slide for breathing room

# Slides 1-3 only -- slide 4 is real archival audio (McNamara's own voice,
# already processed) and gets no VO.
#
# vo-02's "U.S." was replaced with "United States": Kokoro's phonemizer kept
# the literal "." inside the abbreviation in its IPA output (jˈuː.ˈɛs.),
# treating "U." and "S." as two separate sentence-ending punctuation marks
# and inserting an awkward pause between them. No phoneme-level splice can
# patch that -- it's a text-level issue -- so the source text itself changed.
LINES = [
    ("mcnamara-confession-vo-01", "Robert McNamara ran the Pentagon through seven years of Vietnam."),
    ("mcnamara-confession-vo-02", "In nineteen sixty seven, he secretly commissioned a history of United States decision-making in Vietnam."),
    ("mcnamara-confession-vo-03", "That study became the Pentagon Papers, the record of decisions the public was never supposed to see."),
]

# Pronunciation fixes -- phoneme-splice technique (same proven approach as
# generateVoiceover-nuremberg-goering.py / the antietam phoneme-fix scripts):
# phonemize the sentence normally (correct spelling throughout), then splice
# in a hand-built correct phoneme substring for just the mispronounced word.
# Chosen over a plain-text respelling (the "Khe Sanh" -> "Keh Sahn" approach)
# because there's no prior proven respelling for either word to reuse, and
# this session has no audio playback to A/B respelling candidates by ear the
# way that fix was validated -- phoneme IPA, by contrast, can be checked
# directly against dictionary pronunciation without listening. Recommend a
# listen-through once rendered to confirm before calling this final.
#
# McNamara: Kokoro doubles the "r" AND uses the wrong vowel -- "ɑː" (father)
# instead of "ɛ" (dress) -- ending on a rhotic "-er" (mˌæknəmˈɑːɹɹɚ,
# "mac-nuh-MAH-rrer") instead of a single "r" + plain schwa with the "ɛ"
# vowel (mˌæknəmˈɛɹə, "mac-nuh-MEH-ruh"). The first pass at this fix only
# corrected the double-r/rhotic-ending and kept the wrong vowel, which is
# why it still sounded off -- confirmed by ear (Brad) against an isolated
# test clip of just the corrected phoneme string before this was applied
# to the real file. Stress placement (secondary on "Mc", primary on "-me-")
# was already correct.
WRONG_MCNAMARA_PHONEMES = "mˌæknəmˈɑːɹɹɚ"
CORRECT_MCNAMARA_PHONEMES = "mˌæknəmˈɛɹə"

# Pentagon: Kokoro renders the middle vowel as "æ" and reduces the final
# syllable to an unstressed schwa (pˈɛntæɡən, "PEN-tag-ən") instead of a
# schwa in the middle and a secondary-stressed "ah" at the end
# (pˈɛntəɡˌɑːn, "PEN-tuh-GAHN") -- matches Merriam-Webster's ˈpen-tə-ˌgän.
WRONG_PENTAGON_PHONEMES = "pˈɛntæɡən"
CORRECT_PENTAGON_PHONEMES = "pˈɛntəɡˌɑːn"

# Per-file list of (wrong, correct) phoneme substitutions to apply, in
# order, after phonemizing that file's own LINES text.
# - vo-01: "McNamara" + "Pentagon" (both appear here).
# - vo-03: "Pentagon" only ("...became the Pentagon Papers...").
# - vo-02: NOT listed -- its fix was the plain-text "U.S." -> "United
#   States" change above, no phoneme splice needed (or possible).
PHONEME_FIXES = {
    "mcnamara-confession-vo-01": [
        (WRONG_MCNAMARA_PHONEMES, CORRECT_MCNAMARA_PHONEMES),
        (WRONG_PENTAGON_PHONEMES, CORRECT_PENTAGON_PHONEMES),
    ],
    "mcnamara-confession-vo-03": [
        (WRONG_PENTAGON_PHONEMES, CORRECT_PENTAGON_PHONEMES),
    ],
}

# This pass only touches vo-01 (McNamara vowel fix, confirmed by ear) --
# 02/03 are unaffected and already correct from the prior pass.
REGENERATE = {"mcnamara-confession-vo-01"}


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
    print("=== Kokoro TTS -- mcnamara-confession voiceovers (slides 1-3 only) ===\n")

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

    print(f"Generating {len(LINES)} segments (voice='{VOICE}', speed={SPEED})\n")

    generated = []  # (name, out_path, sample_duration_s)
    for name, text in LINES:
        mp3_path = AUDIO_DIR / f"{name}.mp3"

        if name not in REGENERATE:
            if not mp3_path.exists():
                print(f"ERROR: {name}.mp3 expected to already exist (reused, not regenerated) but is missing")
                sys.exit(1)
            print(f"  {name}: reused as-is (unaffected by this pass)")
            generated.append((name, mp3_path, None))
            continue

        fixes = PHONEME_FIXES.get(name)
        if fixes:
            phonemes = kokoro.tokenizer.phonemize(text, LANG)
            for wrong, correct in fixes:
                if wrong not in phonemes:
                    print(f"ERROR: expected phoneme substring not found in {name}'s phonemization:")
                    print(f"  looking for: {wrong}")
                    print(f"  got:         {phonemes}")
                    sys.exit(1)
                phonemes = phonemes.replace(wrong, correct)
            print(f"  {name}: phonemes: {phonemes}")
            samples, sample_rate = kokoro.create(
                text=phonemes, voice=VOICE, speed=SPEED, lang=LANG, is_phonemes=True,
            )
        else:
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
