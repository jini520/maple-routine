import type { ScheduleSyncError } from './schedule-sync'

export function formatScheduleSyncError(error: ScheduleSyncError): string {
  switch (error.kind) {
    case 'invalidApiKey':
      return 'API 키가 유효하지 않습니다'
    case 'rateLimited':
      return '잠시 후 다시 시도해주세요'
    case 'network':
      return '네트워크 오류가 발생했습니다'
  }
}

// 후보 목록(getCharacterPickerRoster) 조회 실패의 문구·액션([[ADR-062]] 결정 3).
//
// 같은 원인이라도 **자리에 따라 줄 수 있는 행동이 다르다** — 피커는 설정으로 보낼 수 있지만
// 온보딩 중에는 설정 화면 자체가 없다. 그래서 place를 받는다.
//
// 401에 "다시 시도"를 주지 않는 것이 핵심이다 — 눌러도 실패하는 버튼이기 때문이고, 그 대신
// 설정으로 보내면 error-resilience.md의 "전역 apiKeyInvalid → 설정 진입 유도"가 배너를 새로
// 만들지 않고 해결된다.
//
// 문구 어미는 에러 규칙에 따라 '~습니다'/'~주세요'다([[ADR-062]] 결정 5).
export type RosterErrorPlace = 'picker' | 'onboarding'

export interface RosterErrorCopy {
  title: string
  description: string
  action: { kind: 'retry' | 'openSettings'; label: string }
}

const RETRY = { kind: 'retry', label: '다시 시도' } as const

export function formatRosterError(error: ScheduleSyncError, place: RosterErrorPlace): RosterErrorCopy {
  switch (error.kind) {
    case 'invalidApiKey':
      return place === 'picker'
        ? {
            title: 'API 키가 유효하지 않습니다',
            description: '설정에서 키를 다시 등록해주세요',
            action: { kind: 'openSettings', label: '설정 열기' },
          }
        : {
            title: 'API 키가 유효하지 않습니다',
            description: 'API 키를 다시 확인해주세요',
            action: RETRY,
          }
    case 'rateLimited':
      // 즉시 누르면 또 429지만 버튼을 잠그지 않는다 — 잠글 시각을 추적하는 상태를 새로 만들 만큼의
      // 이익이 없다(사용자 결정 2026-07-30).
      return {
        title: '요청이 너무 많습니다',
        description: '잠시 후 다시 시도해주세요',
        action: RETRY,
      }
    case 'network':
      return {
        title: '캐릭터 목록을 불러오지 못했습니다',
        description: '네트워크 연결을 확인해주세요',
        action: RETRY,
      }
  }
}

export function formatSyncedAt(syncedAt: string | null): string {
  if (syncedAt === null) {
    return '동기화 기록 없음'
  }

  const diffMinutes = Math.floor((Date.now() - new Date(syncedAt).getTime()) / (60 * 1000))

  if (diffMinutes < 1) {
    return '방금 전'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`
  }
  return `${Math.floor(diffMinutes / 60)}시간 전`
}
