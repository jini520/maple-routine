import { beforeEach, describe, expect, it } from 'vitest'
import {
  hasSyncAttemptedThisRun,
  markSyncAttemptedThisRun,
  resetSyncRunStateForTests,
} from '../sync-run-state'

beforeEach(() => {
  resetSyncRunStateForTests()
})

describe('sync-run-state', () => {
  it('앱을 갓 켠 상태에서는 아직 시도하지 않은 것이다', () => {
    expect(hasSyncAttemptedThisRun()).toBe(false)
  })

  it('표시하면 이번 실행에서 시도한 것이 된다', () => {
    markSyncAttemptedThisRun()

    expect(hasSyncAttemptedThisRun()).toBe(true)
  })

  it('여러 번 표시해도 상태는 같다', () => {
    markSyncAttemptedThisRun()
    markSyncAttemptedThisRun()

    expect(hasSyncAttemptedThisRun()).toBe(true)
  })

  it('초기화하면 앱 재시작과 같은 상태로 돌아간다', () => {
    markSyncAttemptedThisRun()
    resetSyncRunStateForTests()

    expect(hasSyncAttemptedThisRun()).toBe(false)
  })
})
