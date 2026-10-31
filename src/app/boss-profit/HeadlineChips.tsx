/**
 * 총 수익 카드의 결정석 판매 칸. 월드별로 집계한다.
 */
import { Image, Pressable, View } from 'react-native'

import { getItemIconUrlByFile, worldEmblemUrl } from '../../lib/assets/asset-lookup'
import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../lib/boss/boss-matching'
import type { MonthlyCrystalsByWorld } from '../../features/boss-profit/monthly-crystals'

import { ChevronDownIcon, ChevronUpIcon, Text } from '../../components/atoms'
import { AnchoredPopover } from '../../components/molecules/Popover/Popover'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { summarizeWorldCrystals } from './character-groups'
import type { CharacterGroup } from './character-groups'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'


// 총 수익 카드 셋째 줄의 결정석 칸. 주간 90 한도 대비 주간 몫과 그 주에 잡은 월간 보스의 월간 몫을 칸 둘로 나눠 적는다.
// 월간 몫은 한도가 없어 분모 없이 개수만 적고, 안 잡은 주에도 `0개` 로 선다.
//
// 월드별 분해는 흐름이 아니라 공용 팝오버(별도 네이티브 창)로 띄운다. 펼쳐도 카드 높이가 변하지 않는다.
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
  // 결정석 아이콘(주간/월간). 드롭 표 항목이 아니라 UI 표시 전용이라 파일 이름으로 직접 찾는다. 없으면 아이콘만 생략한다.
  // 렌더 안에서 찾는다. 모듈 최상위에서 찾으면 그림 목록을 받기 전의 빈 값으로 굳는다.
  const weeklyCrystalIcon = getItemIconUrlByFile('intense_power_crystal_weekly.webp')
  const monthlyCrystalIcon = getItemIconUrlByFile('intense_power_crystal_monthly.webp')
  const chipContent = (
    <>
      {!monthlyOnly && (
        <View className={`flex-1 ${cellClassName}`}>
          {weeklyCrystalIcon !== null && (
            <Image source={weeklyCrystalIcon} resizeMode="contain" className="h-4 w-4 shrink-0" />
          )}
          <Text className="text-11 text-text-muted">주간 결정석</Text>
          <Text className="ml-auto text-xs font-bold text-text" style={TABULAR_NUMS}>
            {cleared} <Text className="font-normal text-text-muted">/ {limit}</Text>
          </Text>
        </View>
      )}
      <View className={`${monthlyOnly ? 'flex-1 ' : ''}${cellClassName}`}>
        {monthlyCrystalIcon !== null && (
          <Image source={monthlyCrystalIcon} resizeMode="contain" className="h-4 w-4 shrink-0" />
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
        // 바깥 탭으로 닫는다. 공용 상자는 가운데로 옮길 때만 스크림을 깔아서, 평소에는 비교 대상인 헤드라인이 안 어두워진다.
        <AnchoredPopover
          testID="world-crystal-breakdown"
          ariaLabel="월드별 결정석 판매 현황"
          closeLabel="월드별 결정석 판매 현황 닫기"
          anchor={anchor}
          onClose={closeBreakdown}
          className="p-3"
        >
          <Text className="mb-2 text-11 font-bold tracking-wide text-text-muted">월드별 판매 현황</Text>
          <View className="gap-1">
            {worlds.map((summary) => {
              const emblemUrl = worldEmblemUrl(summary.worldKey)
              // 줄은 그림이 주간 · 월간을 말해 숫자만 적는다. 읽는 이름은 두 몫을 말로 푼다.
              const rowLabel = monthlyOnly
                ? `${summary.world} 월간 결정석 ${summary.monthlyCleared}개`
                : `${summary.world} 주간 결정석 ${summary.cleared} / ${WEEKLY_CRYSTAL_SALE_LIMIT}, 월간 결정석 ${summary.monthlyCleared}개`
              return (
                <View
                  key={summary.worldKey}
                  accessible
                  aria-label={rowLabel}
                  className="flex-row items-center gap-1.5 rounded-[10px] bg-card-inset px-2 py-1.5"
                >
                  {emblemUrl !== null && <Image source={emblemUrl} className="h-3.5 w-3.5 shrink-0" resizeMode="contain" />}
                  <Text className="mr-3 shrink grow text-xs font-semibold text-text" numberOfLines={1}>
                    {summary.world}
                  </Text>
                  {!monthlyOnly && (
                    <View className="flex-row items-center gap-0.5">
                      {weeklyCrystalIcon !== null && (
                        <Image source={weeklyCrystalIcon} resizeMode="contain" className="h-4 w-3.5 shrink-0" />
                      )}
                      <Text className="text-xs font-bold text-text" style={TABULAR_NUMS}>
                        {summary.cleared}
                        <Text className="text-11 font-normal text-text-muted">/{WEEKLY_CRYSTAL_SALE_LIMIT}</Text>
                      </Text>
                    </View>
                  )}
                  <View className={`flex-row items-center gap-0.5${monthlyOnly ? '' : ' ml-2'}`}>
                    {monthlyCrystalIcon !== null && (
                      <Image source={monthlyCrystalIcon} resizeMode="contain" className="h-4 w-3.5 shrink-0" />
                    )}
                    <Text className="text-xs font-bold text-text" style={TABULAR_NUMS}>
                      {summary.monthlyCleared}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        </AnchoredPopover>
      )}
    </>
  )
}
