/**
 * 위젯 9. 계정과 메이플 ID 가 공유하는 컨텐츠 진행을 계열별로 그리는 `4×auto` 타일.
 *
 * 지키는 것 셋.
 *
 * ① 계열은 두 열로 서고 두 열의 줄 수가 가장 고른 지점에서 가른다. 오른쪽이 비면 한 열이다.
 * ② 체크박스를 누를 수 없다. 값이 게임에서 오므로 앱이 못 뒤집는다.
 * ③ 말풍선은 **별도 창**이다. 인라인으로 펼치면 `h: 'auto'` 가 다시 재서 아래 타일이 전부
 *    밀린다. 앱의 다른 팝오버 둘과 같은 구조이고, 바깥을 누르면 닫힌다.
 *
 * @see docs/features/today.md 위젯 정책
 */

import { Modal, Pressable, View, useWindowDimensions } from 'react-native'

import { useAnchoredPopover } from '../../../hooks/useAnchoredPopover'
import { GRID_SIDE_PADDING } from '../../../lib/today/widget-grid-metrics'

import { CheckIcon, CircleQuestionMarkIcon, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { SharedContentGroupView, SharedContentItemView } from '../view-model'
import type { WidgetProps } from './types'

/** 한 줄의 **고정 높이**. 위젯 2 의 수치 줄과 같은 이유다(빈 오른쪽 칸이 행을 접으면 안 된다). */
const ITEM_HEIGHT_PX = 16

/**
 * `?` 가 말하는 두 줄. **계열마다 기준이 다르다**(사용자 확인).
 *
 * 한 문장으로 뭉뚱그리면 어느 쪽도 안 맞는다. Open API 는 몬스터파크 계열을 마지막 접속 캐릭터
 * 기준으로 돌려주고, 그 캐릭터가 누구인지 구분할 신호가 응답에 없다.
 */
const SCOPE_NOTES = [
  '에픽 던전과 메이플 유니온은 메이플 ID 기준입니다.',
  '몬스터파크와 익스트림 몬스터파커는 마지막에 접속한 캐릭터 기준입니다.',
] as const

/** `?` 밑변과 상자 윗변 사이. 다른 팝오버 둘과 같은 값이다. */
const NOTE_GAP = 8
/**
 * 상자 폭 상한. `ItemRevenuePopover` 와 같은 값이라 앱의 팝오버 셋이 한 폭으로 선다.
 *
 * 상한이 없으면 넓은 기기에서 두 문장이 한 줄씩으로 늘어져 상자가 화면을 가로지른다.
 */
const NOTE_MAX_WIDTH = 248

/** 계열이 차지하는 **줄 수**. 제목 한 줄 + 항목들. 두 열의 높이를 견주는 자다. */
function groupRows(group: SharedContentGroupView): number {
  return 1 + group.items.length
}

/**
 * 계열을 두 열로 가른다. 순서를 지키면서 두 열의 줄 수가 가장 고른 지점 하나를 고른다.
 *
 * 순서를 안 바꾸므로 카탈로그 순서(`sharedGroupOrder`)가 화면에서 그대로 읽히고, 높이 차가
 * 최소라 타일이 가장 낮다. 오른쪽이 빈 배열이면 호출부가 한 열만 그린다.
 */
function splitColumns(
  groups: readonly SharedContentGroupView[],
): readonly [readonly SharedContentGroupView[], readonly SharedContentGroupView[]] {
  const total = groups.reduce((sum, group) => sum + groupRows(group), 0)

  let cut = groups.length
  let smallestGap = Number.POSITIVE_INFINITY
  let left = 0
  for (const [index, group] of groups.entries()) {
    left += groupRows(group)
    const gap = Math.abs(left - (total - left))
    if (gap < smallestGap) {
      smallestGap = gap
      cut = index + 1
    }
  }

  return [groups.slice(0, cut), groups.slice(cut)]
}

/**
 * 읽기 전용 체크박스. `Pressable` 이 아니다.
 *
 * 채운 상자는 `primary` 다. 완료 계보(`secondary`)는 테마의 두 번째 시드라 메인 컬러와 색상(H)이
 * 아예 무관해, 빨강 테마에 틸이 앉으면 테마 밖의 색으로 읽힌다. 앱의 다른 체크박스 셋(설정
 * 캐시 비우기 · 가계부 사냥 입력 · 테마 선택)이 전부 이 색이다.
 */
function Checkbox(props: { checked: boolean }): React.JSX.Element {
  return (
    <View
      testID="shared-checkbox"
      aria-hidden
      className={`h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border ${
        props.checked ? 'border-primary bg-primary' : 'border-border-strong'
      }`}
    >
      {props.checked && (
        <CheckIcon
          testID="shared-checkbox-mark"
          className="h-2 w-2 text-on-primary"
          strokeWidth={3.5}
          aria-hidden
        />
      )}
    </View>
  )
}

function CountValue(props: { count: { now: number; max: number } }): React.JSX.Element {
  return (
    <Text fixed testID="shared-count" style={TABULAR_NUMS} className="shrink-0 text-[11.5px] text-text-muted">
      <Text fixed style={TABULAR_NUMS} className="text-[11.5px] font-extrabold text-text">
        {String(props.count.now)}
      </Text>
      {`/${String(props.count.max)}`}
    </Text>
  )
}

function SharedItemRow(props: { item: SharedContentItemView }): React.JSX.Element {
  const { item } = props

  return (
    <View
      testID="shared-item"
      className="flex-row items-center gap-1.5"
      style={{ minHeight: ITEM_HEIGHT_PX }}
    >
      <Checkbox checked={item.isComplete} />
      <Text
        fixed
        testID="shared-item-name"
        numberOfLines={1}
        className={`min-w-0 flex-1 text-[11.5px] leading-tight ${
          item.isComplete ? 'text-text-disabled line-through' : 'text-text'
        }`}
      >
        {item.shortName}
      </Text>
      {item.count !== null && <CountValue count={item.count} />}
    </View>
  )
}

export function SharedContentsWidget({ data }: WidgetProps): React.JSX.Element {
  // 기억하지 않는다. 위젯 2 의 아코디언과 같은 태도다. 다음에 열었을 때 설명이 떠 있으면 닫는
  // 법을 다시 찾게 된다.
  //
  // 구조 분해가 필수다. `popover.toggle` 처럼 프로퍼티로 읽으면 `react-hooks/refs` 가 그 접근을
  // 렌더 중 ref 접근으로 본다.
  const { ref: toggleRef, isOpen: noteOpen, anchor, toggle: toggleNote, close: closeNote } = useAnchoredPopover()
  // 팝오버가 별도 창이라 좌표가 **화면 기준**이다. 부모 타일을 안 넘으려면 그 변을 알아야 하는데,
  // 이 위젯은 크기 선언이 `4×auto` 하나뿐이라(레지스트리) 창 좌우 여백이 곧 타일의 변이다.
  const { width: windowWidth } = useWindowDimensions()
  const tileWidth = windowWidth - GRID_SIDE_PADDING * 2

  return (
    <View testID="widget-shared-contents" className="p-3">
      <View className="flex-row items-center border-b border-border-strong pb-2">
        <Text fixed className="text-11 font-bold text-text-muted">계정 및 메이플 ID 공유 컨텐츠</Text>
        <Pressable
          ref={toggleRef}
          testID="shared-note-toggle"
          role="button"
          aria-label="표시 기준 설명"
          aria-expanded={noteOpen}
          // 아이콘이 12px 이라 그대로면 누를 자리가 손가락보다 작다. 보이는 크기는 두고 **눌리는
          // 자리만** 넓힌다.
          hitSlop={10}
          className="ml-1"
          onPress={toggleNote}
        >
          {/* 열려도 색이 안 변한다. 상태를 가진 버튼이 아니라 팁을 띄우는 버튼이라, 켜짐을 그리면
              사용자가 그 색을 무언가의 상태로 읽는다. */}
          <CircleQuestionMarkIcon className="h-3 w-3 text-text-disabled" strokeWidth={2.5} aria-hidden />
        </Pressable>
        <Text fixed className="ml-auto text-xs text-text-muted">
          <Text fixed testID="shared-total" style={TABULAR_NUMS} className="text-xs font-extrabold text-text">
            {data.sharedRemaining}
          </Text>
          개
        </Text>
      </View>

      {noteOpen && (
        /*
          닫는 층과 내용이 **같은 창에** 있어야 한다. RN 의 `Modal` 은 앱 루트 뷰와 다른 네이티브
          창이라 항상 그 위이고, `zIndex` 는 같은 트리의 형제끼리만 순서를 정한다. 닫기 층만 창에
          넣고 내용을 트리에 두면 투명한 닫기 층이 상자 위에 깔린다.

          별도 창이라 흐름에 아예 없어서, 카드 안 절대 배치이던 시절처럼 타일 높이가 안 변한다.
        */
        <Modal
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={closeNote}
        >
          {/* 바깥 탭으로 닫는다. **스크림이 없다**. 뒤를 덮으면 설명이 가리키는 목록이 함께 어두워진다. */}
          <Pressable aria-label="표시 기준 설명 닫기" onPress={closeNote} className="flex-1" />
          <View
            testID="shared-note"
            role="dialog"
            aria-label="표시 기준 설명"
            style={{
              // 타일 왼쪽 변에 붙인다. `?` 왼쪽 끝에 맞추면 상자가 오른쪽으로 타일을 넘고, 화면
              // 여백(12)을 쓰면 타일(16)보다 왼쪽에 선다. 제목이 고정 문구라 `?` 자리가 안
              // 움직여서, 변에 붙여도 `?` 는 상자 위에 남는다.
              left: GRID_SIDE_PADDING,
              top: anchor === null ? 0 : anchor.top + anchor.height + NOTE_GAP,
              // 좁은 기기에서는 상한보다 타일이 먼저 좁다.
              width: Math.min(NOTE_MAX_WIDTH, tileWidth),
            }}
            // 아직 못 쟀으면 그리되 안 보인다. 0,0 에 한 프레임 번쩍이는 것을 막는다.
            className={`absolute gap-1 rounded-[12px] border border-border bg-surface px-3 py-2 shadow-lg${
              anchor === null ? ' opacity-0' : ''
            }`}
          >
            {SCOPE_NOTES.map((note) => (
              <Text key={note} fixed className="text-[11.5px] leading-snug text-text-muted">
                {note}
              </Text>
            ))}
          </View>
        </Modal>
      )}

      {data.sharedContents.length > 0 && (
        <View className="flex-row gap-3 pt-2">
          {splitColumns(data.sharedContents)
            // 오른쪽이 비면 한 열이다. 반폭만 쓰면 그 자체가 여백이다.
            .filter((column) => column.length > 0)
            .map((column) => (
              <View key={column[0]?.group} testID="shared-column" className="min-w-0 flex-1">
                {column.map((group, index) => (
                  <View
                    key={group.group}
                    testID="shared-group"
                    className={index === 0 ? '' : 'mt-2 border-t border-border pt-2'}
                  >
                    <Text fixed testID="shared-group-name" className="text-[12.5px] font-bold text-text">
                      {group.group}
                    </Text>
                    <View className="mt-1.5 gap-1.5">
                      {group.items.map((item) => (
                        <SharedItemRow key={item.name} item={item} />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))}
        </View>
      )}
    </View>
  )
}
