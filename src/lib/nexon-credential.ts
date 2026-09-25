/**
 * 저장된 설정에서 넥슨에 넘길 자격을 고른다. 부를 수 없으면 `null`.
 *
 * `storage/` 가 아니라 여기 있는 것은 **순수 함수라서**다. 저장소 모듈은 테스트가 통째로
 * 갈아끼우는 I/O 경계라, 거기 두면 mock 마다 이 함수를 따로 알려 줘야 한다.
 *
 * **저장된 설정이 없는 것과 쓸 키가 없는 것을 한 답으로 묶는다.** 부르는 쪽이 하는 일이 같아서다
 * (조회를 건너뛴다). 가드를 둘로 두면 같은 말을 두 번 한다.
 *
 * **지금은 첫 API 키를 고른다.** 어느 메이플 ID 를 어느 수단으로 부를지는 메이플 ID 목록을
 * 합치는 단위(#537)가 정한다.
 */
import type { NexonAuthConfig, NexonCredential } from '../types/auth'

export function credentialOf(config: NexonAuthConfig | null): NexonCredential | null {
  const key = config?.apiKeys[0]
  return key === undefined ? null : { kind: 'apiKey', value: key.value }
}

/**
 * 사용자가 방금 친 키로 자격을 만든다. **저장 전이라 설정이 아직 없다.**
 *
 * 로그인 폼이 검증과 단계 재기에 쓴다. 저장은 그 둘을 통과한 뒤에 한다.
 */
export function apiKeyCredential(value: string): NexonCredential {
  return { kind: 'apiKey', value }
}

/**
 * 실패에 실어 보낼 키 값. 자격이 API 키가 아니면 `undefined`.
 *
 * 무효화 알림이 **어느 키를 지울지** 가리는 데 쓴다. 로그인으로 부르다 실패한 것이면 지울 키가
 * 없으므로 안 싣는다.
 */
export function apiKeyValueOf(credential: NexonCredential): string | undefined {
  return credential.kind === 'apiKey' ? credential.value : undefined
}
