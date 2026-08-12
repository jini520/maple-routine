/**
 * `@core/lib/world-emblem` 의 RN 대체 — `core-shims.js` 가 번들러 수준에서 이 파일로 갈아끼운다.
 *
 * **시그니처는 한 글자도 다르지 않다**([[ADR-128]] 원칙 1). 두 export 중 성질이 정반대다.
 *
 * ## `isChallengersWorld` 는 에셋과 무관하다 — 그대로 산다
 *
 * 이 판정은 이미지가 아니라 `world-emblems.json` 의 **매핑값**을 본다([[ADR-031]]) — 새 챌린저스
 * 월드가 생겨도 그 JSON 만 갱신하면 판정이 함께 갱신되는 것이 원래 설계다. 그래서 같은 JSON 을
 * 같은 규칙으로 읽는다. **이 함수가 조용히 틀리면 보스 스케줄러의 시즌 보스 표시가 무너지므로**
 * (`BossScreen`·`BossManageScreen` 이 쓴다) 테스트가 JSON 에서 기대값을 뽑아 지킨다.
 *
 * ## `worldEmblemUrl` 은 항상 `null` 이다
 *
 * `null` 은 원본이 정의해 둔 정상 경로다 — *"매핑에 없거나 파일이 없으면 `null`(폴백: 엠블럼
 * 생략)"*. 지금 RN 번들에 엠블럼 15장이 실려 있지 않으므로 사실 그대로다. 채우는 데 필요한 것과
 * 그것이 왜 이 파일 밖의 결정인지는 `rn-boss-icons.ts` 파일 머리에 한 번만 적어 뒀다(같은 사정이다).
 */

import worldEmblems from '@core/data/world-emblems.json'

const basenameByWorld = worldEmblems as Record<string, string>

/** 항상 `null` — RN 번들에 월드 엠블럼이 아직 없다(파일 머리). */
export function worldEmblemUrl(world: string): string | null {
  void world
  return null
}

export function isChallengersWorld(world: string): boolean {
  return basenameByWorld[world] === 'challengers'
}
