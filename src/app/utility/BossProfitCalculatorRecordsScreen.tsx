/**
 * 주간 보스 수익 계산기의 계산 기록. 저장 시각이 늦은 기록부터 늘어놓는다.
 *
 * 금액은 저장할 때의 값이 아니라 지금 결정석 가격으로 다시 센 값이다. 기록이 금액 없이 보스 · 난이도 · 파티 값만 들기
 * 때문이다. 기록을 누르면 그 값으로 계산기가 열리고, 지운 기록은 되살리지 못한다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { FileTextIcon, Text, Trash2Icon } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { FaqButton } from '../../components/organisms/FaqSheet/FaqButton'
import { useFaqSheet } from '../../features/faq/use-faq-sheet'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useBossProfitCalculatorStore } from '../../features/boss-profit-calculator/store'
import { useBossSchedule } from '../../features/boss-scheduler/use-boss-schedule'
import { useToastStore } from '../../features/toast/store'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { totalPayoutMeso } from '../../lib/boss/boss-profit-calculator'
import { WEEKDAY_LABELS } from '../../lib/calendar'
import { formatMesoUnits } from '../../lib/drop/drop-price'
import { boxShadowOf } from '../../lib/shadow'
import { useThemeAppearance } from '../../theme/context'
import type { BossProfitCalculatorRecord } from '../../storage/boss-profit-calculator-records'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 기록 제목. 저장한 날짜와 시간(KST)이다(`10월 20일 (화)` · `14:32`) */
function recordTitle(savedAt: string): { date: string; time: string } {
  const kst = new Date(new Date(savedAt).getTime() + KST_OFFSET_MS)
  const hours = String(kst.getUTCHours()).padStart(2, '0')
  const minutes = String(kst.getUTCMinutes()).padStart(2, '0')
  return {
    date: `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 (${WEEKDAY_LABELS[kst.getUTCDay()]})`,
    time: `${hours}:${minutes}`,
  }
}

export function BossProfitCalculatorRecordsScreen(): React.JSX.Element {
  const faq = useFaqSheet('utility-boss-profit-calculator-records')
  const navigation = useScreenNavigation()
  const { definition } = useThemeAppearance()
  const { records, openedId, openRecord, deleteRecord } = useBossProfitCalculatorStore()
  const { characters } = useBossSchedule()
  const [now] = useState(() => new Date())
  const lift = [
    boxShadowOf(definition.shadowColor, { opacity: 0.14, radius: 1, y: 1 }),
    boxShadowOf(definition.shadowColor, { opacity: 0.17, radius: 12, y: 8 }),
  ].join(', ')

  /**
   * 기록 줄의 캐릭터 글자. 추적 캐릭터 가운데 기록 순서로 첫 이름이고, 나머지 캐릭터 수를 `외 n` 으로 단다.
   * 아는 이름이 없으면 비운다.
   */
  function charactersLabel(record: BossProfitCalculatorRecord): string {
    const first = record.characters
      .map((one) => characters.find((character) => character.ocid === one.ocid)?.characterName)
      .find((name) => name !== undefined)
    if (first === undefined) return ''
    const others = record.characters.length - 1
    return others === 0 ? first : `${first} 외 ${others}`
  }

  async function remove(record: BossProfitCalculatorRecord): Promise<void> {
    try {
      await deleteRecord(record.id)
    } catch {
      useToastStore.getState().showError('기록을 지우지 못했습니다')
    }
  }

  return (
    <ScreenScroll
      hasTabBar={false}
      header={
        <PageHeader>
          <PageHeaderTitleRow className="gap-2">
            <BackButton onPress={() => navigation.goBack()} />
            <View className="flex-row items-center">
              <Text className="text-lg font-bold text-text">계산 기록</Text>
              <FaqButton sheet={faq} />
            </View>
          </PageHeaderTitleRow>
        </PageHeader>
      }
    >
      <View testID="screen-UtilityBossProfitCalculatorRecords" className="gap-2.5 px-4 pb-4">
        {records.length === 0 ? (
          <EmptyState icon={FileTextIcon} title="저장한 기록이 없어요" description="계산기에서 결과 저장을 누르면 여기에 남아요." />
        ) : (
          <>
            <Text className="px-1 pb-1.5 text-xs text-text-muted">금액은 지금 결정석 가격으로 다시 센 값입니다</Text>
            {records.map((record) => {
              const title = recordTitle(record.savedAt)
              const opened = record.id === openedId
              const bosses = record.characters.flatMap((character) => character.bosses)
              return (
                <View
                  key={record.id}
                  testID={`calculator-record-${record.id}`}
                  className={`flex-row items-center gap-1 rounded-[22px] py-1.5 pr-1.5 ${opened ? 'bg-primary-tint' : 'bg-surface'}`}
                  style={opened ? undefined : { boxShadow: lift }}
                >
                  <Pressable
                    role="button"
                    aria-label={`${title.date} ${title.time} 기록 열기`}
                    onPress={() => {
                      openRecord(record.id)
                      navigation.goBack()
                    }}
                    className="flex-1 gap-2 py-2.5 pl-[18px] pr-2"
                  >
                    <View className="flex-row items-baseline gap-2">
                      <Text className="text-sm font-bold text-text">{title.date}</Text>
                      <Text className="text-xs text-text-muted" style={TABULAR_NUMS}>
                        {title.time}
                      </Text>
                      {opened && (
                        <View className="h-5 justify-center self-center rounded-full bg-primary px-2">
                          <Text className="text-chip-sm font-bold text-on-primary">열려 있음</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center justify-between gap-2">
                      {/* 얼굴을 늘어놓지 않는다. 캐릭터가 여럿이면 날짜와 금액 사이에 얼굴이 설 폭이 모자란다. */}
                      <Text numberOfLines={1} className="min-w-0 shrink text-xs text-text-muted">
                        {charactersLabel(record)}
                      </Text>
                      <Text className="text-lg font-bold text-text" style={TABULAR_NUMS}>
                        {formatMesoUnits(totalPayoutMeso(bosses, now))}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    role="button"
                    aria-label={`${title.date} ${title.time} 기록 지우기`}
                    onPress={() => void remove(record)}
                    className="h-11 w-11 items-center justify-center rounded-full active:opacity-60"
                  >
                    <Trash2Icon className="h-[18px] w-[18px] text-text-muted" strokeWidth={2} aria-hidden />
                  </Pressable>
                </View>
              )
            })}
          </>
        )}
      </View>
    </ScreenScroll>
  )
}
