"""Build the licensed collision effect and three original PCM effects."""
import math
import struct
import wave
from pathlib import Path
from generate_collision_audio import generate_collision

RATE = 22050
DESTINATION = Path(__file__).resolve().parents[1] / '公路之王' / 'audio'


def generate(name, duration, sample):
    count = round(duration * RATE)
    samples = []
    for index in range(count):
        t = index / RATE
        envelope = min(1.0, t / 0.004) * min(1.0, (duration - t) / 0.012)
        samples.append(sample(t, duration) * envelope)
    peak = max(max(abs(value) for value in samples), 0.001)
    pcm = b''.join(struct.pack('<h', round(value / peak * 0.72 * 32767)) for value in samples)
    with wave.open(str(DESTINATION / (name + '.wav')), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm)
    print(f'{name}.wav: {count} samples, {len(pcm) + 44} bytes')


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    generate_collision()
    generate('pulse', 0.42, lambda t, d: (math.sin(2 * math.pi * (280 * t - 220 * t * t)) + 0.25 * math.sin(2 * math.pi * 54 * t)) * (1 - t / d) ** 1.6)

    def success(t, duration):
        notes = [(0, 659.25), (0.075, 830.61), (0.15, 987.77)]
        return sum(0.6 * math.sin(2 * math.pi * frequency * (t - start)) * math.exp(-(t - start) * 13)
                   * min(1.0, max(0, (t - start) / 0.004))
                   for start, frequency in notes if t >= start)

    generate('success', 0.34, success)
    generate('signal', 0.09, lambda t, d: math.sin(2 * math.pi * (900 * t - 1000 * t * t)) * math.exp(-t * 32))


if __name__ == '__main__':
    main()
