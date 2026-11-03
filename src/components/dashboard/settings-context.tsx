'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_SETTINGS, makeFmt, type Fmt, type Settings } from '@/lib/settings';

const Ctx = createContext<{ settings: Settings; fmt: Fmt }>({ settings: DEFAULT_SETTINGS, fmt: makeFmt(DEFAULT_SETTINGS.units) });

export function SettingsProvider({ settings, children }: { settings: Settings; children: React.ReactNode }) {
  const value = useMemo(() => ({ settings, fmt: makeFmt(settings.units) }), [settings]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The signed-in user's goals and units, and the formatter for their units */
export const useSettings = () => useContext(Ctx);
