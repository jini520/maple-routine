/**
 * MASPI 상세 화면. 카드 밖 위에 아이템 그림 · 이름 · 큰 기준가 · 전일 대비 칩, 그 아래 그래프 카드와 범위 · 거래 칸이다.
 *
 * 서버가 최대 1년의 날마다 값을 주고 앱은 고른 기간만큼 마지막 날부터 잘라 그린다. 범위는 마지막 날의 25% ~ 75% 지점이고
 * 그래프에서는 띠로도 보인다. 거래 수는 숫자 대신 많음 · 보통 · 적음이다.
 */
import { useState } from 'react'
import { View } from 'react-native'

import { Badge, ChartLineIcon, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { FaqButton } from '../../components/organisms/FaqSheet/FaqButton'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { InsetRow } from '../../components/molecules/InsetRow/InsetRow'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { Segment } from '../../components/molecules/Segment/Segment'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { marketItemFace } from '../../features/market/catalog'
import {
  formatBasisDate,
  formatChangePct,
  formatMarketRange,
  MARKET_PERIODS,
  sliceSeries,
  toneOf,
  type MarketPeriod,
} from '../../features/market/format'
import { useMarketItem } from '../../features/market/query'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { formatMesoUnits } from '../../lib/drop/drop-price'
import type { MarketItemParams } from '../../navigation/routes'
import type { MarketGrade } from '../../server/market'
import { MarketChart } from './maspi/MarketChart'
import { MarketItemIcon } from './maspi/MarketRow'
import { TONE_BADGE } from './maspi/tone'
import { MASPI_TOOL_NAME } from './tool-names'
import { MARKET_EMPTY_TITLE } from './MaspiScreen'

const GRADE_LABEL: Readonly<Record<MarketGrade, string>> = { many: '많음', normal: '보통', few: '적음' }

export function MaspiItemScreen(props: { route?: { params?: Partial<MarketItemParams> } }): React.JSX.Element {
  const navigation = useScreenNavigation()
  // 목록과 제목이 같은 화면이라 FAQ 묶음도 목록과 같이 쓴다.
  const faq = useFaqSheet('utility-maspi')
  const params = props.route?.params
  // 목록의 줄만 이 화면을 열어 값이 늘 있다. 스택이 파라미터 없이 되살린 경우에는 빈 key 로 불러 빈 상태가 선다.
  const target: MarketItemParams = { itemKey: params?.itemKey ?? '', ringLevel: params?.ringLevel ?? null, world: params?.world ?? 'general' }
  const market = useMarketItem(target)
  const [period, setPeriod] = useState<MarketPeriod>('30일')
  const face = marketItemFace(target.itemKey, target.ringLevel)

  return (
    <ScreenScroll
      hasTabBar={false}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2" freshnessLabel={formatBasisDate(market?.date ?? null)}>
            <BackButton onPress={() => navigation.goBack()} />
            <View className="flex-row items-center">
              <Text className="text-lg font-bold text-text">{MASPI_TOOL_NAME}</Text>
              <Badge variant="primary" className="ml-1.5">
                beta
              </Badge>
              <FaqButton sheet={faq} />
            </View>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      <View className="gap-3.5 px-4 pb-4" testID="screen-UtilityMaspiItem">
        <View className="gap-1.5 px-0.5 pt-1">
          <View className="flex-row items-center gap-2">
            <MarketItemIcon iconAssetId={face.iconAssetId} />
            <Text className="min-w-0 flex-1 text-base font-bold text-text">{face.name}</Text>
          </View>
          {market !== undefined && market !== null && (
            <>
              <Text testID="maspi-item-price" className="text-2xl font-bold text-text" style={TABULAR_NUMS}>
                {formatMesoUnits(market.price)}
              </Text>
              <View className="flex-row">
                <Badge variant={TONE_BADGE[toneOf(market.changePct)]}>{`전일 대비 ${formatChangePct(market.changePct)}`}</Badge>
              </View>
            </>
          )}
        </View>

        {market === undefined ? (
          <LoadingState message="불러오고 있어요" />
        ) : market === null ? (
          <EmptyState icon={ChartLineIcon} title={MARKET_EMPTY_TITLE} />
        ) : (
          <>
            <View className="gap-2.5 rounded-[14px] bg-surface p-3.5">
              <Segment options={MARKET_PERIODS} selected={period} onSelect={setPeriod} size="md" fill />
              <MarketChart series={sliceSeries(market.series, period)} />
            </View>
            <View className="gap-1 rounded-[14px] bg-surface p-1.5">
              <InsetRow label="범위" value={formatMarketRange(market.low, market.high)} />
              <InsetRow label="거래" value={GRADE_LABEL[market.grade]} />
            </View>
          </>
        )}
      </View>
    </ScreenScroll>
  )
}
