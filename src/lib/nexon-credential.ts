/**
 * 저장된 설정에서 넥슨에 넘길 자격을 고른다. 부를 수 없으면 `null`.
 *
 * `storage/` 가 아니라 여기 있는 것은 **순수 함수라서**다. 저장소 모듈은 테스트가 통째로
 * 갈아끼우는 I/O 경계라, 거기 두면 mock 마다 이 함수를 따로 알려 줘야 한다.
 *
 * **저장된 설정이 없는 것과 쓸 수단이 없는 것을 한 답으로 묶는다.** 부르는 쪽이 하는 일이
 * 같아서다(조회를 건너뛴다). 가드를 둘로 두면 같은 말을 두 번 한다.
 *
 * **메인 계정의 자격이다.** 로그인이 있으면 로그인이고, 없으면 로그인 없이 쓰는 메인 키(`mainKeyId`)다. 프렌즈 밖
 * 경로는 로그인 자격으로 못 가는데, 그 자리는 `routeOf` 가 개발자 키로 바꿔 단다.
 *
 * 부계정 키는 메인이 되지 않는다. 로그인이 만료돼 부계정 키만 남으면 `null` 이고 앱은 로그인 화면을 세운다.
 * 어느 부계정이 이 사용자의 것인지는 로그인이 정하기 때문이다.
 */
import type { NexonApiKeyMethod, NexonAuthConfig, NexonCredential } from '../types/auth'

export function credentialOf(config: NexonAuthConfig | null): NexonCredential | null {
  const login = config?.login
  if (login != null) return { type: 'login', value: login.session, accountId: login.id }

  const key = mainApiKeyOf(config)
  return key === null ? null : keyCredentialOf(key)
}

/** 로그인 없이 쓰는 메인 키. 없으면 `null`. 귀속(`loginId`)이 있어도 메인 키일 수 있다. */
export function mainApiKeyOf(config: NexonAuthConfig | null): NexonApiKeyMethod | null {
  if (config == null || config.mainKeyId === null) return null
  return config.apiKeys.find((one) => one.id === config.mainKeyId) ?? null
}

function keyCredentialOf(key: NexonApiKeyMethod): NexonCredential {
  return { type: 'key', value: key.value, accountId: key.id }
}

/**
 * 지금 부를 수 있는 넥슨 계정마다의 자격. 메인 계정이 맨 앞이다.
 *
 * 로그인이 있으면 로그인과 그 로그인에 등록한 부계정 키다. 다른 로그인의 부계정 키는 빠진다. 로그인이 없으면 메인 키 하나뿐이다.
 */
export function usableCredentialsOf(config: NexonAuthConfig | null): NexonCredential[] {
  const login = config?.login
  if (login == null) {
    const main = credentialOf(config)
    return main === null ? [] : [main]
  }
  return [
    { type: 'login', value: login.session, accountId: login.id },
    ...(config?.apiKeys ?? []).filter((one) => one.loginId === login.id).map(keyCredentialOf),
  ]
}

/**
 * 한 넥슨 계정의 캐릭터를 부를 자격. 부를 수 없으면 `null`.
 *
 * @param owner 캐릭터가 속한 넥슨 계정 id. 모르면 `null` 이고, 메인 계정의 자격을 준다. 계정 칸이 생기기 전 기록은 모두 메인 계정의 것이었다
 */
export function credentialOfOwner(config: NexonAuthConfig | null, owner: string | null): NexonCredential | null {
  if (owner === null) return credentialOf(config)
  return usableCredentialsOf(config).find((one) => one.accountId === owner) ?? null
}

/**
 * 메인 넥슨 계정의 id. `credentialOf` 가 고르는 자격과 같은 계정이다.
 *
 * 계정 칸이 생기기 전의 기록은 모두 이 계정의 자격으로 받았다.
 */
export function mainNexonAccountIdOf(config: NexonAuthConfig | null): string | null {
  return credentialOf(config)?.accountId ?? null
}

/**
 * 저장된 넥슨 로그인 자격. 로그인이 없으면 `null`.
 *
 * **값은 서버 세션이다.** 넥슨에는 안 나가고 우리 서버의 프렌즈 스트림에만 실린다. 프렌즈 여섯
 * 말고는 이 자격으로 못 부른다.
 */
export function loginCredentialOf(config: NexonAuthConfig | null): NexonCredential | null {
  const login = config?.login
  return login == null ? null : { type: 'login', value: login.session, accountId: login.id }
}

/**
 * 사용자가 방금 친 키로 자격을 만든다. **저장 전이라 설정이 아직 없다.**
 *
 * 로그인 폼이 검증과 단계 재기에 쓴다. 저장은 그 둘을 통과한 뒤에 한다.
 *
 * @param accountId 저장된 키면 그 넥슨 계정 id. 저장 전이면 계정이 없어 `null` 이다
 */
export function apiKeyCredential(value: string, accountId: string | null = null): NexonCredential {
  return { type: 'key', value, accountId }
}

/**
 * 실패에 실어 보낼 키 값. 자격이 API 키가 아니면 `undefined`.
 *
 * 무효화 알림이 **어느 키를 지울지** 가리는 데 쓴다. 로그인으로 부르다 실패한 것이면 지울 키가
 * 없으므로 안 싣는다.
 */
export function apiKeyValueOf(credential: NexonCredential): string | undefined {
  return credential.type === 'key' ? credential.value : undefined
}

/**
 * 자격이 같은 것끼리 묶는다. 차례는 처음 나온 차례다.
 *
 * 동시 상한과 자격 전체가 막혔는지 보는 판정이 자격마다 따로라, 넥슨 계정마다 나눠 부를 때 쓴다.
 */
export function groupByCredential<T>(
  items: readonly T[],
  credentialOfItem: (item: T) => NexonCredential,
): { credential: NexonCredential; items: T[] }[] {
  const groups = new Map<string, { credential: NexonCredential; items: T[] }>()
  for (const item of items) {
    const credential = credentialOfItem(item)
    const key = identityOf(credential)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, { credential, items: [item] })
    else group.items.push(item)
  }
  return [...groups.values()]
}

/** 같은 넥슨 계정의 같은 자격인가. 설정을 따로 읽어 만든 두 자격을 견줄 때 쓴다. */
export function isSameCredential(left: NexonCredential, right: NexonCredential): boolean {
  return identityOf(left) === identityOf(right)
}

function identityOf(credential: NexonCredential): string {
  return `${credential.type}:${credential.accountId ?? credential.value}`
}
