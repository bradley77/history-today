#!/usr/bin/env python3
"""
pad_dub_to_video_length.py

General-purpose, reusable tool: takes N per-slide translated audio clips and
the target total video length (see below for how to supply it), and produces
ONE combined mp3 with the clips played SEQUENTIALLY -- each starting the
instant the previous one ends -- followed by silence padding to reach the
target total length.

PLACEMENT STRATEGY: SEQUENTIAL, NOT PER-SLIDE-SLOT
----------------------------------------------------
An earlier version of this script placed each clip at its own slide's START
OFFSET from the English timeline (so slide 3's translated line always began
exactly when slide 3's English line began), padding any leftover slot time
with silence. That works when translated lines fit inside their English
slide's duration, but on dunkirk-halt-order it didn't: several translated
lines ran well past their slide's English slot (Spanish slide 2 alone ran
2 seconds over a 5.7s slot), so slot-placement made those clips bleed
audibly into the NEXT slide's slot -- overlapping speech, not a clean dub.

Changed to sequential playback + end-padding per direction: these are
narrated-over-photos slides with no lip-sync requirement, so a translated
line starting a beat later or earlier than its English counterpart doesn't
matter -- only the TOTAL duration matching the video, and never overlapping
two lines of speech, actually matter. Sequential placement guarantees zero
overlap by construction (each clip only ever starts after the previous one's
audio has fully finished), at the cost of the dub's pacing drifting from the
English cut's -- an accepted tradeoff for this format.

If the clips' combined length is still LONGER than the target total (i.e.
even end-to-end, the translation doesn't fit), that surfaces as a single
clear overage on the whole track rather than N separate per-slide overlaps --
still never truncated; the output just runs long and this script says so.

WHY THIS EXISTS
---------------
public/audio/north-anna/north-anna-ES-full.mp3 (the Spanish dub actually
uploaded to Facebook's dub feature) was built by hand, matching the video's
total rendered length (34.717s vs timing.json's 34.687s, ~0.03s off) rather
than a straight end-to-end concatenation of the six raw Spanish clips (which
only ran 30.407s -- 4.3s short) -- but that step was never saved as a
script. This script exists so the next dub doesn't repeat that undocumented
manual step, or its sequel (slot-placement's overlap problem on
dunkirk-halt-order) by hand either.

HOW TO SUPPLY THE TARGET TOTAL DURATION
------------------------------------------
Only the SUM of what you pass in is used now (per-slide slot boundaries are
no longer consulted for placement -- see above), but both original input
shapes are kept so a timing.json or a composition's per-slide constants can
still be handed over directly without pre-summing them by hand:
1. --timing-json PATH: a timing.json in the shape the north-anna scripts
   already write (see scripts/generateVoiceover-north-anna.py) --
   {"slides": [{"slideDuration": ...}, ...], ...}. Only each slide's
   `slideDuration` is read (and summed); other fields are ignored.
2. --durations "2.8666667,5.7333333,5.4333333,9.7666667": a plain
   comma-separated list of per-slide durations in seconds -- for
   compositions like DunkirkHaltOrderQS.tsx that compute slide durations
   from constants in the .tsx file rather than writing a timing.json. Pull
   these from the composition's actual rendered frame counts
   (durationFrames / fps -- NOT the pre-rounding *_AUDIO_S/PAD_S constants,
   which drift a few ms from what actually renders once each slide's
   duration is independently rounded to a frame); this script does not
   parse .tsx source.
Either way, len(clips) must equal len(durations) -- a lightweight sanity
check that the durations given actually correspond to the clips given, even
though individual entries no longer drive placement.

USAGE
-----
    python pad_dub_to_video_length.py \\
        --durations 2.8666667,5.7333333,5.4333333,9.7666667 \\
        --clips slide1-es.mp3,slide2-es.mp3,slide3-es.mp3,slide4-es.mp3 \\
        --output dunkirk-halt-order-spanish-full.mp3

    python pad_dub_to_video_length.py \\
        --timing-json public/audio/north-anna/timing.json \\
        --clips public/audio/north-anna/es/01-north-anna-es.mp3,public/audio/north-anna/es/02-north-anna-es.mp3,public/audio/north-anna/es/03-north-anna-es.mp3,public/audio/north-anna/es/04-north-anna-es.mp3,public/audio/north-anna/es/05-north-anna-es.mp3,public/audio/north-anna/es/06-north-anna-es.mp3 \\
        --output /tmp/north-anna-ES-full-rebuilt.mp3

REQUIRES PER-SLIDE CLIPS, NOT A SINGLE COMBINED FILE
-----------------------------------------------------
This script cannot work from a single already-concatenated narration file --
there is no reliable way to know where one slide's line ends and the next
begins inside it without guessing at silence gaps (fragile, and exactly the
kind of guess this tool exists to avoid). Per-slide clips are a required
input, not an optional convenience.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            str(FFPROBE), "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"ffprobe error on {path}:\n{result.stderr}")
        sys.exit(1)
    return float(result.stdout.strip())


def load_durations_from_timing_json(path: Path) -> list[float]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [float(s["slideDuration"]) for s in data["slides"]]


def parse_durations_arg(raw: str) -> list[float]:
    return [float(x.strip()) for x in raw.split(",") if x.strip()]


def build_padded_track(clips: list[Path], durations: list[float], output_path: Path) -> None:
    if len(clips) != len(durations):
        print(
            f"ERROR: {len(clips)} clips but {len(durations)} durations given -- "
            f"these must be the same length (a sanity check that the durations "
            f"correspond to the clips), even though individual entries no "
            f"longer drive placement -- see the file header."
        )
        sys.exit(1)

    target_total_duration_s = sum(durations)

    # Sequential placement: clip i starts the instant clip i-1's audio ends
    # -- never at a fixed slide-timeline offset. Guarantees zero overlap
    # between any two lines of speech by construction, at the cost of pacing
    # drifting from the English cut's (accepted tradeoff -- see file header).
    clip_durations = [probe_duration(clip) for clip in clips]
    offsets_ms: list[int] = []
    running_s = 0.0
    for d in clip_durations:
        offsets_ms.append(round(running_s * 1000))
        running_s += d
    total_clip_duration_s = running_s

    # Whole-track overage check -- replaces the old per-slide overrun check
    # now that there are no per-slide slots to overrun. Reported, never
    # silently truncated: apad below only ever ADDS silence, so if the
    # clips alone already exceed the target, the output simply runs long.
    if total_clip_duration_s > target_total_duration_s + 0.01:  # 10ms tolerance for encode jitter
        overage = total_clip_duration_s - target_total_duration_s
        print(
            f"WARNING: the {len(clips)} clips play back-to-back for "
            f"{total_clip_duration_s:.3f}s, which is {overage:.3f}s LONGER than "
            f"the target video length ({target_total_duration_s:.3f}s). "
            f"Output will run over target -- not truncated.\n"
        )

    # ffmpeg: delay each clip to its sequential start offset (adelay, same
    # delay on both channels via all=1), concatenate via amix (normalize=0
    # because amix's default loudness normalization divides by input count
    # assuming simultaneous overlap, which would quietly reduce volume here
    # even though these clips never overlap by construction), then apad to
    # guarantee AT LEAST target_total_duration_s (apad only ADDS silence if
    # short; it never trims, so a whole-track overage is preserved, not cut).
    n = len(clips)
    filter_parts = []
    labels = []
    for i in range(n):
        label = f"a{i}"
        filter_parts.append(f"[{i}:a]adelay={offsets_ms[i]}:all=1[{label}]")
        labels.append(f"[{label}]")
    filter_parts.append("".join(labels) + f"amix=inputs={n}:duration=longest:dropout_transition=0:normalize=0[mixed]")
    filter_parts.append(f"[mixed]apad=whole_dur={target_total_duration_s:.3f}[out]")
    filter_complex = ";".join(filter_parts)

    cmd = [str(FFMPEG), "-y"]
    for clip in clips:
        cmd += ["-i", str(clip)]
    cmd += [
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-ar", "44100", "-ab", "128k",
        str(output_path),
    ]

    print("Sequential placement:")
    for i, (clip, off, clip_dur) in enumerate(zip(clips, offsets_ms, clip_durations)):
        print(f"  Slide {i + 1}: {clip.name}  clip={clip_dur:.3f}s  starts at {off / 1000:.3f}s")
    print(f"\nClips end-to-end: {total_clip_duration_s:.3f}s  |  Target total: {target_total_duration_s:.3f}s\n")

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ffmpeg error:\n{result.stderr}")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--timing-json", type=Path, help="Path to a timing.json to read slide durations from.")
    parser.add_argument("--durations", type=str, help="Comma-separated slide durations in seconds, in slide order (alternative to --timing-json).")
    parser.add_argument("--clips", type=str, required=True, help="Comma-separated per-slide audio clip paths, in slide order.")
    parser.add_argument("--output", type=Path, required=True, help="Output mp3 path.")
    args = parser.parse_args()

    if not args.timing_json and not args.durations:
        print("ERROR: supply one of --timing-json or --durations.")
        sys.exit(1)
    if args.timing_json and args.durations:
        print("ERROR: supply only one of --timing-json or --durations, not both.")
        sys.exit(1)

    durations = (
        load_durations_from_timing_json(args.timing_json)
        if args.timing_json
        else parse_durations_arg(args.durations)
    )
    clips = [Path(p.strip()) for p in args.clips.split(",") if p.strip()]

    for clip in clips:
        if not clip.exists():
            print(f"ERROR: clip not found: {clip}")
            sys.exit(1)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    build_padded_track(clips, durations, args.output)

    actual_duration = probe_duration(args.output)
    expected_total = sum(durations)
    print(f"Output: {args.output}")
    print(f"ffprobe duration: {actual_duration:.3f}s  (target: {expected_total:.3f}s, diff: {actual_duration - expected_total:+.3f}s)")
    print("\nDone.")


if __name__ == "__main__":
    main()
