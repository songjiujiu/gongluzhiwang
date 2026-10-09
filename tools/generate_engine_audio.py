"""Prepare loops from wikusv's real Lotus V8 recordings (CC BY 4.0)."""
import math
import random
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
    if output == 'engine.wav':
        # Use sustained RPM, not repeated throttle/release gestures. Gentle level
        # control preserves combustion texture; a quiet rolling bed adds motion.
        target=math.sqrt(sum(x*x for x in samples)/len(samples))
        energy=target*target;air=0;rng=random.Random(1401)
        alpha=1-math.exp(-1/(RATE*.12))
        for i,x in enumerate(samples):
            energy+=alpha*(x*x-energy)
            gain=max(.7,min(1.4,target/math.sqrt(max(1,energy))))
            air=.78*air+.22*rng.uniform(-1,1)
            samples[i]=x*gain+air*target*.32
    overlap = round((.32 if output=='engine.wav' else .16) * RATE)
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

prepare('lotus-rev.wav', 'engine.wav', 12.8, 19.2)
prepare('lotus-idle.wav', 'engine-idle.wav', 2.0, 4.4)
