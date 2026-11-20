/**
 * 총 수익 카드의 결정석 판매 칸. 한도 줄마다 집계한다.
 */
import { Image, Pressable, View } from 'react-native'

import { appImage, worldEmblemUrl } from '../../lib/assets/asset-lookup'
import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../lib/boss/boss-matching'
import { countsCrystalLimitPerMapleId } from '../../lib/boss/crystal-limit'
import type { MonthlyCrystalsByWorld } from '../../features/boss-profit/monthly-crystals'
import type { MapleIdOwners } from '../../features/maple-id/owners'
import { useMapleIdNameOf } from '../../features/maple-id/names'

import { ChevronDownIcon, ChevronUpIcon, Text } from '../../components/atoms'
import { AnchoredPopover } from '../../components/molecules/Popover/Popover'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { crystalLimitLines, summarizeWorldCrystals } from './character-groups'
import type { CharacterGroup, CrystalLimitLine, WorldCrystalSummary } from './character-groups'
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover'


// 총 수익 카드 셋째 줄의 결정석 칸. 주간 몫과 그 주에 잡은 월간 보스의 월간 몫을 칸 둘로 나눠 적는다.
// 둘 다 분모 없이 개수만 적고, 안 잡은 주에도 `0개` 로 선다. 주간 한도는 한도 줄마다 따로라 칸에 분모를 두면
// 줄 수만큼 커져 어느 줄의 한도도 아니다(사용자 선택). 한도는 펼친 줄마다 `/90` 으로 본다.
//
// 월드별 분해는 흐름이 아니라 공용 팝오버(별도 네이티브 창)로 띄운다. 펼쳐도 카드 높이가 변하지 않는다.
//
// 월간 탭은 `variant="monthly"` 로 **월간 몫만** 싣는다. 주간 90 은 주마다의 한도라 한 달의 합에는 뜻이
// 없다. 주간 탭의 월간 몫은 화면이 기록에서 센 **그 주까지의 그 달 누적**(`monthlyByWorld`)이다.
export function CrystalSummaryChip(props: {
  groups: CharacterGroup[]
  variant?: 'weekly' | 'monthly'
  /** 주간 탭이 보고 있는 주. 그 주의 규칙으로 한도 줄을 가른다. 월간 탭은 `null` */
  weekKey: string | null
  /** 한도 줄마다의 그 달 누적. 오면 행으로 센 월간 몫을 대신한다. */
  monthlyByWorld?: MonthlyCrystalsByWorld
  /** 캐릭터마다의 메이플 ID 와 그 차례. 오면 메이플 ID 와 월드마다 가르고, 못 읽었으면 월드로만 가른다 */
  mapleIds?: MapleIdOwners | null
}): React.JSX.Element | null {
  const nameOf = useMapleIdNameOf()
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

  const worlds = summarizeWorldCrystals(props.groups, props.monthlyByWorld, props.mapleIds?.ofOcid ?? null)
  // 월드를 아는 캐릭터가 하나도 없으면(구버전 캐시만 있는 경우) 대비할 한도가 없다. 반대로 월드는
  // 알지만 처치 수가 0 이면 `0 / 90` 을 그대로 보여준다. 정보로서 유효하다.
  if (worlds.length === 0) return null

  const cleared = worlds.reduce((sum, summary) => sum + summary.cleared, 0)
  // 월간 수도 월드별 줄의 합이다. 칩과 펼친 줄이 같은 수를 말하고, 월드를 모르는 행은 둘 다에서 빠진다.
  const monthlyCleared = worlds.reduce((sum, summary) => sum + summary.monthlyCleared, 0)
  const isExpandable = worlds.length > 1
  const label = monthlyOnly
    ? `월간 결정석 ${monthlyCleared}개`
    : `주간 결정석 판매 ${cleared}개, 월간 결정석 ${monthlyCleared}개`
  const sections = sectionsByMapleId(worlds, props.mapleIds?.order ?? [])
  // 메이플 ID 가 하나면 이름으로 가를 것이 없다. 캐릭터 관리 드롭다운의 묶음 라벨과 같은 규칙이다.
  const namesMapleIds = sections.length > 1
  // 한도를 메이플 ID 마다 세는 주는 한도 줄마다 칸을 둔다. 그 전 주와 월간 탭은 월드 줄마다 칸이다.
  const weekKey = monthlyOnly ? null : props.weekKey
  const lineSections =
    weekKey !== null && countsCrystalLimitPerMapleId(weekKey)
      ? sections.map((section) => ({ accountId: section.accountId, lines: crystalLimitLines(section.worlds, weekKey) }))
      : null
  // 한도 줄이 하나뿐이고 메이플 ID 이름도 적지 않으면 한도를 둘 머리가 없어 제목 줄에 둔다.
  const titleLine = lineSections !== null && !namesMapleIds && lineSections.length === 1 && lineSections[0].lines.length === 1
    ? lineSections[0].lines[0]
    : null

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
  const weeklyCrystalIcon = appImage('boss_crystal_weekly')
  const monthlyCrystalIcon = appImage('boss_crystal_monthly')
  const chipContent = (
    <>
      {!monthlyOnly && (
        <View className={`flex-1 ${cellClassName}`}>
          {weeklyCrystalIcon !== null && (
            <Image source={weeklyCrystalIcon} resizeMode="contain" className="h-4 w-4 shrink-0" />
          )}
          <Text className="text-11 text-text-muted">주간 결정석</Text>
          {/* `개` 는 한국어 표기상 숫자에 붙으므로 공백을 넣지 않는다. */}
          <Text className="ml-auto text-xs font-bold text-text" style={TABULAR_NUMS}>
            {cleared}개
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
          <View className="mb-2 flex-row items-center gap-2">
            <Text className="text-11 font-bold tracking-wide text-text-muted">
              {namesMapleIds ? '메이플 ID · 월드별 판매 현황' : '월드별 판매 현황'}
            </Text>
            {titleLine !== null && (
              <View accessible aria-label={limitLabel('', titleLine)} className="ml-auto">
                <LimitFigure cleared={titleLine.cleared} icon={weeklyCrystalIcon} />
              </View>
            )}
          </View>
          {lineSections !== null ? (
            <View className="gap-1">
              {lineSections.map((section, sectionIndex) => {
                const name = namesMapleIds && section.accountId !== null ? nameOf(section.accountId) : null
                const owner = name === null ? '' : `${name} `
                // 한도 줄이 하나면 줄 이름이 가를 것이 없다. 한도는 이름 줄이나 제목 줄에 둔다.
                const nameLine = name !== null && section.lines.length === 1 ? section.lines[0] : null
                const headless = section.lines.length === 1 && (nameLine !== null || titleLine !== null)
                return (
                  <View key={section.accountId ?? ''} className={`gap-1${sectionIndex === 0 ? '' : ' pt-1'}`}>
                    {name !== null && (
                      <View
                        accessible={nameLine !== null}
                        aria-label={nameLine === null ? undefined : limitLabel(owner, nameLine)}
                        className="flex-row items-center gap-2 px-0.5"
                      >
                        <Text className="text-11 font-bold text-text">{name}</Text>
                        {nameLine !== null && (
                          <View className="ml-auto">
                            <LimitFigure cleared={nameLine.cleared} icon={weeklyCrystalIcon} />
                          </View>
                        )}
                      </View>
                    )}
                    {section.lines.map((line) => (
                      <View key={line.key} className="gap-1 rounded-[10px] bg-card-inset p-2">
                        {!headless && (
                          <View accessible aria-label={limitLabel(`${owner}${line.name} `, line)} className="flex-row items-center gap-2">
                            <Text className="shrink text-xs font-semibold text-text" numberOfLines={1}>
                              {line.name}
                            </Text>
                            <View className="ml-auto">
                              <LimitFigure cleared={line.cleared} icon={weeklyCrystalIcon} />
                            </View>
                          </View>
                        )}
                        {line.worlds.map((summary) => {
                          const emblemUrl = worldEmblemUrl(summary.worldKey)
                          return (
                            <View
                              key={summary.worldKey}
                              accessible
                              aria-label={`${owner}${summary.world} 주간 결정석 ${summary.cleared}개, 월간 결정석 ${summary.monthlyCleared}개`}
                              className="flex-row items-center gap-1.5"
                            >
                              {emblemUrl !== null && <Image source={emblemUrl} className="h-3.5 w-3.5 shrink-0" resizeMode="contain" />}
                              <Text className="mr-3 shrink grow text-xs text-text-muted" numberOfLines={1}>
                                {summary.world}
                              </Text>
                              <View className="flex-row items-center gap-0.5">
                                {weeklyCrystalIcon !== null && (
                                  <Image source={weeklyCrystalIcon} resizeMode="contain" className="h-4 w-3.5 shrink-0" />
                                )}
                                <Text className="text-xs font-bold text-text" style={TABULAR_NUMS}>
                                  {summary.cleared}
                                </Text>
                              </View>
                              <View className="ml-2 flex-row items-center gap-0.5">
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
                    ))}
                  </View>
                )
              })}
            </View>
          ) : (
          <View className="gap-1">
            {sections.map((section, sectionIndex) => (
              <View key={section.accountId ?? ''} className="gap-1">
                {namesMapleIds && section.accountId !== null && (
                  <Text className={`px-0.5 pb-0.5 text-11 font-bold text-text ${sectionIndex === 0 ? '' : 'pt-1.5'}`}>
                    {nameOf(section.accountId)}
                  </Text>
                )}
                {section.worlds.map((summary) => {
                  const emblemUrl = worldEmblemUrl(summary.worldKey)
                  // 줄은 그림이 주간 · 월간을 말해 숫자만 적는다. 읽는 이름은 두 몫을 말로 풀고, 메이플 ID 가 둘 이상이면 그 이름도 붙인다.
                  const owner = namesMapleIds && summary.accountId !== null ? `${nameOf(summary.accountId)} ` : ''
                  const rowLabel = monthlyOnly
                    ? `${owner}${summary.world} 월간 결정석 ${summary.monthlyCleared}개`
                    : `${owner}${summary.world} 주간 결정석 ${summary.cleared} / ${WEEKLY_CRYSTAL_SALE_LIMIT}, 월간 결정석 ${summary.monthlyCleared}개`
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
            ))}
          </View>
          )}
        </AnchoredPopover>
      )}
    </>
  )
}

/** 한도 줄의 읽는 이름. `prefix` 는 메이플 ID 이름이나 줄 이름과 그 뒤의 공백이다. */
function limitLabel(prefix: string, line: CrystalLimitLine): string {
  return `${prefix}주간 결정석 판매 ${line.cleared} / ${WEEKLY_CRYSTAL_SALE_LIMIT}`
}

/** 한도 줄의 `판 수/90`. 주간 결정석 그림이 무엇의 수인지 말한다. */
function LimitFigure(props: { cleared: number; icon: ReturnType<typeof appImage> }): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-0.5">
      {props.icon !== null && <Image source={props.icon} resizeMode="contain" className="h-4 w-3.5 shrink-0" />}
      <Text className="text-xs font-bold text-text" style={TABULAR_NUMS}>
        {props.cleared}
        <Text className="text-11 font-normal text-text-muted">/{WEEKLY_CRYSTAL_SALE_LIMIT}</Text>
      </Text>
    </View>
  )
}

/** 펼친 줄을 메이플 ID 마다 묶는다. 메이플 ID 차례이고, 차례를 모르는 메이플 ID 와 소속을 가르지 않은 묶음은 뒤에 선다. */
function sectionsByMapleId(
  worlds: readonly WorldCrystalSummary[],
  order: readonly string[],
): Array<{ accountId: string | null; worlds: WorldCrystalSummary[] }> {
  const sections = new Map<string | null, WorldCrystalSummary[]>()
  for (const summary of worlds) sections.set(summary.accountId, [...(sections.get(summary.accountId) ?? []), summary])
  const rankOf = (accountId: string | null): number => {
    const index = accountId === null ? -1 : order.indexOf(accountId)
    return index === -1 ? order.length : index
  }
  return [...sections.entries()]
    .sort(([left], [right]) => rankOf(left) - rankOf(right))
    .map(([accountId, list]) => ({ accountId, worlds: list }))
}
