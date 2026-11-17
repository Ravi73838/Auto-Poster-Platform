import sharp from '../../../../api/node_modules/sharp';

export interface PhotoOptions {
  plateNumber: string;
  posterText?: string;
  isNearDuplicate?: boolean;
  salt?: string;
  width?: number;
  height?: number;
  brightnessMod?: number;
}

/**
 * Generates valid, realistic synthetic JPEG images for simulator tests.
 * Includes vehicle registration plate number and poster rectangle in the image scan.
 */
export async function generateDriverPhoto(options: PhotoOptions): Promise<{
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}> {
  const width = options.width || 800;
  const height = options.height || 600;
  const posterText = options.posterText || 'POSTER: CAMPAIGN AUTO';
  const salt = options.salt || Math.random().toString(36).substring(2, 8);
  const plate = options.plateNumber.toUpperCase();

  // Draw simulated auto rickshaw rear with campaign poster and yellow license plate
  const svgOverlay = `
    <svg width="${width}" height="${height}">
      <!-- Auto Rickshaw Body Background -->
      <rect width="${width}" height="${height}" fill="#1E293B"/>
      <!-- Rear Window Frame -->
      <rect x="50" y="40" width="${width - 100}" height="${height - 200}" rx="16" fill="#334155" stroke="#64748B" stroke-width="4"/>
      <!-- Advertising Poster Rectangle -->
      <rect x="80" y="70" width="${width - 160}" height="${height - 280}" rx="8" fill="#2563EB"/>
      <text x="${width / 2}" y="${height / 2 - 40}" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${posterText}</text>
      <text x="${width / 2}" y="${height / 2 + 10}" font-family="Arial, sans-serif" font-size="16" fill="#BFDBFE" text-anchor="middle">SALT: ${salt}</text>
      <!-- Rear Bumper & License Plate Area -->
      <rect x="${width / 2 - 140}" y="${height - 110}" width="280" height="70" rx="8" fill="#FACC15" stroke="#000000" stroke-width="3"/>
      <text x="${width / 2}" y="${height - 65}" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#000000" text-anchor="middle">${plate}</text>
    </svg>
  `;

  let pipeline = sharp(Buffer.from(svgOverlay)).jpeg({ quality: 85 });

  if (options.isNearDuplicate) {
    // Near-duplicate: slightly adjust brightness/contrast to simulate light variation
    pipeline = pipeline.modulate({
      brightness: options.brightnessMod || 1.05,
      saturation: 0.98,
    });
  }

  const buffer = await pipeline.toBuffer();

  return {
    buffer,
    mimeType: 'image/jpeg',
    width,
    height,
    sizeBytes: buffer.length,
  };
}

/**
 * Returns an exact bit-for-bit duplicate copy of an existing image buffer.
 */
export function generateExactDuplicate(originalBuffer: Buffer): Buffer {
  return Buffer.from(originalBuffer);
}

/**
 * Generates a near-duplicate image buffer with subtle pixel variation.
 */
export async function generateNearDuplicate(options: PhotoOptions): Promise<Buffer> {
  const photo = await generateDriverPhoto({
    ...options,
    isNearDuplicate: true,
    brightnessMod: 1.04,
  });
  return photo.buffer;
}
