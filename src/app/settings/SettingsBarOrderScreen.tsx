/**
 * 하단 탭 순서 페이지. **끌어서 놓은 순서는 이 페이지에만 보이고, `적용` 을 눌러야 저장되고 바에 반영된다.**
 *
 * 카드마다 그 행의 바 미리보기를 끄는 목록 바로 위에 둔다. 이 화면에는 고정 영역이 없어 미리보기를 맨 위에 하나만 두면
 * 아래 카드를 끄는 동안 화면 밖으로 밀려난다. today 와 더보기는 옮길 수 없어 목록에 넣지 않고 미리보기에만 그린다.
 */
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { runOnJS } from 'react-native-reanimated'
import Sortable from 'react-native-sortables'

import { isSameBarOrder } from '../../features/bar-order/config'
import { useBarOrderStore } from '../../features/bar-order/store'
import { useSettingsNavigation } from '../../hooks/useSettingsNavigation'
import { BAR_MAX_WIDTH } from '../../lib/bottom-bar-metrics'
import { selectionFeedback } from '../../native/haptics'
import { BAR_GROUPS, type BarOrder, type GroupId } from '../../navigation/bar-groups'
import type { TabRouteName } from '../../navigation/routes'
import { useThemeAppearance } from '../../theme/context'

import { Button, Card, Text } from '../../components/atoms'
import { BackButton } from '../../components/molecules/BackButton/BackButton'
import { BarIcon } from '../../components/organisms/BottomBar/BarGlyph'
import { BarPreview } from '../../components/organisms/BottomBar/BarPreview'
import { DragHandle } from '../../components/organisms/CharacterRow/DragHandle'
import { PageHeader } from '../../components/templates/PageHeader/PageHeader'
import { PageHeaderTitleRow } from '../../components/templates/PageHeader/PageHeaderTitleRow'
import { ScreenScroll } from '../../components/templates/ScreenScroll/ScreenScroll'
import { SectionTitle } from './SectionTitle'
import { SettingsActionBar } from './SettingsActionBar'
import { SETTINGS_CARD_CLASS } from './row-class'

type BarKey = GroupId | TabRouteName

const LABELS = new Map<BarKey, string>(
  BAR_GROUPS.flatMap((group) => [
    [group.id, group.label],
    ...group.subs.map((sub): [BarKey, string] => [sub.page, sub.label]),
  ]),
)

const SUB_GROUPS = BAR_GROUPS.filter((group) => group.subs.length > 0)

/** 페이지 `px-4` · 카드 `p-1.5` · 미리보기 칸 `p-1.5` 의 좌우 합. 셋 중 하나를 바꾸면 미리보기가 카드를 넘거나 모자란다 */
const PREVIEW_GUTTER_PX = (16 + 6 + 6) * 2

interface OrderCardProps<T extends BarKey> {
  title: string
  /** 미리보기에 그리는 행 전체. 그룹 행이면 양 끝의 today 와 더보기도 든다 */
  previewKeys: readonly BarKey[]
  hasBack: boolean
  previewWidthPx: number
  previewTestID: string
  /** 끌어서 옮기는 칸 */
  keys: readonly T[]
  onDrop: (keys: T[]) => void
}

function OrderCard<T extends BarKey>(props: OrderCardProps<T>): React.JSX.Element {
  const { definition } = useThemeAppearance()

  return (
    <View className="gap-2">
      <SectionTitle>{props.title}</SectionTitle>
      <Card className={SETTINGS_CARD_CLASS}>
        <View className="items-center p-1.5">
          <BarPreview
            testID={props.previewTestID}
            items={props.previewKeys.map((key) => ({ id: key, label: LABELS.get(key) ?? key }))}
            hasBack={props.hasBack}
            widthPx={props.previewWidthPx}
          />
        </View>
        <Sortable.Grid
          columns={1}
          // 카드의 칸 사이 간격(`SETTINGS_CARD_CLASS` 의 `gap-1`)과 같다.
          rowGap={4}
          data={[...props.keys]}
          keyExtractor={(key) => key}
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
          onDragEnd={({ data }) => props.onDrop(data)}
          renderItem={({ item }) => (
            <View className="h-12 flex-row items-center gap-2.5 rounded-[10px] bg-card-inset pl-2.5 pr-3.5">
              <Sortable.Handle>
                <DragHandle />
              </Sortable.Handle>
              <BarIcon id={item} className="h-5 w-5" color={definition.textMuted} strokeWidth={1.8} />
              <Text className="text-sm font-semibold text-text">{LABELS.get(item) ?? item}</Text>
            </View>
          )}
        />
      </Card>
    </View>
  )
}

export function SettingsBarOrderScreen(): React.JSX.Element {
  const navigation = useSettingsNavigation()
  const { order, save } = useBarOrderStore()
  const [draft, setDraft] = useState<BarOrder>(order)
  const [actionBarHeightPx, setActionBarHeightPx] = useState(0)
  const { width: windowWidthPx } = useWindowDimensions()
  // 바와 같은 상한이다. 넓은 화면에서 미리보기만 길어지면 칸이 바보다 벌어진다.
  const previewWidthPx = Math.min(windowWidthPx - PREVIEW_GUTTER_PX, BAR_MAX_WIDTH)

  async function handleApply(): Promise<void> {
    await save(draft)
    navigation.goBack()
  }

  const isUnchanged = isSameBarOrder(draft, order)
  const firstGroup = draft.groups[0]
  const lastGroup = draft.groups[draft.groups.length - 1]

  return (
    <View className="flex-1">
      <ScreenScroll
        hasTabBar={false}
        header={
          <PageHeader>
            <PageHeaderTitleRow className="gap-2">
              <BackButton onPress={() => navigation.goBack()} />
              <Text className="text-lg font-bold text-text">하단 탭 순서</Text>
            </PageHeaderTitleRow>
          </PageHeader>
        }
      >
        <View className="gap-4 px-4 pb-4" testID="screen-SettingsBarOrder" style={{ paddingBottom: actionBarHeightPx }}>
          <OrderCard
            title="하단 탭"
            previewKeys={draft.groups}
            hasBack={false}
            previewWidthPx={previewWidthPx}
            previewTestID="bar-order-preview-groups"
            keys={draft.groups.slice(1, -1)}
            onDrop={(groups) => setDraft({ ...draft, groups: [firstGroup, ...groups, lastGroup] })}
          />
          {SUB_GROUPS.map((group) => (
            <OrderCard
              key={group.id}
              title={group.label}
              previewKeys={draft.subs[group.id] ?? []}
              hasBack
              previewWidthPx={previewWidthPx}
              previewTestID={`bar-order-preview-${group.id}`}
              keys={draft.subs[group.id] ?? []}
              onDrop={(pages) => setDraft({ ...draft, subs: { ...draft.subs, [group.id]: pages } })}
            />
          ))}
        </View>
      </ScreenScroll>

      <SettingsActionBar testID="bar-order-action-bar" onHeight={setActionBarHeightPx}>
        <Button
          variant="primary"
          disabled={isUnchanged}
          onPress={() => {
            void handleApply()
          }}
          // `disabled` 프롭은 색을 바꾸지 않는다. 그대로 두면 꺼진 버튼이 멀쩡한 색으로 보인다.
          className={`w-full items-center${isUnchanged ? ' opacity-50' : ''}`}
        >
          적용
        </Button>
      </SettingsActionBar>
    </View>
  )
}
