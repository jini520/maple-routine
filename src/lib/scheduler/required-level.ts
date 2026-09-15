/**
 * 이 캐릭터가 이 항목을 진행할 수 있는지 내는 요구 레벨 판정. 소비처가 다섯이라 한 곳에 모은다.
 *
 * 컨텐츠 카드 배지 · 보스 카드 배지 · 컨텐츠 진행률 분모 · 초상화 링 · today 남은 스케줄이 이것을
 * 쓴다. 판정이 흩어지면 같은 항목이 화면마다 다르게 세어진다.
 *
 * **이것은 잠금이 아니다.** 표시하고 집계에서 뺄 뿐 막는 것은 없다.
 *
 * 두 `없음` 을 안 가른다.
 *
 * | | 판정 | 왜 |
 * |---|---|---|
 * | 캐릭터 레벨을 모른다 | 진행 가능 | 모르는 것을 단정하지 않는다 |
 * | 참조표에 요구 레벨이 없다 | 진행 가능 | 제한 없음과 미확정을 안 가른다 |
 *
 * 둘째가 결정이다. 지금 데이터는 둘을 필드 생략 하나로 표현해서, 표식 없이 미확정을 진행 불가로
 * 읽으면 없는 사실을 단정하는 것이 된다.
 */

import type { BossDifficulty } from '../../types'
import { bossRequiredLevel } from '../boss/bosses'
import { CONTENT_TEMPLATE } from './scheduler-content-template'

/** 컨텐츠 이름 → 요구 레벨. 참조표에 없거나 값이 없으면 `null`. */
const CONTENT_REQUIRED_LEVELS: ReadonlyMap<string, number> = new Map(
  [...CONTENT_TEMPLATE.daily, ...CONTENT_TEMPLATE.weekly].flatMap((entry) => {
    const required = (entry as { requiredLevel?: number }).requiredLevel
    return required === undefined ? [] : [[entry.content_name, required] as const]
  }),
)

/** 컨텐츠의 요구 레벨. 참조표에 없으면 `null`(제한 없음 으로 읽힌다). */
export function contentRequiredLevel(contentName: string): number | null {
  return CONTENT_REQUIRED_LEVELS.get(contentName) ?? null
}

export { bossRequiredLevel }

/**
 * 판정의 알맹이. **둘 중 하나라도 모르면 **진행 가능**** 이다(위 표).
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
  bossKey: string | null,
  difficulty: BossDifficulty,
): boolean {
  return isLevelBlocked(characterLevel, bossRequiredLevel(bossKey, difficulty))
}
