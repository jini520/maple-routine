/**
 * 쿼리 열쇠를 만드는 한 자리. 호출부가 배열을 직접 적으면 같은 데이터에 열쇠가 둘 생겨 무효화가 한쪽만 닿는다.
 *
 * 첫 칸은 데이터의 종류다. 초기화 시각의 무효화와 저장 여부가 `meta` 가 아니라 이 칸을 보지는 않지만, 사람이 캐시를
 * 읽을 때 종류를 먼저 보게 두었다.
 */
import type { BossCycle } from '../../types'

export const queryKeys = {
  /** 추적 캐릭터 목록(Preferences). 아직 안 읽었으면 데이터가 없고, 읽었는데 없으면 `null` 이다. */
  trackedOcids: () => ['tracked-ocids'] as const,
  /** 캐릭터 하나의 스케줄러 응답. `syncSchedules` 회차가 캐릭터마다 나눠 넣는다. */
  schedule: (ocid: string) => ['schedule', ocid] as const,
  /** 캐릭터 하나의 `character/basic`. `fetchCharacterBasicCached` 가 넣는다. */
  characterBasic: (ocid: string) => ['character-basic', ocid] as const,
  /** 마지막 스케줄 회차의 받은 시각과 캐릭터별 결과 종류. 신선도와 다시 받기의 단위다. */
  scheduleRound: () => ['schedule-round'] as const,
  /** 가계부의 날짜별 줄(두 끝 포함). today 의 이번 주 · 가계부의 달 · 통계의 전 기간이 범위만 달리 든다. */
  ledgerDays: (from: string, to: string) => ['ledger-days', from, to] as const,
  /** 보스 수익 한 기간의 스냅샷. 첫 두 칸만으로 모든 기간을 한꺼번에 무효화한다. */
  bossProfitPeriod: (tab: BossCycle, periodKey: string) => ['boss-profit-period', tab, periodKey] as const,
  /** 드롭 기록 전 기간 묶음과 가뭄 요약. */
  dropHistory: () => ['drop-history'] as const,
  /** 오늘 강화 내역을 마지막으로 받은 시각. 수집기가 `setQueryData` 로 넣는다. */
  enhancementToday: () => ['enhancement-today'] as const,
  /** 자격 하나로 조회되는 전 계정의 캐릭터 목록. 자격이 바뀌면 열쇠가 바뀐다. */
  characterList: (credentialKey: string) => ['character-list', credentialKey] as const,
  /** 분류 하나의 공지 목록. */
  notices: (kind: string) => ['notices', kind] as const,
  /** 다섯 분류를 한꺼번에 가리키는 앞 칸. 포커스에 만료된 분류를 다 받는다. */
  allNotices: () => ['notices'] as const,
  /** 결산 중인지와 시작 시각. */
  settlement: () => ['settlement'] as const,
  /** 직접 완료를 연 보스. */
  manualCompletion: () => ['manual-completion'] as const,
  /** 추적 캐릭터가 직접 적은 완료. 이번 주 · 이번 달 기간 키가 열쇠다. */
  manualCompleted: (weeklyKey: string, monthlyKey: string) => ['manual-completed', weeklyKey, monthlyKey] as const,
  /** 파티 약속 목록(Preferences). 저장이 `setQueryData` 로 덮는다. */
  partyAppointments: () => ['party-appointments'] as const,
  /** 캐릭터 하나의 메소 획득량(%) 마지막 성공값. */
  mesoRate: (ocid: string) => ['meso-rate', ocid] as const,
  /** 메소 획득량 전부를 가리키는 앞 칸. */
  allMesoRates: () => ['meso-rate'] as const,
  /** 이벤트 월드 캐릭터 이름 배열. 강화 수집기가 `setQueryData` 로 넣는다. */
  eventWorldNames: () => ['event-world-names'] as const,
}
