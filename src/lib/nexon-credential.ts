/**
 * 저장된 설정을 넥슨에 넘길 자격으로 바꾼다.
 *
 * `storage/` 가 아니라 여기 있는 것은 **순수 함수라서**다. 저장소 모듈은 테스트가 통째로
 * 갈아끼우는 I/O 경계라, 거기 두면 mock 마다 이 함수를 따로 알려 줘야 한다.
 *
 * 인증 수단이 목록이 되면(#536) 어느 수단을 고를지가 여기로 들어온다.
 */
import type { NexonAuthConfig, NexonCredential } from '../types/auth'

export function credentialOf(config: NexonAuthConfig): NexonCredential {
  return { kind: 'apiKey', value: config.apiKey }
}
