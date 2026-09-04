/**
 * 총 수익 헤드라인 옆의 칩 2종.
 *
 * 결정석 판매 한도 요약(월드별로 집계한다)과 직전 기간 대비 증감(상승 빨강·하락 파랑, 방향이
 * 없으면 테마 색). 둘 다 자기 상자 안에서 끝난다.
 */
import { Image, Modal, Pressable, View, useWindowDimensions } from 'react-native'

import { getItemIconUrlByFile, worldEmblemUrl } from '../../lib/assets/asset-lookup'
import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../lib/boss/boss-matching'
import { computeProfitDelta, formatProfitDeltaBody, formatProfitDeltaLabel } from '../../lib/boss/boss-profit-delta'
import { formatBossProfitPeriodLabel, getAdjacentPeriodKey } from '../../lib/boss/boss-profit-period'
import type { BossCycle } from '../../types'

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Text,
} from '../../components/atoms'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { countMonthlyCrystals, summarizeWorldCrystals } from './character-groups'
import type { CharacterGroup } from './character-groups'
import { useAnchoredPopover } from './ItemRevenuePopover'

/** 칩 밑변과 상자 윗변 사이. 흐름 안에 있던 시절의 `mt-1.5` 를 그대로 옮긴 값. */
const BREAKDOWN_GAP = 6
/** 상자 오른쪽 변과 화면 끝 사이에 남길 최소 여백. */
const BREAKDOWN_EDGE_GAP = 12

// 결정석 아이콘(주간/월간). 드랍 테이블 항목이 아니라 UI 표시 전용이라 `item-icons.json` 에
// 등록하지 않고 파일명으로 직접 조회한다. 파일이 없으면 null. 아이콘만 생략하고 숫자는 그대로 둔다.
export const WEEKLY_CRYSTAL_ICON_URL = getItemIconUrlByFile('intense_power_crystal_weekly.webp')
export const MONTHLY_CRYSTAL_ICON_URL = getItemIconUrlByFile('intense_power_crystal_monthly.webp')

// 총 수익 헤드라인의 결정석 판매 현황. 라벨행의 `{기간} 총 수익` 텍스트 바로 옆 칩이다. 금액행
// 아래 새 줄로 두면 그 한 줄이 헤더를 그대로 높여 목록을 잠식한다.
//
// 칩 높이는 라벨(text-xs = 16px)을 넘지 않아야 한다. 이 줄에 흐름으로 들어가는 요소가
// 라벨행(h-6 = 24px)을 넘으면 라벨행이 튄다. 그것이 고가 드롭 배지(24px)를 절대배치로 빼낸
// 이유이고, 그 배지가 우측 끝을 쓰므로 칩은 좌측(라벨 옆)에 붙는다.
//
// 월드별 분해는 흐름이 아니라 별도 네이티브 창의 팝오버로 띄운다. 펼쳐도 헤더 높이가 변하지 않는다.
export function CrystalSummaryChip(props: { tab: BossCycle; groups: CharacterGroup[] }): React.JSX.Element | null {
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

  const isWeekly = props.tab === 'weekly'
  const worlds = isWeekly ? summarizeWorldCrystals(props.groups) : []
  // 주간 탭인데 월드를 아는 캐릭터가 하나도 없으면(구버전 캐시만 있는 경우) 대비할 한도가 없다.
  // 반대로 월드는 알지만 처치 수가 0 이면 `0 / 90` 을 그대로 보여준다. 정보로서 유효하다.
  if (isWeekly && worlds.length === 0) return null

  const iconUrl = isWeekly ? WEEKLY_CRYSTAL_ICON_URL : MONTHLY_CRYSTAL_ICON_URL
  const cleared = isWeekly
    ? worlds.reduce((sum, summary) => sum + summary.cleared, 0)
    : countMonthlyCrystals(props.groups)
  // 각 월드가 각자 90 을 가지므로 복수 월드의 분모는 90 × 월드 수다.
  const limit = WEEKLY_CRYSTAL_SALE_LIMIT * worlds.length
  const isExpandable = worlds.length > 1
  const label = isWeekly ? `주간 결정석 판매 ${cleared} / ${limit}` : `월간 결정석 ${cleared}개`

  // 칩은 화면에 간단히만. 월드 수·월드명 같은 부가 표기는 팝오버로 넘긴다.
  const chipContent = (
    <>
      {iconUrl !== null && <Image source={iconUrl} resizeMode="contain" className="h-4 w-4 shrink-0" />}
      {/* 숫자와 단위 사이는 마진이 아니라 실제 공백 문자로 띄운다. 마진만으론 읽는 문자열이
          `34/90` 으로 붙어 스크린리더가 이어 읽는다. `개` 는 한국어 표기상 숫자에 붙으므로
          공백을 넣지 않는다. */}
      {isWeekly ? (
        <Text className="text-xs font-bold leading-none text-primary-ink" style={TABULAR_NUMS}>
          {cleared} <Text className="font-semibold opacity-70">/ {limit}</Text>
        </Text>
      ) : (
        <Text className="text-xs font-bold leading-none text-primary-ink" style={TABULAR_NUMS}>
          {cleared}
          <Text className="font-semibold opacity-70">개</Text>
        </Text>
      )}
    </>
  )

  // h-5(20px). 라벨행이 h-6(24px)으로 고정돼 있으므로 그 안에 들어가기만 하면 된다.
  // `leading-none` 과 함께 두어야 글꼴 line-height 가 칩 높이를 밀어 올리지 않는다.
  const chipClassName = 'ml-2 h-5 shrink-0 flex-row items-center gap-1 rounded-full bg-primary-tint px-1.5'

  // 단일 월드·월간 탭은 펼칠 것이 없어 버튼으로 두지 않는다. 수치만으로는 무엇의 비율인지
  // 읽히지 않으므로 칩 전체에 레이블을 주고 아이콘은 장식으로 남긴다.
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
        {isBreakdownOpen ? (
          <ChevronUpIcon className="h-3 w-3 shrink-0 text-primary-ink" strokeWidth={2.5} aria-hidden />
        ) : (
          <ChevronDownIcon className="h-3 w-3 shrink-0 text-primary-ink" strokeWidth={2.5} aria-hidden />
        )}
      </Pressable>
      {isBreakdownOpen && (
        /*
          닫는 층과 내용이 **같은 창에** 있어야 한다. RN 의 `Modal` 은 앱 루트 뷰와 다른 네이티브
          창이라 항상 그 위이고, `zIndex` 는 같은 트리의 형제끼리만 순서를 정한다. 닫기 층만
          여기 넣고 내용을 트리에 두면 내용에 `z-20` 을 줘도 투명한 닫기 층이 그 위에 깔린다.
          그러면 상자 안을 누르는 것이 전부 닫기로 먹힌다.

          펼쳐도 헤더 높이가 안 변하는 것은 그대로다. 별도 창이라 흐름에 아예 없다.
        */
        <Modal
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={closeBreakdown}
        >
          {/* 바깥 탭으로 닫는다. **스크림이 없다**. 뒤를 덮으면 비교 대상인 헤드라인이 함께 어두워진다. */}
          <Pressable
            aria-label="월드별 결정석 판매 현황 닫기"
            onPress={closeBreakdown}
            className="flex-1"
          />
          <View
            testID="world-crystal-breakdown"
            style={{
              left: anchor?.left ?? 0,
              top: anchor === null ? 0 : anchor.top + anchor.height + BREAKDOWN_GAP,
              // 폭은 내용이 정하므로(`min-w-[168px]`) 상한만 준다. 월드 이름이 길어도 화면 밖으로
              // 안 나간다.
              maxWidth: windowWidth - (anchor?.left ?? 0) - BREAKDOWN_EDGE_GAP,
            }}
            // 아직 못 쟀으면 그리되 안 보인다. 0,0 에 한 프레임 번쩍이는 것을 막는다.
            className={`absolute min-w-[168px] rounded-[12px] border border-border bg-surface p-2 shadow-lg${
              anchor === null ? ' opacity-0' : ''
            }`}
          >
            <Text className="px-1 pb-1.5 text-11 font-bold tracking-wide text-text-muted">월드별 판매 현황</Text>
            <View className="gap-1">
              {worlds.map((summary) => {
                const emblemUrl = worldEmblemUrl(summary.world)
                return (
                  <View key={summary.world} className="flex-row items-center gap-1.5 px-1">
                    {emblemUrl !== null && <Image source={emblemUrl} className="h-4 w-4 shrink-0" resizeMode="contain" />}
                    <Text className="text-xs text-text-muted">{summary.world}</Text>
                    <Text className="ml-auto pl-3 text-xs font-semibold text-text" style={TABULAR_NUMS}>
                      {summary.cleared} / {WEEKLY_CRYSTAL_SALE_LIMIT}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        </Modal>
      )}
    </>
  )
}

// 직전 기간 대비 증감 칩. 금액행 오른쪽에 붙는다. 라벨행이 아니라 금액행(아이콘 32px)이라
// h-6 제약과 무관하고 헤더 높이가 늘지 않는다.
//
// 비교 기준(`previousMeso`)은 스토어가 기록 합만 넘긴 값이다. 조회한 적 없는 기간도 0 이라
// 이 컴포넌트는 기간 상태를 전혀 보지 않는다.
export function DeltaChip(props: {
  totalMeso: number
  previousMeso: number
  tab: BossCycle
  periodKey: string
  now: Date
}): React.JSX.Element {
  const delta = computeProfitDelta(props.totalMeso, props.previousMeso)
  const previousLabel = formatBossProfitPeriodLabel(
    props.tab,
    getAdjacentPeriodKey(props.tab, props.periodKey, 'prev'),
    props.now,
  ).primary

  // 방향이 없는 상태(같음)에는 신호색을 쓰지 않는다. 빨강도 파랑도 거짓이다.
  const tone =
    delta.direction === 'same'
      ? 'bg-primary-tint'
      : delta.direction === 'up'
        ? 'bg-rise-tint'
        : 'bg-fall-tint'
  const ink =
    delta.direction === 'same'
      ? 'text-primary-ink'
      : delta.direction === 'up'
        ? 'text-rise-ink'
        : 'text-fall-ink'

  return (
    // 화살표·색은 의미를 전하지 못하므로 칩 전체에 문장을 준다. `leading-none` 이 없으면 글꼴
    // line-height 가 실려 h-5 를 넘긴다.
    <View
      role="img"
      aria-label={formatProfitDeltaLabel(delta, previousLabel)}
      className={`ml-2 h-5 shrink-0 flex-row items-center gap-0.5 rounded-full px-1.5 ${tone}`}
    >
      {/* 'same' 에는 방향 표식을 그리지 않는다. 표기 "-" 자체가 표식이라 겹친다. */}
      {delta.direction === 'up' && <ArrowUpIcon className={`h-2.5 w-2.5 shrink-0 ${ink}`} strokeWidth={3} aria-hidden />}
      {delta.direction === 'down' && (
        <ArrowDownIcon className={`h-2.5 w-2.5 shrink-0 ${ink}`} strokeWidth={3} aria-hidden />
      )}
      <Text className={`text-11 font-bold leading-none ${ink}`} style={TABULAR_NUMS}>
        {formatProfitDeltaBody(delta)}
      </Text>
    </View>
  )
}
