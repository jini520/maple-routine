/**
 * 계산기의 보스 줄. 첫 줄은 초상 · 별칭 · 내 몫, 둘째 줄은 난이도 · `변경` · 인원이다.
 *
 * 난이도 고르개는 펼치면 둘째 줄 위로 겹쳐 서서 스테퍼를 덮는다. 그래서 둘째 줄의 왼쪽 끝에 두고, 펼친 줄이 그 위에
 * 서도록 그 줄을 겹침의 기준으로 삼는다. 비율로 나누는 보스는 스테퍼 자리에 비율이 선다.
 */
import { Pressable, View } from 'react-native'

import { Badge, Text } from '../../../components/atoms'
import { BossPortrait } from '../../../components/molecules/BossPortrait/BossPortrait'
import { DifficultyExpander } from '../../../components/molecules/DifficultyExpander/DifficultyExpander'
import { Stepper } from '../../../components/molecules/Stepper/Stepper'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { CalculatorBoss } from '../../../lib/boss/boss-profit-calculator'
import { activeDifficultiesNow, bossAliasOf, bossNameOf, bossPortraitSlugOf, getMaxPartySize } from '../../../lib/boss/bosses'
import { formatMesoUnits } from '../../../lib/drop/drop-price'
import { formatShareRatio } from '../../../lib/boss/party-shares'
import type { BossDifficulty } from '../../../types'

export function BossRow(props: {
  boss: CalculatorBoss
  payoutMeso: number
  onChangeDifficulty: (difficulty: BossDifficulty) => void
  onChangePartySize: (partySize: number) => void
  /** `변경`. 파티 모달을 연다 */
  onOpenParty: () => void
}): React.JSX.Element {
  const { boss } = props
  const name = bossAliasOf(boss.bossKey, bossNameOf(boss.bossKey, boss.bossKey))
  const ratio = formatShareRatio(boss.shares)

  return (
    <View testID={`calculator-boss-${boss.bossKey}`} className="flex-row gap-3 px-3.5 py-2.5">
      <View aria-hidden>
        <BossPortrait portraitSlug={bossPortraitSlugOf(boss.bossKey)} label={name} size={40} />
      </View>
      <View className="flex-1 gap-1.5">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="text-sm font-semibold text-text">{name}</Text>
          <Text testID={`calculator-boss-payout-${boss.bossKey}`} className="text-sm font-bold text-text" style={TABULAR_NUMS}>
            {formatMesoUnits(props.payoutMeso)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <DifficultyExpander
            label={name}
            difficulties={activeDifficultiesNow(boss.bossKey)}
            value={boss.difficulty}
            onChange={props.onChangeDifficulty}
          />
          <View className="flex-row items-center gap-0.5">
            <Pressable
              role="button"
              aria-label={`${name} 파티 인원과 비율 변경`}
              onPress={props.onOpenParty}
              hitSlop={{ top: 6, bottom: 6 }}
              className="h-8 justify-center px-1.5 active:opacity-60"
            >
              <Text className="text-xs font-semibold text-text-muted">변경</Text>
            </Pressable>
            {ratio === null ? (
              <Stepper
                label={`${name} 파티 인원`}
                size="sm"
                value={boss.partySize}
                max={getMaxPartySize(boss.bossKey, boss.difficulty)}
                onChange={props.onChangePartySize}
              />
            ) : (
              <Badge variant="primary" style={TABULAR_NUMS}>
                {ratio}
              </Badge>
            )}
          </View>
        </View>
      </View>
    </View>
  )
}
