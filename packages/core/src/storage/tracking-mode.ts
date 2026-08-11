import { preferences } from './ports'
import { STORAGE_KEYS } from './keys'

export type TrackingMode = 'auto' | 'manual'

// ADR-086 결정 2: 저장된 값이 없거나 알 수 없는 값이면 **null(미선택)** 이다 — 전에는 'auto'를
// 돌려줘서 "자동을 골랐다"와 "아직 안 골랐다"가 같은 값이었고, 그래서 온보딩을 중간에 끊은
// 사용자에게 고르지도 않은 '자동'이 선택된 것처럼 보였다.
// **동작 기본값은 그대로 자동이다**(ADR-035 결정 2) — 소비처가 `?? 'auto'`로 흡수한다.
// 이 null을 "아직 안 골랐다"로 읽는 곳은 온보딩 게이트 하나뿐이다.
export async function getTrackingMode(): Promise<TrackingMode | null> {
  const value = await preferences.get(STORAGE_KEYS.trackingMode)
  if (value === 'manual' || value === 'auto') {
    return value
  }
  return null
}

export async function setTrackingMode(mode: TrackingMode): Promise<void> {
  await preferences.set(STORAGE_KEYS.trackingMode, mode)
}
