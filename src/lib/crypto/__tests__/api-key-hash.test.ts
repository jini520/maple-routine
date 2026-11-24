/**
 * 부계정 등록 표시(`로그인 계정 id:키 해시`)에 쓰는 키 해시가 표준 SHA-256 이고 같은 키에 늘 같은 값인지 보는 자리.
 *
 * 틀려도 에러가 안 난다. 표시는 기기에 남아 다음 회차와 키 삭제가 다시 만든 값과 견주므로, 값이 흔들리면 등록한 키를
 * 못 알아보고 회차마다 다시 등록한다. 그래서 표준 테스트 벡터로 못박는다.
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

  it('한글 · 이모지 · 긴 키도 노드의 sha256(UTF-8) 과 같다', () => {
    for (const key of ['test_1a2b3c', '', '한글 키', 'a'.repeat(500), '🍁']) {
      expect(apiKeyHashHex(key)).toBe(createHash('sha256').update(key, 'utf8').digest('hex'))
    }
  })

  it('소문자 16진 64자다', () => {
    expect(apiKeyHashHex('어떤 키')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('같은 키는 같게, 다른 키는 다르게 나온다', () => {
    expect(apiKeyHashHex('키')).toBe(apiKeyHashHex('키'))
    expect(apiKeyHashHex('키')).not.toBe(apiKeyHashHex('키 '))
  })
})
