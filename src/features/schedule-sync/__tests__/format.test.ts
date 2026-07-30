import { describe, expect, it } from 'vitest'
import { formatRosterError, formatScheduleSyncError, formatSyncedAt } from '../format'
import type { ScheduleSyncError } from '../schedule-sync'

describe('formatScheduleSyncError', () => {
  it.each<[ScheduleSyncError, string]>([
    [{ kind: 'invalidApiKey' }, 'API 키가 유효하지 않습니다'],
    [{ kind: 'rateLimited' }, '잠시 후 다시 시도해주세요'],
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

  it.each(['picker', 'onboarding'] as const)('%s의 나머지 원인은 액션이 있다', (place) => {
    for (const kind of ['invalidApiKey', 'rateLimited', 'network', 'periodOutOfRange', 'notCollected'] as const) {
      expect(formatRosterError({ kind }, place).action).toBeDefined()
    }
  })

  it('모든 문구가 에러 어미 규칙(~습니다 / ~주세요)을 따른다', () => {
    const kinds: ScheduleSyncError[] = [{ kind: 'invalidApiKey' }, { kind: 'rateLimited' }, { kind: 'network' }]

    for (const error of kinds) {
      for (const place of ['picker', 'onboarding'] as const) {
        const copy = formatRosterError(error, place)
        expect(copy.title).toMatch(/(습니다|주세요)$/)
        expect(copy.description).toMatch(/(습니다|주세요)$/)
      }
    }
  })

  it('피커의 invalidApiKey는 설정으로 보낸다 — 재시도로는 풀리지 않기 때문', () => {
    const copy = formatRosterError({ kind: 'invalidApiKey' }, 'picker')

    expect(copy.title).toBe('API 키가 유효하지 않습니다')
    expect(copy.action).toEqual({ kind: 'openSettings', label: '설정 열기' })
  })

  it('온보딩의 invalidApiKey는 설정 화면이 없어 재시도만 준다', () => {
    const copy = formatRosterError({ kind: 'invalidApiKey' }, 'onboarding')

    expect(copy.title).toBe('API 키가 유효하지 않습니다')
    expect(copy.action).toEqual({ kind: 'retry', label: '다시 시도' })
  })

  it.each(['picker', 'onboarding'] as const)('%s의 rateLimited·network는 재시도를 준다', (place) => {
    expect(formatRosterError({ kind: 'rateLimited' }, place).action?.kind).toBe('retry')
    expect(formatRosterError({ kind: 'network' }, place).action?.kind).toBe('retry')
  })

  it('rateLimited와 network는 제목이 다르다 — 원인을 구분해 말해야 한다', () => {
    expect(formatRosterError({ kind: 'rateLimited' }, 'picker').title).not.toBe(
      formatRosterError({ kind: 'network' }, 'picker').title,
    )
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
