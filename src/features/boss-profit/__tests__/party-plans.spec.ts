import type { BossPartySetting } from '../../../storage/boss-party-settings'
import type { BossPartyPeriodOverride } from '../../../storage/boss-party-period-overrides'
import { SOLO_PARTY_PLAN, buildPartyPlans, partyPlanKey } from '../party-plans'

const setting = (over: Partial<BossPartySetting> = {}): BossPartySetting => ({
  ocid: 'ocid-1',
  bossKey: 'black_mage',
  difficulty: 'hard',
  partySize: 3,
  crystalMyShare: null,
  crystalSharesTotal: null,
  splitFeePercent: null,
  splitFeeAuto: false,
  updatedAt: '2026-09-20T00:00:00.000Z',
  ...over,
})

const override = (over: Partial<BossPartyPeriodOverride> = {}): BossPartyPeriodOverride => ({
  ocid: 'ocid-1',
  bossKey: 'black_mage',
  difficulty: 'hard',
  periodKey: '2026-W39',
  partySize: 2,
  crystalMyShare: null,
  crystalSharesTotal: null,
  splitFeePercent: null,
  splitFeeAuto: false,
  updatedAt: '2026-09-23T00:00:00.000Z',
  ...over,
})

describe('buildPartyPlans', () => {
  it('설정 하나가 기간마다 한 칸이 된다', () => {
    const plans = buildPartyPlans([setting()], [], ['2026-W39', '2026-09'])

    expect(plans[partyPlanKey('ocid-1', 'black_mage', 'hard', '2026-W39')]?.partySize).toBe(3)
    expect(plans[partyPlanKey('ocid-1', 'black_mage', 'hard', '2026-09')]?.partySize).toBe(3)
  })

  it('갈라진 값이 그 기간에서만 설정을 이긴다', () => {
    const plans = buildPartyPlans([setting()], [override()], ['2026-W39', '2026-09'])

    expect(plans[partyPlanKey('ocid-1', 'black_mage', 'hard', '2026-W39')]?.partySize).toBe(2)
    // 다음 주는 다시 파티 관리 값이다. 갈라진 것은 그 기간 한 칸이다.
    expect(plans[partyPlanKey('ocid-1', 'black_mage', 'hard', '2026-09')]?.partySize).toBe(3)
  })

  it('비율과 자동 수수료도 함께 갈린다', () => {
    const plans = buildPartyPlans(
      [setting({ crystalMyShare: 1, crystalSharesTotal: 2, splitFeePercent: 3, splitFeeAuto: false })],
      [override({ crystalMyShare: 2, crystalSharesTotal: 3, splitFeePercent: 5, splitFeeAuto: true })],
      ['2026-W39'],
    )

    expect(plans[partyPlanKey('ocid-1', 'black_mage', 'hard', '2026-W39')]).toEqual({
      partySize: 2,
      crystalMyShare: 2,
      crystalSharesTotal: 3,
      splitFeePercent: 5,
      splitFeeAuto: true,
    })
  })

  it('설정이 없는 보스도 갈라진 값만으로 칸이 선다', () => {
    const plans = buildPartyPlans([], [override()], ['2026-W39'])

    expect(plans[partyPlanKey('ocid-1', 'black_mage', 'hard', '2026-W39')]?.partySize).toBe(2)
  })

  it('보는 기간이 아닌 갈라진 값은 안 싣는다', () => {
    const plans = buildPartyPlans([], [override({ periodKey: '2026-W38' })], ['2026-W39'])

    expect(plans).toEqual({})
  })

  it('둘 다 없으면 빈 표다. 못 찾은 행은 솔로로 선다', () => {
    expect(buildPartyPlans([], [], ['2026-W39'])).toEqual({})
    expect(SOLO_PARTY_PLAN).toEqual({
      partySize: 1,
      crystalMyShare: null,
      crystalSharesTotal: null,
      splitFeePercent: null,
      splitFeeAuto: false,
    })
  })
})
