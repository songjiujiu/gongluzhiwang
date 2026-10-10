"""Process qubodup's CC0 car-collision foley; see art/audio/README.md."""
import math
from pathlib import Path
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]


def generate_collision():
    with wave.open(str(ROOT / 'art/audio/collision-source.wav'), 'rb') as source:
        assert (source.getnchannels(), source.getsampwidth(), source.getframerate()) == (1, 2, 22050)
        data = source.readframes(source.getnframes())
    samples = [v[0] / 32768 for v in struct.iter_unpack('<h', data)]
    # Remove encoder silence, retaining 2 ms before the first audible transient.
    threshold = max(map(abs, samples)) * .015
    first = next(i for i, v in enumerate(samples) if abs(v) > threshold)
    samples = samples[max(0, first - 44):]
    rate = 22050
    dc = body = treble = 0.0
    dc_alpha = 1 - math.exp(-2 * math.pi * 45 / rate)
    body_alpha = 1 - math.exp(-2 * math.pi * 220 / rate)
    treble_alpha = 1 - math.exp(-2 * math.pi * 4800 / rate)
    output = []
    for i, value in enumerate(samples):
        dc += dc_alpha * (value - dc)
        treble += treble_alpha * (value - dc - treble)
        body += body_alpha * (treble - body)
        # Retain the sharp contact; emphasize body resonance without a long hiss.
        envelope = min(1, i / 11, (len(samples) - 1 - i) / 441)
        output.append((treble + .35 * body) * envelope)
    gain = .88 / max(map(abs, output))
    pcm = b''.join(struct.pack('<h', round(v * gain * 32767)) for v in output)
    target = ROOT / '公路之王/audio/hit.wav'
    with wave.open(str(target), 'wb') as audio:
        audio.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        audio.writeframes(pcm)
    print(f'hit.wav: {len(output) / rate:.3f}s, peak 0.88, {len(pcm) + 44} bytes')


if __name__ == '__main__':
    generate_collision()
