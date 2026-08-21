import { formatRosterError, formatScheduleSyncError, formatStaleRosterError, formatSyncedAt } from '../format'
import type { ScheduleSyncError } from '../schedule-sync'

describe('formatScheduleSyncError', () => {
  it.each<[ScheduleSyncError, string]>([
    [{ kind: 'invalidApiKey' }, 'API 키가 유효하지 않습니다'],
    // ADR-114 결정 1·4: 토스트는 한 줄이 상한이라 원인만 말하고 처방은 인라인 자리가 준다.
    [{ kind: 'rateLimited' }, '호출 한도를 초과했습니다'],
    [{ kind: 'network' }, '네트워크 오류가 발생했습니다'],
    // ADR-067 결정 1로 갈라진 세 종류
    [{ kind: 'characterUnavailable' }, '이 캐릭터는 조회할 수 없습니다'],
    [{ kind: 'periodOutOfRange' }, '이 기간은 조회할 수 없습니다'],
    [{ kind: 'notCollected' }, '아직 집계되지 않았습니다'],
  ])('%o -> %s', (error, expected) => {
    expect(formatScheduleSyncError(error)).toBe(expected)
  })
})

// ADR-062 결정 3: 같은 원인이라도 자리에 따라 줄 수 있는 행동이 다르다 —
// 피커는 설정으로 보낼 수 있지만 온보딩 중에는 설정 화면 자체가 없다.
describe('formatRosterError', () => {
  it('모든 원인이 제목과 설명을 가진다', () => {
    const kinds: ScheduleSyncError[] = [
      { kind: 'invalidApiKey' },
      { kind: 'rateLimited' },
      { kind: 'network' },
      { kind: 'characterUnavailable' },
      { kind: 'periodOutOfRange' },
      { kind: 'notCollected' },
    ]

    for (const error of kinds) {
      for (const place of ['picker', 'onboarding'] as const) {
        const copy = formatRosterError(error, place)
        expect(copy.title.length).toBeGreaterThan(0)
        expect(copy.description.length).toBeGreaterThan(0)
      }
    }
  })

  // ADR-062 결정 3 + ADR-067 결정 1: 영구 실패에는 버튼을 주지 않는다.
  it.each(['picker', 'onboarding'] as const)('%s의 characterUnavailable은 액션이 없다(영구 실패)', (place) => {
    const copy = formatRosterError({ kind: 'characterUnavailable' }, place)
    expect(copy.action).toBeUndefined()
    expect(copy.description).toContain('계정')
  })

  it.each(['picker', 'onboarding'] as const)('%s의 network 계열은 액션이 있다', (place) => {
    for (const kind of ['network', 'periodOutOfRange', 'notCollected'] as const) {
      expect(formatRosterError({ kind }, place).action).toBeDefined()
    }
  })

  // '합니다'를 함께 허용하는 것은 규칙(ADR-062 결정 5)을 푸는 게 아니라 같은 하십시오체(~ㅂ니다)의
  // 다른 활용이기 때문이다 — 아래 formatStaleRosterError가 '아닙니다'를 허용하는 것과 같은 이유고,
  // 피커 401의 '키 입력 화면으로 이동합니다'(ADR-115 결정 1·7)가 그 경우다.
  it('모든 문구가 에러 어미 규칙(~습니다 / ~주세요)을 따른다', () => {
    const kinds: ScheduleSyncError[] = [{ kind: 'invalidApiKey' }, { kind: 'rateLimited' }, { kind: 'network' }]

    for (const error of kinds) {
      for (const place of ['picker', 'onboarding'] as const) {
        const copy = formatRosterError(error, place)
        expect(copy.title).toMatch(/(습니다|주세요)$/)
        expect(copy.description).toMatch(/(습니다|합니다|주세요)$/)
      }
    }
  })

  // ADR-115 결정 1·7: 목적지가 설정에서 키 입력 화면으로 바뀌었고, 이동이 자동으로 이미
  // 일어나므로 누를 것이 없다. 옛 문구("설정에서 키를 다시 등록해주세요")는 거짓이었다 —
  // 설정에는 키를 바꿀 자리가 없다(ApiKeyModal 2026-07-25 제거).
  it('피커의 invalidApiKey는 액션 없이 이동을 알린다 — 설정으로 보내지 않는다', () => {
    const copy = formatRosterError({ kind: 'invalidApiKey' }, 'picker')

    expect(copy.title).toBe('API 키가 유효하지 않습니다')
    expect(copy.description).toBe('키 입력 화면으로 이동합니다')
    expect(copy.action).toBeUndefined()
  })

  // 회귀 가드: 온보딩 중에는 무효화 경로가 성립하지 않으므로(status가 completed가 아니다,
  // ADR-115 결정 6) 그 실패는 폼 자체의 에러이고 재시도가 실제 처방이다 — 이 phase가 이 자리를
  // 건드리지 않았음이 이 단언으로 증명된다.
  it('온보딩의 invalidApiKey는 문구·액션이 그대로다 — 재시도가 실제 처방인 자리', () => {
    const copy = formatRosterError({ kind: 'invalidApiKey' }, 'onboarding')

    expect(copy.title).toBe('API 키가 유효하지 않습니다')
    expect(copy.description).toBe('API 키를 다시 확인해주세요')
    expect(copy.action).toEqual({ kind: 'retry', label: '다시 시도' })
  })

  // ADR-114 결정 2([[ADR-062]] 결정 3 일부 폐기): 429의 처방은 재시도가 아니라 키 단계 확인이다.
  // 처방이 "키를 확인하라"인데 버튼이 "다시 시도"면 화면이 두 말을 한다.
  it.each(['picker', 'onboarding'] as const)('%s의 network는 재시도를 주지만 rateLimited는 액션이 없다', (place) => {
    expect(formatRosterError({ kind: 'network' }, place).action?.kind).toBe('retry')
    expect(formatRosterError({ kind: 'rateLimited' }, place).action).toBeUndefined()
  })

  // ADR-114 결정 1: 문구는 확정값이다(사용자 확정 2026-08-08). 단계를 판정하지 않고 안내만 한다.
  it.each(['picker', 'onboarding'] as const)('%s의 rateLimited는 키 단계 확인을 처방한다', (place) => {
    const copy = formatRosterError({ kind: 'rateLimited' }, place)

    expect(copy.title).toBe('호출 한도를 초과했습니다')
    expect(copy.description).toBe('입력하신 API 키가 서비스 단계 키인지 확인해주세요')
  })

  it('rateLimited와 network는 제목이 다르다 — 원인을 구분해 말해야 한다', () => {
    expect(formatRosterError({ kind: 'rateLimited' }, 'picker').title).not.toBe(
      formatRosterError({ kind: 'network' }, 'picker').title,
    )
  })
})

// ADR-114 결정 3: 스탈 배너가 원인을 무시하던 것(호출부 2곳이 "목록이 최신이 아닙니다"를
// 하드코딩)을 원인별로 가른다. ErrorState와 갈리는 근거는 자리다 — 배너는 목록이 남아 있어
// 액션이 없어도 막다른 길이 아니다.
//
// ADR-115 결정 7: 401의 `설정 열기`가 사라지면서 6종이 두 자리에서 전부 같아졌다 — place를
// 아무 데서도 쓰지 않게 돼 파라미터 자체가 없어졌다(시그니처가 인자 1개다).
describe('formatStaleRosterError', () => {
  const KINDS: ScheduleSyncError['kind'][] = [
    'invalidApiKey',
    'rateLimited',
    'characterUnavailable',
    'periodOutOfRange',
    'notCollected',
    'network',
  ]

  // 어미 규칙은 ADR-062 결정 5. '아닙니다'를 함께 허용하는 것은 규칙을 푸는 게 아니라 같은
  // 하십시오체(~ㅂ니다)의 다른 활용이기 때문이다 — network 계열 문구 '목록이 최신이 아닙니다'는
  // 화면 하드코딩과 같아야 해서 바꿀 수 없다(아래 회귀 가드).
  it('6종 전부 문구가 있고 에러 어미 규칙(~습니다 / ~주세요)을 따른다', () => {
    for (const kind of KINDS) {
      const copy = formatStaleRosterError({ kind })
      expect(copy.message.length).toBeGreaterThan(0)
      expect(copy.message).toMatch(/(습니다|아닙니다|주세요)$/)
    }
  })

  it('network 계열 3종은 현행 문구 + 다시 시도를 유지한다', () => {
    for (const kind of ['network', 'periodOutOfRange', 'notCollected'] as const) {
      const copy = formatStaleRosterError({ kind })
      expect(copy.message).toBe('목록이 최신이 아닙니다')
      expect(copy.action).toEqual({ kind: 'retry', label: '다시 시도' })
    }
  })

  // 회귀 가드: 이 문자열은 화면(CharacterTrackingPicker·ContentCharacterStep)에 하드코딩된 값과
  // 정확히 같아야 한다. 이 phase가 바꾸는 것은 401뿐임이 이 단언으로 증명된다.
  it('network의 문구는 화면 하드코딩과 한 글자도 다르지 않다', () => {
    expect(formatStaleRosterError({ kind: 'network' }).message).toBe('목록이 최신이 아닙니다')
  })

  it('rateLimited는 액션 없이 키 단계 확인만 말한다', () => {
    const copy = formatStaleRosterError({ kind: 'rateLimited' })

    expect(copy.message).toContain('서비스 단계')
    expect(copy.action).toBeUndefined()
  })

  // ADR-115 결정 7: 배너가 뜨는 순간 키 무효화가 화면을 키 입력으로 보내므로 누를 것이 없다.
  // 문구는 그대로다 — 바뀐 것은 액션뿐이다.
  it('invalidApiKey는 문구를 유지하고 액션만 잃는다 — 어디서도 설정으로 보내지 않는다', () => {
    const copy = formatStaleRosterError({ kind: 'invalidApiKey' })

    expect(copy.message).toBe('API 키가 유효하지 않아 목록을 갱신하지 못했습니다')
    expect(copy.action).toBeUndefined()
  })

  it('characterUnavailable은 영구 실패라 액션이 없다', () => {
    expect(formatStaleRosterError({ kind: 'characterUnavailable' }).action).toBeUndefined()
  })

  it('원인마다 문구가 갈린다 — 401·429·characterUnavailable·network가 서로 다르다', () => {
    const messages = ['invalidApiKey', 'rateLimited', 'characterUnavailable', 'network'].map(
      (kind) => formatStaleRosterError({ kind } as ScheduleSyncError).message,
    )

    expect(new Set(messages).size).toBe(4)
  })
})

describe('formatSyncedAt', () => {
  it('null이면 "동기화 기록 없음"을 반환한다', () => {
    expect(formatSyncedAt(null)).toBe('동기화 기록 없음')
  })

  it('1분 미만이면 "방금 전"을 반환한다', () => {
    const syncedAt = new Date(Date.now() - 30 * 1000).toISOString()
    expect(formatSyncedAt(syncedAt)).toBe('방금 전')
  })

  it('n분 전을 반환한다', () => {
    const syncedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatSyncedAt(syncedAt)).toBe('5분 전')
  })

  it('60분을 넘으면 n시간 전을 반환한다', () => {
    const syncedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatSyncedAt(syncedAt)).toBe('3시간 전')
  })
})
