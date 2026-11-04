import { SETTING_KEYS, ERROR_CODES } from '@ap/shared-constants';
import type {
  CreateCityInput,
  UpdateCityInput,
  CreateZoneInput,
  UpdateZoneInput,
} from '@ap/shared-validation';
import type {
  CityDto,
  ZoneDto,
  LegalVersionsResponse,
} from '@ap/shared-types';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import { SettingsService } from '../settings/settings.service.js';

export class LocationsService {
  /**
   * Returns active cities with zones count for public and onboarding pickers.
   */
  static async listActiveCities(): Promise<CityDto[]> {
    const cities = await prisma.city.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { zones: { where: { isActive: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return cities.map((c) => ({
      id: c.id,
      name: c.name,
      state: c.state,
      country: c.country,
      isActive: c.isActive,
      zonesCount: c._count.zones,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  /**
   * Returns active zones for a specific city.
   */
  static async listZonesForCity(cityId: string): Promise<ZoneDto[]> {
    const zones = await prisma.zone.findMany({
      where: { cityId, isActive: true },
      orderBy: { name: 'asc' },
    });

    return zones.map((z) => ({
      id: z.id,
      cityId: z.cityId,
      name: z.name,
      pinCodes: z.pinCodes,
      centerLat: z.centerLat,
      centerLng: z.centerLng,
      radiusMeters: z.radiusMeters,
      isActive: z.isActive,
      createdAt: z.createdAt.toISOString(),
    }));
  }

  /**
   * Admin: List all cities (including inactive) with total zones count.
   */
  static async listAllCitiesAdmin(): Promise<CityDto[]> {
    const cities = await prisma.city.findMany({
      include: {
        _count: {
          select: { zones: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return cities.map((c) => ({
      id: c.id,
      name: c.name,
      state: c.state,
      country: c.country,
      isActive: c.isActive,
      zonesCount: c._count.zones,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  /**
   * Admin: Create a new city.
   */
  static async createCity(input: CreateCityInput): Promise<CityDto> {
    const existing = await prisma.city.findUnique({
      where: {
        name_state: {
          name: input.name,
          state: input.state,
        },
      },
    });

    if (existing) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        409,
        `City "${input.name}, ${input.state}" already exists`,
      );
    }

    const city = await prisma.city.create({
      data: {
        name: input.name,
        state: input.state,
        country: input.country ?? 'IN',
        isActive: true,
      },
    });

    return {
      id: city.id,
      name: city.name,
      state: city.state,
      country: city.country,
      isActive: city.isActive,
      zonesCount: 0,
      createdAt: city.createdAt.toISOString(),
    };
  }

  /**
   * Admin: Update city details.
   */
  static async updateCity(id: string, input: UpdateCityInput): Promise<CityDto> {
    const city = await prisma.city.findUnique({
      where: { id },
      include: { _count: { select: { zones: true } } },
    });

    if (!city) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'City not found');
    }

    const updated = await prisma.city.update({
      where: { id },
      data: {
        name: input.name,
        state: input.state,
        country: input.country,
        isActive: input.isActive,
      },
      include: { _count: { select: { zones: true } } },
    });

    return {
      id: updated.id,
      name: updated.name,
      state: updated.state,
      country: updated.country,
      isActive: updated.isActive,
      zonesCount: updated._count.zones,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Admin: List all zones, optionally filtered by cityId.
   */
  static async listAllZonesAdmin(cityId?: string): Promise<ZoneDto[]> {
    const zones = await prisma.zone.findMany({
      where: cityId ? { cityId } : undefined,
      orderBy: { name: 'asc' },
    });

    return zones.map((z) => ({
      id: z.id,
      cityId: z.cityId,
      name: z.name,
      pinCodes: z.pinCodes,
      centerLat: z.centerLat,
      centerLng: z.centerLng,
      radiusMeters: z.radiusMeters,
      isActive: z.isActive,
      createdAt: z.createdAt.toISOString(),
    }));
  }

  /**
   * Admin: Create a zone.
   */
  static async createZone(input: CreateZoneInput): Promise<ZoneDto> {
    const city = await prisma.city.findUnique({
      where: { id: input.cityId },
    });

    if (!city) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Target city not found');
    }

    const zone = await prisma.zone.create({
      data: {
        cityId: input.cityId,
        name: input.name,
        pinCodes: input.pinCodes,
        centerLat: input.centerLat,
        centerLng: input.centerLng,
        radiusMeters: input.radiusMeters,
        isActive: true,
      },
    });

    return {
      id: zone.id,
      cityId: zone.cityId,
      name: zone.name,
      pinCodes: zone.pinCodes,
      centerLat: zone.centerLat,
      centerLng: zone.centerLng,
      radiusMeters: zone.radiusMeters,
      isActive: zone.isActive,
      createdAt: zone.createdAt.toISOString(),
    };
  }

  /**
   * Admin: Update zone details.
   */
  static async updateZone(id: string, input: UpdateZoneInput): Promise<ZoneDto> {
    const existing = await prisma.zone.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(ERROR_CODES.NOT_FOUND, 404, 'Zone not found');
    }

    const updated = await prisma.zone.update({
      where: { id },
      data: {
        name: input.name,
        pinCodes: input.pinCodes,
        centerLat: input.centerLat,
        centerLng: input.centerLng,
        radiusMeters: input.radiusMeters,
        isActive: input.isActive,
      },
    });

    return {
      id: updated.id,
      cityId: updated.cityId,
      name: updated.name,
      pinCodes: updated.pinCodes,
      centerLat: updated.centerLat,
      centerLng: updated.centerLng,
      radiusMeters: updated.radiusMeters,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Public: Retrieve current active legal document versions.
   */
  static async getLegalVersions(): Promise<LegalVersionsResponse> {
    let termsVersion = '1.0';
    let privacyVersion = '1.0';
    let posterPolicyVersion = '1.0';

    try {
      termsVersion = await SettingsService.get(SETTING_KEYS.TERMS_VERSION);
    } catch {
      // fallback
    }

    try {
      privacyVersion = await SettingsService.get(SETTING_KEYS.PRIVACY_VERSION);
    } catch {
      // fallback
    }

    try {
      posterPolicyVersion = await SettingsService.get(
        SETTING_KEYS.POSTER_POLICY_VERSION,
      );
    } catch {
      // fallback
    }

    return {
      termsVersion,
      termsUrl: '/legal/terms',
      privacyVersion,
      privacyUrl: '/legal/privacy',
      posterPolicyVersion,
      posterPolicyUrl: '/legal/poster-policy',
    };
  }
}

