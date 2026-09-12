#!/usr/bin/env python3
import sys
import subprocess
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

FFMPEG = REPO_ROOT / "node_modules" / "@remotion" / "compositor-win32-x64-msvc" / "ffmpeg.exe"

VOICE = "am_adam"
SPEED = 0.95
LANG  = "en-us"

LINES = [
    ("01", "People assume the opening clash between Grant's and Lee's armies was a battle of brilliant maneuver. It was not. It was a battle where neither side could see the other clearly, where cavalry and artillery were severely limited, and where numbers and even good generalship were harder to use than either commander expected. On May fourth, eighteen sixty four, Grant's army crosses the Rapidan at Germanna and Ely's Fords, moving quickly through the Wilderness toward open ground before Lee can block the way."),
    ("02", "Lee lets Grant cross. Then he sends Ewell down the Orange Turnpike and Hill down the Orange Plank Road, ordering them to block the Union advance while Longstreet races to join them."),
    ("03", "Around seven in the morning, May fifth, Ewell's advance makes contact with Warren's Fifth Corps near Saunders Field. Neither side expected to find the other so soon. The surprise is mutual."),
    ("04", "Meade orders Warren to attack. But Warren's corps is still tangled in the woods, stretched out over miles, struggling to form a proper line. When the attack finally comes, thousands of Union soldiers disappear into the trees."),
    ("05", "At the same time, Hill's column pushes east on the Orange Plank Road and runs into the Fifth New York Cavalry. Outnumbered, the troopers fall back fighting, buying just enough time for Getty's division to reach the crossroads first."),
    ("06", "If Hill reaches the junction first, he can isolate Hancock's corps from the rest of the army. Getty's division is rushed to intercept him."),
    ("07", "Getty reaches the crossroads just ahead of Hill. His division digs in."),
    ("08", "Hancock's Second Corps reinforces Getty, and the isolated stand becomes a full Union defensive line. Along the Plank Road, the fighting becomes a brutal back and forth."),
    ("09", "After dark, the fighting finally fades. Neither army has broken. In the dense woods, fires begin to spread through the brush, burning among the dead and wounded."),
    ("10", "At first light, both armies will attack again. Neither Grant nor Lee has won anything yet."),
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


def main() -> None:
    print("=== Kokoro TTS — Wilderness Episode 1 voiceovers ===\n")

    if not MODEL_FILE.exists():
        print(f"ERROR: Model not found at {MODEL_FILE}")
        sys.exit(1)
    if not VOICES_FILE.exists():
        print(f"ERROR: Voices not found at {VOICES_FILE}")
        sys.exit(1)

    print("Loading model ...", flush=True)
    kokoro = Kokoro(str(MODEL_FILE), str(VOICES_FILE))

    use_ffmpeg = FFMPEG.exists()
    if not use_ffmpeg:
        print(f"WARNING: ffmpeg not found at {FFMPEG} — will save as WAV")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Generating {len(LINES)} lines (voice='{VOICE}', speed={SPEED})\n")

    durations = []
    for num, text in LINES:
        samples, sample_rate = kokoro.create(text=text, voice=VOICE, speed=SPEED, lang=LANG)
        duration_s = len(samples) / sample_rate
        durations.append(duration_s)

        mp3_path = AUDIO_DIR / f"wilderness-ep1-vo-{num}.mp3"

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
        print(f"  vo-{num}: {duration_s:.3f}s  ({size_kb:.0f} KB)  {out_path.name}")

    print(f"\nDurations (durationInSeconds = actual + 0.4s pad):")
    for (num, _), dur in zip(LINES, durations):
        print(f"  vo-{num}: {dur:.3f}s  ->  durationInSeconds: {dur + 0.4:.3f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
