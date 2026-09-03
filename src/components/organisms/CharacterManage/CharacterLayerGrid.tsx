/**
 * 두 층을 함께 담는 격자.
 *
 * ```
 * [ ...선택된 행, 구분자(고정), ...후보 행 ]
 * ```
 *
 * **두 목록으로 가르지 말 것.** 형제여야 층을 넘는 것이 같은 격자 안의 재배열이 되고, 그때만
 * 카드가 옛 자리에서 새 자리로 미끄러진다. 부모가 다르면 카드가 한쪽에서 언마운트되고 다른
 * 쪽에서 마운트돼 그 움직임이 사라진다.
 *
 * **끌 수 있는 것은 위층 행뿐이다.** 구분자와 후보 행에 `mode="fixed-order"` 를 준다. 그 모드는
 * 제스처를 안 붙이고, 남이 그 칸을 밀어내지도 못한다. 그래서 위층 행을 아래로 끌면 놓을 자리가
 * 없어 제자리로 돌아온다. 층을 넘는 이동은 누르기와 `✕` 둘뿐이다.
 *
 * `선택된 캐릭터 N개` 라벨을 이 격자 안에 넣지 말 것. 첫 칸이 고정 항목이 되어 맨 위로 옮기려는
 * 카드가 설 자리를 잃는다.
 */
import { View } from 'react-native'
import type { ScrollView } from 'react-native'
import type { AnimatedRef } from 'react-native-reanimated'
import Sortable from 'react-native-sortables'

import type { SelectedCharacterView } from '../../../features/character-manage/derivations'
import { SEPARATOR_KEY, selectedFromOrder } from '../../../features/character-manage/grid-split'
import type { CharacterPickerEntry } from '../../../types'

import { AddMark } from '../../organisms/CharacterRow/AddMark'
import { CharacterRow } from '../../organisms/CharacterRow/CharacterRow'
import { DragHandle } from '../../organisms/CharacterRow/DragHandle'
import { RemoveButton } from '../../organisms/CharacterRow/RemoveButton'
import { RepresentativeStar } from '../../organisms/CharacterRow/RepresentativeStar'

/**
 * 행이 어느 층인지 밝히는 표식. 두 층이 한 격자의 형제라 상자로는 못 가른다.
 */
export const SELECTED_ROW_TEST_ID = 'character-manage-selected-row'
export const CANDIDATE_ROW_TEST_ID = 'character-manage-candidate-row'

/** 접근성 액션 식별자. 사람이 듣는 것은 `label` 이고 이 이름은 우리끼리 쓴다. */
const MOVE_UP = 'moveUp'
const MOVE_DOWN = 'moveDown'

type Cell =
  | { readonly kind: 'candidate'; readonly key: string; readonly entry: CharacterPickerEntry }
  | { readonly kind: 'selected'; readonly key: string; readonly view: SelectedCharacterView }
  | { readonly kind: 'separator'; readonly key: string }

export interface CharacterLayerGridProps {
  views: SelectedCharacterView[]
  candidates: CharacterPickerEntry[]
  representativeOcid: string | null
  /** 끌기 중 자동 스크롤이 굴릴 스크롤 뷰. 화면이 소유한다. */
  scrollableRef: AnimatedRef<ScrollView>
  /** 구분자 칸에 그릴 것. 구분선 · 계정 드롭다운 · `캐릭터 추가` 라벨이 여기 든다. */
  separator: React.ReactNode
  /** 격자가 준 순서에서 선택된 것만 뽑아 넘긴다. 셋(순서·추가·해제)이 이 문 하나다. */
  onOrderChange: (selectedOcids: string[]) => void
  /** 누르기로 옮길 때. 끌기와 같은 결과를 낸다. */
  onAdd: (ocid: string) => void
  onRemove: (ocid: string) => void
  onSelectRepresentative: (ocid: string) => void
}

export function CharacterLayerGrid(props: CharacterLayerGridProps): React.JSX.Element {
  const cells: Cell[] = [
    ...props.views.map((view): Cell => ({ key: view.ocid, kind: 'selected', view })),
    { key: SEPARATOR_KEY, kind: 'separator' },
    ...props.candidates.map((entry): Cell => ({ entry, key: entry.ocid, kind: 'candidate' })),
  ]
  const selectedCount = props.views.length

  return (
    <Sortable.Grid
      columns={1}
      rowGap={8}
      data={cells}
      keyExtractor={(cell) => cell.key}
      customHandle
      scrollableRef={props.scrollableRef}
      autoScrollActivationOffset={72}
      autoScrollMaxVelocity={720}
      // 핸들에 손이 닿으면 곧바로 끌기다. 기본값 200ms 는 카드 전체가 시작점일 때 목록 굴리기와
      // 가르려고 두는 값인데, 여기는 핸들이 따로 있어 기다릴 이유가 없다.
      dragActivationDelay={0}
      // 끌리는 행은 그림자로만 뜬다. 크기를 키우거나 나머지를 흐리면 대표가 정해졌을 때의 흐림
      // (`dimmed`)과 같은 자리에서 두 가지 뜻이 겹친다.
      activeItemScale={1}
      inactiveItemOpacity={1}
      // 칸이 늘고 주는 것이 아니라 **자리를 옮기는** 화면이다. 나타남·사라짐 효과를 주면 층을
      // 넘는 카드가 한 번 사라졌다 나타난 것처럼 보여 이 결정이 무의미해진다.
      itemEntering={null}
      itemExiting={null}
      // 배열은 놓을 때 한 번만 바뀐다. 끄는 동안 움직이는 것은 그림뿐이라 도중에 취소되면 저장
      // 활성 판정이 안 깜빡인다.
      onDragEnd={({ indexToKey }) => {
        const next = selectedFromOrder(indexToKey)
        // 구분자가 없으면 아무것도 안 바꾼다. 전부를 선택으로 읽으면 후보 전원이 한 번에 추적
        // 목록에 들어간다.
        if (next !== null) props.onOrderChange(next)
      }}
      renderItem={({ item, index }) => {
        if (item.kind === 'separator') {
          // 고정 항목. 이 모드가 아니면 다른 카드가 이것을 밀어내 두 층의 경계가 사라진다.
          return <Sortable.Handle mode="fixed-order">{props.separator}</Sortable.Handle>
        }
        if (item.kind === 'selected') {
          return (
            <SelectedRow
              testID={SELECTED_ROW_TEST_ID}
              view={item.view}
              index={index}
              count={selectedCount}
              isRepresentative={props.representativeOcid === item.view.ocid}
              // 하나가 채워지면 나머지는 흐려진다. 비활성이 아니라 톤만 낮춘다.
              dimmed={
                props.representativeOcid !== null && props.representativeOcid !== item.view.ocid
              }
              onMove={(from, to) => props.onOrderChange(moved(props.views, from, to))}
              onRemove={props.onRemove}
              onSelectRepresentative={props.onSelectRepresentative}
            />
          )
        }
        return (
          <CandidateRow
            testID={CANDIDATE_ROW_TEST_ID}
            entry={item.entry}
            onAdd={props.onAdd}
          />
        )
      }}
    />
  )
}

/** 접근성 액션이 만드는 새 순서. 끌기가 `onDragEnd` 로 내는 것과 같은 모양으로 맞춘다. */
function moved(views: SelectedCharacterView[], fromIndex: number, toIndex: number): string[] {
  const ocids = views.map((view) => view.ocid)
  const [taken] = ocids.splice(fromIndex, 1)
  if (taken === undefined) return views.map((view) => view.ocid)
  ocids.splice(toIndex, 0, taken)
  return ocids
}

interface SelectedRowProps {
  testID: string
  view: SelectedCharacterView
  index: number
  count: number
  isRepresentative: boolean
  dimmed: boolean
  onMove: (fromIndex: number, toIndex: number) => void
  onRemove: (ocid: string) => void
  onSelectRepresentative: (ocid: string) => void
}

function SelectedRow(props: SelectedRowProps): React.JSX.Element {
  const { count, index, view } = props

  // **할 수 있는 것만 준다**. 첫 행에 `위로 옮기기`를 주면 눌러도 아무 일이 없다.
  const reorderActions = [
    ...(index > 0 ? [{ name: MOVE_UP, label: '위로 옮기기' }] : []),
    ...(index < count - 1 ? [{ name: MOVE_DOWN, label: '아래로 옮기기' }] : []),
  ]

  return (
    <CharacterRow
      testID={props.testID}
      name={view.name}
      level={view.level}
      jobClass={view.jobClass}
      world={view.world}
      imageUrl={view.imageUrl}
      unavailable={view.unavailable}
      leading={
        <Sortable.Handle>
          {/* 끌기와 같은 결과를 내는 화면 밖 경로. 스크린리더가 이 핸들에 서면 로터에
              위로·아래로 옮기기 가 뜬다. 두 경로가 같은 순서를 만든다. */}
          <View
            accessible
            accessibilityLabel={`${view.name} 순서 변경`}
            accessibilityActions={reorderActions}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === MOVE_UP) props.onMove(index, index - 1)
              if (event.nativeEvent.actionName === MOVE_DOWN) props.onMove(index, index + 1)
            }}
          >
            <DragHandle />
          </View>
        </Sortable.Handle>
      }
      trailing={
        <View className="shrink-0 flex-row items-center gap-1">
          <RepresentativeStar
            label={view.name}
            filled={props.isRepresentative}
            dimmed={props.dimmed}
            onPress={() => props.onSelectRepresentative(view.ocid)}
          />
          <RemoveButton label={view.name} onPress={() => props.onRemove(view.ocid)} />
        </View>
      }
    />
  )
}

/**
 * 후보 카드. 핸들이 없고 끌리지 않는 칸.
 *
 * 이 층에는 바꿀 순서가 없다. 로스터가 준 레벨 내림차순이고 저장되지도 않는다. 카드 전체를
 * `mode="fixed-order"` 로 감싸면 끌기만 빠지고 **누름은 그대로 통한다**.
 */
function CandidateRow(props: {
  testID: string
  entry: CharacterPickerEntry
  onAdd: (ocid: string) => void
}): React.JSX.Element {
  const { entry } = props

  return (
    <Sortable.Handle mode="fixed-order">
      <CharacterRow
        testID={props.testID}
        name={entry.name}
        level={entry.level}
        jobClass={entry.jobClass}
        world={entry.world}
        imageUrl={entry.imageUrl}
        // 누르는 것은 카드 전체다. `＋` 는 표시일 뿐 버튼이 아니다.
        onPress={() => props.onAdd(entry.ocid)}
        trailing={<AddMark />}
      />
    </Sortable.Handle>
  )
}
