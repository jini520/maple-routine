/**
 * `선택됨` 층의 행 목록. 순서를 끌어서 바꾸는 자리.
 *
 * 순서를 바꾸는 길이 둘이다. 핸들을 끄는 손가락과, 그것을 못 쓰는 사람을 위한 접근성 액션. 둘이
 * **`onMove` 하나로** 들어온다. 각자 배열을 만들면 언젠가 갈라진다.
 *
 * 끌기는 `Sortable.Grid` 가 하고 여기서 하는 일은 프롭을 고르는 것뿐이다. 한 줄짜리 목록에 격자를
 * 쓰는 것은 **행이 칸 너비를 물려받기** 때문이다. `Sortable.Flex` 는 `alignItems` 가 `stretch` 를
 * 안 받아 행이 이름 길이만큼만 넓어진다.
 *
 * 끌기는 **핸들에서만** 시작한다(`customHandle` + `Sortable.Handle`). 행 전체를 시작점으로 두면
 * 목록을 굴리려던 손가락이 행을 집는다.
 */
import { View } from 'react-native'
import type { ScrollView } from 'react-native'
import type { AnimatedRef } from 'react-native-reanimated'
import Sortable from 'react-native-sortables'

import type { SelectedCharacterView } from '../../../features/character-manage/derivations'

import { CharacterRow } from '../../organisms/CharacterRow/CharacterRow'
import { DragHandle } from '../../organisms/CharacterRow/DragHandle'
import { RemoveButton } from '../../organisms/CharacterRow/RemoveButton'
import { RepresentativeStar } from '../../organisms/CharacterRow/RepresentativeStar'

/** 접근성 액션 식별자. 사람이 듣는 것은 `label` 이고 이 이름은 우리끼리 쓴다. */
const MOVE_UP = 'moveUp'
const MOVE_DOWN = 'moveDown'

export interface SelectedCharacterListProps {
  views: SelectedCharacterView[]
  representativeOcid: string | null
  /** 끌기 중 자동 스크롤이 굴릴 스크롤 뷰. 화면이 소유한다. */
  scrollableRef: AnimatedRef<ScrollView>
  /** 놓았을 때 · 접근성 액션일 때. **같은 문**이다(`moveOcid` 를 부른다). */
  onMove: (fromIndex: number, toIndex: number) => void
  onRemove: (ocid: string) => void
  onSelectRepresentative: (ocid: string) => void
}

export function SelectedCharacterList(props: SelectedCharacterListProps): React.JSX.Element {
  const count = props.views.length

  return (
    <Sortable.Grid
      columns={1}
      rowGap={8}
      data={props.views}
      keyExtractor={(view) => view.ocid}
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
      // 행이 늘고 주는 것은 추가·빼기 버튼이 하는 일이라 그 자리의 피드백은 버튼이 이미 준다.
      itemEntering={null}
      itemExiting={null}
      // 배열은 놓을 때 한 번만 바뀐다. 끄는 동안 움직이는 것은 그림뿐이라 도중에 취소되면 저장
      // 활성 판정이 안 깜빡인다.
      onDragEnd={({ fromIndex, toIndex }) => props.onMove(fromIndex, toIndex)}
      renderItem={({ item, index }) => (
        <SelectedRow
          view={item}
          index={index}
          count={count}
          isRepresentative={props.representativeOcid === item.ocid}
          // 하나가 채워지면 나머지는 흐려진다. 비활성이 아니라 톤만 낮춘다.
          dimmed={props.representativeOcid !== null && props.representativeOcid !== item.ocid}
          onMove={props.onMove}
          onRemove={props.onRemove}
          onSelectRepresentative={props.onSelectRepresentative}
        />
      )}
    />
  )
}

interface SelectedRowProps {
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
      name={view.name}
      level={view.level}
      jobClass={view.jobClass}
      world={view.world}
      imageUrl={view.imageUrl}
      unavailable={view.unavailable}
      leading={
        <Sortable.Handle>
          {/* 끌기와 같은 결과를 내는 화면 밖 경로. 스크린리더가 이 핸들에 서면 로터에
              위로·아래로 옮기기 가 뜬다. 두 경로가 `onMove` 하나를 부른다. */}
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
