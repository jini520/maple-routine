/**
 * 보스별 수익 섹션. 파티 분배 뒤의 내 몫 결정석을 보스 초상 타일로 줄 세운다.
 *
 * 난이도별은 초상 아래 테두리에 작은 난이도 배지를 반쯤 걸치고, 보스별은 난이도를 합쳐 배지가 없다.
 */
import { memo, useState } from 'react'
import { ScrollView, View } from 'react-native'

import { Badge, Text } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { Segment } from '../../components/molecules/Segment/Segment'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { bossTotalsBetween, type DaysByDate, type StatsRange } from '../../features/stats/aggregate'
import { bossPortraitSlugOf } from '../../lib/boss/bosses'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'
import { StatsSection } from './StatsSection'

const MODES = ['난이도별', '보스별'] as const
type Mode = (typeof MODES)[number]

const TILE_WIDTH = 88
const PORTRAIT_SIZE = 48
/** 작은 배지 높이의 반. 배지가 초상 아래 테두리에 반쯤 걸친다 */
const BADGE_HALF = 7

export const BossSection = memo(function BossSection(props: { days: DaysByDate; range: StatsRange }): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('난이도별')
  const rows = bossTotalsBetween(props.days, props.range, mode === '보스별' ? 'boss' : 'difficulty')
  const total = rows.reduce((sum, row) => sum + row.meso, 0)
  const count = rows.reduce((sum, row) => sum + row.count, 0)

  return (
    <StatsSection
      title="보스별 수익"
      testID="stats-bosses"
      trailing={<Segment options={MODES} selected={mode} onSelect={setMode} />}
    >
      {rows.length === 0 ? (
        <Text className="py-6 text-center text-xs text-text-muted">이 기간에 결정석을 판 보스가 없어요</Text>
      ) : (
        <>
          <View className="flex-row items-baseline gap-1.5">
            <Text className="text-xl font-bold text-rise-ink" style={TABULAR_NUMS}>
              {formatMesoCompact(total)}
            </Text>
            <Text testID="stats-boss-headline" className="text-11 text-text-muted">
              {`처치 ${count}회`}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {rows.map((row) => (
              <View
                key={row.key}
                testID={`stats-boss-tile-${row.key}`}
                className="items-center gap-1.5 rounded-xl bg-card-body p-2"
                style={{ width: TILE_WIDTH }}
              >
                <View className="items-center" style={{ marginBottom: row.difficulty === null ? 0 : BADGE_HALF }}>
                  <BossPortrait
                    portraitSlug={bossPortraitSlugOf(row.bossKey)}
                    label={row.difficulty === null ? row.name : `${DIFFICULTY_NAME[row.difficulty]} ${row.name}`}
                    size={PORTRAIT_SIZE}
                  />
                  {row.difficulty !== null && (
                    <View className="absolute" style={{ bottom: -BADGE_HALF }}>
                      <Badge variant={row.difficulty} size="mini">
                        {DIFFICULTY_NAME[row.difficulty]}
                      </Badge>
                    </View>
                  )}
                </View>
                <View className="items-center">
                  <Text numberOfLines={2} className="text-center text-11 font-semibold text-text">
                    {row.name}
                  </Text>
                  <Text className="text-10 text-text-muted" style={TABULAR_NUMS}>
                    {`${row.count}회 처치`}
                  </Text>
                </View>
                <Text className="mt-auto text-xs font-bold text-rise-ink" style={TABULAR_NUMS}>
                  {formatMesoCompact(row.meso)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </StatsSection>
  )
})
