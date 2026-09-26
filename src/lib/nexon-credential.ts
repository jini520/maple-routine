/**
 * 저장된 설정에서 넥슨에 넘길 자격을 고른다. 부를 수 없으면 `null`.
 *
 * `storage/` 가 아니라 여기 있는 것은 **순수 함수라서**다. 저장소 모듈은 테스트가 통째로
 * 갈아끼우는 I/O 경계라, 거기 두면 mock 마다 이 함수를 따로 알려 줘야 한다.
 *
 * **저장된 설정이 없는 것과 쓸 수단이 없는 것을 한 답으로 묶는다.** 부르는 쪽이 하는 일이
 * 같아서다(조회를 건너뛴다). 가드를 둘로 두면 같은 말을 두 번 한다.
 *
 * **로그인이 있으면 로그인이 이긴다.** 로그인을 붙이면 같은 계정의 키가 거둬지므로 통상은 둘 중
 * 하나만 있다. 프렌즈 밖 경로는 이 자격으로 못 가는데, 그 자리는 `routeOf` 가 개발자 키로
 * 바꿔 단다.
 *
 * **남은 키를 어느 메이플 ID 에 쓸지는 아직 아무도 안 정한다.** 로그인이 안 덮는 다른 넥슨
 * 계정의 키가 남을 수 있고, 그 계정 캐릭터는 이 자격으로 안 보인다(열린 질문).
 */
import type { NexonAuthConfig, NexonCredential } from '../types/auth'

export function credentialOf(config: NexonAuthConfig | null): NexonCredential | null {
  const login = config?.login
  if (login != null) return { kind: 'login', value: login.accessToken }

  const key = config?.apiKeys[0]
  return key === undefined ? null : { kind: 'apiKey', value: key.value }
}

/**
 * 저장된 넥슨 로그인 자격. 로그인이 없으면 `null`.
 *
 * **세션이 아니라 액세스 토큰이다.** 세션은 새 토큰을 받을 때만 우리 서버로 가고 넥슨에는
 * 안 나간다. 프렌즈 여섯 말고는 이 자격으로 못 부른다.
 */
export function loginCredentialOf(config: NexonAuthConfig | null): NexonCredential | null {
  const login = config?.login
  return login == null ? null : { kind: 'login', value: login.accessToken }
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
