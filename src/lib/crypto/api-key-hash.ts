/**
 * 기기에 적는 부계정 등록 표시(Preferences `serverAccounts` 의 `로그인 계정 id:키 해시`)의 키 부분. 서버로는 보내지 않는 값.
 *
 * **같은 키는 늘 같은 값이어야 한다.** 다음 회차와 키 삭제가 다시 만든 값을 적힌 표시와 견주므로, 값이 흔들리면 등록한 키를
 * 못 알아보고 회차마다 다시 등록한다.
 *
 * 경로에 `.js` 가 붙는 것은 이 패키지 `exports` 의 키가 `./sha2.js` 라서다. 빼면 해석이 안 된다(노드도 jest 도).
 *
 * Hermes 전역에 `crypto` 가 없어 순수 JS 라이브러리를 쓴다. 네이티브 모듈이면 지문이 바뀌어 스토어 빌드를 기다려야 하고,
 * 순수 JS 는 OTA 로 나간다.
 */
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

/** 키 하나의 SHA-256. 소문자 16진 64자. */
export function apiKeyHashHex(key: string): string {
  return bytesToHex(sha256(utf8ToBytes(key)))
}
