export const STORAGE_KEYS = {
  apiKey: 'apiKey',
  // 레거시 — 계정 선택 단계가 사라져([[ADR-143]] 결정 7) 아무도 읽고 쓰지 않는다. 옛 설치본에
  // 남은 값을 치우기 위해 이름만 남긴다(연결 해제·캐시 삭제가 지운다).
  legacySelectedAccountId: 'selectedAccountId',
  theme: 'theme',
  trackingMode: 'trackingMode',
  dropEffect: 'dropEffect',
  // ADR-090: 전면광고 마지막 노출 시각. 앱 재시작을 넘어 간격을 재야 해서 영속 저장하지만,
  // cache-data.ts의 KEEP_KEYS에는 **넣지 않는다** — 지워져도 광고가 한 번 더 뜰 뿐이고
  // 보존해야 할 사용자 자산이 아니다.
  lastAdShownAt: 'lastAdShownAt',
  // ADR-126 결정 4: 마지막으로 실행된 OTA 번들 버전. 부팅 때 지금 도는 버전과 비교해 "방금
  // 업데이트했다"를 판정한다. `lastAdShownAt`과 같은 이유로 cache-data.ts의 KEEP_KEYS에는
  // **넣지 않는다** — 지워져도 다음 부팅이 조용히 다시 기록할 뿐이고, 그때 생기는 것은
  // 거짓 안내가 아니라 안내 없음이다.
  lastRunBundleVersion: 'lastRunBundleVersion',
} as const

export function schedulerCacheKey(ocid: string): string {
  return `schedulerCache:${ocid}`
}

export function characterBasicCacheKey(ocid: string): string {
  return `characterBasicCache:${ocid}`
}

// ADR-086 결정 9: 역인덱스를 계정별로 나눈다. 전역 인덱스였을 때는 피커의 stub 단계가 그것을
// 통째로 읽어 **이전 계정 캐릭터까지** 그렸다(계정 변경 후 관측된 증상).
export function characterBasicCacheIndexKey(accountId: string): string {
  return `characterBasicCache:index:${accountId}`
}

export const LEGACY_CHARACTER_BASIC_CACHE_INDEX_KEY = 'characterBasicCache:index'

// ADR-086 결정 4: (ocid, 날짜) 조회 원장 — 같은 캐릭터를 같은 날짜로 두 번 조회하지 않는다.
export function scheduleProbeKey(ocid: string): string {
  return `scheduleProbe:${ocid}`
}

// ADR-042: 컨텐츠/보스로 갈려 있던 추적 목록·현재 선택을 앱 전역 단일 키로 통합했다.
export function trackedCharactersKey(): string {
  return 'trackedCharacters'
}

export function lastSelectedCharacterKey(): string {
  return 'lastSelectedCharacter'
}

// ADR-143 결정 4: 사용자가 "대표"라고 말한 캐릭터(ocid 하나). 미지정이면 키 자체가 없다 —
// "첫 번째가 임시 대표"는 읽는 쪽의 규칙이고, 그 파생값을 여기 적어두면 사용자가 고른 대표와
// 앱이 계산한 대표 두 진실이 갈린다. `lastSelectedCharacter`(앱이 쓰는 값)와는 다른 축이다.
export function representativeCharacterKey(): string {
  return 'representativeCharacter'
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
