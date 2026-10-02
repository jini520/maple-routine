/**
 * 등록 시트의 보스 목록. 보스를 캐릭터별로 묶어 묶음마다 머리 줄(얼굴 · 이름 · 보스 수) 아래에 줄을 쌓는다.
 *
 * 줄은 손잡이 · 초상 · 보스 · 난이도 · `✕` 이다. 손잡이를 끌어 **같은 묶음 안에서** 차례를 바꾸고 `✕` 로 뺀다.
 * 캐릭터와 난이도는 보스 추가 화면에서 바꾼다. 상세(읽기 모드)에서는 손잡이 · `✕` · 보스 추가 칸 없이 줄만 선다.
 */
import { Pressable, View } from 'react-native'
import { runOnJS } from 'react-native-reanimated'
import Sortable from 'react-native-sortables'

import { Badge, PlusIcon, Text, XIcon } from '../../components/atoms'
import { BossPortrait } from '../../components/molecules/BossPortrait/BossPortrait'
import { DragHandle } from '../../components/organisms/CharacterRow/DragHandle'
import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { groupBossesByCharacter, moveWithinGroup } from '../../features/party-appointments/boss-groups'
import { mixOklab } from '../../lib/color'
import { useThemeAppearance } from '../../theme/context'
import { bossAliasOf, bossPortraitSlugOf } from '../../lib/boss/bosses'
import { selectionFeedback } from '../../native/haptics'
import type { BossDifficulty } from '../../types'
import type { PartyAppointmentBoss } from '../../types/party-appointment'
import { CharacterGroupHeader } from './CharacterGroupHeader'

export interface AppointmentBossListProps {
  bosses: PartyAppointmentBoss[]
  /** 캐릭터 `ocid → 이름` */
  names: ReadonlyMap<string, string>
  /** 캐릭터 `ocid → 얼굴 그림 URL` */
  faces: ReadonlyMap<string, string | null>
  onChange: (bosses: PartyAppointmentBoss[]) => void
  onAdd: () => void
  /** 상세의 읽기 모드 */
  readOnly?: boolean
}

/** 같은 보스를 다른 캐릭터로 넣을 수 있어 보스 key 만으로는 줄이 안 갈린다 */
function rowKey(boss: PartyAppointmentBoss): string {
  return `${boss.ocid}:${boss.bossKey}`
}

/** 줄 하나의 가운데(초상 · 이름 · 난이도). 손잡이와 `✕` 는 부르는 쪽이 앞뒤에 붙인다 */
function RowBody(props: { boss: PartyAppointmentBoss }): React.JSX.Element {
  const { boss } = props
  const name = bossAliasOf(boss.bossKey, boss.bossKey)
  return (
    <>
      <BossPortrait portraitSlug={bossPortraitSlugOf(boss.bossKey)} label={name} size={24} />
      <Text className="shrink text-13 font-semibold text-text" numberOfLines={1}>
        {name}
      </Text>
      <Badge variant={boss.difficulty as BossDifficulty} size="mini">
        {DIFFICULTY_NAME[boss.difficulty as BossDifficulty] ?? boss.difficulty}
      </Badge>
    </>
  )
}

const ROW_CLASS = 'h-[46px] flex-row items-center gap-2 rounded-[10px] bg-card-body pr-2'

export function AppointmentBossList(props: AppointmentBossListProps): React.JSX.Element {
  const { bosses } = props
  const { definition } = useThemeAppearance()
  // 주황 글자색을 시트 바탕 쪽으로 반쯤 섞은 점선. 글자보다 한 단계 옅어 버튼 테두리로만 읽힌다.
  const dashColor = mixOklab(definition.primaryInk, definition.surface, 0.55)
  const readOnly = props.readOnly === true
  const groups = groupBossesByCharacter(bosses)

  return (
    <View className="gap-1.5 px-4">
      <Text className="text-11 font-semibold text-text-muted">보스 {bosses.length}</Text>
      {groups.map((group) => (
        <View key={group.ocid} className="gap-1.5 pt-1">
          <CharacterGroupHeader
            name={props.names.get(group.ocid) ?? ''}
            imageUrl={props.faces.get(group.ocid) ?? null}
            count={group.bosses.length}
          />
          {readOnly ? (
            group.bosses.map((boss) => (
              <View key={rowKey(boss)} className={`${ROW_CLASS} pl-3`}>
                <RowBody boss={boss} />
              </View>
            ))
          ) : (
            // 묶음마다 정렬 줄이 따로라, 끌어도 다른 캐릭터 묶음으로는 못 넘어간다.
            <Sortable.Grid
              columns={1}
              rowGap={6}
              data={group.bosses}
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
              onDragEnd={({ fromIndex, toIndex }) => props.onChange(moveWithinGroup(bosses, group.ocid, fromIndex, toIndex))}
              renderItem={({ item }) => {
                const name = bossAliasOf(item.bossKey, item.bossKey)
                const characterName = props.names.get(item.ocid) ?? ''
                return (
                  <View className={ROW_CLASS}>
                    <Sortable.Handle>
                      <DragHandle />
                    </Sortable.Handle>
                    <RowBody boss={item} />
                    <Pressable
                      role="button"
                      aria-label={`${characterName} ${name} 빼기`}
                      hitSlop={8}
                      onPress={() => props.onChange(bosses.filter((boss) => rowKey(boss) !== rowKey(item)))}
                      className="ml-auto"
                    >
                      <XIcon className="h-3.5 w-3.5 text-text-disabled" strokeWidth={2} aria-hidden />
                    </Pressable>
                  </View>
                )
              }}
            />
          )}
        </View>
      ))}
      {!readOnly && (
        // 보스 줄과 같은 크기의 점선 빈 칸. 여기에 줄이 하나 더 들어온다는 뜻이다.
        <Pressable
          role="button"
          aria-label="보스 추가"
          onPress={props.onAdd}
          style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: dashColor }}
          className="mt-1 h-[46px] flex-row items-center justify-center gap-1.5 rounded-[10px] active:opacity-60"
        >
          <PlusIcon className="h-3.5 w-3.5 text-primary-ink" strokeWidth={2.6} aria-hidden />
          <Text className="text-13 font-bold text-primary-ink">보스 추가</Text>
        </Pressable>
      )}
    </View>
  )
}
