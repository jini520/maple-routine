/**
 * 이 캐릭터가 이 항목을 진행할 수 있는가 — 요구 레벨 판정 **한 곳**.
 *
 * ## 왜 한 곳인가
 *
 * 소비처가 다섯이다 — 컨텐츠 카드의 배지 · 보스 카드의 배지 · 컨텐츠 진행률의 분모 · 초상화 링 ·
 * today 남은 스케줄. 판정이 흩어지면 **같은 항목이 화면마다 다르게 세어진다**, 그리고 그것은
 *  이 금지하는 상태다(*"today 가 세는 남은 것 은 스케줄러 화면이 보여 주는
 * 것과 한 글자도 다르면 안 된다"*). 참조표 조회도 여기 모으는 이유가 같다.
 *
 * ## 이것은 잠금이 아니다
 *
 *  가 폐기한 것은 수동 추적에서 고르지 못하게 막는 것 이고, 여기서 하는 것은
 * 표시하고 집계에서 빼는 것 이다. **막는 것은 아무것도 없다** — 축이 다르므로 그 정정을 되살리는
 * 것이 아니다(그 구분을 가 본문에 못 박았다).
 *
 * ## 두 없음 을 안 가른다
 *
 * | | 판정 | 왜 |
 * |---|---|---|
 * | 캐릭터 레벨을 모른다 | 진행 가능 | 모르는 것을 단정하지 않는다(태도) |
 * | 참조표에 요구 레벨이 없다 | 진행 가능 | 제한 없음 과 미확정 을 안 가른다(사용자 판정) |
 *
 * 두 번째가 결정이다. 지금 데이터는 둘을 **필드 생략** 하나로 표현하고(주간 컨텐츠 5개 — 유니온
 * 둘·길드 셋), 표식 없이 미확정 을 진행 불가 로 읽으면 위반이다.
 */

import weeklyBossesData from '../../data/weekly-bosses.json'
import { CONTENT_TEMPLATE } from './scheduler-content-template'

/** 컨텐츠 이름 → 요구 레벨. 참조표에 없거나 값이 없으면 `null`. */
const CONTENT_REQUIRED_LEVELS: ReadonlyMap<string, number> = new Map(
  [...CONTENT_TEMPLATE.daily, ...CONTENT_TEMPLATE.weekly].flatMap((entry) => {
    const required = (entry as { requiredLevel?: number }).requiredLevel
    return required === undefined ? [] : [[entry.content_name, required] as const]
  }),
)

/**
 * 보스 이름 → (난이도 → 요구 레벨).
 *
 * **필드명이 `requiredLevel` 이 아니라 `requiredLevels` 다** — 보스는 같은 이름이라도 난이도마다
 * 요구 레벨이 다르다(자쿰 카오스 90 · 검은 마법사 하드 200 …). 이슈 #243 본문이 이 차이를 놓쳐
 * `requiredLevel` 27곳 이라 적었는데, 그것은 복수형 필드를 부분 문자열로 센 값이다.
 */
const BOSS_REQUIRED_LEVELS: ReadonlyMap<string, Readonly<Record<string, number>>> = new Map(
  [
    ...weeklyBossesData.weekly,
    ...weeklyBossesData.eventWeekly,
    ...weeklyBossesData.monthly,
  ].flatMap((entry) => {
    const levels = (entry as { requiredLevels?: Record<string, number> }).requiredLevels
    return levels === undefined ? [] : [[entry.boss, levels] as const]
  }),
)

/** 컨텐츠의 요구 레벨 — 참조표에 없으면 `null`(제한 없음 으로 읽힌다). */
export function contentRequiredLevel(contentName: string): number | null {
  return CONTENT_REQUIRED_LEVELS.get(contentName) ?? null
}

/** 보스+난이도의 요구 레벨 — 참조표에 없으면 `null`. */
export function bossRequiredLevel(bossName: string, difficulty: string): number | null {
  return BOSS_REQUIRED_LEVELS.get(bossName)?.[difficulty] ?? null
}

/**
 * 판정의 알맹이 — **둘 중 하나라도 모르면 **진행 가능**** 이다(위 표).
 *
 * 순수 비교라 참조표를 안 거치는 호출부(이미 요구 레벨을 손에 든 자리)도 그대로 쓸 수 있다.
 */
export function isLevelBlocked(characterLevel: number | null, requiredLevel: number | null): boolean {
  if (characterLevel === null || requiredLevel === null) return false
  return characterLevel < requiredLevel
}

/** 컨텐츠 한 항목이 이 캐릭터에게 진행 불가 인가. */
export function isContentBlocked(characterLevel: number | null, contentName: string): boolean {
  return isLevelBlocked(characterLevel, contentRequiredLevel(contentName))
}

/** 보스 한 항목(난이도까지)이 이 캐릭터에게 진행 불가 인가. */
export function isBossBlocked(
  characterLevel: number | null,
  bossName: string,
  difficulty: string,
): boolean {
  return isLevelBlocked(characterLevel, bossRequiredLevel(bossName, difficulty))
}
