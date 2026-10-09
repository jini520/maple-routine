/**
 * **서버와 같은 값이 나오는가**를 보는 자리.
 *
 * 틀려도 에러가 안 난다. 서버는 모양(`[0-9a-f]{64}`)만 보고 통과시킨 뒤 그 값으로 사람을 찾으므로,
 * 값이 다르면 거절이 아니라 **매번 새 사람**이 된다. 그래서 표준 테스트 벡터로 못박는다.
 */
import { createHash } from 'node:crypto'

import { apiKeyHashHex } from '../api-key-hash'

describe('API 키 해시', () => {
  it('표준 테스트 벡터와 같다', () => {
    // FIPS 180-4 의 'abc' 와 빈 문자열. 라이브러리를 갈아도 이 둘이 이 값이어야 한다.
    expect(apiKeyHashHex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(apiKeyHashHex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('노드의 sha256 과 같다. **서버가 그것으로 다시 해시한다**', () => {
    // 서버는 `createHash('sha256').update(received, 'utf8')` 로 받은 값을 감싼다. 앱이 그
    // `received` 를 다르게 만들면 두 층이 영원히 어긋난다.
    for (const key of ['test_1a2b3c', '', '한글 키', 'a'.repeat(500), '🍁']) {
      expect(apiKeyHashHex(key)).toBe(createHash('sha256').update(key, 'utf8').digest('hex'))
    }
  })

  it('소문자 16진 64자다', () => {
    // 서버의 `API_KEY_HASH` 정규식이 대문자를 거절한다.
    expect(apiKeyHashHex('어떤 키')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('같은 키는 같게, 다른 키는 다르게 나온다', () => {
    expect(apiKeyHashHex('키')).toBe(apiKeyHashHex('키'))
    expect(apiKeyHashHex('키')).not.toBe(apiKeyHashHex('키 '))
  })
})
