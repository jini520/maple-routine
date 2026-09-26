/**
 * 번들에 박힌 개발자 API 키. **로그인만 한 사용자의 비프렌즈 경로**가 이걸로 넥슨을 부른다.
 *
 * Open ID 는 프렌즈 6경로만 열어서 `character/basic` · 메소 다섯 · 공지 넷은 키가 있어야 한다.
 * 로그인 사용자는 자기 키가 없으므로 우리 키를 쓴다. 키 소유 계정과 무관한 ocid 도 조회된다
 * (실측 2026-09-27. 계정으로 묶이는 것은 `character/list` 뿐이다).
 *
 * **번들에서 꺼낼 수 있다.** 꺼내 쓰면 우리 한도가 탄다. 그 대가를 알고 고른 값이다.
 *
 * **`process.env.EXPO_PUBLIC_이름` 형태 그대로여야 한다.** `babel-preset-expo` 가 그 글자를
 * 보고 번들에 값을 박는다. 변수로 빼거나 동적으로 조합하면 `undefined` 가 된다
 * (`native/adapters/rn-ads.ts` 가 같은 이유로 그 형태를 지킨다).
 */

/** 살아 있는 키 목록. 빈 값은 키가 아니다(`.env` 에 항목만 만든 상태). */
let keys: string[] = [
  process.env.EXPO_PUBLIC_NEXON_API_KEY_1,
  process.env.EXPO_PUBLIC_NEXON_API_KEY_2,
].filter((key): key is string => typeof key === 'string' && key !== '')

/**
 * 더 못 쓰는 키. **되살리지 않는다.**
 *
 * 무효 키는 영구다. 한도 초과는 시간이 지나면 풀리지만 그것을 여기서 재려면 시계를 들여야 하고,
 * 앱을 다시 켜면 이 집합이 비어 그때 다시 해 본다.
 */
const dead = new Set<string>()

/** 다음에 쓸 키를 고르는 자리. 번갈아 써야 한도가 두 배가 된다. */
let cursor = 0

/** 지금 쓸 수 있는 키들. */
function alive(): string[] {
  return keys.filter((key) => !dead.has(key))
}

/**
 * 다음 개발자 키. 살아 있는 것이 없으면 `null`.
 *
 * `null` 이면 부르는 쪽이 그 경로를 포기한다. 빈 키를 실으면 넥슨이 400 을 주고, 그 400 은
 * 사용자에게 키가 잘못됐다 로 보인다.
 */
export function nextDeveloperKey(): string | null {
  const usable = alive()
  if (usable.length === 0) return null

  const key = usable[cursor % usable.length] ?? null
  cursor += 1
  return key
}

/**
 * 이 키로는 더 못 부른다. 무효(400 `OPENAPI00005`)이거나 한도를 넘었다(429).
 *
 * @param key 실패한 그 키. 모르는 값이면 아무 일도 안 한다
 */
export function markDeveloperKeyDead(key: string): void {
  if (keys.includes(key)) dead.add(key)
}

/** 테스트가 번들 값 대신 쓸 목록을 세운다. 죽은 표시와 차례도 함께 되돌린다. */
export function __setDeveloperKeysForTest(next: readonly string[]): void {
  keys = next.filter((key) => key !== '')
  dead.clear()
  cursor = 0
}
