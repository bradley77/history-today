#!/usr/bin/env python3
"""
Spanish dub for the FRONT Quick Strike "dunkirk-halt-order" -- for Facebook's
built-in translation/dub upload feature, NOT the Remotion per-slide timeline.

Generates TWO things:
  1. Four per-slide clips (dunkirk-halt-order-spanish-slide{1..4}.mp3) --
     the locked paragraph split at the same sentence boundaries as the
     English per-slide script (generateVoiceover-dunkirk-halt-order.py).
     These are required input to pad_dub_to_video_length.py, which places
     each clip at its slide's actual start offset in the English video's
     timeline and pads with silence to build the upload-ready combined
     track -- see that script's docstring for why slot-placement matters
     and isn't the same as a flat concatenation.
  2. The original single flat-paragraph combined file
     (dunkirk-halt-order-spanish.mp3, unchanged from the first version of
     this script) -- kept for backward compatibility with anything already
     pointing at it, though pad_dub_to_video_length.py's output
     (dunkirk-halt-order-spanish-full.mp3) is the one that actually matches
     the video's timing and should be what gets uploaded.

Voice: em_alex -- same voice already used and proven for the North Anna
Spanish dub, kept for voice-identity consistency across dubbed videos
(confirmed with Brad before generating).
"""

import tempfile
from pathlib import Path

import soundfile as sf

from kokoro_pipeline import AUDIO_DIR, FFMPEG, FFPROBE, create_audio, load_kokoro, probe_duration, wav_to_mp3

VOICE = "em_alex"
# 1.05, not the usual 0.95 -- the locked Spanish text runs long against
# DunkirkHaltOrderQS's slot durations (0.95 summed to 25.156s vs a 23.8s
# target, 1.0 to 24.556s; 1.05 gets closest without going under, at
# 24.138s -- confirmed with Brad before committing to this value). See
# pad_dub_to_video_length.py for how the resulting overage gets absorbed
# without cutting off speech.
SPEED = 1.05
LANG = "es"

# Locked Spanish script, split at the same sentence boundaries as the
# English per-slide script (slide 2 carries two sentences, matching
# "Then the panzers stopped. On May twenty-fourth..." on the English side).
# Phonemization checked clean against kokoro_onnx's espeak-es backend before
# generating -- no language-switch artifacts, unlike the French script's
# "Göring" issue (see kokoro_pipeline.py's PRONUNCIATION_FIXES).
LINES = [
    (1, "Hitler tenía atrapado al ejército británico en Dunkerque."),
    (2, "Entonces los panzers se detuvieron. El 24 de mayo, los blindados alemanes se detuvieron justo a las afueras de Dunkerque."),
    (3, "Se dice que Hitler describió después la decisión como un gesto deportivo hacia Gran Bretaña."),
    (4, "Los diarios de guerra alemanes revelan una verdad más complicada: generales nerviosos, un Göring jactancioso y una apuesta por la Luftwaffe."),
]

# Flat paragraph -- identical text to LINES joined, kept as its own constant
# (rather than re-joining LINES) so this file's original combined-file
# behavior stays byte-for-byte unchanged from the first version of this
# script.
FULL_TEXT = (
    "Hitler tenía atrapado al ejército británico en Dunkerque. Entonces los "
    "panzers se detuvieron. El 24 de mayo, los blindados alemanes se "
    "detuvieron justo a las afueras de Dunkerque. Se dice que Hitler "
    "describió después la decisión como un gesto deportivo hacia Gran "
    "Bretaña. Los diarios de guerra alemanes revelan una verdad más "
    "complicada: generales nerviosos, un Göring jactancioso y una apuesta "
    "por la Luftwaffe."
)

SLUG = "dunkirk-halt-order-spanish"
FULL_OUT_PATH = AUDIO_DIR / "dunkirk-halt-order-spanish.mp3"


def synthesize(kokoro, text: str, out_path: Path, use_ffmpeg: bool) -> tuple[Path, float]:
    samples, sample_rate = create_audio(kokoro, text, VOICE, SPEED, LANG)
    sample_duration = len(samples) / sample_rate

    if use_ffmpeg:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        sf.write(str(tmp_path), samples, sample_rate)
        wav_to_mp3(tmp_path, out_path)
        return out_path, sample_duration
    else:
        wav_path = out_path.with_suffix(".wav")
        sf.write(str(wav_path), samples, sample_rate)
        return wav_path, sample_duration


def main() -> None:
    print("=== Kokoro TTS -- dunkirk-halt-order Spanish dub ===\n")

    kokoro = load_kokoro()
    use_ffmpeg = FFMPEG.exists()
    use_ffprobe = FFPROBE.exists()

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Generating {len(LINES)} per-slide clips (voice='{VOICE}', lang='{LANG}', speed={SPEED})\n")
    for slide_id, text in LINES:
        out_path = AUDIO_DIR / f"{SLUG}-slide{slide_id}.mp3"
        result_path, sample_duration = synthesize(kokoro, text, out_path, use_ffmpeg)
        size_kb = result_path.stat().st_size / 1024
        dur = probe_duration(result_path) if use_ffprobe and result_path.suffix == ".mp3" else sample_duration
        print(f"  Slide {slide_id}: {dur:.3f}s  ({size_kb:.0f} KB)  {result_path.name}")

    print(f"\nGenerating flat combined narration -> {FULL_OUT_PATH.name}\n")
    result_path, sample_duration = synthesize(kokoro, FULL_TEXT, FULL_OUT_PATH, use_ffmpeg)
    dur = probe_duration(result_path) if use_ffprobe and result_path.suffix == ".mp3" else sample_duration
    print(f"  {result_path.name}: {dur:.3f}s")

    print("\nDone.")


if __name__ == "__main__":
    main()
