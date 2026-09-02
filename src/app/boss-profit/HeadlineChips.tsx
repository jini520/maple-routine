/**
 * 총 수익 헤드라인 옆의 **칩 2종**(화면에서 분리).
 *
 * 결정석 판매 한도 요약(월드별로 집계한다)과 직전 기간 대비 증감
 * (상승 빨강·하락 파랑, 방향이 없으면 테마 색). 둘 다 자기 상자 안에서 끝난다.
 */
import { useState } from 'react'
import { Image, Modal, Pressable, View } from 'react-native'

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

// 결정석 아이콘(주간/월간). 드랍 테이블 항목이 아니라 UI 표시 전용이라 item-icons.json에 등록하지 않고
// 파일명으로 직접 조회한다. 파일이 없으면 null. 아이콘만 생략하고 숫자는 그대로 둔다.
export const WEEKLY_CRYSTAL_ICON_URL = getItemIconUrlByFile('intense_power_crystal_weekly.webp')
export const MONTHLY_CRYSTAL_ICON_URL = getItemIconUrlByFile('intense_power_crystal_monthly.webp')

// 총 수익 헤드라인의 결정석 판매 현황(3으로 배치 변경). **라벨행의
// "{기간} 총 수익" 텍스트 바로 옆** 칩이다(사용자 요청). 원래는 금액행 아래 새 줄이었는데 그 한 줄이
// 헤더를 그대로 높여 목록을 잠식했다(헤더를 줄여둔 작업을 되돌리는 셈).
// **칩 높이는 라벨(text-xs = 16px)을 넘지 않아야 한다**. 이 줄에 흐름으로 들어가는 요소가 라벨행
// (h-6 = 24px)을 넘으면 라벨행이 튀고, 그것이 바로 고가 드롭 뱃지(24px)를 절대배치로 빼낸 이유다
// 그 뱃지가 여전히 우측 끝을 절대배치로 쓰므로 칩은 좌측(라벨 옆)에 붙는다.
// 월드별 분해는 흐름이 아니라 **절대배치 팝오버**로 띄운다. 펼쳐도 헤더 높이가 변하지 않는다.
export function CrystalSummaryChip(props: { tab: BossCycle; groups: CharacterGroup[] }): React.JSX.Element | null {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)

  const isWeekly = props.tab === 'weekly'
  const worlds = isWeekly ? summarizeWorldCrystals(props.groups) : []
  // 주간 탭인데 월드를 아는 캐릭터가 하나도 없으면(구버전 캐시만 있는 경우) 대비할 한도가 없다.
  // 반대로 월드는 알지만 처치 수가 0이면 "0 / 90"을 그대로 보여준다(정보로서 유효하다).
  if (isWeekly && worlds.length === 0) return null

  const iconUrl = isWeekly ? WEEKLY_CRYSTAL_ICON_URL : MONTHLY_CRYSTAL_ICON_URL
  const cleared = isWeekly
    ? worlds.reduce((sum, summary) => sum + summary.cleared, 0)
    : countMonthlyCrystals(props.groups)
  // 각 월드가 각자 90을 가지므로 복수 월드의 분모는 90 × 월드 수다(결정 7).
  const limit = WEEKLY_CRYSTAL_SALE_LIMIT * worlds.length
  const isExpandable = worlds.length > 1
  const label = isWeekly ? `주간 결정석 판매 ${cleared} / ${limit}` : `월간 결정석 ${cleared}개`

  // 칩은 화면에 "간단히"만. 월드 수·월드명 같은 부가 표기는 팝오버로 넘긴다(사용자 요청).
  const chipContent = (
    <>
      {iconUrl !== null && <Image source={iconUrl} resizeMode="contain" className="h-4 w-4 shrink-0" />}
      {/* 숫자와 단위 사이는 마진이 아니라 실제 공백 문자로 띄운다. 마진만으론 읽는 문자열이
          "34/90"으로 붙어 스크린리더가 이어 읽는다(에서 "메소" 단위로 정한 규약).
          "개"는 한국어 표기상 숫자에 붙으므로 공백을 넣지 않는다. */}
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

  // h-5(20px). 라벨행이 h-6(24px)으로 고정돼 있으므로 그 안에 들어가기만 하면 된다. leading-none과
  // 함께 두어야 글꼴 line-height가 칩 높이를 밀어 올리지 않는다.
  const chipClassName = 'ml-2 h-5 shrink-0 flex-row items-center gap-1 rounded-full bg-primary-tint px-1.5'

  // 단일 월드·월간 탭은 펼칠 것이 없어 버튼으로 두지 않는다. 수치만으로는 무엇의 비율인지 읽히지
  // 않으므로 칩 전체에 레이블을 주고 아이콘은 장식(alt 없음)으로 남긴다(아바타 링과 동일 규약).
  if (!isExpandable) {
    return (
      <View role="img" aria-label={label} className={chipClassName}>
        {chipContent}
      </View>
    )
  }

  return (
    <>
      {/* 팝오버가 열려 있는 동안 바깥 탭으로 닫는다(파일 머리 ①). */}
      {isBreakdownOpen && (
        <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setIsBreakdownOpen(false)}>
          <Pressable
            aria-label="월드별 결정석 판매 현황 닫기"
            onPress={() => setIsBreakdownOpen(false)}
            className="flex-1"
          />
        </Modal>
      )}
      <Pressable
        role="button"
        onPress={() => setIsBreakdownOpen((prev) => !prev)}
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
        // 흐름 밖(절대배치)이라 헤더 높이에 영향이 없다. 월드가 늘어도 헤더 영역은 그대로다.
        // 기준 박스는 라벨행이고 칩이 좌측에 있으므로 left-0에 맞춘다(우측은 고가 드롭 뱃지 자리).
        <View
          testID="world-crystal-breakdown"
          style={{ top: '100%' }}
          className="absolute left-0 z-20 mt-1.5 min-w-[168px] rounded-[12px] border border-border bg-surface p-2 shadow-lg"
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
      )}
    </>
  )
}

// 직전 기간 대비 증감 칩. **금액행** 오른쪽에 붙는다. 라벨행이 아니라
// 금액행(아이콘 32px)이라의 h-6 제약과 무관하고 헤더 높이가 늘지 않는다.
//
// 비교 기준(`previousMeso`)은 store 가 기록 합만 넘긴 값이다. 조회한 적 없는 기간도 0이라
// (결정 3, 사용자 결정) 이 컴포넌트는 기간 상태를 전혀 보지 않는다.
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
    // 화살표·색은 의미를 전하지 못하므로 칩 전체에 문장을 준다. leading-none 이 없으면 글꼴
    // line-height 가 실려 h-5 를 넘긴다(결정석 칩과 같은 규약).
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
