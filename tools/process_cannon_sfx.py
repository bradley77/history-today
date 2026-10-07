#!/usr/bin/env python3
"""
Distant cannon booms for the fort-sumter-salute Quick Strike, cut from a real
recording: "Cannon Shot" by qubodup, Freesound 187767, CC0 (see SOURCE.txt).

Reads  tools/sfx-source/cannon-shot.flac
Writes tools/sfx-source/test/cannon-boom-01.wav and cannon-boom-02.wav
       (44.1kHz mono 16-bit)

Steps:
  1. Inspect the source: duration, sample rate, channels, peak, shot onsets
     (ffmpeg silencedetect; an onset is a silence end preceded by >= 0.5s of
     silence, or sound at t=0). Uses the first shot.
  2. Cut that shot with 30ms pre-roll and up to 1.6s of tail (stopping short
     of the next shot), downmix to mono, resample to 44.1kHz.
  3. Low-pass (4th-order Butterworth, causal) to push it into the distance,
     then 5ms fade-in and 0.4s fade-out.
  4. Normalize the peak to -3 dBFS (after the fades).
  Boom 2 is the same cut pitched down ~8% (asetrate + aresample, so it also
  runs ~8% longer), a lower cutoff, and 0.8x gain (peak ~-4.9 dBFS).

The bundled Remotion ffmpeg has no lowpass/afade/volumedetect filters, so
filtering, fades and level measurement are done in numpy.

Run from the repo root:
  python tools/process_cannon_sfx.py
"""
import re
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "tools" / "sfx-source" / "cannon-shot.flac"
OUT_DIR = REPO_ROOT / "tools" / "sfx-source" / "test"
BIN = REPO_ROOT / "remotion" / "node_modules" / "@remotion" / "compositor-win32-x64-msvc"
FFMPEG = BIN / "ffmpeg.exe"
FFPROBE = BIN / "ffprobe.exe"

SR = 44100
PRE_ROLL_S = 0.03
MAX_TAIL_S = 1.6
SHOT_GAP_S = 0.5          # silence needed before an onset to count as a new shot
DETECT_NOISE = "-30dB"
FADE_IN_S = 0.005
FADE_OUT_S = 0.4
PEAK_DBFS = -3.0

VARIANTS = [
    # (output name, pitch factor, low-pass cutoff Hz, gain after normalizing)
    ("cannon-boom-01.wav", 1.00, 1800.0, 1.0),
    ("cannon-boom-02.wav", 0.92, 1500.0, 0.8),
]


def db(x: float) -> float:
    return 20.0 * np.log10(max(x, 1e-12))


def decode(af: str | None, mono: bool) -> tuple[np.ndarray, int]:
    """Decode the source through ffmpeg (optionally filtered) to 16-bit WAV,
    the only PCM encoder in the bundled build. Returns (frames x channels, rate)."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "x.wav"
        cmd = [str(FFMPEG), "-hide_banner", "-y", "-i", str(SRC)]
        if af:
            cmd += ["-af", af]
        if mono:
            cmd += ["-ac", "1"]
        cmd += ["-c:a", "pcm_s16le", str(out)]
        subprocess.run(cmd, capture_output=True, check=True)
        with wave.open(str(out), "rb") as w:
            channels, rate = w.getnchannels(), w.getframerate()
            raw = w.readframes(w.getnframes())
    frames = np.frombuffer(raw, dtype="<i2").reshape(-1, channels) / 32768.0
    return frames, rate


def probe() -> dict:
    r = subprocess.run(
        [str(FFPROBE), "-v", "error", "-show_entries", "stream=sample_rate,channels:format=duration",
         "-of", "default=noprint_wrappers=1", str(SRC)],
        capture_output=True, text=True, check=True,
    )
    return dict(line.split("=", 1) for line in r.stdout.split())


def silences() -> list[tuple[float, float]]:
    r = subprocess.run(
        [str(FFMPEG), "-hide_banner", "-i", str(SRC), "-af",
         f"silencedetect=noise={DETECT_NOISE}:d=0.1", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: (-?[\d.]+)", r.stderr)]
    return list(zip(starts, ends))


def find_shots(sil: list[tuple[float, float]], duration: float) -> list[float]:
    shots = []
    if not sil or sil[0][0] > 0.0:
        shots.append(0.0)
    for s, e in sil:
        if e - s >= SHOT_GAP_S or s == 0.0:
            if e < duration - 1e-3:
                shots.append(e)
    return shots


def biquad_lowpass(x: np.ndarray, fc: float, q: float, sr: int) -> np.ndarray:
    """RBJ cookbook low-pass biquad, direct form I."""
    w0 = 2.0 * np.pi * fc / sr
    alpha = np.sin(w0) / (2.0 * q)
    cw = np.cos(w0)
    a0 = 1.0 + alpha
    b0, b1, b2 = (1.0 - cw) / 2.0 / a0, (1.0 - cw) / a0, (1.0 - cw) / 2.0 / a0
    a1, a2 = -2.0 * cw / a0, (1.0 - alpha) / a0
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, xi in enumerate(x):
        yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        y[i] = yi
        x2, x1, y2, y1 = x1, xi, y1, yi
    return y


def lowpass4(x: np.ndarray, fc: float, sr: int) -> np.ndarray:
    """4th-order Butterworth as two cascaded biquads."""
    for q in (0.5412, 1.3066):
        x = biquad_lowpass(x, fc, q, sr)
    return x


def band_shares(x: np.ndarray, sr: int) -> str:
    """Ear proxy: share of energy in thump / body / harsh bands, and centroid."""
    spec = np.abs(np.fft.rfft(x)) ** 2
    f = np.fft.rfftfreq(len(x), 1.0 / sr)
    total = spec.sum()
    lo = spec[f < 200].sum() / total
    mid = spec[(f >= 200) & (f < 1500)].sum() / total
    hi = spec[f >= 2500].sum() / total
    centroid = (f * spec).sum() / total
    return f"<200Hz {lo:5.1%}  200-1500Hz {mid:5.1%}  >2500Hz {hi:5.2%}  centroid {centroid:6.0f}Hz"


def fades(x: np.ndarray, sr: int) -> np.ndarray:
    x = x.copy()
    n_in, n_out = int(FADE_IN_S * sr), int(FADE_OUT_S * sr)
    x[:n_in] *= np.linspace(0.0, 1.0, n_in)
    x[-n_out:] *= np.linspace(1.0, 0.0, n_out)
    return x


def write_wav(path: Path, x: np.ndarray, sr: int) -> None:
    pcm = np.clip(np.round(x * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def main() -> None:
    # 1. Inspect
    info = probe()
    duration = float(info["duration"])
    src, src_sr = decode(None, mono=False)
    print(f"Source: {SRC.name}")
    print(f"  duration {duration:.3f}s  {info['sample_rate']}Hz  {info['channels']} ch  "
          f"peak {db(np.abs(src).max()):.2f} dBFS "
          f"(per channel: {', '.join(f'{db(np.abs(src[:, c]).max()):.2f}' for c in range(src.shape[1]))})")
    sil = silences()
    print(f"  silencedetect noise={DETECT_NOISE} d=0.1:")
    for s, e in sil:
        print(f"    silence {s:7.3f}-{e:7.3f}  ({e - s:.3f}s)")
    shots = find_shots(sil, duration)
    for i, t in enumerate(shots, 1):
        seg = src[int(t * src_sr):int((t + 0.5) * src_sr)]
        print(f"  shot {i}: onset {t:.3f}s  peak in first 0.5s {db(np.abs(seg).max()):.2f} dBFS")
    onset = shots[0]
    next_shot = shots[1] if len(shots) > 1 else duration
    if len(shots) > 1:
        print(f"  {len(shots)} shots found; using shot 1 (onset {onset:.3f}s).")

    # 2. Cut: pre-roll + tail, never reaching the next shot's pre-roll
    start = max(0.0, onset - PRE_ROLL_S)
    end = min(onset + MAX_TAIL_S, next_shot - PRE_ROLL_S, duration)
    print(f"  cut {start:.3f}-{end:.3f}s ({end - start:.3f}s)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, pitch, cutoff, gain in VARIANTS:
        af = f"atrim=start={start}:end={end},asetpts=PTS-STARTPTS"
        if pitch != 1.0:
            af += f",asetrate={round(src_sr * pitch)}"
        af += f",aresample={SR}"
        x, sr = decode(af, mono=True)
        x = x[:, 0]
        before = band_shares(x, sr)
        # 3. Low-pass, then fades
        y = fades(lowpass4(x, cutoff, sr), sr)
        # 4. Normalize peak, then per-variant gain
        y *= 10.0 ** (PEAK_DBFS / 20.0) / np.abs(y).max()
        y *= gain
        out = OUT_DIR / name
        write_wav(out, y, sr)
        print(f"\n{name}: pitch x{pitch}  low-pass {cutoff:.0f}Hz  gain {gain}")
        print(f"  before LP: {before}")
        print(f"  after:     {band_shares(y, sr)}")
        print(f"  duration {len(y) / sr:.3f}s  peak {db(np.abs(np.round(y * 32767) / 32767).max()):.2f} dBFS")


if __name__ == "__main__":
    main()
