import { describe, expect, it } from 'vitest'
import { formatOnboardingError } from '../error-message'

describe('formatOnboardingError', () => {
  it('invalidApiKey를 사람이 읽을 문구로 바꾼다', () => {
    expect(formatOnboardingError({ kind: 'invalidApiKey' })).toBe('API 키가 유효하지 않습니다')
  })

  it('rateLimited를 사람이 읽을 문구로 바꾼다', () => {
    expect(formatOnboardingError({ kind: 'rateLimited' })).toBe('잠시 후 다시 시도해주세요')
  })

  it('network를 사람이 읽을 문구로 바꾼다', () => {
    expect(formatOnboardingError({ kind: 'network' })).toBe('네트워크 오류가 발생했습니다')
  })

  it('storageWriteFailed를 사람이 읽을 문구로 바꾼다', () => {
    expect(formatOnboardingError({ kind: 'storageWriteFailed' })).toBe(
      '기기에 저장하지 못했습니다. 다시 시도해주세요',
    )
  })
})
