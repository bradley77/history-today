#!/usr/bin/env python3
"""
Synthesized distant cannon booms for the fort-sumter-salute Quick Strike.

Writes remotion/public/audio/fort-sumter-salute-sfx-01.wav (1.6s) and -02.wav
(0.5s), 44.1kHz mono 16-bit. numpy + the standard wave module only.

Each boom is three layers:
  - body:   sine sweeping ~110Hz -> ~35Hz, exponential decay (tau 0.35s)
  - crack:  white noise burst, low-passed at ~600Hz, decay (tau 20ms)
  - rumble: brown noise low-passed below ~150Hz, decay (tau 0.6s)
Mixed, soft-clipped with tanh, peak-normalized to -3 dBFS, then a 5ms
fade-in and 0.3s fade-out. Variant 02 uses a different noise seed, 0.8x
amplitude and a slightly lower pitch, and is cut to 0.5s so it is silent
before the next spoken sentence (its 0.3s fade-out runs 0.2s-0.5s).

Run from the repo root:
  python tools/make_cannon_sfx.py
"""
import wave
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = REPO_ROOT / "remotion" / "public" / "audio"

SR = 44100
PEAK_DBFS = -3.0
FADE_IN_S = 0.005
FADE_OUT_S = 0.3

VARIANTS = [
    # (output name, noise seed, amplitude, pitch factor, duration s)
    ("fort-sumter-salute-sfx-01.wav", 1861, 1.0, 1.0, 1.6),
    ("fort-sumter-salute-sfx-02.wav", 4121, 0.8, 0.92, 0.5),
]


def lowpass(x: np.ndarray, cutoff_hz: float, q: float = 0.707) -> np.ndarray:
    """RBJ-cookbook 2nd-order low-pass biquad."""
    w0 = 2 * np.pi * cutoff_hz / SR
    alpha = np.sin(w0) / (2 * q)
    cos_w0 = np.cos(w0)
    b0 = (1 - cos_w0) / 2
    b1 = 1 - cos_w0
    b2 = (1 - cos_w0) / 2
    a0 = 1 + alpha
    a1 = -2 * cos_w0
    a2 = 1 - alpha
    b0, b1, b2, a1, a2 = b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0

    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        xi = x[i]
        yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        y[i] = yi
        x2, x1 = x1, xi
        y2, y1 = y1, yi
    return y


def normalize(x: np.ndarray) -> np.ndarray:
    peak = np.max(np.abs(x))
    return x / peak if peak > 0 else x


def make_boom(seed: int, amplitude: float, pitch: float, duration_s: float) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(SR * duration_s)
    t = np.arange(n) / SR

    # Body: pitch glides from ~110Hz down to ~35Hz over the first ~0.3s.
    f_start, f_end = 110.0 * pitch, 35.0 * pitch
    freq = f_end + (f_start - f_end) * np.exp(-t / 0.1)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-t / 0.35)

    # Crack: short low-passed noise burst (two passes for a muffled, distant edge).
    crack = rng.standard_normal(n) * np.exp(-t / 0.02)
    crack = normalize(lowpass(lowpass(crack, 600.0), 600.0))

    # Rumble: brown noise (integrated white noise), DC removed, kept below ~150Hz.
    brown = np.cumsum(rng.standard_normal(n))
    brown -= np.linspace(brown[0], brown[-1], n)
    rumble = lowpass(lowpass(brown, 150.0), 150.0)
    rumble = normalize(rumble) * (1 - np.exp(-t / 0.03)) * np.exp(-t / 0.6)

    mix = body + 0.35 * crack + 0.5 * rumble
    mix = np.tanh(1.5 * mix)

    # Fades before normalizing, so the 5ms fade-in (which lands on the crack
    # transient) can't pull the final peak below the -3 dBFS target.
    fade_in = int(SR * FADE_IN_S)
    fade_out = int(SR * FADE_OUT_S)
    mix[:fade_in] *= np.linspace(0, 1, fade_in)
    mix[-fade_out:] *= np.linspace(1, 0, fade_out)
    return normalize(mix) * 10 ** (PEAK_DBFS / 20) * amplitude


def write_wav(path: Path, audio: np.ndarray) -> None:
    pcm = np.clip(np.round(audio * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main() -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    for name, seed, amplitude, pitch, duration_s in VARIANTS:
        audio = make_boom(seed, amplitude, pitch, duration_s)
        path = AUDIO_DIR / name
        write_wav(path, audio)
        peak_db = 20 * np.log10(np.max(np.abs(audio)))
        print(f"{path}  {len(audio) / SR:.3f}s  peak {peak_db:.2f} dBFS")


if __name__ == "__main__":
    main()
