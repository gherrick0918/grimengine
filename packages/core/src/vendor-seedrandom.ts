export type SeedGenerator = () => number;

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): SeedGenerator {
  let t = seed >>> 0;
  return function generate() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    const result = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    return result;
  };
}

export default function seedrandom(seed?: string): SeedGenerator {
  if (!seed) {
    return Math.random;
  }
  const seedFactory = xmur3(seed);
  return mulberry32(seedFactory());
}
