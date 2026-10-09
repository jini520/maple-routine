/**
 * API 키를 우리 서버에 보여 줄 값으로 바꾼다. **키 원문은 안 나간다.**
 *
 * 서버는 이 값으로 사람을 가르고, 받은 값을 한 번 더 해시해 칸에 넣는다. 그래서 DB 가 새어
 * 나가도 그 값으로 남의 기록을 열 수 없다.
 *
 * **앱과 서버가 같은 알고리즘과 같은 표기를 써야 한다.** 서버가 `/^[0-9a-f]{64}$/` 를 보고
 * 안 맞으면 거절하는데, 맞는데 값이 다르면 거절이 아니라 **매번 새 사람**이 된다. 그래서 틀려도
 * 에러가 안 나고 표에 열쇠 없는 행만 쌓인다 - 아래 테스트가 그 자리를 지킨다.
 *
 * 경로에 `.js` 가 붙는 것은 이 패키지의 `exports` 지도 열쇠가 `./sha2.js` 라서다. 빼면
 * 해석이 안 된다(노드도 jest 도).
 *
 * Hermes 전역에 `crypto` 가 없어 순수 JS 라이브러리를 쓴다. 네이티브 모듈이면 지문이 바뀌어
 * 스토어 빌드를 기다려야 하는데, 이 길은 OTA 로 나간다.
 */
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

/** 키 하나의 SHA-256. 소문자 16진 64자. */
export function apiKeyHashHex(key: string): string {
  return bytesToHex(sha256(utf8ToBytes(key)))
}
