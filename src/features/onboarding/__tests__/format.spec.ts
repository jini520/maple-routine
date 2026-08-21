import { formatOnboardingError } from '../format'

describe('formatOnboardingError', () => {
  it('invalidApiKey를 사람이 읽을 문구로 바꾼다', () => {
    expect(formatOnboardingError({ kind: 'invalidApiKey' })).toBe('API 키가 유효하지 않습니다')
  })

  // ADR-114 결정 1·4: 429는 원인만 말한다. 이 함수의 반환값은 전부 토스트 본문이라
  // 처방("서비스 단계 키인지 확인해주세요")을 붙이면 Toast의 truncate에 잘린다 —
  // 처방은 인라인 자리(app/settings/error-message.ts·배너·ErrorState)가 준다.
  it('rateLimited를 사람이 읽을 문구로 바꾼다 (처방 없이 원인만)', () => {
    expect(formatOnboardingError({ kind: 'rateLimited' })).toBe('호출 한도를 초과했습니다')
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
