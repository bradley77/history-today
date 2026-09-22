#!/usr/bin/env python3
"""
Forced-alignment caption generator for the Operation Menu Quick Strike.

Run inside whisper-env (Python 3.11, CPU, stable-ts + a small English Whisper
model -- NOT chatterbox-env):
  ./whisper-env/Scripts/python.exe remotion/scripts/generate_captions_operation_menu.py

What it does, per slide (01-03; slide 04 gets no captions):
  1. Reads the slide's real spoken text by statically parsing SLIDES out of
     generate_vo_operation_menu_chatterbox.py (via ast, so this script never
     imports that module -- it top-level-imports chatterbox, which isn't
     installed in this venv).
  2. Runs a free transcribe() over the FINAL trimmed MP3 and compares it
     (normalized) against that SLIDES text. If they differ materially, this
     STOPS with a diff report and writes nothing -- the audio may not say what
     the config claims it says.
  3. Runs align() with the SLIDES text as the reference, which forces the
     exact known text onto the audio's timeline and returns per-word start/end
     times tokenized from that exact text (not from a free transcription, so
     hyphens/punctuation in the reference are handled consistently).
  4. Slices the aligned words into the hand-authored caption chunks below by
     matching each chunk's normalized spoken text against a flattened,
     punctuation-free character stream built from the aligned words -- robust
     to whatever way Whisper's tokenizer happened to split "fifty-twos" etc.
  5. Applies the start/end timing rule and writes
     remotion/src/data/operation-menu-captions.json.

Any alignment failure (chunk text not found in order) or transcript mismatch
stops the whole run -- no partial JSON is written.
"""
import ast
import json
import re
import subprocess
import sys
from difflib import SequenceMatcher
from pathlib import Path

import stable_whisper

SCRIPT_DIR = Path(__file__).resolve().parent
REMOTION_ROOT = SCRIPT_DIR.parent
PROJECT_ROOT = REMOTION_ROOT.parent
AUDIO_DIR = REMOTION_ROOT / "public" / "audio"
GENERATOR_SCRIPT = SCRIPT_DIR / "generate_vo_operation_menu_chatterbox.py"
OUTPUT_JSON = REMOTION_ROOT / "src" / "data" / "operation-menu-captions.json"

FFPROBE = "ffprobe"  # system ffprobe (whisper-env has no bundled binaries)
WHISPER_MODEL_NAME = "base.en"
FPS = 30

TRANSCRIPT_MATCH_THRESHOLD = 0.85

# Whisper's free transcribe() normalizes spoken numbers to digits ("three
# thousand eight hundred seventy five" -> "3875", "nineteen seventy three" ->
# "1973"), which isn't a real content mismatch against SLIDES' spelled-out
# text -- align() forces the literal reference text regardless. Collapsing
# any run of digits/number-words to one placeholder on both sides before
# diffing avoids flagging that formatting difference as a mismatch, while
# still catching genuinely different/missing words elsewhere.
NUMBER_WORDS = {
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
    "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
    "hundred", "thousand", "million", "billion",
}
LEAD_IN_S = 0.05
GAP_MERGE_THRESHOLD_S = 0.35
GAP_TAIL_PAD_S = 0.15
VISIBLE_FLAG_THRESHOLD_S = 0.9

# Caption chunks: display text (what's shown, may reformat numbers/hyphens for
# readability) paired with the exact spoken text (what's actually said in the
# audio, used only for alignment matching -- never rendered).
CAPTION_CHUNKS = {
    "01": [
        ("Nixon told the nation", "Nixon told the nation"),
        ("American policy was to respect\nCambodia's neutrality.", "American policy was to respect Cambodia's neutrality"),
        ("B-52s had been bombing it", "B fifty-twos had been bombing it"),
        ("for over a year.", "for over a year"),
    ],
    "02": [
        ("The reports said South Vietnam.", "The reports said South Vietnam"),
        ("The bombs fell on Cambodia.", "The bombs fell on Cambodia"),
        ("The real records were burned.", "The real records were burned"),
    ],
    "03": [
        ("3,875 B-52 sorties.", "Three thousand, eight hundred seventy-five B fifty-two sorties"),
        ("In 1973, former Air Force major", "In nineteen seventy-three, former Air Force major"),
        ("Hal Knight told the Senate", "Hal Knight told the Senate"),
        ("he helped falsify the reports.", "he helped falsify the reports"),
    ],
}


def normalize_token(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def parse_slides_from_generator() -> dict:
    """Statically extract SLIDES = [(int, "text"), ...] from the generator
    script via ast, without importing it (it top-level-imports chatterbox,
    which this venv does not have)."""
    tree = ast.parse(GENERATOR_SCRIPT.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == "SLIDES" for t in node.targets
        ):
            slides_list = ast.literal_eval(node.value)
            return {f"{n:02d}": text for n, text in slides_list}
    raise RuntimeError(f"Could not find SLIDES assignment in {GENERATOR_SCRIPT}")


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"ffprobe error:\n{result.stderr}")
        sys.exit(1)
    return float(result.stdout.strip())


def collapse_number_runs(words: list) -> list:
    out = []
    i = 0
    while i < len(words):
        if words[i].isdigit() or words[i] in NUMBER_WORDS:
            while i < len(words) and (words[i].isdigit() or words[i] in NUMBER_WORDS):
                i += 1
            out.append("NUM")
        else:
            out.append(words[i])
            i += 1
    return out


def check_transcript_matches(model, audio_path: Path, expected_text: str, slide_num: str) -> None:
    free_result = model.transcribe(str(audio_path), language="en", verbose=None)
    transcribed = free_result.text
    expected_words = collapse_number_runs(re.findall(r"[a-z0-9']+", expected_text.lower()))
    transcribed_words = collapse_number_runs(re.findall(r"[a-z0-9']+", transcribed.lower()))
    ratio = SequenceMatcher(None, expected_words, transcribed_words).ratio()
    print(f"  transcript check: ratio={ratio:.3f}")
    print(f"    expected:    {' '.join(expected_words)}")
    print(f"    transcribed: {' '.join(transcribed_words)}")
    if ratio < TRANSCRIPT_MATCH_THRESHOLD:
        print(f"\nSTOPPING: slide {slide_num}'s transcribed audio differs materially "
              f"from SLIDES text (ratio {ratio:.3f} < {TRANSCRIPT_MATCH_THRESHOLD}).")
        print("The audio may not say what generate_vo_operation_menu_chatterbox.py's "
              "SLIDES claims it says -- fix the mismatch before regenerating captions.")
        sys.exit(1)


def build_char_index(words):
    """Flatten aligned words into one punctuation-free character stream, with
    a parallel span list mapping each contributed character range back to
    that word's (start, end) time -- lets chunk text be located by simple
    substring search regardless of how the tokenizer split hyphenated words."""
    full_norm = []
    spans = []  # (char_start, char_end, word_start_time, word_end_time)
    cum = 0
    for w in words:
        n = normalize_token(w.word)
        if not n:
            continue
        spans.append((cum, cum + len(n), w.start, w.end))
        full_norm.append(n)
        cum += len(n)
    return "".join(full_norm), spans


def time_at_char(spans, char_pos: int, want_start: bool) -> float:
    for char_start, char_end, t_start, t_end in spans:
        if char_start <= char_pos < char_end:
            return t_start if want_start else t_end
    # char_pos is exactly at the end of the last span
    if spans and char_pos == spans[-1][1]:
        return spans[-1][2] if want_start else spans[-1][3]
    raise ValueError(f"char position {char_pos} not covered by any word span")


def align_slide(model, slide_num: str, spoken_text: str, audio_path: Path):
    print(f"\nAligning slide {slide_num}...")
    result = model.align(str(audio_path), text=spoken_text, language="en")
    words = result.all_words()
    full_norm, spans = build_char_index(words)

    chunks = CAPTION_CHUNKS[slide_num]
    audio_duration = probe_duration(audio_path)

    raw = []  # (display_text, start, last_word_end)
    pointer = 0
    for display_text, spoken in chunks:
        chunk_norm = "".join(normalize_token(w) for w in spoken.split())
        idx = full_norm.find(chunk_norm, pointer)
        if idx == -1:
            print(f"\nSTOPPING: could not align chunk on slide {slide_num}: "
                  f"spoken={spoken!r}")
            print(f"  Searched from character offset {pointer} in: {full_norm}")
            sys.exit(1)
        char_start = idx
        char_end = idx + len(chunk_norm)
        word_start_time = time_at_char(spans, char_start, want_start=True)
        word_end_time = time_at_char(spans, char_end - 1, want_start=False)
        start = max(0.0, word_start_time - LEAD_IN_S)
        raw.append((display_text, start, word_end_time))
        pointer = char_end

    final = []
    for i, (display_text, start, last_word_end) in enumerate(raw):
        if i == len(raw) - 1:
            end = audio_duration
        else:
            next_start = raw[i + 1][1]
            gap = next_start - last_word_end
            end = next_start if gap < GAP_MERGE_THRESHOLD_S else last_word_end + GAP_TAIL_PAD_S
        final.append({"text": display_text, "start": round(start, 3), "end": round(end, 3)})
    return final, audio_duration


def print_report(all_chunks: dict):
    print("\n=== Caption timing report ===")
    header = f"{'Slide':>5s} {'Chunk':>5s} {'Start':>8s} {'End':>8s} {'Visible':>8s}  Text"
    print(header)
    print("-" * len(header))
    flagged = []
    for slide_num, chunks in all_chunks.items():
        for i, c in enumerate(chunks, start=1):
            visible = c["end"] - c["start"]
            flag = " <-- SHORT" if visible < VISIBLE_FLAG_THRESHOLD_S else ""
            if flag:
                flagged.append((slide_num, i, visible))
            text_oneline = c["text"].replace("\n", " / ")
            print(f"{slide_num:>5s} {i:>5d} {c['start']:>8.3f} {c['end']:>8.3f} {visible:>8.3f}  {text_oneline}{flag}")
    if flagged:
        print("\nFlagged (visible < 0.9s):")
        for slide_num, i, visible in flagged:
            print(f"  slide {slide_num} chunk {i}: {visible:.3f}s")


def main():
    slides_text = parse_slides_from_generator()
    print(f"Parsed SLIDES from {GENERATOR_SCRIPT.name}:")
    for n, t in slides_text.items():
        print(f"  {n}: {t}")

    print(f"\nLoading Whisper model '{WHISPER_MODEL_NAME}' (CPU)...")
    model = stable_whisper.load_model(WHISPER_MODEL_NAME, device="cpu")
    print("Model loaded.")

    all_chunks = {}
    for slide_num in ["01", "02", "03"]:
        audio_path = AUDIO_DIR / f"operation-menu-vo-{slide_num}.mp3"
        if not audio_path.exists():
            print(f"ERROR: {audio_path} not found.")
            sys.exit(1)
        spoken_text = slides_text[slide_num]

        print(f"\n--- Slide {slide_num} ---")
        check_transcript_matches(model, audio_path, spoken_text, slide_num)
        chunks, audio_duration = align_slide(model, slide_num, spoken_text, audio_path)
        print(f"  audio duration: {audio_duration:.3f}s")
        all_chunks[slide_num] = chunks

    print_report(all_chunks)

    output = {"fps": FPS, "slides": all_chunks}
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
