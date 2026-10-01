/**
 * 등록 시트의 보스 목록. 줄마다 손잡이 · 차례 · 초상 · 보스 · 난이도 · 캐릭터 · `✕`.
 *
 * 손잡이를 끌어 도는 차례를 바꾸고 `✕` 로 뺀다. 캐릭터와 난이도는 보스 추가 화면에서 바꾼다.
 * 상세(읽기 모드)에서는 손잡이 · `✕` · 보스 추가 칸 없이 줄만 선다.
 */
import { Pressable, View } from 'react-native'
import { runOnJS } from 'react-native-reanimated'
import Sortable from 'react-native-sortables'

import { Badge, PlusIcon, Text, XIcon } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { DragHandle } from '../../components/organisms/CharacterRow/DragHandle'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { moveItem } from '../../features/party-appointments/draft'
import { mixOklab } from '../../lib/color'
import { useThemeAppearance } from '../../theme/context'
import { bossAliasOf, bossPortraitSlugOf } from '../../lib/boss/bosses'
import { selectionFeedback } from '../../native/haptics'
import type { BossDifficulty } from '../../types'
import type { PartyAppointmentBoss } from '../../types/party-appointment'

export interface AppointmentBossListProps {
  bosses: PartyAppointmentBoss[]
  /** 캐릭터 `ocid → 이름` */
  names: ReadonlyMap<string, string>
  colorOf: (ocid: string) => string
  onChange: (bosses: PartyAppointmentBoss[]) => void
  onAdd: () => void
  /** 상세의 읽기 모드 */
  readOnly?: boolean
}

/** 같은 보스를 다른 캐릭터로 넣을 수 있어 보스 key 만으로는 줄이 안 갈린다 */
function rowKey(boss: PartyAppointmentBoss): string {
  return `${boss.ocid}:${boss.bossKey}`
}

/** 줄 하나의 가운데(차례 · 초상 · 이름 · 난이도 · 캐릭터). 손잡이와 `✕` 는 부르는 쪽이 앞뒤에 붙인다 */
function RowBody(props: {
  boss: PartyAppointmentBoss
  index: number
  names: ReadonlyMap<string, string>
  colorOf: (ocid: string) => string
}): React.JSX.Element {
  const { boss } = props
  const name = bossAliasOf(boss.bossKey, boss.bossKey)
  return (
    <>
      <Text className="w-3 text-center text-11 font-bold text-text-muted">{props.index + 1}</Text>
      <BossPortrait portraitSlug={bossPortraitSlugOf(boss.bossKey)} label={name} size={24} />
      <Text className="shrink text-13 font-semibold text-text" numberOfLines={1}>
        {name}
      </Text>
      <Badge variant={boss.difficulty as BossDifficulty} size="mini">
        {DIFFICULTY_NAME[boss.difficulty as BossDifficulty] ?? boss.difficulty}
      </Badge>
      <View className="ml-auto flex-row items-center gap-1 rounded-full border border-border bg-surface py-0.5 pl-1 pr-2">
        <View className="h-3 w-3 rounded-full" style={{ backgroundColor: props.colorOf(boss.ocid) }} />
        <Text className="text-11 text-text" numberOfLines={1}>
          {props.names.get(boss.ocid) ?? ''}
        </Text>
      </View>
    </>
  )
}

const ROW_CLASS = 'h-[46px] flex-row items-center gap-2 rounded-[10px] bg-card-body pr-2'

export function AppointmentBossList(props: AppointmentBossListProps): React.JSX.Element {
  const { bosses } = props
  const { definition } = useThemeAppearance()
  // 주황 글자색을 시트 바탕 쪽으로 반쯤 섞은 점선. 글자보다 한 단계 옅어 버튼 테두리로만 읽힌다.
  const dashColor = mixOklab(definition.primaryInk, definition.surface, 0.55)
  if (props.readOnly === true) {
    return (
      <View className="gap-1.5 px-4">
        <Text className="text-11 font-semibold text-text-muted">보스 {bosses.length}</Text>
        {bosses.map((boss, index) => (
          <View key={rowKey(boss)} className={`${ROW_CLASS} pl-2`}>
            <RowBody boss={boss} index={index} names={props.names} colorOf={props.colorOf} />
          </View>
        ))}
      </View>
    )
  }
  return (
    <View className="gap-1.5 px-4">
      <Text className="text-11 font-semibold text-text-muted">
        보스 {bosses.length}
      </Text>
      <Sortable.Grid
        columns={1}
        rowGap={6}
        data={bosses}
        keyExtractor={rowKey}
        customHandle
        dragActivationDelay={0}
        activeItemScale={1}
        inactiveItemOpacity={1}
        itemEntering={null}
        itemExiting={null}
        onOrderChange={() => {
          'worklet'
          runOnJS(selectionFeedback)()
        }}
        onDragEnd={({ fromIndex, toIndex }) => props.onChange(moveItem(bosses, fromIndex, toIndex))}
        renderItem={({ item, index }) => {
          const name = bossAliasOf(item.bossKey, item.bossKey)
          const characterName = props.names.get(item.ocid) ?? ''
          return (
            <View className={ROW_CLASS}>
              <Sortable.Handle>
                <DragHandle />
              </Sortable.Handle>
              <RowBody boss={item} index={index} names={props.names} colorOf={props.colorOf} />
              <Pressable
                role="button"
                aria-label={`${characterName} ${name} 빼기`}
                hitSlop={8}
                onPress={() => props.onChange(bosses.filter((_, at) => at !== index))}
              >
                <XIcon className="h-3.5 w-3.5 text-text-disabled" strokeWidth={2} aria-hidden />
              </Pressable>
            </View>
          )
        }}
      />
      {/* 보스 줄과 같은 크기의 점선 빈 칸. 여기에 줄이 하나 더 들어온다는 뜻이다. */}
      <Pressable
        role="button"
        aria-label="보스 추가"
        onPress={props.onAdd}
        style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: dashColor }}
        className="h-[46px] flex-row items-center justify-center gap-1.5 rounded-[10px] active:opacity-60"
      >
        <PlusIcon className="h-3.5 w-3.5 text-primary-ink" strokeWidth={2.6} aria-hidden />
        <Text className="text-13 font-bold text-primary-ink">보스 추가</Text>
      </Pressable>
    </View>
  )
}
