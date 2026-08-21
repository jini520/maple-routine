import { describe, expect, it } from 'vitest'
import { shouldDismissFromSwipe } from '../swipe-dismiss'

describe('shouldDismissFromSwipe', () => {
  it('임계값(70px)을 넘으면 true를 반환한다', () => {
    expect(shouldDismissFromSwipe(71)).toBe(true)
    expect(shouldDismissFromSwipe(-71)).toBe(true)
  })

  it('임계값 이하면 false를 반환한다', () => {
    expect(shouldDismissFromSwipe(70)).toBe(false)
    expect(shouldDismissFromSwipe(-70)).toBe(false)
    expect(shouldDismissFromSwipe(0)).toBe(false)
  })
})
