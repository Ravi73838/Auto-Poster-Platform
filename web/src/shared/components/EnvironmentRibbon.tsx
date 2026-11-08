import React, { useEffect, useState } from 'react';
import { useApiClient } from '../lib/api';
import { Clock, RotateCcw, AlertTriangle } from 'lucide-react';
import type { ClockState } from '@ap/shared-types';

export function EnvironmentRibbon() {
  const client = useApiClient();
  const [clockState, setClockState] = useState<ClockState | null>(null);
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

  useEffect(() => {
    fetchClock();
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

  if (!clockState || clockState.isRealTime) {
    return null;
  }

  const offsetHours = Math.round(clockState.offsetMs / (3600 * 1000));
  const offsetDays = (clockState.offsetMs / (86400 * 1000)).toFixed(1);

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-500 px-4 py-1.5 flex items-center justify-between text-xs font-medium z-50">
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
  );
}

