import { describe, expect, it } from 'vitest'
import { formatScheduleSyncError, formatSyncedAt } from '../format'
import type { ScheduleSyncError } from '../schedule-sync'

describe('formatScheduleSyncError', () => {
  it.each<[ScheduleSyncError, string]>([
    [{ kind: 'invalidApiKey' }, 'API 키가 유효하지 않습니다'],
    [{ kind: 'rateLimited' }, '잠시 후 다시 시도해주세요'],
    [{ kind: 'network' }, '네트워크 오류가 발생했습니다'],
  ])('%o -> %s', (error, expected) => {
    expect(formatScheduleSyncError(error)).toBe(expected)
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
