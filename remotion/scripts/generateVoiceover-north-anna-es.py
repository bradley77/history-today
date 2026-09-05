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
AUDIO_DIR   = REPO_ROOT / "public" / "audio" / "north-anna" / "es"

MODEL_FILE  = MODELS_DIR / "kokoro-v1.0.int8.onnx"
VOICES_FILE = MODELS_DIR / "voices-v1.0.bin"

FFMPEG  = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"
FFPROBE = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffprobe.exe"

SLUG  = "north-anna"
# Spanish counterpart to the English am_adam voice — confirmed available in
# this repo's cached voices-v1.0.bin (Kokoro-82M v1.0's standard 'e' =
# Spanish prefix), verified with a real test generation before this script
# was written. Same speed/pad convention as generateVoiceover-north-anna.py.
VOICE = "em_alex"
SPEED = 0.95
LANG  = "es"
PAD   = 0.4  # seconds added per slide for breathing room


# REVISED (round 2): the initial translation below ran 13-21% over each
# slide's locked on-screen window (see timing.json vs the first ffprobe pass)
# on slides 1-5. Tightened per Brad's direction ("trim/tighten the Spanish
# wording") rather than speeding up the voice or accepting audio that spills
# past the slide's cut point. Slide 6 was already under budget and is
# unchanged. Original (round 1) text, for reference:
#   1: "Lee construyó la mejor trampa de su carrera en North Anna. Pero no
#       pudo levantarse de su catre para usarla."
#   2: "Demasiado enfermo para cabalgar, Lee ve el movimiento río arriba y lo
#       llama una finta. Hill no se mueve."
#   3: "Hancock toma un reducto en minutos. El ataque de Hill quiebra a la
#       Brigada de Hierro, y luego se desmorona."
#   4: "Esa noche, Lee prepara una trampa con forma de V invertida que divide
#       al ejército de Grant en tres."
#   5: "Para la tarde, Lee no puede salir de su tienda. Su ayudante recuerda
#       las palabras: debemos darles un golpe."
LINES = [
    (1, "Lee tendió la mejor trampa de su carrera. No pudo dejar el catre para usarla."),
    (2, "Muy enfermo, Lee ve movimiento río arriba y lo llama finta. Hill no se mueve."),
    (3, "Hancock toma un reducto en minutos. Hill quiebra la Brigada de Hierro, y se desmorona."),
    (4, "Esa noche, Lee traza una trampa en V invertida que divide al ejército en tres."),
    (5, "Por la tarde, Lee no sale de su tienda. Su ayudante recuerda: debemos darles un golpe."),
    (6, "Grant reconoce la trampa, se retira el 26 de mayo y se dirige hacia Cold Harbor. Síguenos para más."),
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
    print("=== Kokoro TTS -- north-anna Spanish (ES) voiceovers ===\n")

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

    print(f"Generating {len(LINES)} slides (voice='{VOICE}', lang='{LANG}', speed={SPEED})\n")

    generated = []  # (slide_id, out_path, sample_duration_s)
    for slide_id, text in LINES:
        samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        sample_duration = len(samples) / sample_rate

        filename = f"{slide_id:02d}-{SLUG}-es.mp3"
        mp3_path = AUDIO_DIR / filename

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
        print(f"  Slide {slide_id:02d}: {sample_duration:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")
        generated.append((slide_id, out_path, sample_duration))

    # ffprobe pass -- exact MP3 durations
    print(f"\n=== ffprobe durations ===")
    for slide_id, path, sample_dur in generated:
        if use_ffprobe and path.suffix == ".mp3":
            dur = probe_duration(path)
        else:
            dur = sample_dur
        padded = dur + PAD
        print(f"  {path.name}  {dur:.3f}s  ->  slideDuration: {padded:.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
