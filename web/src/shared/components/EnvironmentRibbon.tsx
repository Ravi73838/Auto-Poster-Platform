import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../lib/api';
import { Clock, RotateCcw, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { ClockState, PublicAppConfigDto } from '@ap/shared-types';

export function EnvironmentRibbon() {
  const { t } = useTranslation('auth');
  const client = useApiClient();
  const [clockState, setClockState] = useState<ClockState | null>(null);
  const [appConfig, setAppConfig] = useState<PublicAppConfigDto | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const fetchClock = async () => {
    try {
      const res = await client.devGetClock();
      if (res) {
        setClockState(res);
      }
    } catch {
      // Endpoint disabled or production
      setClockState(null);
    }
  };

  const fetchAppConfig = async () => {
    try {
      const config = await client.getPublicAppConfig();
      if (config) {
        setAppConfig(config);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchClock();
    fetchAppConfig();
    const interval = setInterval(fetchClock, 30000);
    return () => clearInterval(interval);
  }, [client]);

  const handleResetClock = async () => {
    try {
      setIsResetting(true);
      await client.devResetClock();
      await fetchClock();
    } catch (err: any) {
      alert(err?.message || 'Failed to reset clock');
    } finally {
      setIsResetting(false);
    }
  };

  const showClock = Boolean(clockState && !clockState.isRealTime);
  const showOtpDisabled = Boolean(appConfig?.auth && appConfig.auth.otpEnabled === false);

  if (!showClock && !showOtpDisabled) {
    return null;
  }

  const offsetHours = clockState ? Math.round(clockState.offsetMs / (3600 * 1000)) : 0;
  const offsetDays = clockState ? (clockState.offsetMs / (86400 * 1000)).toFixed(1) : '0';

  return (
    <div className="flex flex-col z-50">
      {showOtpDisabled && (
        <div className="bg-amber-500/10 border-b border-amber-500/25 text-amber-500 dark:text-amber-400 px-4 py-1 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>{t('otpDisabledTestingBanner', { defaultValue: 'OTP authentication is DISABLED (testing mode)' })}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 font-bold">
            Auth Mode: Password Only
          </span>
        </div>
      )}
      {showClock && clockState && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-500 px-4 py-1.5 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 animate-pulse shrink-0" />
            <span>
              <strong>Simulated Clock Active:</strong> {clockState.simulatedTimeIst || clockState.simulatedTime} (Offset: +{offsetDays}d / +{offsetHours}h)
            </span>
          </div>
          <button
            onClick={handleResetClock}
            disabled={isResetting}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 transition-colors cursor-pointer"
            title="Reset clock to real-time"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{isResetting ? 'Resetting...' : 'Reset to Real Time'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

