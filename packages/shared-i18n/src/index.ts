import enCommon from './locales/en/common.json' with { type: 'json' };
import enAuth from './locales/en/auth.json' with { type: 'json' };
import enErrors from './locales/en/errors.json' with { type: 'json' };
import enStatus from './locales/en/status.json' with { type: 'json' };
import enSettings from './locales/en/settings.json' with { type: 'json' };
import enKyc from './locales/en/kyc.json' with { type: 'json' };
import enCampaigns from './locales/en/campaigns.json' with { type: 'json' };
import enNotifications from './locales/en/notifications.json' with { type: 'json' };

import hiCommon from './locales/hi/common.json' with { type: 'json' };
import hiAuth from './locales/hi/auth.json' with { type: 'json' };
import hiErrors from './locales/hi/errors.json' with { type: 'json' };
import hiStatus from './locales/hi/status.json' with { type: 'json' };
import hiSettings from './locales/hi/settings.json' with { type: 'json' };
import hiKyc from './locales/hi/kyc.json' with { type: 'json' };
import hiCampaigns from './locales/hi/campaigns.json' with { type: 'json' };
import hiNotifications from './locales/hi/notifications.json' with { type: 'json' };

import guCommon from './locales/gu/common.json' with { type: 'json' };
import guAuth from './locales/gu/auth.json' with { type: 'json' };
import guErrors from './locales/gu/errors.json' with { type: 'json' };
import guStatus from './locales/gu/status.json' with { type: 'json' };
import guSettings from './locales/gu/settings.json' with { type: 'json' };
import guKyc from './locales/gu/kyc.json' with { type: 'json' };
import guCampaigns from './locales/gu/campaigns.json' with { type: 'json' };
import guNotifications from './locales/gu/notifications.json' with { type: 'json' };

import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type Language,
} from '@ap/shared-constants';

export const resources = {
  [LANGUAGES.EN]: {
    common: enCommon,
    auth: enAuth,
    errors: enErrors,
    status: enStatus,
    settings: enSettings,
    kyc: enKyc,
    campaigns: enCampaigns,
    notifications: enNotifications,
  },
  [LANGUAGES.HI]: {
    common: hiCommon,
    auth: hiAuth,
    errors: hiErrors,
    status: hiStatus,
    settings: hiSettings,
    kyc: hiKyc,
    campaigns: hiCampaigns,
    notifications: hiNotifications,
  },
  [LANGUAGES.GU]: {
    common: guCommon,
    auth: guAuth,
    errors: guErrors,
    status: guStatus,
    settings: guSettings,
    kyc: guKyc,
    campaigns: guCampaigns,
    notifications: guNotifications,
  },
} as const;

export type TranslationResources = typeof resources;
export type TranslationNamespace = keyof (typeof resources)[typeof LANGUAGES.EN];

export { LANGUAGES, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type Language };

