#!/usr/bin/env python3
"""
Forced-alignment checks for the Operation Menu voiceover. Runs in whisper-env
(stable-ts), because chatterbox-env doesn't have it; generate_vo_operation_menu_
chatterbox.py shells out to this for its number check.

A forced aligner places every word of the reference text somewhere on the audio
timeline, so a word the TTS dropped ("hundred") doesn't go missing -- it gets
squeezed into a near-zero-length slot. Checking aligned word durations is what
catches that.

  items  mode: align arbitrary (id, audio, text) items, write JSON. Used by the
               generator. --number-check adds the "three thousand eight hundred
               seventy-five" check.
  slides mode: align the FINAL trimmed MP3s in remotion/public/audio/ against
               their SLIDES text and print a human report (words under 0.08s or
               words that cannot be placed). Read-only.
"""
import argparse
import json
import re
import sys
from pathlib import Path

import stable_whisper

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_captions_operation_menu import AUDIO_DIR, parse_slides_from_generator  # noqa: E402

MIN_HUNDRED_S = 0.20
MIN_NUMBER_WORD_S = 0.10
MIN_ANY_WORD_S = 0.08


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def align_words(model, audio: Path, text: str):
    result = model.align(str(audio), text=text, language="en")
    if result is None:
        return None
    return [
        dict(word=w.word.strip(), start=round(w.start, 3), end=round(w.end, 3),
             dur=round(w.end - w.start, 3))
        for w in result.all_words()
    ]


def number_check(words) -> dict:
    """three, thousand, eight, hundred, [and,] seventy-five (or seventy + five),
    contiguous and in order; hundred >= 0.20s, every one of them >= 0.10s."""
    norms = [norm(w["word"]) for w in words]
    fail = lambda why, picked: dict(**{"pass": False}, reason=why, words=picked)  # noqa: E731
    if "three" not in norms:
        return fail("could not place 'three'", [])
    i = norms.index("three")
    picked = []
    for k, target in enumerate(["three", "thousand", "eight", "hundred"]):
        if i + k >= len(norms) or norms[i + k] != target:
            return fail(f"could not place '{target}' in order", picked)
        picked.append(words[i + k])
    j = i + 4
    if j < len(norms) and norms[j] == "and":
        j += 1
    if j < len(norms) and norms[j] == "seventyfive":
        picked.append(words[j])
    elif j + 1 < len(norms) and norms[j] == "seventy" and norms[j + 1] == "five":
        picked += [words[j], words[j + 1]]
    else:
        return fail("could not place 'seventy-five' in order", picked)

    reasons = []
    if picked[3]["dur"] < MIN_HUNDRED_S:
        reasons.append(f"'hundred' {picked[3]['dur']:.3f}s < {MIN_HUNDRED_S:.2f}s")
    for w in picked:
        if w["dur"] < MIN_NUMBER_WORD_S:
            reasons.append(f"'{w['word']}' {w['dur']:.3f}s < {MIN_NUMBER_WORD_S:.2f}s")
    return dict(**{"pass": not reasons}, reason="; ".join(reasons) or "ok", words=picked)


def run_items(args, model):
    items = json.loads(Path(args.items).read_text(encoding="utf-8"))
    out = []
    for item in items:
        words = align_words(model, Path(item["audio"]), item["text"])
        entry = dict(id=item["id"], placed=words is not None, words=words or [])
        if args.number_check:
            entry["number_check"] = (
                number_check(words) if words else dict(**{"pass": False}, reason="aligner returned nothing", words=[])
            )
        out.append(entry)
    Path(args.out).write_text(json.dumps(dict(items=out), indent=2), encoding="utf-8")


def run_slides(args, model):
    slides_text = parse_slides_from_generator()
    for n in [s.strip() for s in args.slides.split(",")]:
        key = f"{int(n):02d}"
        audio = AUDIO_DIR / f"operation-menu-vo-{key}.mp3"
        text = slides_text[key]
        print(f"\n--- slide {key}: {audio.name} ---")
        print(f"text: {text}")
        words = align_words(model, audio, text)
        if words is None:
            print("CANNOT PLACE: aligner returned nothing")
            continue
        expected = len(text.split())
        if len(words) != expected:
            print(f"NOTE: aligned {len(words)} words vs {expected} whitespace tokens in the text")
        short = [w for w in words if w["dur"] < MIN_ANY_WORD_S]
        if short:
            for w in short:
                idx = words.index(w)
                nxt = words[idx + 1]["word"] if idx + 1 < len(words) else "-"
                print(f"  SHORT: '{w['word']}' {w['dur']:.3f}s at {w['start']:.2f}s (next word '{nxt}')")
        else:
            print(f"  no words under {MIN_ANY_WORD_S:.2f}s, all {len(words)} placed")
        if key == "03":
            nc = number_check(words)
            desc = ", ".join(f"{w['word']}={w['dur']:.3f}s" for w in nc["words"])
            print(f"  number check: {'PASS' if nc['pass'] else 'FAIL'} ({nc['reason']}) -> {desc}")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)
    p_items = sub.add_parser("items")
    p_items.add_argument("--items", required=True)
    p_items.add_argument("--out", required=True)
    p_items.add_argument("--number-check", action="store_true")
    p_slides = sub.add_parser("slides")
    p_slides.add_argument("--slides", required=True, help="comma-separated slide numbers, e.g. 1,2,4")
    parser.add_argument("--model", default="base.en")
    args = parser.parse_args()

    model = stable_whisper.load_model(args.model, device="cpu")
    if args.mode == "items":
        run_items(args, model)
    else:
        run_slides(args, model)


if __name__ == "__main__":
    main()
