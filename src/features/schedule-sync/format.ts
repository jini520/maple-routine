import type { ScheduleSyncError } from './schedule-sync'

// tsconfig에 noImplicitReturns가 없어 switch가 소진되지 않아도 타입 오류가 나지 않는다.
// ScheduleSyncError에 종류를 더했을 때 이 함수가 조용히 undefined를 반환하던 사고가 실제로
// 있었다(작업 중). 이 가드가 그 자리에서 컴파일 오류를 낸다.
function assertNever(value: never): never {
  throw new Error(`처리하지 않은 ScheduleSyncError 종류: ${JSON.stringify(value)}`)
}

export function formatScheduleSyncError(error: ScheduleSyncError): string {
  switch (error.kind) {
    case 'invalidApiKey':
      return 'API 키가 유효하지 않습니다'
    // 처방("서비스 단계 키인지 확인해주세요")을 붙이지 않는다. Toast 본문이 truncate라 한 줄이
    // 상한이고, 처방은 인라인 자리(배너·ErrorState·설정 계정 카드)가 준다.
    case 'rateLimited':
      return '호출 한도를 초과했습니다'
    // 세 종류의 문구가 서로 달라야 하는 것은 처방이 다르기 때문이다. 아래 둘은 사용자가 지금 할
    // 수 있는 것이 없고, characterUnavailable 은 영구다.
    case 'characterUnavailable':
      return '이 캐릭터는 조회할 수 없습니다'
    case 'periodOutOfRange':
      return '이 기간은 조회할 수 없습니다'
    // 시각을 말하지 않는다. 집계가 언제 끝나는지 우리는 모른다.
    case 'notCollected':
      return '아직 집계되지 않았습니다'
    case 'network':
      return '네트워크 오류가 발생했습니다'
    default:
      return assertNever(error)
  }
}

// 후보 목록(`getCharacterPickerRoster`) 조회 실패의 문구·액션.
//
// 같은 원인이라도 자리에 따라 줄 수 있는 행동이 다르다. 401 이 그렇다. 피커에서는 액션이 없다.
// 그 401 은 곧 키 무효화라 화면이 스스로 키 입력으로 이동하므로 누를 것이 없고, 이 문구는 이동
// 직전 한 프레임이자 안전망이다. 캐릭터 설정 화면에서는 재시도다. 그때는 무효화 경로가 아예 성립하지
// 않고, 그 실패는 방금 넣은 키에 대한 폼 자체의 에러라 재시도가 실제 처방이다. 그래서 place 를
// 받는다.
//
// 401 에 다시 시도를 주지 않는 것(피커)이 핵심이다. 눌러도 실패하는 버튼이기 때문이다.
//
// 문구 어미는 에러 규칙에 따라 ~습니다 · ~주세요 다.
export type RosterErrorPlace = 'picker' | 'characterSetup'

export interface RosterErrorCopy {
  title: string
  description: string
  /**
   * 눌러도 실패하거나 누를 것이 없는 자리에는 액션을 주지 않는다. 그래서 옵셔널이다.
   * `characterUnavailable`(400 OPENAPI00003)과 `rateLimited` 가 전자, 피커의 401 이 후자다.
   */
  action?: { kind: 'retry'; label: string }
}

const RETRY = { kind: 'retry', label: '다시 시도' } as const

export function formatRosterError(error: ScheduleSyncError, place: RosterErrorPlace): RosterErrorCopy {
  switch (error.kind) {
    case 'invalidApiKey':
      return place === 'picker'
        ? {
            title: 'API 키가 유효하지 않습니다',
            description: '키 입력 화면으로 이동합니다',
          }
        : {
            title: 'API 키가 유효하지 않습니다',
            description: 'API 키를 다시 확인해주세요',
            action: RETRY,
          }
    // 액션을 주지 않는다. 사용자는 개발 단계 키를 쓰므로 일 1,000건을 소진했으면 다음 날까지 안
    // 풀린다. 게다가 이 문구의 처방이 재시도가 아니라 키 단계 확인이라, 버튼이 있으면 화면이
    // 두 말을 한다.
    case 'rateLimited':
      return {
        title: '호출 한도를 초과했습니다',
        description: '입력하신 API 키가 서비스 단계 키인지 확인해주세요',
      }
    // 이 계정의 캐릭터를 조회할 수 없다(영구). 재시도 버튼을 주지 않는다. 눌러도 같은 400 이다.
    // 빠져나가려면 계정을 바꾸는 수밖에 없고 그 경로는 설정(피커)·계정 선택(온보딩)에 이미 있다.
    case 'characterUnavailable':
      return {
        title: '캐릭터를 조회할 수 없습니다',
        description:
          place === 'picker'
            ? '이 계정의 캐릭터를 조회할 수 없습니다. 설정에서 계정을 변경해주세요'
            : '이 계정의 캐릭터를 조회할 수 없습니다. 다른 계정을 선택해주세요',
      }
    // 이 둘은 date 파라미터가 있는 보스 수익 백필에서만 나오는 종류다. 도달할 수 없는 조합이지만
    // 종류가 늘 때 조용히 undefined 가 되지 않도록 network 와 같은 문구로 흡수한다.
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

// 스탈 배너(항목이 남아 있는 채로 실패했을 때 목록 위에 얹는 한 줄)의 문구·액션.
//
// `formatRosterError` 를 재사용하지 않는 것은 두 가지가 다르기 때문이다.
//
// 1. 담을 수 있는 양. 배너는 한 줄이고 ErrorState 는 제목 + 설명 두 줄이다.
// 2. 액션 규칙. 배너는 목록이 남아 있어 액션이 없어도 막다른 길이 아니라 401·429·
//    characterUnavailable 전부 액션이 없다. ErrorState 는 자리 전체가 실패라 온보딩 401 에서
//    액션을 빼면 화면에 아무 길도 남지 않으므로, 같은 401 이 `formatRosterError` 에서는
//    온보딩에만 재시도를 남긴다.
export interface StaleRosterErrorCopy {
  /** 배너 한 줄에 들어가는 문구. 제목·설명으로 쪼개지 않는다. 배너는 한 줄이다. */
  message: string
  /** 재시도가 실제로 통하는 실패에만 주는 액션. */
  action?: { kind: 'retry'; label: string }
}

// place 를 받지 않는다. 401 의 설정 이동 액션이 사라지면서 6종이 두 자리에서 전부 같아졌다.
// 자리별로 갈릴 것이 생기면 그때 `formatRosterError` 처럼 다시 받는다.
export function formatStaleRosterError(error: ScheduleSyncError): StaleRosterErrorCopy {
  switch (error.kind) {
    // 재시도로는 절대 풀리지 않고 누를 것도 없다. 피커에서는 이 배너가 뜨는 순간 키 무효화가
    // 화면을 키 입력으로 보내고, 온보딩은 설정 화면 자체가 없어 원래 액션이 없었다.
    case 'invalidApiKey':
      return {
        message: 'API 키가 유효하지 않아 목록을 갱신하지 못했습니다',
      }
    // 단계를 판정하지 않고 문구로만 안내한다. 429(OPENAPI00007)는 개발·서비스 두 단계에서 같은
    // 코드로 오고 본문에도 구분이 없다. 수치는 넣지 않는다. 배너 한 줄에 들어가야 한다.
    case 'rateLimited':
      return { message: '호출 한도를 초과했습니다. 서비스 단계 키인지 확인해주세요' }
    // 400 OPENAPI00003은 영구다. 언제 눌러도 같은 400이라 액션을 주지 않는다.
    case 'characterUnavailable':
      return { message: '이 계정의 캐릭터를 조회할 수 없습니다' }
    // 뒤 둘은 date 를 쓰는 보스 수익 백필에서만 나오는 종류라 여기 도달할 수 없지만,
    // `formatRosterError` 와 같은 이유로 network 에 흡수해 조용히 undefined 가 되지 않게 한다.
    case 'periodOutOfRange':
    case 'notCollected':
    case 'network':
      return { message: '목록이 최신이 아닙니다', action: RETRY }
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
