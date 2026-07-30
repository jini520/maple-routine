import type { ScheduleSyncError } from './schedule-sync'

// tsconfig에 noImplicitReturns가 없어 switch가 소진되지 않아도 타입 오류가 나지 않는다 —
// ScheduleSyncError에 종류를 더했을 때 이 함수가 조용히 undefined를 반환하던 사고가 실제로
// 있었다([[ADR-067]] 결정 1 작업 중). 이 가드가 그 자리에서 컴파일 오류를 낸다.
function assertNever(value: never): never {
  throw new Error(`처리하지 않은 ScheduleSyncError 종류: ${JSON.stringify(value)}`)
}

export function formatScheduleSyncError(error: ScheduleSyncError): string {
  switch (error.kind) {
    case 'invalidApiKey':
      return 'API 키가 유효하지 않습니다'
    case 'rateLimited':
      return '잠시 후 다시 시도해주세요'
    // ADR-067 결정 1로 갈라진 세 종류. 문구가 서로 달라야 하는 이유는 처방이 다르기 때문이다 —
    // 아래 둘은 사용자가 지금 할 수 있는 것이 없고, characterUnavailable은 영구다.
    case 'characterUnavailable':
      return '이 캐릭터는 조회할 수 없습니다'
    case 'periodOutOfRange':
      return '이 기간은 조회할 수 없습니다'
    // 시각을 말하지 않는다([[ADR-068]] 결정 1) — 집계가 언제 끝나는지 우리는 모른다.
    case 'notCollected':
      return '아직 집계되지 않았습니다'
    case 'network':
      return '네트워크 오류가 발생했습니다'
    default:
      return assertNever(error)
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
  /**
   * **영구 실패에는 액션을 주지 않는다**([[ADR-062]] 결정 3) — 눌러도 실패하는 버튼을 주지 않기
   * 위해 옵셔널이다. `characterUnavailable`(400 OPENAPI00003)이 그 경우다([[ADR-067]] 결정 1).
   */
  action?: { kind: 'retry' | 'openSettings'; label: string }
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
    // ADR-067 결정 1 + ADR-068 결정 4: 이 계정의 캐릭터를 조회할 수 없다(영구). 재시도 버튼을
    // 주지 않는다 — 눌러도 같은 400이다. 계정을 바꾸는 것이 유일한 탈출구이고 그 경로는 설정
    // (피커)·계정 선택(온보딩)에 이미 있다.
    case 'characterUnavailable':
      return {
        title: '캐릭터를 조회할 수 없습니다',
        description:
          place === 'picker'
            ? '이 계정의 캐릭터를 조회할 수 없습니다 — 설정에서 계정을 변경해주세요'
            : '이 계정의 캐릭터를 조회할 수 없습니다 — 다른 계정을 선택해주세요',
      }
    // 이 둘은 date 파라미터가 있는 보스 수익 백필에서만 나오는 종류다(피커·온보딩은 date를 쓰지
    // 않는다). 도달할 수 없는 조합이지만 종류가 늘 때 조용히 undefined가 되지 않도록 network와
    // 같은 문구로 흡수한다 — "모르는 실패는 재시도 가능"이라는 폴백 원칙과 같다.
    case 'periodOutOfRange':
    case 'notCollected':
    case 'network':
      return {
        title: '캐릭터 목록을 불러오지 못했습니다',
        description: '네트워크 연결을 확인해주세요',
        action: RETRY,
      }
    default:
      return assertNever(error)
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
