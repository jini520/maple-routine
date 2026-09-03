/**
 * 위젯 9. 계정과 메이플 ID 가 공유하는 컨텐츠 진행을 계열별로 그리는 `4×auto` 타일.
 *
 * 지키는 것 셋.
 *
 * ① 계열은 두 열로 서고 두 열의 줄 수가 가장 고른 지점에서 가른다. 오른쪽이 비면 한 열이다.
 * ② 체크박스를 누를 수 없다. 값이 게임에서 오므로 앱이 못 뒤집는다.
 * ③ 말풍선은 카드 **안**에 절대 배치한다. 인라인으로 펼치면 `h: 'auto'` 가 다시 재서 아래 타일이
 *    전부 밀린다.
 *
 * @see docs/features/today.md 위젯 정책
 */

import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { CheckIcon, CircleQuestionMarkIcon, Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { SharedContentGroupView, SharedContentItemView } from '../view-model'
import type { WidgetProps } from './types'

/** 한 줄의 **고정 높이**. 위젯 2 의 수치 줄과 같은 이유다(빈 오른쪽 칸이 행을 접으면 안 된다). */
const ITEM_HEIGHT_PX = 16

/**
 * `?` 가 말하는 한 문장.
 *
 * Open API 는 월드 공유 항목을 마지막 접속 월드 기준으로 돌려주고, 어느 월드 것인지 구분할
 * 신호가 응답에 없다.
 */
const WORLD_NOTE = '계정 및 메이플 ID 공유 컨텐츠는 가장 마지막에 접속한 월드 기준으로 표시됩니다.'

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
  const [noteOpen, setNoteOpen] = useState(false)

  return (
    <View testID="widget-shared-contents" className="p-3">
      <View className="flex-row items-center border-b border-border-strong pb-2">
        <Text fixed className="text-11 font-bold text-text-muted">계정 및 메이플 ID 공유 컨텐츠</Text>
        <Pressable
          testID="shared-note-toggle"
          role="button"
          aria-label="표시 기준 설명"
          aria-expanded={noteOpen}
          // 아이콘이 12px 이라 그대로면 누를 자리가 손가락보다 작다. 보이는 크기는 두고 **눌리는
          // 자리만** 넓힌다.
          hitSlop={10}
          className="ml-1"
          onPress={() => setNoteOpen((open) => !open)}
        >
          <CircleQuestionMarkIcon
            className={`h-3 w-3 ${noteOpen ? 'text-text' : 'text-text-disabled'}`}
            strokeWidth={2.5}
            aria-hidden
          />
        </Pressable>
        <Text fixed className="ml-auto text-xs text-text-muted">
          <Text fixed testID="shared-total" style={TABULAR_NUMS} className="text-xs font-extrabold text-text">
            {data.sharedRemaining}
          </Text>
          개
        </Text>
      </View>

      {noteOpen && (
        // 카드 안 절대 배치라 타일 높이가 안 변한다. 말풍선 자체를 눌러도 닫힌다. 닫는 방법이
        // `?` 뿐이면 그 자리를 다시 찾아야 한다.
        <Pressable
          testID="shared-note"
          role="button"
          className="absolute left-3 right-3 top-9 z-10 rounded-lg border border-border bg-surface-2 px-3 py-2"
          onPress={() => setNoteOpen(false)}
        >
          <Text fixed className="text-[11.5px] leading-snug text-text-muted">{WORLD_NOTE}</Text>
        </Pressable>
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
