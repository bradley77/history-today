#!/usr/bin/env python3
"""
French dub for the FRONT Quick Strike "dunkirk-halt-order" -- for Facebook's
built-in translation/dub upload feature, NOT the Remotion per-slide timeline.

Generates TWO things:
  1. Four per-slide clips (dunkirk-halt-order-french-slide{1..4}.mp3) --
     the locked paragraph split at the same sentence boundaries as the
     English per-slide script (generateVoiceover-dunkirk-halt-order.py).
     These are required input to pad_dub_to_video_length.py, which places
     each clip at its slide's actual start offset in the English video's
     timeline and pads with silence to build the upload-ready combined
     track -- see that script's docstring for why slot-placement matters
     and isn't the same as a flat concatenation.
  2. The original single flat-paragraph combined file
     (dunkirk-halt-order-french.mp3, unchanged from the first version of
     this script) -- kept for backward compatibility with anything already
     pointing at it, though pad_dub_to_video_length.py's output
     (dunkirk-halt-order-french-full.mp3) is the one that actually matches
     the video's timing and should be what gets uploaded.

Voice: ff_siwis -- the ONLY French voice in this repo's cached
voices-v1.0.bin (no male French voice exists in this pack).

Pronunciation note: espeak-fr's language-switch heuristic doesn't recognize
"Göring" as French (every spelling tried was flagged) and renders it in
English mid-sentence by default. Fixed via kokoro_pipeline.py's
PRONUNCIATION_FIXES["fr-fr"]["göring"] -- confirmed clean before generating,
see that module for the phoneme derivation.
"""

import tempfile
from pathlib import Path

import soundfile as sf

from kokoro_pipeline import AUDIO_DIR, FFMPEG, FFPROBE, create_audio, load_kokoro, probe_duration, wav_to_mp3

VOICE = "ff_siwis"
SPEED = 0.95
LANG = "fr-fr"  # NOT "fr" -- espeak backend rejects bare "fr" outright.

# Locked French script, split at the same sentence boundaries as the English
# per-slide script (slide 2 carries two sentences, matching "Then the
# panzers stopped. On May twenty-fourth..." on the English side).
LINES = [
    (1, "Hitler avait l'armée britannique piégée à Dunkerque."),
    (2, "Puis les panzers se sont arrêtés. Le 24 mai, les blindés allemands ont fait halte juste aux portes de Dunkerque."),
    (3, "Hitler aurait ensuite décrit cette décision comme un geste sportif envers la Grande-Bretagne."),
    (4, "Les journaux de guerre allemands révèlent une vérité plus complexe : des généraux nerveux, un Göring vantard et un pari sur la Luftwaffe."),
]

# Flat paragraph -- identical text to LINES joined, kept as its own constant
# (rather than re-joining LINES) so this file's original combined-file
# behavior stays byte-for-byte unchanged from the first version of this
# script.
FULL_TEXT = (
    "Hitler avait l'armée britannique piégée à Dunkerque. Puis les panzers "
    "se sont arrêtés. Le 24 mai, les blindés allemands ont fait halte juste "
    "aux portes de Dunkerque. Hitler aurait ensuite décrit cette décision "
    "comme un geste sportif envers la Grande-Bretagne. Les journaux de "
    "guerre allemands révèlent une vérité plus complexe : des généraux "
    "nerveux, un Göring vantard et un pari sur la Luftwaffe."
)

SLUG = "dunkirk-halt-order-french"
FULL_OUT_PATH = AUDIO_DIR / "dunkirk-halt-order-french.mp3"


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
    print("=== Kokoro TTS -- dunkirk-halt-order French dub ===\n")

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
