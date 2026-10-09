"""Generate four original, compact mono PCM effects using only Python's standard library."""
import math
import random
import struct
import wave
from pathlib import Path

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
    rng = random.Random(137)
    # Body impact, resonant crumpling metal and a short road scrape.
    # Separate seeded noise keeps this asset reproducible without changing other effects.
    crash_rng = random.Random(902)
    low_noise = 0.0
    def collision(t, duration):
        nonlocal low_noise
        noise = crash_rng.uniform(-1, 1)
        low_noise = .88 * low_noise + .12 * noise
        thump = 1.05 * math.sin(2 * math.pi * (88 * t - 28 * t * t)) * math.exp(-t * 13)
        crack = .85 * noise * math.exp(-t * 44)
        metal = sum(.14 * math.sin(2 * math.pi * f * t) * math.exp(-t * decay)
                    for f, decay in [(347, 8), (593, 10), (1097, 15)])
        crumple = .62 * noise * math.exp(-t * 7) * (.5 + .5 * math.sin(2 * math.pi * 31 * t) ** 2)
        scrape = .55 * (noise - low_noise) * min(1, t / .055) * math.exp(-t * 5)
        return thump + crack + metal + crumple + scrape
    generate('hit', .85, collision)
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
