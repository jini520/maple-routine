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
import { CharacterAvatar } from '../../components/molecules/CharacterAvatar/CharacterAvatar'
import { EmptyState } from '../../components/molecules/EmptyState/EmptyState'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import { useBossProfitCalculatorStore } from '../../features/boss-profit-calculator/store'
import { useBossSchedulerStore } from '../../features/boss-scheduler/store'
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
  const navigation = useScreenNavigation()
  const { definition } = useThemeAppearance()
  const { records, openedId, openRecord, deleteRecord } = useBossProfitCalculatorStore()
  const characters = useBossSchedulerStore((state) => state.characters)
  const [now] = useState(() => new Date())
  const lift = [
    boxShadowOf(definition.shadowColor, { opacity: 0.14, radius: 1, y: 1 }),
    boxShadowOf(definition.shadowColor, { opacity: 0.17, radius: 12, y: 8 }),
  ].join(', ')

  function faceOf(ocid: string): { name: string; imageUrl: string | null } | null {
    const character = characters.find((one) => one.ocid === ocid)
    return character === undefined ? null : { name: character.characterName, imageUrl: character.imageUrl ?? null }
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
            <Text className="text-lg font-semibold text-text">계산 기록</Text>
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
                      openRecord(record.id, new Date())
                      navigation.goBack()
                    }}
                    className="flex-1 gap-2 py-2.5 pl-[18px] pr-2 active:opacity-60"
                  >
                    <View className="flex-row items-baseline gap-2">
                      <Text className="text-base font-bold text-text">{title.date}</Text>
                      <Text className="text-13 font-semibold text-text-muted" style={TABULAR_NUMS}>
                        {title.time}
                      </Text>
                      {opened && (
                        <View className="h-5 justify-center self-center rounded-full bg-primary px-2">
                          <Text className="text-chip-sm font-bold text-on-primary">열려 있음</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-row items-center gap-2">
                        <View className="flex-row gap-0.5">
                          {record.characters.flatMap((character) => {
                            const face = faceOf(character.ocid)
                            return face === null
                              ? []
                              : [
                                  <CharacterAvatar
                                    key={character.ocid}
                                    imageUrl={face.imageUrl}
                                    name={face.name}
                                    size={22}
                                    className="bg-surface-2"
                                  />,
                                ]
                          })}
                        </View>
                        <Text className="text-xs text-text-muted">보스 {bosses.length}</Text>
                      </View>
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
