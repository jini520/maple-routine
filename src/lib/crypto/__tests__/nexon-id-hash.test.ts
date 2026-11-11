/**
 * 서버가 운영의 원문을 바꾼 해시와 같은 값이 나오는가를 보는 자리.
 *
 * 서버 이관은 노드의 sha256 으로 원문을 해시했다. 앱이 다른 값을 만들면 서버가 모양만 보고 받아, 이미 있는 메이플 ID 와
 * 이어지지 않는 새 줄이 생긴다.
 */
import { createHash } from 'node:crypto'

import { nexonIdHashHex } from '../nexon-id-hash'

it('노드의 sha256(UTF-8) 소문자 16진과 같다', () => {
  for (const id of ['da9b2f21c4e8', 'e0a4f439e53c369866b55297d2f5f4eb', '', '한글']) {
    expect(nexonIdHashHex(id)).toBe(createHash('sha256').update(id, 'utf8').digest('hex'))
  }
})
