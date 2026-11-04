import { type Request, type Response, type NextFunction } from 'express';
import { ERROR_CODES, SETTING_KEYS } from '@ap/shared-constants';
import { SettingsService } from '../../modules/settings/settings.service.js';
import { AppError } from '../errors/index.js';

function ipToLong(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  const p0 = parts[0];
  const p1 = parts[1];
  const p2 = parts[2];
  const p3 = parts[3];
  if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) {
    return null;
  }
  return ((p0 << 24) | (p1 << 16) | (p2 << 8) | p3) >>> 0;
}

function matchesCidr(ip: string, entry: string): boolean {
  if (ip === entry) return true;
  if (!entry.includes('/')) return false;

  const parts = entry.split('/');
  const range = parts[0];
  const bitsStr = parts[1];
  if (!range || !bitsStr) return false;

  const bits = parseInt(bitsStr, 10);
  if (isNaN(bits) || bits < 0 || bits > 32) return false;

  const ipLong = ipToLong(ip);
  const rangeLong = ipToLong(range);
  if (ipLong === null || rangeLong === null) return false;

  if (bits === 0) return true;
  const mask = ((0xffffffff << (32 - bits)) >>> 0);
  return (ipLong & mask) === (rangeLong & mask);
}

export function adminIpAllowlist() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Break-glass emergency environment variable
    if (process.env.DISABLE_ADMIN_IP_ALLOWLIST === 'true') {
      return next();
    }

    try {
      const allowlist = await SettingsService.get(SETTING_KEYS.ADMIN_IP_ALLOWLIST).catch(() => []);
      if (!Array.isArray(allowlist) || allowlist.length === 0) {
        return next();
      }

      let clientIp = (req.ip || req.socket.remoteAddress || '').trim();
      if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
      }

      const isAllowed = allowlist.some((entry: string) => matchesCidr(clientIp, entry.trim()));
      if (!isAllowed) {
        throw new AppError(
          ERROR_CODES.IP_NOT_ALLOWED,
          'Administrative access is restricted from your current IP address',
          403,
          { clientIp },
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
