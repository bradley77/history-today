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

# Grant's Memoirs -- one-off, BLUEGRAY-adjacent, no trigger word. Eight slide
# lines plus a spoken CTA line (this video's end card is NOT silent, unlike
# HancocksLineQS/HessAmnesiaQS -- see the build brief). On-screen-correct
# spelling throughout, not respelled. Numbers are already spelled out as
# words per the build brief -- left as-is, not converted to digits.
#
# Slide 4 revision (round 2): the original line used a colon ("...save his
# family: write his memoirs.") -- colons are a known Kokoro weak point, it
# often doesn't pause meaningfully there, risking a run-together "save his
# family write his memoirs." Rewritten as a straight sentence to remove the
# ambiguity without changing the meaning.
#
# Prosody pass (round 3) -- NOT mispronunciations, the phonemes were already
# correct; these are odd-lilt/pause prosody issues, fixed by restructuring
# text rather than phoneme overrides (confirmed via kokoro.create() being
# fully deterministic for identical (text, voice, speed, lang) -- re-running
# the exact same string a second time produces bit-identical audio, so a fix
# has to change the text, not just re-roll the same generation):
#   - Slide 1: "Robert E. Lee" -> "Robert E Lee" (dropped the period after
#     "E" -- confirmed via kokoro.tokenizer.phonemize that "E." was being
#     retained as a literal "." token between "E" and "Lee"
#     (...ˈiː. lˈiː...), which is what produced the audible pause; dropping
#     the period removes that token entirely (...ˈiː lˈiː...) with no other
#     text change needed. A "Robert Edward Lee" full-name variant was tried
#     in an earlier pass and rejected -- reverted back to "Robert E Lee" per
#     direction. "Ulysses S Grant" left as-is -- no pause was reported there,
#     and "S" doesn't expand to a real middle name, so there's no
#     substitution to make even if it turns out to need one later.
#   - Slide 2: "con man" -> "swindler" (also more historically precise for
#     Ferdinand Ward).
#   - Slide 4: restructured so "cancer" isn't sentence-final -- sentence-final
#     position is a common source of exaggerated falling-pitch TTS delivery.
#     "Doctors found throat cancer. Mark Twain gave him a chance..." ->
#     "Doctors found cancer in his throat, and Mark Twain gave him a
#     chance...".
#   - Slide 7: "rank it" -> "count it" (reworded around the pause rather than
#     fighting it).
LINES = [
    ("grants-memoirs-vo-01", "Ulysses S Grant beat Robert E Lee, served two terms as president, and became a legend."),
    ("grants-memoirs-vo-02", "By eighteen eighty four, he'd put his fortune in the hands of a Wall Street swindler young enough to be his son."),
    ("grants-memoirs-vo-03", "Ferdinand Ward's Ponzi scheme collapsed, wiping out Grant's fortune and leaving his family nearly destitute."),
    ("grants-memoirs-vo-04", "Doctors found cancer in his throat, and Mark Twain gave him a chance to save his family by writing his memoirs."),
    ("grants-memoirs-vo-05", "So Grant wrote, wrapped in blankets, barely able to speak, less than a month before the end."),
    ("grants-memoirs-vo-06", "This is him four days before he died, one day before he finished reviewing the manuscript."),
    ("grants-memoirs-vo-07", "Critics still count it among the finest military memoirs ever written."),
    ("grants-memoirs-vo-08", "Julia received the largest royalty check written up to that time. The man who died broke saved his family after all."),
    ("grants-memoirs-vo-cta", "Follow the page for the history they didn't teach you."),
]

# Last-resort fallback phrasing named in the build brief -- generated as a
# sidecar file (NOT wired into GrantsMemoirsQS.tsx) so it can be A/B'd by ear
# against the primary slide-4 line above without touching the locked
# composition durations. Only used if the primary slide-4 line still sounds
# off. (The slide-1 "Robert Edward Lee" fallback from an earlier pass is
# dropped -- slide 1 reverted to "Robert E Lee" per direction, see LINES
# above and its comment.)
FALLBACKS = [
    ("grants-memoirs-vo-04-alt", "He was diagnosed with throat cancer, and Mark Twain gave him a chance to save his family by writing his memoirs."),
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
    print("=== Kokoro TTS -- grants-memoirs voiceovers ===\n")

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

    print(f"Generating {len(LINES)} segments + {len(FALLBACKS)} fallback sidecar(s) (voice='{VOICE}', speed={SPEED})\n")

    fallback_names = {name for name, _ in FALLBACKS}
    generated = []  # (name, out_path, sample_duration_s)
    for name, text in LINES + FALLBACKS:
        mp3_path = AUDIO_DIR / f"{name}.mp3"
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

    # ffprobe pass -- exact MP3 durations and frame counts. Fallback sidecars
    # are measured too (printed below) but excluded from the composition
    # totals -- they're not wired into GrantsMemoirsQS.tsx.
    print(f"\n=== ffprobe durations ===")
    total_audio = 0.0
    frame_results = []
    fallback_results = []
    for name, path, sample_dur in generated:
        if use_ffprobe and path.suffix == ".mp3":
            dur = probe_duration(path)
        else:
            dur = sample_dur
        padded = dur + PAD
        frames = round(padded * FPS)
        if name in fallback_names:
            fallback_results.append((name, dur, padded, frames))
            print(f"  {name}.mp3  {dur:.3f}s  ->  durationInSeconds: {padded:.3f}  (durationInFrames: {frames})  [FALLBACK -- not wired in]")
            continue
        total_audio += dur
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
    if fallback_results:
        print("\n  Fallback sidecars (not in composition):")
        for name, dur, padded, frames in fallback_results:
            print(f"  {name + '.mp3':<28} {dur:>10.3f} {padded:>12.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
