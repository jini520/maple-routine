import fixture from '../../__fixtures__/game-data/game-rules.json'
import { parseGameRules } from '../game-rules'

describe('게임 규칙', () => {
  // 규칙 하나만 빠져도 그 규칙을 쓰는 계산이 0 으로 돈다. 표 전체를 버려야 들고 있던 규칙이 그대로 선다.
  it('규칙 아홉이 모두 정수로 있어야 받고, 하나라도 빠지거나 음수면 표 전체를 버린다', () => {
    expect(parseGameRules(fixture)).not.toBeNull()
    const { spendTariffPercent: _dropped, ...missing } = fixture.gameRules
    expect(parseGameRules({ ...fixture, gameRules: missing })).toBeNull()
    expect(parseGameRules({ ...fixture, gameRules: { ...fixture.gameRules, mesoMarketFeePercent: -1 } })).toBeNull()
    expect(parseGameRules({ ...fixture, gameRules: { ...fixture.gameRules, weeklyBossSelectionLimit: 0 } })).toBeNull()
  })
})
