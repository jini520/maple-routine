import { describe, expect, it } from 'vitest'
import {
  NexonAuthError,
  NexonBadRequestError,
  NexonNetworkError,
  NexonRateLimitError,
} from '../../../nexon/errors'
import { formatScheduleSyncError } from '../format'
import { toScheduleSyncError } from '../schedule-sync'

// ADR-067 결정 1: 넥슨 에러 코드를 실패 종류로 옮긴다. 세 코드는 처방이 전부 다르다 —
// 00003은 영구(재시도 무의미), 00009는 시간이 지나면 풀리고, 00004는 호출 측이 날짜로 원인을
// 판정해야 한다. 전에는 셋 다 '네트워크 오류가 발생했습니다'로 나갔다.

describe('toScheduleSyncError', () => {
  it('401/403 → invalidApiKey (기존)', () => {
    expect(toScheduleSyncError(new NexonAuthError('x'))).toEqual({ kind: 'invalidApiKey' })
  })

  it('429 → rateLimited (기존)', () => {
    expect(toScheduleSyncError(new NexonRateLimitError('x'))).toEqual({ kind: 'rateLimited' })
  })

  it('OPENAPI00003 → characterUnavailable', () => {
    expect(toScheduleSyncError(new NexonBadRequestError('x', 'OPENAPI00003'))).toEqual({
      kind: 'characterUnavailable',
    })
  })

  it('OPENAPI00004 → periodOutOfRange', () => {
    expect(toScheduleSyncError(new NexonBadRequestError('x', 'OPENAPI00004'))).toEqual({
      kind: 'periodOutOfRange',
    })
  })

  it('OPENAPI00009 → notCollected', () => {
    expect(toScheduleSyncError(new NexonBadRequestError('x', 'OPENAPI00009'))).toEqual({
      kind: 'notCollected',
    })
  })

  // ADR-115 결정 9: 무효 키의 실제 응답이 이것이다(401/403 이 아니다, 실측 2026-08-08).
  // 이 케이스가 없으면 키가 폐기된 사용자에게 앱이 "네트워크 오류"만 반복해 말한다.
  it('OPENAPI00005 → invalidApiKey — 무효 키는 400으로 온다', () => {
    expect(toScheduleSyncError(new NexonBadRequestError('x', 'OPENAPI00005'))).toEqual({
      kind: 'invalidApiKey',
    })
  })

  it('코드를 모르는 400은 network로 degrade한다 — 최악의 경우 지금 동작(재시도 유도)으로 떨어진다', () => {
    expect(toScheduleSyncError(new NexonBadRequestError('x', null))).toEqual({ kind: 'network' })
    expect(toScheduleSyncError(new NexonBadRequestError('x', 'OPENAPI99999'))).toEqual({
      kind: 'network',
    })
  })

  it('그 외는 network (기존)', () => {
    expect(toScheduleSyncError(new NexonNetworkError('x'))).toEqual({ kind: 'network' })
    expect(toScheduleSyncError(new Error('x'))).toEqual({ kind: 'network' })
  })
})

describe('formatScheduleSyncError — 새 종류의 문구', () => {
  it('종류마다 서로 다른 문구를 준다 (뭉개지지 않는다)', () => {
    const messages = (
      [
        'invalidApiKey',
        'rateLimited',
        'network',
        'characterUnavailable',
        'periodOutOfRange',
        'notCollected',
      ] as const
    ).map((kind) => formatScheduleSyncError({ kind }))

    expect(new Set(messages).size).toBe(messages.length)
  })

  it('문구 어미는 ~습니다/~주세요다 (ADR-062 결정 5)', () => {
    for (const kind of ['characterUnavailable', 'periodOutOfRange', 'notCollected'] as const) {
      expect(formatScheduleSyncError({ kind })).toMatch(/(습니다|주세요)$/)
    }
  })

  it('notCollected 문구는 시각을 말하지 않는다 (집계 시각 미확정, ADR-068 결정 1)', () => {
    expect(formatScheduleSyncError({ kind: 'notCollected' })).not.toMatch(/오전|오후|\d시/)
  })
})
