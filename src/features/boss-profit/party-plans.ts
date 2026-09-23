/**
 * 미완료 보스 행이 그릴 파티 인원과 결정석 비율.
 *
 * 파티 관리 설정(`boss_party_settings`)을 기본으로 깔고, 그 기간에 갈라진 값
 * (`boss_party_period_overrides`)이 있으면 그것이 이긴다.
 *
 * 행에 실어 보내지 않는 이유는 `BossProfitRow.partySize` 가 자동 기록에서 **이미 기록됐나**를
 * 겸해서 말하기 때문이다. 거기에 설정값을 실으면 자동 기록이 통째로 멈춘다.
 */
import type { BossPartyPeriodOverride } from '../../storage/boss-party-period-overrides'
import type { BossPartySetting, BossPartyShareColumns } from '../../storage/boss-party-settings'

export interface BossPartyPlan extends BossPartyShareColumns {
  partySize: number
  splitFeeAuto: boolean
}

/** 설정도 갈라진 값도 없는 행이 서는 자리. 지금까지의 미완료 행과 같은 값이다. */
export const SOLO_PARTY_PLAN: BossPartyPlan = {
  partySize: 1,
  crystalMyShare: null,
  crystalSharesTotal: null,
  splitFeePercent: null,
  splitFeeAuto: false,
}

/**
 * 표의 키. 기간까지 든다 - 같은 보스라도 기간마다 다른 값일 수 있다.
 *
 * @example const plan = partyPlans[partyPlanKey(row.ocid, row.bossKey, row.difficulty, row.periodKey)]
 */
export function partyPlanKey(ocid: string, bossKey: string, difficulty: string, periodKey: string): string {
  return `${ocid}:${bossKey}:${difficulty}:${periodKey}`
}

function planOf(source: BossPartySetting | BossPartyPeriodOverride): BossPartyPlan {
  return {
    partySize: source.partySize,
    crystalMyShare: source.crystalMyShare,
    crystalSharesTotal: source.crystalSharesTotal,
    splitFeePercent: source.splitFeePercent,
    splitFeeAuto: source.splitFeeAuto === true,
  }
}

/**
 * 설정과 갈라진 값을 기간별 한 표로 합친다.
 *
 * @param periodKeys 미완료 행이 설 수 있는 기간. 지금 주차와 지금 달 둘이다.
 */
export function buildPartyPlans(
  settings: BossPartySetting[],
  overrides: BossPartyPeriodOverride[],
  periodKeys: string[],
): Record<string, BossPartyPlan> {
  const plans: Record<string, BossPartyPlan> = {}

  for (const setting of settings) {
    for (const periodKey of periodKeys) {
      plans[partyPlanKey(setting.ocid, setting.bossKey, setting.difficulty, periodKey)] = planOf(setting)
    }
  }

  for (const override of overrides) {
    if (!periodKeys.includes(override.periodKey)) continue
    plans[partyPlanKey(override.ocid, override.bossKey, override.difficulty, override.periodKey)] =
      planOf(override)
  }

  return plans
}
