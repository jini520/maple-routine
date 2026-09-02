import {
  isInvalidApiKeyError,
  NexonApiError,
  NexonAuthError,
  NexonBadRequestError,
  NexonNetworkError,
  NexonRateLimitError,
} from '../errors'

// "무엇이 무효 키인가"는 넥슨이 정하는 사실 하나이므로 판정도 하나다.
// 실측(2026-08-08). 넥슨은 무효한 키에 401/403 이 아니라 400 OPENAPI00005 를 준다.
// 애초에 존재한 적 없는 키와, 한때 유효했다가 삭제된 키가 **같은 응답**이다.

describe('isInvalidApiKeyError', () => {
  it('401/403(NexonAuthError)은 무효 키다', () => {
    expect(isInvalidApiKeyError(new NexonAuthError('x'))).toBe(true)
  })

  it('400 OPENAPI00005 는 무효 키다. 이 코드가 실제 응답이다', () => {
    expect(isInvalidApiKeyError(new NexonBadRequestError('x', 'OPENAPI00005'))).toBe(true)
  })

  // 다른 400 코드까지 무효 키로 삼으면 캐릭터·날짜 문제가 키 문제로 둔갑해
  // 사용자를 엉뚱하게 키 입력 화면으로 보낸다(이 가른 세 종류).
  it.each(['OPENAPI00003', 'OPENAPI00004', 'OPENAPI00009', null])(
    '다른 400(%s)은 무효 키가 아니다',
    (code) => {
      expect(isInvalidApiKeyError(new NexonBadRequestError('x', code))).toBe(false)
    },
  )

  it('429·네트워크·일반 에러는 무효 키가 아니다', () => {
    expect(isInvalidApiKeyError(new NexonRateLimitError('x'))).toBe(false)
    expect(isInvalidApiKeyError(new NexonNetworkError('x'))).toBe(false)
    expect(isInvalidApiKeyError(new NexonApiError('x'))).toBe(false)
    expect(isInvalidApiKeyError(new Error('x'))).toBe(false)
    expect(isInvalidApiKeyError(null)).toBe(false)
    expect(isInvalidApiKeyError(undefined)).toBe(false)
  })
})
