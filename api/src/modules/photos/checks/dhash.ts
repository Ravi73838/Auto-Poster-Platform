import sharp from 'sharp';

/**
 * Computes a 64-bit difference hash (dHash) for an image buffer.
 * 1. Resizes to 9x8 grayscale image.
 * 2. Compares adjacent pixels: if left > right, set bit to 1, else 0.
 * 3. Returns a 16-character hexadecimal string representing the 64 bits.
 */
export async function computeDHash(imageBuffer: Buffer): Promise<string> {
  const { data } = await sharp(imageBuffer)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col] ?? 0;
      const right = data[row * 9 + col + 1] ?? 0;
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }

  return hash.toString(16).padStart(16, '0');
}

/**
 * Computes the Hamming distance (number of differing bits) between two 64-bit dHash hex strings.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  try {
    let val = BigInt(`0x${hash1}`) ^ BigInt(`0x${hash2}`);
    let dist = 0;
    while (val > 0n) {
      dist += Number(val & 1n);
      val >>= 1n;
    }
    return dist;
  } catch {
    return 64; // Maximum distance on parse error
  }
}
