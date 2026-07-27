export const STORAGE_KEYS = {
  apiKey: 'apiKey',
  selectedAccountId: 'selectedAccountId',
  theme: 'theme',
  trackingMode: 'trackingMode',
  dropEffect: 'dropEffect',
} as const

export function schedulerCacheKey(ocid: string): string {
  return `schedulerCache:${ocid}`
}

export function characterBasicCacheKey(ocid: string): string {
  return `characterBasicCache:${ocid}`
}

export function characterBasicCacheIndexKey(): string {
  return 'characterBasicCache:index'
}

// ADR-042: 컨텐츠/보스로 갈려 있던 추적 목록·현재 선택을 앱 전역 단일 키로 통합했다.
export function trackedCharactersKey(): string {
  return 'trackedCharacters'
}

export function lastSelectedCharacterKey(): string {
  return 'lastSelectedCharacter'
}

// ADR-035: 수동 트래킹 모드의 캐릭터별 추적 항목(멤버십) 키
export function manualTrackedContentKey(ocid: string): string {
  return `manualTrackedContent:${ocid}`
}

// ADR-030: 월드/계정 단위로 완료가 공유되는 콘텐츠의 진행 상태 원장 키
export function worldSharedProgressKey(world: string): string {
  return `worldSharedProgress:${world}`
}

export function accountSharedProgressKey(accountId: string): string {
  return `accountSharedProgress:${accountId}`
}
