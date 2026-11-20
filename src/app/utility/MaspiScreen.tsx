/**
 * MASPI 목록 화면. 위에 MASPI 카드, 그 아래 장비 · 소비 세그먼트와 아이템 줄이다. 줄을 누르면 상세 화면이 열린다.
 *
 * 장비는 일반 거래권의 신뢰 시세만 보여 고르는 것이 없다. 소비는 월드마다 따로라 세그먼트 줄 오른쪽에 월드 고르개가 선다.
 * 고르개의 처음 값은 앱의 대표 캐릭터의 월드이고, 고른 월드는 기억하지 않는다. 값은 서버가 하루 한 번 낸 전날 것이라
 * 머리 아래 줄에 값의 날짜를 적는다.
 */
import { useMemo, useState } from 'react'
import { View } from 'react-native'

import { Badge, ChartLineIcon, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { FaqButton } from '../../components/organisms/FaqSheet/FaqButton'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { Segment } from '../../components/molecules/Segment/Segment'
import { WidgetSelect } from '../../components/organisms/WidgetSelect/WidgetSelect'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { byPriceDesc, initialWorldKey, openWorlds } from '../../features/market/catalog'
import { formatBasisDate } from '../../features/market/format'
import { useMarketItems, useMaspi } from '../../features/market/query'
import { useRepresentativeWorldKey } from '../../features/market/representative'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { worldEmblemUrl } from '../../lib/assets/asset-lookup'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { MarketRow } from './maspi/MarketRow'
import { MaspiCard } from './maspi/MaspiCard'
import { MASPI_TOOL_NAME } from './tool-names'

const KINDS = ['장비', '소비'] as const
type Kind = (typeof KINDS)[number]

/** 장비 시세는 일반 거래권 하나라 서버가 월드를 보지 않는다. 상세 쿼리가 월드마다 갈리지 않게 이 값으로 부른다. */
const EQUIPMENT_SCOPE = 'general'

/**
 * 월드 목록의 최대 높이. 줄 38(위아래 9 · 글자 20)로 여섯 줄 반과 위 여백 6 이다.
 * 반 줄이 잘려 보여야 아래에 월드가 더 있다는 것이 드러난다.
 */
const WORLD_LIST_MAX_HEIGHT = 6 + 38 * 6.5

/** 고른 목록에 신뢰 시세가 없을 때의 글자. 지금은 에오스 · 핼리오스가 그렇다 */
export const MARKET_EMPTY_TITLE = '신뢰 범위의 데이터가 수집되지 않았습니다'

export function MaspiScreen(): React.JSX.Element {
  const navigation = useScreenNavigation()
  const faq = useFaqSheet('utility-maspi')
  const maspi = useMaspi()
  const [kind, setKind] = useState<Kind>('장비')
  const worlds = useMemo(() => openWorlds(getCurrentKstDateKey(new Date())), [])
  const representativeWorld = useRepresentativeWorldKey()
  const [pickedWorld, setPickedWorld] = useState<string | null>(null)
  // 고르기 전에는 대표 캐릭터의 프로필이 늦게 와도 따라간다.
  const world = pickedWorld ?? initialWorldKey(worlds, representativeWorld)
  const market = useMarketItems(world)
  const entries = useMemo(() => {
    if (market === undefined) return undefined
    return (kind === '장비' ? (market?.equipment ?? []) : (market?.consumable.items ?? [])).slice().sort(byPriceDesc)
  }, [market, kind])

  return (
    <ScreenScroll
      hasTabBar={false}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2" freshnessLabel={formatBasisDate(market?.date ?? maspi?.date ?? null)}>
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
      <View className="gap-3 px-4 pb-4" testID="screen-UtilityMaspi">
        <MaspiCard maspi={maspi} />

        <View className="flex-row items-center justify-between px-0.5">
          <Segment options={KINDS} selected={kind} onSelect={setKind} size="md" />
          {kind === '소비' && world !== null && (
            <WidgetSelect
              label="월드"
              testID="maspi-world"
              options={worlds.map((entry) => ({ value: entry.key, label: entry.name, icon: worldEmblemUrl(entry.key) }))}
              selected={world}
              onSelect={setPickedWorld}
              onPage
              listMaxHeight={WORLD_LIST_MAX_HEIGHT}
            />
          )}
        </View>

        {entries === undefined ? (
          <LoadingState message="불러오고 있어요" />
        ) : entries.length === 0 ? (
          <EmptyState icon={ChartLineIcon} title={MARKET_EMPTY_TITLE} />
        ) : (
          <View className="gap-1.5">
            {entries.map((entry) => (
              <MarketRow
                key={`${entry.itemKey}-${entry.ringLevel ?? ''}`}
                entry={entry}
                onPress={() =>
                  navigation.navigate('UtilityMaspiItem', {
                    itemKey: entry.itemKey,
                    ringLevel: entry.ringLevel,
                    world: kind === '장비' ? EQUIPMENT_SCOPE : (world ?? EQUIPMENT_SCOPE),
                  })
                }
              />
            ))}
          </View>
        )}
      </View>
    </ScreenScroll>
  )
}
