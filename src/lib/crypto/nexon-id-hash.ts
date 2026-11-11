/**
 * 넥슨 식별자(메이플 ID · ocid)를 우리 서버에 보여 줄 값으로 바꾼다. 서버에는 원문을 두지 않는다.
 *
 * 소금 없는 SHA-256 소문자 16진 64자다. 같은 식별자는 어느 기기에서 해시해도 같아야 서버가 원문 없이 같은 캐릭터를 잇는다.
 * 키 해시와 달리 서버가 한 번 더 해시하지 않는다.
 */
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

export function nexonIdHashHex(id: string): string {
  return bytesToHex(sha256(utf8ToBytes(id)))
}
