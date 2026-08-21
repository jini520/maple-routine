// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { consumePendingNotice, setPendingNotice } from '../pending-notice'

beforeEach(() => {
  sessionStorage.clear()
})

describe('pending-notice', () => {
  it('남긴 알림을 읽어 온다', () => {
    setPendingNotice('cacheClearFailed')

    expect(consumePendingNotice()).toBe('cacheClearFailed')
  })

  it('남긴 게 없으면 null이다', () => {
    expect(consumePendingNotice()).toBeNull()
  })

  // 리로드가 또 일어나도 같은 토스트를 반복하지 않아야 한다.
  it('한 번 읽으면 사라진다', () => {
    setPendingNotice('cacheClearFailed')

    expect(consumePendingNotice()).toBe('cacheClearFailed')
    expect(consumePendingNotice()).toBeNull()
  })

  it('알 수 없는 값이 들어 있으면 무시하고 지운다', () => {
    sessionStorage.setItem('pendingNotice', 'somethingElse')

    expect(consumePendingNotice()).toBeNull()
    expect(sessionStorage.getItem('pendingNotice')).toBeNull()
  })
})
