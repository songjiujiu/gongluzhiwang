"""Prepare loops from wikusv's real Lotus V8 recordings (CC BY 4.0)."""
import math
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RATE = 22050

def prepare(source, output, start, end):
    with wave.open(str(ROOT / 'art/audio' / source)) as w:
        assert w.getframerate() == RATE and w.getnchannels() == 1
        w.setpos(round(start * RATE))
        raw = w.readframes(round((end-start) * RATE))
    samples = list(struct.unpack('<' + 'h' * (len(raw)//2), raw))
    mean = sum(samples) / len(samples)
    samples = [x-mean for x in samples]
    overlap = round(.16 * RATE)
    loop = samples[overlap:]
    # Crossfade the recorded ending into its beginning; preserve original tone.
    for i in range(overlap):
        mix = (i+1)/overlap
        loop[-overlap+i] = samples[-overlap+i]*math.cos(mix*math.pi/2) + samples[i]*math.sin(mix*math.pi/2)
    peak = max(abs(x) for x in loop)
    pcm = b''.join(struct.pack('<h', round(x/peak*.85*32767)) for x in loop)
    destination = ROOT / '公路之王/audio' / output
    with wave.open(str(destination), 'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(pcm)
    print(f'{output}: {len(loop)/RATE:.2f}s real Lotus V8 recording loop, {len(pcm)+44} bytes')

prepare('lotus-rev.wav', 'engine.wav', 7.0, 9.4)
prepare('lotus-idle.wav', 'engine-idle.wav', 2.0, 4.4)
