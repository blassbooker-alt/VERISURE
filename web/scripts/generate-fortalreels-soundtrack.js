import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const output = resolve(dirname(fileURLToPath(import.meta.url)), "../src/assets/fortalfy-reel-instrumental.wav");
const sampleRate = 44_100;
const duration = 8;
const sampleCount = sampleRate * duration;
const samples = [new Float32Array(sampleCount), new Float32Array(sampleCount)];
const chords = [
  [130.81, 164.81, 196, 261.63],
  [110, 130.81, 164.81, 220],
  [87.31, 110, 130.81, 174.61],
  [98, 123.47, 146.83, 196],
];
const melody = [392, 329.63, 261.63, 329.63, 440, 392, 329.63, 293.66];
let noiseState = 0x5a17f0;
const noise = () => {
  noiseState = (noiseState * 1_664_525 + 1_013_904_223) >>> 0;
  return (noiseState / 0x80000000) - 1;
};
let previousNoise = 0;

for (let index = 0; index < sampleCount; index += 1) {
  const time = index / sampleRate;
  const beat = time % 0.5;
  const beatNumber = Math.floor(time / 0.5);
  const bar = Math.floor(time / 2) % chords.length;
  const barTime = time % 2;
  const beatInBar = beatNumber % 4;
  let left = 0;
  let right = 0;

  const kickEnvelope = Math.exp(-beat * 13);
  const kickFrequency = 42 + 44 * Math.exp(-beat * 18);
  const kick = Math.sin(2 * Math.PI * kickFrequency * beat) * kickEnvelope * 0.34;
  left += kick;
  right += kick;

  const bassFrequency = chords[bar][0] / 2;
  const bassEnvelope = Math.exp(-beat * 3.5);
  const bass = Math.sin(2 * Math.PI * bassFrequency * time) * bassEnvelope * 0.16;
  left += bass;
  right += bass;

  const chordEnvelope = Math.min(1, barTime / 0.14, (2 - barTime) / 0.24);
  const pad = chords[bar].slice(1).reduce((sum, frequency, noteIndex) => {
    const voice = Math.sin(2 * Math.PI * frequency * time + noteIndex * 0.12);
    const overtone = Math.sin(2 * Math.PI * frequency * 2 * time) * 0.16;
    return sum + (voice + overtone) * chordEnvelope * 0.035;
  }, 0);
  left += pad;
  right += pad * 0.94;

  const melodyFrequency = melody[beatNumber % melody.length];
  const pluckEnvelope = Math.exp(-beat * 5.5);
  const pluck = Math.sin(2 * Math.PI * melodyFrequency * beat) * pluckEnvelope * 0.065;
  left += pluck * (beatNumber % 2 ? 0.72 : 1);
  right += pluck * (beatNumber % 2 ? 1 : 0.72);

  if (beatInBar === 1 || beatInBar === 3) {
    const rawNoise = noise();
    const highNoise = rawNoise - previousNoise * 0.72;
    previousNoise = rawNoise;
    const snare = highNoise * Math.exp(-beat * 24) * 0.045;
    left += snare;
    right -= snare * 0.85;
  }

  if (beat >= 0.24 && beat < 0.28) {
    const hat = noise() * Math.exp(-(beat - 0.24) * 210) * 0.018;
    left += hat * 0.8;
    right -= hat;
  }

  const edge = Math.min(1, time / 0.035, (duration - time) / 0.035);
  samples[0][index] = (left + right * 0.12) * edge;
  samples[1][index] = (right + left * 0.12) * edge;
}

let peak = 0;
for (const channel of samples) {
  for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
}
const gain = 0.48 / peak;
const dataSize = sampleCount * samples.length * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(dataSize, 40);

let offset = 44;
for (let index = 0; index < sampleCount; index += 1) {
  for (const channel of samples) {
    const value = Math.max(-1, Math.min(1, channel[index] * gain));
    wav.writeInt16LE(Math.round(value * 32_767), offset);
    offset += 2;
  }
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, wav);
console.log(`Generated original Fortalfy instrumental loop: ${output}`);
