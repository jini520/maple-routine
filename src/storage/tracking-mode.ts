import { Preferences } from '@capacitor/preferences'
import { STORAGE_KEYS } from './keys'

export type TrackingMode = 'auto' | 'manual'

// 저장된 값이 없거나 알 수 없는 값이면 'auto'가 기본값이다(ADR-035 결정 2 — 자동 모드가 기본).
export async function getTrackingMode(): Promise<TrackingMode> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.trackingMode })
  return value === 'manual' ? 'manual' : 'auto'
}

export async function setTrackingMode(mode: TrackingMode): Promise<void> {
  await Preferences.set({ key: STORAGE_KEYS.trackingMode, value: mode })
}
