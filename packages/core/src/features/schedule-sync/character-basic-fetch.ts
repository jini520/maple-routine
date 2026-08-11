import { fetchCharacterBasic } from '@core/nexon/character'
import { getCachedCharacterBasic, setCachedCharacterBasic } from '@core/storage/character-basic-cache'
import type { CharacterBasicProfile } from '@core/types'

/**
 * `character/basic` 의 **공유 통과 지점**([[ADR-113]] 결정 1).
 *
 * 같은 요청이 네 곳에서 나간다 — 계정 선택 프로브(`features/onboarding/use-account-probes`) ·
 * 예열(`features/onboarding/prefetch`) · 캐릭터 피커(`character-roster`) · 동기화 편승 갱신
 * (`schedule-sync` 의 `refreshCharacterBasics`, [[ADR-097]] 결정 7). 엔드포인트·파라미터·응답이
 * 완전히 같고 소비하는 필드만 달라서, 온보딩 한 바퀴에 같은 캐릭터로 세 번이 나가고 있었다.
 *
 * **호출부마다 "이미 받았는지"를 판단하게 하지 않고 경로 하나로 접는다** — 그래야 호출자끼리
 * 서로를 몰라도 접힌다. 프로브는 예열이 뒤따라온다는 것을 모르고 예열은 피커가 곧 열린다는 것을
 * 모르는데, 호출부가 판단하려면 그 지식을 서로에게 심어야 하고 새 호출부가 생기는 순간 조용히
 * 중복이 되살아난다(실제로 [[ADR-097]] 결정 7 이 넷째 호출부를 그렇게 추가했다).
 *
 * 절감의 값은 호출 수 자체가 아니라 **429 확률을 낮춰 조회 원장이 채워질 확률을 올리는 것**이다
 * — 자격 스윕은 실패를 원장에 기록하지 않으므로([[ADR-086]] 결정 4, 의도된 설계) 429 가 나면
 * 다음 화면이 같은 13일을 처음부터 다시 훑고 그게 또 429 를 부른다(이슈 #158).
 */

/**
 * **5분인 이유**는 둘이다([[ADR-113]] 결정 1).
 *
 * 1. 온보딩 한 바퀴(계정 선택 → 예열 → 모드 선택 → 피커)를 여유 있게 덮는다. 3분이면 모드 선택에서
 *    오래 머무는 사이 만료돼 피커가 전원을 다시 부른다.
 * 2. **[[ADR-097]] 동기화 TTL 10분보다 짧아야 한다.** 이 가드는 동기화 게이트를 통과한 회차에서만
 *    만나는 둘째 문이라, 값이 같거나 길면 편승 갱신이 경계에서 거의 항상 건너뛰어져 사실상 죽는다.
 */
export const CHARACTER_BASIC_TTL_MS = 5 * 60 * 1000

/**
 * 파싱 불가·미래 시각은 **만료로 취급한다** — 손상된 값이나 기기 시계 되감기가 캐시를 영구히
 * 신선한 것으로 만들면 안 된다. 경계는 배타적이라 정확히 5분이면 만료다.
 */
function isFresh(cachedAt: string, now: Date): boolean {
  const at = Date.parse(cachedAt)
  if (!Number.isFinite(at)) {
    return false
  }

  const elapsed = now.getTime() - at
  return elapsed >= 0 && elapsed < CHARACTER_BASIC_TTL_MS
}

export async function fetchCharacterBasicCached(
  apiKey: string,
  accountId: string,
  ocid: string,
  now: Date,
): Promise<CharacterBasicProfile> {
  const cached = await getCachedCharacterBasic(ocid)
  if (cached !== null && isFresh(cached.cachedAt, now)) {
    return cached.profile
  }

  // 실패는 **캐시로 폴백하지 않고 그대로 던진다.** 호출부들이 그 예외에 판정을 걸고 있다 —
  // 400 `OPENAPI00003` 로 계정의 조회 불가를 확정하고(`toScheduleSyncError` 의
  // `characterUnavailable`), 401·429 는 전역 실패로 갈라진다. 여기서 삼키면 그 판정이 통째로 죽는다.
  const fetched = await fetchCharacterBasic(apiKey, ocid)

  // cachedAt 은 호출부가 이미 잡아둔 `now` 다(여기서 시계를 다시 읽지 않는다) — 판정이 결정적이고,
  // 오차는 항상 TTL 이 짧아지는 보수적인 방향으로만 난다.
  await setCachedCharacterBasic(accountId, ocid, { profile: fetched, cachedAt: now.toISOString() })
  return fetched
}
