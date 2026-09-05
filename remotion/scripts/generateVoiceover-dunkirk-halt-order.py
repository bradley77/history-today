#!/usr/bin/env python3
import sys
import tempfile
from pathlib import Path

import soundfile as sf

from kokoro_pipeline import AUDIO_DIR, FFMPEG, FFPROBE, create_audio, load_kokoro, probe_duration, wav_to_mp3

SLUG  = "dunkirk-halt-order"
VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"
PAD   = 0.4  # seconds added per slide for breathing room

LINES = [
    (1, "Hitler had the British Army trapped at Dunkirk."),
    (2, "Then the panzers stopped. On May twenty-fourth, German armor halted just outside Dunkirk."),
    (3, "Hitler later reportedly described the decision as giving Britain a sporting chance."),
    (4, "German war diaries reveal a messier truth: nervous generals, a boastful Göring, and a gamble on the Luftwaffe."),
]

# Pronunciation fix (Luftwaffe, via kokoro_pipeline.GERMAN_TERMS_PRONUNCIATION)
# only affects slide 4 -- it's the only line containing the word. Slides 1-3
# are unchanged text and don't need re-synthesis.
REGENERATE = {4}


def main() -> None:
    print("=== Kokoro TTS -- dunkirk-halt-order voiceovers ===\n")

    kokoro = load_kokoro()

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
        print(f"Skipping (unchanged): {', '.join(str(s) for s in skipped)}")
    print()

    generated = []  # (slide_id, out_path, sample_duration_s or None)
    for slide_id, text in LINES:
        mp3_path = AUDIO_DIR / f"{SLUG}-slide{slide_id}.mp3"

        if slide_id not in targets:
            if not mp3_path.exists():
                print(f"ERROR: {mp3_path} does not exist but slide {slide_id} was not selected for regeneration")
                sys.exit(1)
            print(f"  Slide {slide_id}: unchanged  {mp3_path.name}")
            generated.append((slide_id, mp3_path, None))
            continue

        samples, sample_rate = create_audio(kokoro, text, VOICE, SPEED, LANG)
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
        print(f"  Slide {slide_id}: {sample_duration:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")
        generated.append((slide_id, out_path, sample_duration))

    # ffprobe pass -- exact MP3 durations
    print(f"\n=== ffprobe durations ===")
    total_audio = 0.0
    results = []
    for slide_id, path, sample_dur in generated:
        if use_ffprobe and path.suffix == ".mp3":
            dur = probe_duration(path)
        else:
            dur = sample_dur
        padded = dur + PAD
        total_audio += dur
        print(f"  {path.name}  {dur:.3f}s  ->  durationInSeconds: {padded:.3f}")
        results.append((slide_id, path.name, dur, padded))

    print("\n=== Summary Table ===")
    print(f"  {'Filename':<32} {'Raw (s)':>10} {'Padded (s)':>12}")
    for _, filename, dur, padded in results:
        print(f"  {filename:<32} {dur:>10.3f} {padded:>12.3f}")

    print(f"\n  Total audio: {total_audio:.3f}s")
    print("\nDone.")


if __name__ == "__main__":
    main()
