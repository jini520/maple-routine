/**
 * 아이템 가격 입력 화면. 한 기간의 드롭에 판매가를 매기는 하위 스택 화면.
 *
 * 드롭 히스토리와 형제이고 같은 셸을 쓴다. 축이 다르다. 히스토리는 전 기간을 한 목록에 펼치는 읽기
 * 전용이고 여기는 한 기간을 놓고 값을 매기는 쓰기 화면이다.
 *
 * 뼈대는 기간 → 캐릭터 → 기록이다. 캐릭터로 한 번 묶는 것은 가격이 기록 단위라서다. 같은 아이템도
 * 캐릭터마다 판 값이 다를 수 있고 그 차이가 곧 캐릭터별 수익의 차이가 된다.
 *
 * **보스 수익에서 보던 기간을 주기까지 통째로 이어받는다.** 주 단위로만 열면 월간 보스 드롭에 닿을
 * 길이 없다. 그 기록의 `period_key` 가 `YYYY-MM` 이라 어느 주차 조회에도 안 걸린다.
 *
 * **미입력은 0원이 아니다.** 상태 pill 이 색이 아니라 형태로 가르고(채움 · 회색 · 점선) 미입력 행의
 * 금액 자리는 비운다.
 *
 * @see docs/features/boss-profit.md 정책
 */
import { useEffect, useState } from 'react'
import { Image, Pressable, View } from 'react-native'

import { useBossProfitStore } from '../../features/boss-profit/store'
import {
  useDropPriceStore,
  type DropPriceEntry,
  type DropPriceGroup,
} from '../../features/boss-profit/drop-price-store'
import { useToastStore } from '../../features/toast/store'
import { DEFAULT_MAX_PARTY_SIZE, findPriceEntry } from '../../lib/boss/boss-crystal-prices'
import { formatMesoShort } from '../../lib/boss/boss-profit-delta'
import {
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  isEarliestNavigablePeriod,
  isLatestPeriod,
} from '../../lib/boss/boss-profit-period'
import { dropPayoutMeso } from '../../lib/drop/drop-price'
import { getItemIconUrl } from '../../lib/assets/asset-lookup'
import type { RecordedDrop } from '../../types/drops'

import {
  Badge,
  ChevronLeftIcon,
  ChevronRightIcon,
  PackageOpenIcon,
  ProfitIcon,
  Text,
} from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { tapFeedback } from '../../native/haptics'
import { useTopSafeAreaPx } from '../../lib/safe-area'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { CharacterAvatar } from '../../components/molecules/CharacterAvatar/CharacterAvatar'
import { PORTRAIT_COMPACT } from '../../components/organisms/CharacterPortrait/portrait-metrics'
import { DropPricePad } from './DropPricePad'

function characterTotal(group: DropPriceGroup): number {
  return group.entries.reduce((sum, entry) => sum + dropPayoutMeso(entry.drop), 0)
}

/**
 * 상태 pill. 세 상태를 색이 아니라 형태로 가른다(채움 / 회색 / 점선).
 *
 * 미입력 자리에 `0` 을 쓰지 않는다. `entered` 가 아니면 금액을 아예 그리지 않고 `입력`·
 * `기록 안함` 이라는 말이 선다. 값을 모르는 것과 0원인 것은 다른 사실이다.
 */
function PriceStatePill(props: { drop: RecordedDrop }): React.JSX.Element {
  const { drop } = props
  // 칩 안에서는 접는다. 10자리 원시 표기가 들어가면 금액이 행을 밀어낸다(`formatMesoShort` 의 존재 이유).
  if (drop.priceState === 'entered') {
    return (
      <View className="h-[26px] shrink-0 justify-center rounded-full bg-primary-tint px-2.5">
        <Text className="text-[12.5px] font-bold text-primary-ink" style={TABULAR_NUMS}>
          {formatMesoShort(drop.priceMeso ?? 0)}
        </Text>
      </View>
    )
  }
  if (drop.priceState === 'excluded') {
    return (
      <View className="h-[26px] shrink-0 justify-center rounded-full bg-surface-2 px-2.5">
        <Text className="text-[12.5px] font-semibold text-text-disabled">기록 안함</Text>
      </View>
    )
  }
  return (
    <View className="h-[26px] shrink-0 justify-center rounded-full border border-dashed border-border px-2.5">
      <Text className="text-[12.5px] font-semibold text-text-disabled">입력</Text>
    </View>
  )
}

function EntryRow(props: {
  entry: DropPriceEntry
  isLast: boolean
  onSelect: () => void
}): React.JSX.Element {
  const { drop } = props.entry
  const iconUrl = getItemIconUrl(drop.itemName, drop.slot)
  // 상자명(`boxOrigin`)은 쓰지 않는다. 반지 상자·칠흑 장신구 상자는 이름이 길어 실제 정보인
  // 아이템명과 보스를 밀어낸다. 무엇을 열었는지는 히스토리가 말한다.
  //
  // 인원은 값을 매긴 기록에만 붙는다. 미입력에 `1인` 이 서면 이미 정해진 값처럼 읽힌다.
  const shareLabel = drop.priceState === 'entered' ? ` · ${drop.priceShare ?? 1}인` : ''

  return (
    // RN 에 `:last-child` 가 없어 목록을 아는 부모가 알려 준다. 테두리를 아예 빼지 않고 색만
    // 지우는 것이 요점이다.
    <View>
      {/* 행 전체가 버튼이다. 입력이든 수정이든 같은 자리를 누른다. */}
      <Pressable
        role="button"
        onPress={props.onSelect}
        aria-label={`${drop.itemName} 가격 입력`}
        className={`flex-row items-center gap-3 border-b p-4 ${
          props.isLast ? 'border-b-transparent' : 'border-border'
        }`}
      >
        {iconUrl !== null ? (
          <Image source={iconUrl} resizeMode="contain" className="h-8 w-8 shrink-0" />
        ) : (
          <View className="h-8 w-8 shrink-0 rounded-md border border-border bg-surface-2" />
        )}
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text numberOfLines={1} className="shrink text-[13.5px] font-semibold text-text">
              {drop.itemName}
              {drop.ringLevel !== undefined && ` ${drop.ringLevel}레벨`}
            </Text>
            {drop.quantity > 1 && (
              <Text className="shrink-0 text-11 text-text-muted" style={TABULAR_NUMS}>
                ×{drop.quantity}
              </Text>
            )}
          </View>
          <View className="mt-1 flex-row items-center gap-1.5">
            <Badge variant={props.entry.difficulty}>
              {props.entry.difficulty}
            </Badge>
            <Text numberOfLines={1} className="shrink text-11 text-text-muted">
              {props.entry.boss}
              {shareLabel}
            </Text>
          </View>
        </View>
        <PriceStatePill drop={drop} />
      </Pressable>
    </View>
  )
}

export function DropPriceScreen(): React.JSX.Element {
  const navigation = useScreenNavigation()
  const topSafeAreaPx = useTopSafeAreaPx()
  const { tab, periodKey: profitPeriodKey } = useBossProfitStore()
  const { status, periodKey: readPeriodKey, groups, load, savePrice, excludePrice } = useDropPriceStore()

  // 화면이 한 번만 만든 지금. 두 번 부르면 기간 경계를 사이에 두고 갈릴 수 있다.
  const [now] = useState(() => new Date())
  const [cycle] = useState(tab)
  const [week, setWeek] = useState(profitPeriodKey)
  const [pricing, setPricing] = useState<DropPriceEntry | null>(null)
  // 순차 모드에서 남은 미입력 건. 비어 있으면 단건 편집이다.
  const [queue, setQueue] = useState<DropPriceEntry[]>([])

  useEffect(() => {
    void load(week)
  }, [load, week])

  const allEntries = groups.flatMap((group) => group.entries)
  const total = allEntries.reduce((sum, entry) => sum + dropPayoutMeso(entry.drop), 0)
  const entered = allEntries.filter((entry) => entry.drop.priceState === 'entered').length
  const excluded = allEntries.filter((entry) => entry.drop.priceState === 'excluded').length
  const unpriced = allEntries.length - entered - excluded
  const periodLabel = formatBossProfitPeriodLabel(cycle, week, now)
  /**
   * **이 기간을 읽었나.** `status` 만 보면 지난번 기간의 `ready` 를 이번 기간의 사실로 읽는다.
   *
   * 이 스토어는 화면을 떠나도 살아 있고 읽기를 거는 효과는 첫 렌더 뒤에 도므로, 안 가르면
   * 기록이 있는데도 `기록된 아이템이 없습니다` 가 한 프레임 번쩍인다.
   */
  const readThisPeriod = status === 'ready' && readPeriodKey === week

  // 미입력만 골라 순차로 돈다. 첫 건을 열고 나머지는 큐에 쌓아 저장·스킵마다 하나씩 꺼낸다.
  function startSequence(): void {
    const [first, ...rest] = allEntries.filter((entry) => entry.drop.priceState === undefined)
    if (first === undefined) return
    setQueue(rest)
    setPricing(first)
  }

  /** 저장·스킵 뒤 다음 행동. 순차 모드면 다음 건, 아니면 닫는다. */
  function advance(): void {
    const [next, ...rest] = queue
    setQueue(rest)
    setPricing(next ?? null)
  }

  async function runWrite(write: () => Promise<void>): Promise<void> {
    try {
      await write()
      advance()
    } catch {
      // 조용히 삼키면 저장된 줄 알고 화면을 떠난다(예외 원문 대신 토스트).
      useToastStore.getState().showError('가격을 저장하지 못했습니다')
    }
  }

  return (
    <>
      <ScreenScroll
        hasTabBar={false}
        header={
          // 히스토리 화면과 같은 헤더 레시피. 공용 `PageHeader` 를 쓰지 않는 이유도 같다
          // (배경 조각도 하단 페이드도 없는 서브 화면이다). 상단 여백을 안 더하는 것도, 그
          // 안전영역을 `useTopSafeAreaPx()` 로 받는 것도 같다.
          <View testID="page-header" className="z-10 px-4" style={{ paddingTop: topSafeAreaPx }}>
            <PageHeaderTitleRow className="gap-1">
              <BackButton size="regular" onPress={() => navigation.goBack()} />
              <Text className="text-lg font-semibold text-text">아이템 가격 입력</Text>
            </PageHeaderTitleRow>
          </View>
        }
      >
        {/* `screen-<라우트 이름>` 은 내비게이션 테스트가 그 라우트로 밀면 그 화면이 열리는가 를
            묻는 이름이다. */}
        <View testID="screen-DropPrice" className="gap-4 px-4 pb-6">
          {/* 기간 네비게이터. 보스 수익 화면의 것을 그대로 옮겼다(같은 h-7 원형 버튼 + 가운데
              2줄 라벨). 이 화면은 그 화면에서 보던 기간을 이어받아 열리므로 넘기는 손짓도
              같아야 한다. */}
          <View className="flex-row items-center justify-center gap-4">
            <Pressable
              role="button"
              // 화면은 그대로여도 보는 기간이 바뀐다. 꺼진 화살표는 누름 자체가 안 들어와 조용하다.
              onPress={() => {
                tapFeedback()
                setWeek(getAdjacentPeriodKey(cycle, week, 'prev'))
              }}
              disabled={isEarliestNavigablePeriod(cycle, week)}
              aria-label="이전 기간"
              className={`h-7 w-7 items-center justify-center rounded-full border border-border${
                isEarliestNavigablePeriod(cycle, week) ? ' opacity-30' : ''
              }`}
            >
              <ChevronLeftIcon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
            </Pressable>

            <View>
              <Text className="text-center text-sm font-semibold text-text">{periodLabel.primary}</Text>
              <Text className="mt-0.5 text-center text-xs text-text-muted" style={TABULAR_NUMS}>
                {periodLabel.secondary}
              </Text>
            </View>

            <Pressable
              role="button"
              onPress={() => {
                tapFeedback()
                setWeek(getAdjacentPeriodKey(cycle, week, 'next'))
              }}
              disabled={isLatestPeriod(cycle, week, now)}
              aria-label="다음 기간"
              className={`h-7 w-7 items-center justify-center rounded-full border border-border${
                isLatestPeriod(cycle, week, now) ? ' opacity-30' : ''
              }`}
            >
              <ChevronRightIcon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
            </Pressable>
          </View>

          {status === 'failed' ? (
            // 실패를 빈 목록으로 위장하지 않는다.
            <ErrorState
              title="가격 기록을 불러오지 못했습니다"
              description="기기에 저장된 기록을 읽지 못했습니다. 다시 시도해주세요."
              action={{ label: '다시 시도', onClick: () => void load(week) }}
            />
          ) : !readThisPeriod ? (
            <LoadingState size="page" message="불러오고 있어요" />
          ) : allEntries.length === 0 ? (
            <EmptyState
              icon={PackageOpenIcon}
              title={`${cycle === 'weekly' ? '이 주' : '이 달'}에 기록된 아이템이 없습니다`}
              description="보스 수익에서 아이템을 먼저 기록하면 여기서 값을 매길 수 있습니다"
            />
          ) : (
            <>
              {/* 요약은 카드가 아니라 헤드라인이다. 아래가 전부 같은 카드 셸이라 요약도 카드면
                  흰 카드의 반복으로 묻힌다. */}
              <View>
                <View className="h-6 flex-row items-center">
                  <Text className="text-xs font-semibold tracking-wide text-text-muted">
                    {cycle === 'weekly' ? '이 주' : '이 달'} 아이템 수익
                  </Text>
                  {/* 가격을 **입력한** 것만 센다. 기록 안함은 값을 매기지 않기로 한 결정이고,
                      스킵은 아무것도 저장하지 않아 미입력에 머무른다. */}
                  <Text className="ml-auto text-xs text-text-muted" style={TABULAR_NUMS}>
                    {entered}건
                  </Text>
                </View>
                <View className="mt-1.5 flex-row items-center gap-2.5">
                  <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint">
                    <ProfitIcon className="h-[18px] w-[18px] text-primary-ink" strokeWidth={2} aria-hidden />
                  </View>
                  {/* 단위 앞의 실제 공백은 남긴다. 마진만으로 띄우면 읽는 값이 `N메소` 로 붙어
                      스크린리더가 이어 읽는다. */}
                  <Text
                    className="text-xl font-bold text-primary-ink"
                    style={TABULAR_NUMS}
                  >
                    {total.toLocaleString()}{' '}
                    <Text className="text-xs font-bold text-text-muted">메소</Text>
                  </Text>
                </View>
                <View className="mt-3 h-px bg-border" aria-hidden />
              </View>

              {/* CTA 는 요약 **바로 아래**다. 목록 끝에 두면 기록이 열 건만 넘어도 손이 닿지 않는다. */}
              {unpriced > 0 && (
                <Pressable
                  role="button"
                  onPress={startSequence}
                  className="w-full items-center rounded-full bg-primary py-3"
                >
                  <Text className="text-sm font-bold text-on-primary">
                    미입력 {unpriced}건 이어서 입력
                  </Text>
                </Pressable>
              )}

              {groups.map((group) => (
                <View
                  key={group.ocid}
                  className="overflow-hidden rounded-[14px] border border-border bg-surface"
                >
                  {/* 캐릭터 머리. 보스 수익 아코디언 헤더와 같은 짜임(아바타 32 + 이름 + 금액). */}
                  <View className="flex-row items-center gap-3 border-b border-border p-4">
                    <CharacterAvatar
                      imageUrl={group.imageUrl}
                      name={group.characterName}
                      size={PORTRAIT_COMPACT.faceSize}
                      className="shrink-0 bg-surface-2"
                      fallback={
                        <View className="h-full w-full items-center justify-center">
                          <Text className="text-xs font-bold text-text">
                            {group.characterName.charAt(0)}
                          </Text>
                        </View>
                      }
                    />
                    <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-text">
                      {group.characterName}
                    </Text>
                    <Text className="text-sm font-bold text-text" style={TABULAR_NUMS}>
                      {characterTotal(group).toLocaleString()} 메소
                    </Text>
                  </View>
                  <View>
                    {group.entries.map((entry, index) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        isLast={index === group.entries.length - 1}
                        onSelect={() => setPricing(entry)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScreenScroll>

      {/* 시트는 별도 네이티브 호스트에 떠서 갇힐 상자가 없으므로 형제로 둔다. */}
      {pricing !== null && (
        <DropPricePad
          drop={pricing.drop}
          boss={pricing.boss}
          difficulty={pricing.difficulty}
          characterName={groups.find((group) => group.ocid === pricing.ocid)?.characterName ?? ''}
          defaultShare={pricing.partySize}
          maxShare={
            findPriceEntry(pricing.boss, pricing.difficulty)?.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE
          }
          progress={queue.length > 0 ? { current: unpriced - queue.length, total: unpriced } : undefined}
          onSave={(priceMeso, share) => void runWrite(() => savePrice(pricing, priceMeso, share))}
          onExclude={() => void runWrite(() => excludePrice(pricing))}
          // 스킵은 저장하지 않는다. 미입력에 그대로 두고 다음 건으로만 간다(정정).
          onLater={queue.length > 0 ? advance : undefined}
          onClose={() => {
            setQueue([])
            setPricing(null)
          }}
        />
      )}
    </>
  )
}
