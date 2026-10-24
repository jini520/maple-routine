/**
 * 총 수익 카드의 결정석 판매 칸. 월드별로 집계한다.
 */
import { Image, Pressable, View, useWindowDimensions } from 'react-native'

import { getItemIconUrlByFile, worldEmblemUrl } from '../../lib/assets/asset-lookup'
import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../lib/boss/boss-matching'
import type { MonthlyCrystalsByWorld } from '../../features/boss-profit/monthly-crystals'

import { ChevronDownIcon, ChevronUpIcon, Text } from '../../components/atoms'
import { PopoverLayer } from '../../components/molecules/Popover/Popover'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { summarizeWorldCrystals } from './character-groups'
import type { CharacterGroup } from './character-groups'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'
import { usePopoverPlacement } from '../../hooks/usePopoverPlacement'

/** 칩 밑변과 상자 윗변 사이. 흐름 안에 있던 시절의 `mt-1.5` 를 그대로 옮긴 값. */
const BREAKDOWN_GAP = 6
/** 상자 오른쪽 변과 화면 끝 사이에 남길 최소 여백. */
const BREAKDOWN_EDGE_GAP = 12

// 결정석 아이콘(주간/월간). 드롭 표 항목이 아니라 UI 표시 전용이라 `drop-items.json` 에
// 등록하지 않고 파일명으로 직접 조회한다. 파일이 없으면 null. 아이콘만 생략하고 숫자는 그대로 둔다.
export const WEEKLY_CRYSTAL_ICON_URL = getItemIconUrlByFile('intense_power_crystal_weekly.webp')
export const MONTHLY_CRYSTAL_ICON_URL = getItemIconUrlByFile('intense_power_crystal_monthly.webp')

// 총 수익 카드 셋째 줄의 결정석 칸. 주간 90 한도 대비 주간 몫과 그 주에 잡은 월간 보스의 월간 몫을 칸 둘로 나눠 적는다.
// 월간 몫은 한도가 없어 분모 없이 개수만 적고, 안 잡은 주에도 `0개` 로 선다.
//
// 월드별 분해는 흐름이 아니라 별도 네이티브 창의 팝오버로 띄운다. 펼쳐도 카드 높이가 변하지 않는다.
//
// 월간 탭은 `variant="monthly"` 로 **월간 몫만** 싣는다. 주간 90 은 주마다의 한도라 한 달의 합에는 뜻이
// 없다. 주간 탭의 월간 몫은 화면이 기록에서 센 **그 주까지의 그 달 누적**(`monthlyByWorld`)이다.
export function CrystalSummaryChip(props: {
  groups: CharacterGroup[]
  variant?: 'weekly' | 'monthly'
  /** 월드별 그 달 누적. 오면 행으로 센 월간 몫을 대신한다. */
  monthlyByWorld?: MonthlyCrystalsByWorld
}): React.JSX.Element | null {
  const monthlyOnly = props.variant === 'monthly'
  // 구조 분해가 필수다. `popover.toggle` 처럼 프로퍼티로 읽으면 `react-hooks/refs` 가 그 접근을
  // 렌더 중 ref 접근으로 본다. 훅이 안에서 `useRef` 를 쓴다.
  const {
    ref: chipRef,
    isOpen: isBreakdownOpen,
    anchor,
    toggle: toggleBreakdown,
    close: closeBreakdown,
  } = useAnchoredPopover()
  const { width: windowWidth } = useWindowDimensions()
  const placement = usePopoverPlacement(anchor, BREAKDOWN_GAP)

  const worlds = summarizeWorldCrystals(props.groups, props.monthlyByWorld)
  // 월드를 아는 캐릭터가 하나도 없으면(구버전 캐시만 있는 경우) 대비할 한도가 없다. 반대로 월드는
  // 알지만 처치 수가 0 이면 `0 / 90` 을 그대로 보여준다. 정보로서 유효하다.
  if (worlds.length === 0) return null

  const cleared = worlds.reduce((sum, summary) => sum + summary.cleared, 0)
  // 월간 수도 월드별 줄의 합이다. 칩과 펼친 줄이 같은 수를 말하고, 월드를 모르는 행은 둘 다에서 빠진다.
  const monthlyCleared = worlds.reduce((sum, summary) => sum + summary.monthlyCleared, 0)
  // 각 월드가 각자 90 을 가지므로 복수 월드의 분모는 90 × 월드 수다.
  const limit = WEEKLY_CRYSTAL_SALE_LIMIT * worlds.length
  const isExpandable = worlds.length > 1
  const label = monthlyOnly
    ? `월간 결정석 ${monthlyCleared}개`
    : `주간 결정석 판매 ${cleared} / ${limit}, 월간 결정석 ${monthlyCleared}개`

  // 칸은 간단히만. 월드 수 · 월드명 같은 부가 표기는 팝오버로 넘긴다. 숫자와 단위 사이는 마진이 아니라 실제
  // 공백 문자로 띄운다. 마진만으론 읽는 문자열이 `34/90` 으로 붙어 스크린리더가 이어 읽는다.
  const cellClassName = 'h-[30px] flex-row items-center gap-1.5 rounded-[10px] bg-card-inset px-2.5'
  const chevron = isExpandable ? (
    isBreakdownOpen ? (
      <ChevronUpIcon className="h-3 w-3 shrink-0 text-text-muted" strokeWidth={2.5} aria-hidden />
    ) : (
      <ChevronDownIcon className="h-3 w-3 shrink-0 text-text-muted" strokeWidth={2.5} aria-hidden />
    )
  ) : null
  const chipContent = (
    <>
      {!monthlyOnly && (
        <View className={`flex-1 ${cellClassName}`}>
          {WEEKLY_CRYSTAL_ICON_URL !== null && (
            <Image source={WEEKLY_CRYSTAL_ICON_URL} resizeMode="contain" className="h-4 w-4 shrink-0" />
          )}
          <Text className="text-11 text-text-muted">주간 결정석</Text>
          <Text className="ml-auto text-xs font-bold text-text" style={TABULAR_NUMS}>
            {cleared} <Text className="font-semibold text-text-muted">/ {limit}</Text>
          </Text>
        </View>
      )}
      <View className={`${monthlyOnly ? 'flex-1 ' : ''}${cellClassName}`}>
        {MONTHLY_CRYSTAL_ICON_URL !== null && (
          <Image source={MONTHLY_CRYSTAL_ICON_URL} resizeMode="contain" className="h-4 w-4 shrink-0" />
        )}
        <Text className="text-11 text-text-muted">{monthlyOnly ? '월간 결정석' : '월간'}</Text>
        {/* `개` 는 한국어 표기상 숫자에 붙으므로 공백을 넣지 않는다. */}
        <Text className={`${monthlyOnly ? 'ml-auto ' : ''}text-xs font-bold text-text`} style={TABULAR_NUMS}>
          {monthlyCleared}개
        </Text>
        {chevron}
      </View>
    </>
  )

  const chipClassName = 'flex-1 flex-row items-center gap-1.5'

  // 단일 월드는 펼칠 것이 없어 버튼으로 두지 않는다. 수치만으로는 무엇의 비율인지 읽히지 않으므로
  // 칩 전체에 레이블 하나를 주고 아이콘은 장식으로 남긴다.
  if (!isExpandable) {
    return (
      <View role="img" aria-label={label} className={chipClassName}>
        {chipContent}
      </View>
    )
  }

  return (
    <>
      <Pressable
        ref={chipRef}
        role="button"
        onPress={toggleBreakdown}
        aria-label={label}
        aria-expanded={isBreakdownOpen}
        className={`z-20 ${chipClassName}`}
      >
        {chipContent}
      </Pressable>
      {isBreakdownOpen && (
        /*
          닫는 층과 내용이 **같은 창에** 있어야 한다. RN 의 `Modal` 은 앱 루트 뷰와 다른 네이티브
          창이라 항상 그 위이고, `zIndex` 는 같은 트리의 형제끼리만 순서를 정한다. 닫기 층만
          여기 넣고 내용을 트리에 두면 내용에 `z-20` 을 줘도 투명한 닫기 층이 그 위에 깔린다.
          그러면 상자 안을 누르는 것이 전부 닫기로 먹힌다.

          펼쳐도 헤더 높이가 안 변하는 것은 그대로다. 별도 창이라 흐름에 아예 없다.
        */
        <PopoverLayer closeLabel="월드별 결정석 판매 현황 닫기" onClose={closeBreakdown}>
          {/* 바깥 탭으로 닫는다. **스크림이 없다**. 뒤를 덮으면 비교 대상인 헤드라인이 함께 어두워진다. */}
          <View
            testID="world-crystal-breakdown"
            onLayout={placement.onLayout}
            style={{
              left: anchor?.left ?? 0,
              // 칩 위아래 중 빈 공간이 넓은 쪽에 선다
              top: placement.top,
              // 폭은 내용이 정하므로(`min-w-[168px]`) 상한만 준다. 월드 이름이 길어도 화면 밖으로
              // 안 나간다.
              maxWidth: windowWidth - (anchor?.left ?? 0) - BREAKDOWN_EDGE_GAP,
            }}
            // 칩과 상자 높이를 재기 전에는 그리되 안 보인다. 0,0 에 한 프레임 번쩍이는 것을 막는다.
            className={`absolute min-w-[168px] rounded-[12px] border border-border bg-surface p-2 shadow-lg${
              placement.measured ? '' : ' opacity-0'
            }`}
          >
            <Text className="px-1 pb-1.5 text-11 font-bold tracking-wide text-text-muted">월드별 판매 현황</Text>
            <View className="gap-1">
              {worlds.map((summary) => {
                const emblemUrl = worldEmblemUrl(summary.worldKey)
                return (
                  <View key={summary.worldKey} className="flex-row items-center gap-1.5 px-1">
                    {emblemUrl !== null && <Image source={emblemUrl} className="h-4 w-4 shrink-0" resizeMode="contain" />}
                    <Text className="text-xs text-text-muted">{summary.world}</Text>
                    {/* 칩에 두 몫이 있으니 펼친 줄도 월드마다 두 몫을 함께 말한다. */}
                    <Text className="ml-auto pl-3 text-xs font-semibold text-text" style={TABULAR_NUMS}>
                      {monthlyOnly
                        ? `월간 ${summary.monthlyCleared}개`
                        : `${summary.cleared} / ${WEEKLY_CRYSTAL_SALE_LIMIT} | 월간 ${summary.monthlyCleared}개`}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        </PopoverLayer>
      )}
    </>
  )
}
