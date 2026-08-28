/**
 * 사냥 메소 계산([[ADR-175]] 결정 3·4·5).
 *
 * 화면은 이 파일의 함수 둘만 부른다 — 「어디서 · 얼마나 · 무슨 버프로」를 주면 메소가 나온다.
 *
 * ══ 수치는 **전부 사용자가 준 것**이다 ([[ADR-006]]) ═════════════════════════════════
 *
 * 젠 주기(분당 8회) · 메소 계수(몬스터 레벨 × 7.5) · 레벨 차이 페널티 표 둘 · 아이템 증가율 둘 —
 * 하나도 AI 가 추정하지 않았다(2026-08-28 사용자 확정). 맵마다 다른 값은 `hunting-grounds.json`
 * 이고 여기 있는 것은 **게임 전체의 규칙**이라 JSON 이 아니라 코드에 산다.
 *
 * ── 곱하는 차례 ────────────────────────────────────────────────────────────────────
 *
 *   잡는 마릿수    = 맵 마릿수 − 놓친 마릿수
 *   분당 기본 메소 = 몬스터 레벨 × 7.5 × (잡는 마릿수 × 8)
 *   메소 = floor( 분당 기본 메소 × (소재 × 30) × 레벨 페널티 × (1 + 아이템 %합) )
 *
 * **효율은 곱하는 값이 아니라 마릿수에 들어간다**(사용자 지정 2026-08-28) — 고르는 것이 퍼센트가
 * 아니라 «몇 마리를 놓치나» 이기 때문이다. 세그먼트에 적히는 %는 그 결과를 **맵이 정해 준 라벨**이다.
 *
 * **아이템 둘은 합연산 뒤 한 번 곱한다**(사용자 지정) — 유니온의 부 +50% · 소형 재물 획득의 비약
 * +20% 를 둘 다 켜면 ×1.7 이지 ×1.2×1.5(=1.8)가 아니다.
 *
 * **내림은 맨 끝에 한 번**이다. 단계마다 자르면 어느 단계에서 잘랐느냐로 값이 갈리고, 그 차이를
 * 사용자가 되짚을 방법이 없다. (실제 값으로는 8젠과 30분이 소수를 늘 걷어 가지만, 내림은 그
 * 사실에 기대지 않는다.)
 */
import type { HuntingGround } from '../types/hunting-grounds'

/** 젠 주기 — 분당 8회(사용자 제공). 40마리 맵의 1분은 320마리다. */
export const SPAWNS_PER_MINUTE = 8

/** 통상 획득 메소 = 몬스터 레벨 × 7.5(사용자 제공). */
export const MESO_PER_MONSTER_LEVEL = 7.5

/**
 * 「소재」 한 개가 도는 시간([[ADR-175]] 결정 7).
 *
 * 소형 재물 획득의 비약을 줄인 메이플 용어이고 30분이다 — 사용자가 실제로 세는 단위가 그것이라
 * 「분」이나 「시간」으로 묻지 않는다.
 */
export const MINUTES_PER_SOJAE = 30

/**
 * 사냥 효율 조각 다섯 — **고르는 것은 «몇 마리를 놓치나»** 다(사용자 지정 2026-08-28).
 *
 * 처음에는 100·95·90·85·80 이라는 **고정 퍼센트**였는데, 그것은 맵을 모르는 값이다 — 40마리에서
 * 하나를 놓치는 것(97.5%)과 22마리에서 하나를 놓치는 것(95.5%)은 같은 손해가 아니다. 그래서
 * 고르는 축을 마릿수로 내리고 퍼센트는 **맵이 정하는 라벨**로 만들었다(`efficiencyPercentOf`).
 *
 * **0 이 첫 조각이고 기본값**이다 — 다 잡는 것이 기준이다.
 */
export const MISSED_MOB_OPTIONS = [0, 1, 2, 3, 4] as const

export type MissedMobs = (typeof MISSED_MOB_OPTIONS)[number]

/**
 * 세그먼트에 적히는 **라벨**(%) — `(마릿수 − 놓침) / 마릿수`를 **소수 첫째자리에서 반올림**한다
 * (사용자 지정 2026-08-28). 언제나 정수다.
 *
 * **셈에는 이 값을 안 쓴다.** 곱하는 것은 반올림 전의 분수이고(`huntingMesoOf`), 여기서 자른 값은
 * 화면에만 산다 — 표시하려고 자른 숫자가 돈을 세면 라벨이 계산을 끌고 다니게 된다.
 *
 * 이 데이터의 마릿수는 22~40 이라 조각 다섯이 **어느 맵에서도 안 겹친다**(408개 실측) — 겹치면
 * 세그먼트가 어느 조각을 고른 것인지 못 가린다. 그 사실은 `data/__tests__` 가 지킨다.
 */
export function efficiencyPercentOf(mobs: number, missedMobs: number): number {
  return Math.round((killedMobsOf(mobs, missedMobs) / mobs) * 100)
}

/** 실제로 잡는 마릿수 — 사냥터 요약 줄이 이 숫자를 적는다(사용자 지정 2026-08-28). */
export function killedMobsOf(mobs: number, missedMobs: number): number {
  return Math.max(0, mobs - missedMobs)
}

/**
 * 메소 획득률 증가 아이템(사용자 확정 2026-08-28 — [[ADR-006]]).
 *
 * **합연산**이다: 고른 것들의 `percent` 를 더해 `(1 + 합/100)` 을 한 번 곱한다.
 * `id` 는 기록에 글자로 박히므로(`hunt_boosts`) **이름을 바꿔도 id 는 안 바꾼다** — 바꾸면 그전
 * 기록이 어느 아이템도 안 가리키게 된다.
 */
export const MESO_BOOSTS = [
  { id: 'union', label: '유니온의 부', percent: 50 },
  { id: 'potion', label: '소형 재물 획득의 비약', percent: 20 },
] as const

export type MesoBoostId = (typeof MESO_BOOSTS)[number]['id']

/**
 * 레벨 차이 페널티 — **차이 11 부터의 감소폭**이고 배열 자리가 곧 차이다(`[0]` = 차이 11).
 *
 * 방향마다 표가 다르다. 몬스터가 높은 쪽은 규칙으로 접히지만(-3%씩 → -5%씩) **낮은 쪽은 안
 * 접힌다** — …-11 다음이 -8, 그다음이 -13, -3 이다. 게임의 표가 그런 것이라 배열이 곧 사실이다.
 *
 * 두 배열은 합이 각각 70·80 이고 앞의 열 칸(-3%씩·-2%씩)이 30·20 이라 **정확히 -100% 에서
 * 끝난다**. 옮겨 적다 틀리면 테스트가 거기서 잡는다.
 */
const PENALTY_STEPS_MONSTER_HIGHER = [
  // 차이 11~20 — -3%씩
  3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  // 차이 21~34 — -5%씩
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
] as const

const PENALTY_STEPS_MONSTER_LOWER = [
  // 차이 11~20 — -2%씩
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
  // 차이 21~30 — 고르지 않다. 규칙이 아니라 표다.
  5, 6, 7, 8, 9, 10, 11, 8, 13, 3,
] as const

/** 페널티가 안 걸리는 차이의 상한 — 여기까지는 0% 다. */
const PENALTY_FREE_DIFF = 10

/**
 * 레벨 차이가 깎는 몫(%). 0 이면 안 깎이고 100 이면 아무것도 안 나온다.
 *
 * 표 밖(몬스터가 높으면 34 초과 · 낮으면 30 초과)은 **-100% 에 머문다** — 배열을 넘어가면
 * `undefined` 가 더해져 `NaN` 이 되므로 길이로 먼저 자른다.
 */
export function levelPenaltyPercent(characterLevel: number, monsterLevel: number): number {
  const diff = Math.abs(monsterLevel - characterLevel)
  if (diff <= PENALTY_FREE_DIFF) return 0

  const steps =
    monsterLevel > characterLevel ? PENALTY_STEPS_MONSTER_HIGHER : PENALTY_STEPS_MONSTER_LOWER
  const taken = diff - PENALTY_FREE_DIFF
  if (taken >= steps.length) return 100

  let percent = 0
  for (let index = 0; index < taken; index += 1) percent += steps[index]
  return percent
}

/** 고른 아이템들의 증가율 합(%). 모르는 id 는 0 으로 친다(지운 아이템을 든 옛 기록). */
export function boostPercentOf(ids: readonly string[]): number {
  return ids.reduce((sum, id) => {
    const boost = MESO_BOOSTS.find((each) => each.id === id)
    return sum + (boost?.percent ?? 0)
  }, 0)
}

export interface HuntingMesoInput {
  ground: HuntingGround
  /** `null` = 캐릭터를 안 골랐다 → **페널티 없음**([[ADR-175]] 결정 6). */
  characterLevel: number | null
  /** 젠 한 번에 **놓치는 마릿수**(0~4). 퍼센트가 아니라 이것이 고르는 축이다. */
  missedMobs: number
  /** 고른 아이템들의 합(`boostPercentOf`). 화면이 이미 더해서 넘긴다. */
  boostPercent: number
  /** 소재 수 — 하나가 30분이다. */
  sojae: number
}

/**
 * 사냥터 하나에서 나오는 메소.
 *
 * **몬스터 레벨이 둘이면 레벨마다 재서 평균**낸다([[ADR-175]] 결정 5) — 평균 레벨 하나로 접으면
 * 레벨 차이가 소수(20.5)가 되어 정수 표에 못 넣고, 내리든 올리든 임의의 선택이 하나 생긴다.
 * 레벨이 하나인 맵(408 중 356)에서는 이 갈래가 아예 안 돈다.
 */
export function huntingMesoOf(input: HuntingMesoInput): number {
  const minutes = input.sojae * MINUTES_PER_SOJAE
  // **놓친 만큼 덜 잡는다** — 젠은 그대로 돌고 잡는 마릿수만 준다.
  const mobsPerMinute = killedMobsOf(input.ground.mobs, input.missedMobs) * SPAWNS_PER_MINUTE

  const sum = input.ground.levels.reduce((total, level) => {
    const penalty =
      input.characterLevel === null ? 0 : levelPenaltyPercent(input.characterLevel, level)
    const base = level * MESO_PER_MONSTER_LEVEL * mobsPerMinute * minutes
    return total + base * (1 - penalty / 100)
  }, 0)

  const perLevelMean = sum / input.ground.levels.length
  return Math.floor(perLevelMean * (1 + input.boostPercent / 100))
}

export interface HuntingTotalInput extends Omit<HuntingMesoInput, 'ground'> {
  /** `null` = 아직 안 골랐다. 그때도 조각 값은 선다 — 계산기가 반쯤 찬 상태다. */
  ground: HuntingGround | null
  /** 솔 에르다 조각 **획득 개수** — 앱이 추정하지 않는다([[ADR-175]] 결정 8). */
  fragments: number
  /** 조각 개당 메소. */
  fragmentPrice: number
}

/** 큰 숫자에 서는 값 — **메소 + 조각 × 개당 가격**이다([[ADR-175]] 결정 1). */
export function huntingTotalOf(input: HuntingTotalInput): number {
  const meso = input.ground === null ? 0 : huntingMesoOf({ ...input, ground: input.ground })
  return meso + input.fragments * input.fragmentPrice
}
