/**
 * 통계의 사냥 수입 카드. 소재 · 조각 타일 둘과, `사냥 메소 · 조각 판매 · 전리품 판매` 설명 줄 아래의 메소 합계.
 *
 * 기간을 옮겨도 높이가 같다. 0 인 줄은 글자만 숨기고, 기록이 없는 기간도 본문을 보이지 않게 그려 높이를 잡는다.
 *
 * @see docs/features/stats.md
 */
import { Image, View } from 'react-native'

import { Text } from '../../components/atoms'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { HuntTotals } from '../../features/stats/aggregate'
import { mesoBoostIconOf, solErdaFragmentIcon } from '../../lib/assets/asset-lookup'
import { formatMesoCompact } from '../../lib/cashbook/meso-compact'
import type { ImageAssetRef } from '../../types/image-asset'
import { StatsSection } from './StatsSection'

/** 가계부 사냥 전리품 블록의 아이템 그림과 같은 크기 */
const ICON_SIZE = 26
const HIDDEN = { opacity: 0 }

/** 아이템 그림. 그림을 못 찾으면 자리만 지킨다. 숫자가 서는 가로 자리가 그림 유무로 바뀌지 않게 */
function ItemIcon(props: { testID: string; icon: ImageAssetRef | null }): React.JSX.Element {
  const size = { width: ICON_SIZE, height: ICON_SIZE }
  return props.icon === null ? (
    <View testID={props.testID} style={size} />
  ) : (
    <Image testID={props.testID} source={props.icon} style={size} resizeMode="contain" aria-hidden />
  )
}

/**
 * 한 줄 글자. 넘치면 글자를 줄이고 줄 높이는 줄이기 전 그대로 둔다.
 *
 * 줄인 글자는 줄 높이도 함께 줄어든다. 그래서 같은 클래스의 빈 글자로 높이를 잡고 그 위에 글자를 얹는다.
 */
function FitLine(props: {
  testID: string
  className: string
  hidden?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View>
      <Text aria-hidden className={props.className} style={HIDDEN}>
        {' '}
      </Text>
      <View className="absolute inset-0 justify-center">
        <Text
          testID={props.testID}
          numberOfLines={1}
          adjustsFontSizeToFit
          aria-hidden={props.hidden}
          className={props.className}
          style={[TABULAR_NUMS, props.hidden === true ? HIDDEN : undefined]}
        >
          {props.children}
        </Text>
      </View>
    </View>
  )
}

/** 큰 값 한 줄과 둘째 줄의 타일. 둘째 줄은 0 이면 글자만 숨긴다 */
function Tile(props: {
  icon: React.ReactNode
  valueTestID: string
  value: React.ReactNode
  noteTestID: string
  note: string
  noteHidden: boolean
}): React.JSX.Element {
  return (
    <View className="min-w-0 flex-1 flex-row items-center gap-2 rounded-xl bg-card-body px-3 py-2.5">
      {props.icon}
      <View className="min-w-0 flex-1 gap-0.5">
        <FitLine testID={props.valueTestID} className="text-base font-bold text-text">
          {props.value}
        </FitLine>
        <FitLine testID={props.noteTestID} className="text-11 text-text-muted" hidden={props.noteHidden}>
          {props.note}
        </FitLine>
      </View>
    </View>
  )
}

/** 설명 줄. 판매 대금이 0 인 항목은 빼고, 사냥 메소는 늘 적는다. 합계만으로는 판매 대금이 섞였는지 모른다 */
function breakdownOf(totals: HuntTotals): string {
  const parts = [`사냥 메소 ${formatMesoCompact(totals.huntMeso)}`]
  if (totals.fragmentSaleMeso !== 0) parts.push(`조각 판매 ${formatMesoCompact(totals.fragmentSaleMeso)}`)
  if (totals.lootSaleMeso !== 0) parts.push(`전리품 판매 ${formatMesoCompact(totals.lootSaleMeso)}`)
  return parts.join(' · ')
}

export function HuntSection(props: { totals: HuntTotals }): React.JSX.Element {
  const { totals } = props
  const unit = 'text-xs font-normal text-text-muted'
  return (
    <StatsSection title="사냥 수입" testID="stats-hunt">
      <View>
        <View
          testID="stats-hunt-body"
          className="gap-3"
          style={totals.recorded ? undefined : HIDDEN}
          aria-hidden={!totals.recorded}
        >
          <View className="flex-row gap-2">
            <Tile
              icon={<ItemIcon testID="stats-hunt-icon-potion" icon={mesoBoostIconOf('potion')} />}
              valueTestID="stats-hunt-sojae"
              value={
                <>
                  {totals.sojae.toLocaleString()}
                  <Text className={unit}>소재</Text>
                </>
              }
              noteTestID="stats-hunt-manual"
              note={`직접 입력 ${totals.manualCount.toLocaleString()}건`}
              noteHidden={totals.manualCount === 0}
            />
            <Tile
              icon={<ItemIcon testID="stats-hunt-icon-fragment" icon={solErdaFragmentIcon()} />}
              valueTestID="stats-hunt-fragments"
              value={
                <>
                  <Text className={unit}>조각 </Text>
                  {totals.fragments.toLocaleString()}
                  <Text className={unit}>개</Text>
                </>
              }
              noteTestID="stats-hunt-unsold"
              note={`미판매 조각 ${totals.unsoldFragments.toLocaleString()}개`}
              noteHidden={totals.unsoldFragments === 0}
            />
          </View>
          <View className="items-end gap-0.5">
            <Text testID="stats-hunt-breakdown" className="text-11 text-text-muted" style={TABULAR_NUMS}>
              {breakdownOf(totals)}
            </Text>
            <Text testID="stats-hunt-total" className="text-lg font-bold text-rise-ink" style={TABULAR_NUMS}>
              {formatMesoCompact(totals.totalMeso)}
              <Text className={unit}> 메소</Text>
            </Text>
          </View>
        </View>
        {!totals.recorded && (
          <View className="absolute inset-0 items-center justify-center">
            <Text className="text-xs text-text-muted">이 기간에 사냥 기록이 없어요</Text>
          </View>
        )}
      </View>
    </StatsSection>
  )
}
