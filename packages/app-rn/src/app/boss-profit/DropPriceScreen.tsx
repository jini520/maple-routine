// 가격 기록 화면 — 보스 수익의 하위 스택 화면([[ADR-124]] 결정 8, 이슈 #185).
//
// 히스토리와 형제이고 같은 셸을 쓴다. 축이 다르다 — 히스토리는 **전 기간**을 한 목록에 펼치는
// 읽기 전용이고, 여기는 **한 기간**을 놓고 값을 매기는 쓰기 화면이다.
//
// 뼈대는 기간 → 캐릭터 → 기록이다. 캐릭터로 한 번 묶는 이유는 가격이 기록 단위이기 때문이다 —
// 같은 아이템도 캐릭터마다 판 값이 다를 수 있고, 그 차이가 곧 캐릭터별 수익의 차이가 된다.
//
// **보스 수익에서 보던 기간을 통째로 이어받는다**([[ADR-124]] 결정 8) — 주기까지 함께다. 처음엔 주
// 단위로만 열었는데, 그러면 **월간 보스(검은마법사) 드롭에 닿을 길이 없다**(사용자 보고 2026-08-10):
// 그 기록의 `period_key` 는 `YYYY-MM` 이라 어느 주차 조회에도 안 걸린다.
//
// ══ [[ADR-124]] 가 이 화면에서 가장 직접적으로 드러난다 — **미입력은 0원이 아니다** ═══════
//
// 사용자가 값을 넣는 자리라 세 상태가 눈에 보여야 한다. 상태 pill 은 색이 아니라 **형태**로 가르고
// (채움 / 회색 / 점선), 미입력 행의 금액 자리에는 **`0` 이 아니라 `입력`** 이 선다. 합산 층은
// core 가 이미 지킨다(`dropPayoutMeso` 가 `priceState !== 'entered'` 를 0으로 접는다) — 여기서
// 지키는 것은 **표시**이고, `priceMeso` 는 있는데 `priceState` 가 없는 기록이 가장 강한 반례다
// (`priceMeso ?? 0` 계열로 그리면 거기서 금액이 샌다).
//
// ══ RN 으로 옮기며 갈린 것 넷 ═════════════════════════════════════════════════════
//
// ① **셸·헤더·뒤로가기**는 히스토리와 글자 그대로 같다(그 파일 머리 ①·②·③). 두 형제가 같은
//    제스처에 다르게 반응하면 그 자체가 회귀다.
// ② **키패드가 `overlays` 프롭이 아니라 형제로 선다.** 웹은 `StackScreen` 의 `overlays` 로 넘겨
//    오버레이가 탭 레이어의 `transform` 에 딸려 밀리지 않게 했는데, RN 의 시트는 별도 네이티브
//    호스트에 뜨므로(`BottomSheetModalProvider`) 갇힐 상자가 없다 — 프롭이 통째로 사라진다.
// ③ `<li className="valuable-drop-row">` → **`ValuableRowBackground`**. 웹 `index.css` 의 그 클래스가
//    RN 에서 값 셋으로 갈린 자리이고, 보스 행에 이어 **두 번째 호출부**라 step 8 이 그 컴포넌트를
//    `BossProfitBossRow` 밖으로 꺼냈다([[ADR-094]] 결정 1).
// ④ `<img className="absolute max-w-none" style={avatarFaceCropStyle()}>` → `<Image>` + **같은 절대
//    좌표**. 크롭 값은 한 자리도 안 바뀐다(`CharacterAvatar` 가 먼저 밟은 자리) — 얼굴은 넥슨이
//    주는 원격 주소라 `{ uri }` 로 감싼다.
import { useEffect, useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useBossProfitStore } from '@core/features/boss-profit/store'
import {
  useDropPriceStore,
  type DropPriceEntry,
  type DropPriceGroup,
} from '@core/features/boss-profit/drop-price-store'
import { useToastStore } from '@core/features/toast/store'
import { DEFAULT_MAX_PARTY_SIZE, findPriceEntry } from '@core/lib/boss-crystal-prices'
import { formatMesoShort } from '@core/lib/boss-profit-delta'
import {
  formatBossProfitPeriodLabel,
  getAdjacentPeriodKey,
  isEarliestNavigablePeriod,
  isLatestPeriod,
} from '@core/lib/boss-profit-period'
import { dropPayoutMeso } from '@core/lib/drop-price'
import { getItemIconUrl } from '@core/lib/item-icons'
import { isValuableDrop } from '@core/lib/valuable-drops'
import type { RecordedDrop } from '@core/types/drops'

import { DifficultyBadge } from '../../components/atoms/DifficultyBadge/DifficultyBadge'
import { ProfitIcon } from '../../components/atoms/ProfitIcon/ProfitIcon'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { ErrorState } from '../../components/molecules/ErrorState/ErrorState'
import { LoadingState } from '../../components/molecules/LoadingState/LoadingState'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, PackageOpenIcon } from '../../lib/icons'
import { TABULAR_NUMS } from '../../lib/text-styles'
import { useScreenNavigation } from '../use-screen-navigation'
import { avatarFaceCropStyle } from './CharacterAvatar'
import { DropPricePad } from './DropPricePad'
import { ValuableRowBackground } from './ValuableRowBackground'

/** 웹 `pt-[calc(1rem+var(--sa-top))]` 의 상수 몫 — 히스토리 화면과 같은 값이다. */
const HEADER_TOP_PADDING_PX = 16

function characterTotal(group: DropPriceGroup): number {
  return group.entries.reduce((sum, entry) => sum + dropPayoutMeso(entry.drop), 0)
}

/**
 * 상태 pill — 세 상태를 색이 아니라 **형태**로 가른다(채움 / 회색 / 점선).
 *
 * **미입력 자리에 `0` 을 쓰지 않는다**([[ADR-124]]). `entered` 가 아니면 금액을 아예 그리지 않고
 * `입력`·`기록 안함` 이라는 말이 선다 — 값을 모르는 것과 0원인 것은 다른 사실이다.
 */
function PriceStatePill(props: { drop: RecordedDrop }): React.JSX.Element {
  const { drop } = props
  // 칩 안에서는 접는다 — 10자리 원시 표기가 들어가면 금액이 행을 밀어낸다(`formatMesoShort` 의 존재 이유).
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
  // 상자명(`boxOrigin`)은 쓰지 않는다(2026-08-10 사용자 지정) — 반지 상자·칠흑 장신구 상자는
  // 이름이 길어 실제 정보인 아이템명과 보스를 밀어낸다. 무엇을 열었는지는 히스토리가 말한다.
  //
  // **인원은 값을 매긴 기록에만 붙는다** — 미입력에 `1인` 이 서면 이미 정해진 값처럼 읽힌다.
  const shareLabel = drop.priceState === 'entered' ? ` · ${drop.priceShare ?? 1}인` : ''

  return (
    // 웹의 `last:border-b-transparent` 자리 — RN 에는 `:last-child` 가 없어 목록을 아는 부모가
    // 알려 준다. 테두리를 아예 빼지 않고 **색만 지우는** 것이 요점이다([[ADR-049]] 와 같은 규칙).
    <View>
      {isValuableDrop(drop.itemName) && <ValuableRowBackground />}
      {/* 행 전체가 버튼이다 — 입력이든 수정이든 같은 자리를 누른다([[ADR-124]] 결정 5). */}
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
              <Text className="shrink-0 text-[11px] text-text-muted" style={TABULAR_NUMS}>
                ×{drop.quantity}
              </Text>
            )}
          </View>
          <View className="mt-1 flex-row items-center gap-1.5">
            <DifficultyBadge difficulty={props.entry.difficulty} />
            <Text numberOfLines={1} className="shrink text-[11px] text-text-muted">
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
  const insets = useSafeAreaInsets()
  const { tab, periodKey: profitPeriodKey } = useBossProfitStore()
  const { status, groups, load, savePrice, excludePrice } = useDropPriceStore()

  // 화면이 한 번만 만든 '지금' — 두 번 부르면 기간 경계를 사이에 두고 갈릴 수 있다
  // (보스 수익 화면과 같은 규약).
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

  // 미입력만 골라 순차로 돈다. 첫 건을 열고 나머지는 큐에 쌓아 저장·스킵마다 하나씩 꺼낸다.
  function startSequence(): void {
    const [first, ...rest] = allEntries.filter((entry) => entry.drop.priceState === undefined)
    if (first === undefined) return
    setQueue(rest)
    setPricing(first)
  }

  /** 저장·스킵 뒤 다음 행동 — 순차 모드면 다음 건, 아니면 닫는다. */
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
      // 조용히 삼키면 저장된 줄 알고 화면을 떠난다([[ADR-063]] — 예외 원문 대신 토스트).
      useToastStore.getState().showError('가격을 저장하지 못했습니다')
    }
  }

  return (
    <>
      <ScreenScroll
        hasTabBar={false}
        header={
          // 히스토리 화면과 같은 헤더 레시피 — 공용 `PageHeader` 를 쓰지 않는 이유도 같다
          // (배경 조각도 하단 페이드도 없는 서브 화면이다).
          <View
            testID="page-header"
            className="z-10 px-4 pb-2"
            style={{ paddingTop: insets.top + HEADER_TOP_PADDING_PX }}
          >
            <View className="flex-row items-center gap-1">
              <Pressable
                role="button"
                onPress={() => navigation.goBack()}
                aria-label="뒤로"
                className="-ml-2 h-9 w-9 items-center justify-center"
              >
                <ArrowLeftIcon className="h-5 w-5 text-text" strokeWidth={2} aria-hidden />
              </Pressable>
              <Text className="text-lg font-semibold text-text">가격 기록</Text>
            </View>
          </View>
        }
      >
        {/* `screen-<라우트 이름>` 은 자리표시자에게서 그대로 물려받은 계약이다 — 내비게이션
            테스트가 "그 라우트로 밀면 그 화면이 열리는가"를 이 이름으로 묻는다. */}
        <View testID="screen-DropPrice" className="gap-4 px-4 pb-6">
          {/* 기간 네비게이터 — **보스 수익 화면의 것을 그대로 옮겼다**(같은 h-7 원형 버튼 + 가운데
              2줄 라벨). 이 화면은 그 화면에서 보던 기간을 이어받아 열리므로 넘기는 손짓도 같아야 한다. */}
          <View className="flex-row items-center justify-center gap-4">
            <Pressable
              role="button"
              onPress={() => setWeek(getAdjacentPeriodKey(cycle, week, 'prev'))}
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
              onPress={() => setWeek(getAdjacentPeriodKey(cycle, week, 'next'))}
              disabled={isLatestPeriod(cycle, week, now)}
              aria-label="다음 기간"
              className={`h-7 w-7 items-center justify-center rounded-full border border-border${
                isLatestPeriod(cycle, week, now) ? ' opacity-30' : ''
              }`}
            >
              <ChevronRightIcon className="h-4 w-4 text-text" strokeWidth={2} aria-hidden />
            </Pressable>
          </View>

          {status === 'loading' || status === 'idle' ? (
            <LoadingState size="page" message="불러오고 있어요" />
          ) : status === 'failed' ? (
            // 실패를 빈 목록으로 위장하지 않는다([[ADR-062]]).
            <ErrorState
              title="가격 기록을 불러오지 못했습니다"
              description="기기에 저장된 기록을 읽지 못했습니다. 다시 시도해주세요."
              action={{ label: '다시 시도', onClick: () => void load(week) }}
            />
          ) : allEntries.length === 0 ? (
            <EmptyState
              icon={PackageOpenIcon}
              title={`${cycle === 'weekly' ? '이 주' : '이 달'}에 기록된 아이템이 없습니다`}
              description="보스 수익에서 아이템을 먼저 기록하면 여기서 값을 매길 수 있습니다"
            />
          ) : (
            <>
              {/* 요약은 **카드가 아니라 헤드라인**이다(B안 채택 2026-08-10) — [[ADR-046]] 이 보스
                  수익 총 수익에 내린 판단이 이 화면에도 그대로 성립한다: 아래가 전부 같은 카드
                  셸이라 요약도 카드면 "흰 카드의 반복"으로 묻힌다.

                  아래 칩 셋은 **목록의 범례**다 — 생김새가 행의 상태 pill 과 같아(채움 / 회색 /
                  점선) 칩만 봐도 무엇이 몇 개인지 읽힌다. 0인 상태는 칩을 만들지 않는다. */}
              <View>
                <View className="h-6 flex-row items-center">
                  <Text className="text-xs font-semibold tracking-wide text-text-muted">
                    {cycle === 'weekly' ? '이 주' : '이 달'} 아이템 수익
                  </Text>
                  <Text className="ml-auto text-xs text-text-muted" style={TABULAR_NUMS}>
                    {entered + excluded} / {allEntries.length} 정함
                  </Text>
                </View>
                <View className="mt-1.5 flex-row items-center gap-2.5">
                  <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint">
                    <ProfitIcon className="h-[18px] w-[18px] text-primary-ink" strokeWidth={2} aria-hidden />
                  </View>
                  {/* 단위 앞의 실제 공백은 남긴다 — 마진만으로 띄우면 읽는 값이 "N메소"로 붙어
                      스크린리더가 이어 읽는다([[ADR-046]] 규약). */}
                  <Text
                    className="text-xl font-extrabold leading-none text-primary-ink"
                    style={TABULAR_NUMS}
                  >
                    {total.toLocaleString()}{' '}
                    <Text className="text-xs font-bold text-text-muted">메소</Text>
                  </Text>
                </View>
                <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
                  {entered > 0 && (
                    <View className="h-6 justify-center rounded-full bg-primary-tint px-2.5">
                      <Text className="text-xs font-bold text-primary-ink" style={TABULAR_NUMS}>
                        입력 {entered}
                      </Text>
                    </View>
                  )}
                  {excluded > 0 && (
                    <View className="h-6 justify-center rounded-full bg-surface-2 px-2.5">
                      <Text className="text-xs font-semibold text-text-disabled" style={TABULAR_NUMS}>
                        기록 안함 {excluded}
                      </Text>
                    </View>
                  )}
                  {unpriced > 0 && (
                    <View className="h-6 justify-center rounded-full border border-dashed border-border px-2.5">
                      <Text className="text-xs font-semibold text-text-disabled" style={TABULAR_NUMS}>
                        미입력 {unpriced}
                      </Text>
                    </View>
                  )}
                  {unpriced === 0 && (
                    <Text className="text-xs font-semibold text-text-muted">
                      {cycle === 'weekly' ? '이 주는' : '이 달은'} 다 정했습니다
                    </Text>
                  )}
                </View>
                <View className="mt-3 h-px bg-border" aria-hidden />
              </View>

              {/* CTA 는 요약 **바로 아래**다 — 목록 끝에 두면 기록이 열 건만 넘어도 손이 닿지 않는다. */}
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
                  {/* 캐릭터 머리 — 보스 수익 아코디언 헤더와 같은 짜임(아바타 32 + 이름 + 금액). */}
                  <View className="flex-row items-center gap-3 border-b border-border p-4">
                    <View className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-surface-2">
                      {group.imageUrl !== null ? (
                        <Image
                          // 얼굴은 넥슨이 주는 **원격 주소**라 `{ uri }` 로 감싼다(번들 에셋은 반대로
                          // 감싸면 안 뜬다 — `CharacterTrackingGrid` 가 적어 둔 함정).
                          source={{ uri: group.imageUrl }}
                          style={avatarFaceCropStyle()}
                        />
                      ) : (
                        <View className="h-full w-full items-center justify-center">
                          <Text className="text-xs font-bold text-text">
                            {group.characterName.charAt(0)}
                          </Text>
                        </View>
                      )}
                    </View>
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

      {/* 웹의 `StackScreen overlays` 자리(파일 머리 ②) — RN 시트는 별도 네이티브 호스트에 떠서
          갇힐 상자가 없으므로 형제로 둔다. */}
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
          // 스킵은 저장하지 않는다 — 미입력에 그대로 두고 다음 건으로만 간다([[ADR-124]] 결정 6 정정).
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
