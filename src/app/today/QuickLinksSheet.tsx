/**
 * 빠른 이동 편집 시트. 주간 보스 수익 계산기의 보스 선택 시트와 같은 구조다.
 *
 * 본문은 묶음 카드 안의 5열 타일이고, 바닥 트레이는 위젯과 같은 5열 칸에 빈 칸까지 그려 저장될 모습을 미리 보인다.
 * 고친 구성은 `적용` 을 눌러야 저장된다. 시트를 그냥 닫으면 버린다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { runOnJS } from 'react-native-reanimated'
import Sortable from 'react-native-sortables'

import { Badge, CheckIcon, Text } from '../../components/atoms'
import { Segment } from '../../components/molecules/Segment/Segment'
import { BottomSheet } from '../../components/organisms/BottomSheet/BottomSheet'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import {
  QUICK_LINK_GROUPS,
  QUICK_LINK_NAMES,
  QUICK_LINKS_PER_ROW,
  capacityOf,
  toggleQuickLink,
  withRows,
} from '../../features/quick-links/config'
import { useQuickLinksStore } from '../../features/quick-links/store'
import { boxShadowOf, type ShadowLayer } from '../../lib/shadow'
import { selectionFeedback } from '../../native/haptics'
import { useThemeAppearance } from '../../theme/context'
import type { QuickLinkId, QuickLinkRows, QuickLinksConfig } from '../../types/quick-links'
import { QUICK_LINK_ICONS, useQuickLinkColors } from './quick-links'

/** 칸이 다 찼을 때 고르지 않은 타일. 흐리지 않으면 누를 수 없는 타일이 멀쩡해 보인다 */
const LOCKED_OPACITY = 0.35
const CHECK_SIZE = 22
const CHECK_GAP = 3
/** 트레이 칸 한 줄의 높이. 빈 칸 판과 정렬 격자가 같은 자리에 서야 칸이 겹쳐 보인다 */
const SLOT_HEIGHT = 64
const SLOT_ROW_GAP = 10
/** 보스 선택 트레이와 같은 그림자. 구분선 대신 위로 드리워 본문과 가른다 */
const TRAY_SHADOW: ShadowLayer = { opacity: 0.23, radius: 12, y: -10 }
const ROW_OPTIONS = ['1', '2'] as const

export interface QuickLinksSheetProps {
  config: QuickLinksConfig
  onClose: () => void
}

function QuickLinkCircle(props: { id: QuickLinkId; size: number }): React.JSX.Element {
  const { tint, ink } = useQuickLinkColors()
  const Icon = QUICK_LINK_ICONS[props.id]
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: props.size, height: props.size, backgroundColor: tint }}
    >
      <Icon color={ink} size={21} strokeWidth={1.9} aria-hidden />
    </View>
  )
}

function Tile(props: { id: QuickLinkId; selected: boolean; locked: boolean; onPress: () => void }): React.JSX.Element {
  const { definition } = useThemeAppearance()
  return (
    <Pressable
      testID={`quick-links-tile-${props.id}`}
      role="button"
      aria-label={QUICK_LINK_NAMES[props.id].name}
      aria-selected={props.selected}
      disabled={props.locked}
      onPress={props.onPress}
      // RN 의 `disabled` 는 모양을 바꾸지 않는다.
      style={props.locked ? { opacity: LOCKED_OPACITY } : undefined}
      className="w-1/5 items-center gap-1.5 pb-3"
    >
      <View>
        <QuickLinkCircle id={props.id} size={48} />
        {props.selected && (
          <View
            testID={`quick-links-check-${props.id}`}
            pointerEvents="none"
            className="absolute items-center justify-center rounded-full bg-primary"
            style={{
              right: -CHECK_GAP,
              bottom: -CHECK_GAP,
              width: CHECK_SIZE,
              height: CHECK_SIZE,
              boxShadow: `0 0 0 ${CHECK_GAP}px ${definition.surface}`,
            }}
          >
            <CheckIcon className="h-3 w-3 text-on-primary" strokeWidth={4} aria-hidden />
          </View>
        )}
      </View>
      <Text className={`text-11 ${props.selected ? 'font-bold text-text' : 'text-text-muted'}`} numberOfLines={1}>
        {QUICK_LINK_NAMES[props.id].short}
      </Text>
    </Pressable>
  )
}

function TrayItem(props: { id: QuickLinkId; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      testID={`quick-links-tray-${props.id}`}
      role="button"
      aria-label={`${QUICK_LINK_NAMES[props.id].name} 빼기`}
      onPress={props.onPress}
      className="items-center gap-[5px]"
      style={{ height: SLOT_HEIGHT }}
    >
      <QuickLinkCircle id={props.id} size={46} />
      <Text className="text-9 text-text-muted" numberOfLines={1}>
        {QUICK_LINK_NAMES[props.id].short}
      </Text>
    </Pressable>
  )
}

export function QuickLinksSheet(props: QuickLinksSheetProps): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const [draft, setDraft] = useState(props.config)
  const capacity = capacityOf(draft.rows)
  const full = draft.ids.length >= capacity
  const empty = draft.ids.length === 0

  async function apply(): Promise<void> {
    await useQuickLinksStore.getState().save(draft)
    props.onClose()
  }

  return (
    <BottomSheet
      testId="quick-links-sheet"
      label="빠른 이동 편집"
      onClose={props.onClose}
      header={<Text className="text-base font-bold text-text">빠른 이동</Text>}
      footer={
        <View className="-mx-4 -mt-3 bg-bg pt-3" style={{ boxShadow: boxShadowOf(definition.shadowColor, TRAY_SHADOW) }}>
          <View className="flex-row items-center justify-between px-5">
            <Badge variant="primary" style={TABULAR_NUMS}>
              {`${draft.ids.length} / ${capacity}`}
            </Badge>
            <Segment
              size="sm"
              options={ROW_OPTIONS}
              selected={String(draft.rows) as (typeof ROW_OPTIONS)[number]}
              labelOf={(value) => (value === '1' ? '한 줄' : '두 줄')}
              onSelect={(value) => setDraft(withRows(draft, Number(value) as QuickLinkRows))}
            />
          </View>
          <View className="mx-4 mt-3 rounded-[14px] bg-surface p-3">
            {/*
              빈 칸 판. 정렬 격자 뒤에 같은 칸 크기로 깐다. 고른 칸 자리는 비워 둔다. 칸의 원이 반투명이라 밑에
              회색 원이 있으면 비쳐서 위젯보다 탁해 보인다.
            */}
            <View pointerEvents="none" className="absolute left-3 right-3 top-3 flex-row flex-wrap" style={{ rowGap: SLOT_ROW_GAP }}>
              {Array.from({ length: capacity }, (_, at) => (
                <View key={at} className="items-center" style={{ width: `${100 / QUICK_LINKS_PER_ROW}%`, height: SLOT_HEIGHT }}>
                  {at >= draft.ids.length && <View className="h-[46px] w-[46px] rounded-full bg-control-track" />}
                </View>
              ))}
            </View>
            <View style={{ minHeight: draft.rows * SLOT_HEIGHT + (draft.rows - 1) * SLOT_ROW_GAP }}>
              <Sortable.Grid
                data={draft.ids}
                keyExtractor={(id) => id}
                columns={QUICK_LINKS_PER_ROW}
                rowGap={SLOT_ROW_GAP}
                columnGap={0}
                onOrderChange={() => {
                  'worklet'
                  runOnJS(selectionFeedback)()
                }}
                onDragEnd={({ data }) => setDraft({ ...draft, ids: data })}
                renderItem={({ item }) => (
                  <TrayItem id={item} onPress={() => setDraft({ ...draft, ids: draft.ids.filter((id) => id !== item) })} />
                )}
              />
            </View>
          </View>
          <Text className="px-5 pb-3 pt-2 text-center text-11 text-text-muted">눌러서 빼고, 길게 눌러 옮깁니다</Text>
          <View className="px-4">
            <Pressable
              role="button"
              aria-label={empty ? '화면을 골라 주세요' : '적용'}
              disabled={empty}
              onPress={() => void apply()}
              className={`h-[52px] items-center justify-center rounded-full ${empty ? 'bg-surface-2' : 'bg-primary'}`}
            >
              <Text className={`text-base font-bold ${empty ? 'text-text-disabled' : 'text-on-primary'}`}>
                {empty ? '화면을 골라 주세요' : '적용'}
              </Text>
            </Pressable>
          </View>
        </View>
      }
    >
      <View className="gap-3 px-4 pb-3">
        {QUICK_LINK_GROUPS.map((group) => (
          <View key={group.label} className="rounded-[22px] bg-surface px-3 pb-1 pt-3.5">
            <Text className="px-1.5 pb-2.5 text-xs font-bold text-text">{group.label}</Text>
            <View className="flex-row flex-wrap">
              {group.ids.map((id) => {
                const selected = draft.ids.includes(id)
                return (
                  <Tile
                    key={id}
                    id={id}
                    selected={selected}
                    locked={full && !selected}
                    onPress={() => setDraft(toggleQuickLink(draft, id))}
                  />
                )
              })}
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  )
}
