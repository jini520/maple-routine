/**
 * 위젯 9. 계정과 메이플 ID 가 공유하는 컨텐츠 진행을 계열별로 그리는 `4×auto` 타일.
 *
 * 지키는 것 둘.
 *
 * ① 계열은 두 열로 서고 두 열의 줄 수가 가장 고른 지점에서 가른다. 오른쪽이 비면 한 열이다.
 * ② 체크박스를 누를 수 없다. 값이 게임에서 오므로 앱이 못 뒤집는다.
 * ③ 고른 메이플 ID 의 추적 캐릭터만 모은다. 에픽 던전 · 메이플 유니온의 한도는 메이플 ID 마다 따로다. 고를 메이플 ID 가 둘
 *    이상이면 제목 줄 오른쪽 위젯 드롭다운 버튼으로 고른다.
 *
 * @see docs/features/today.md 위젯 정책
 */

import { View } from 'react-native'

import { CheckBox, Text } from '../../../components/atoms'
import { WidgetSelect } from '../../../components/organisms/WidgetSelect/WidgetSelect'
import { useTodaySharedMapleIdStore } from '../../../features/today/shared-maple-id'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { SharedContentGroupView, SharedContentItemView } from '../view-model'
import type { WidgetProps } from './types'

/** 한 줄의 **고정 높이**. 위젯 2 의 수치 줄과 같은 이유다(빈 오른쪽 칸이 행을 접으면 안 된다). */
const ITEM_HEIGHT_PX = 16

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

/** `n/max`. 줄의 진행과 계열 제목의 주간 한도가 같은 모양을 쓴다. */
function CountValue(props: { count: { now: number; max: number }; testID: string }): React.JSX.Element {
  return (
    <Text testID={props.testID} style={TABULAR_NUMS} className="shrink-0 text-11 text-text-muted">
      <Text style={TABULAR_NUMS} className="text-11 font-bold text-text">
        {String(props.count.now)}
      </Text>
      {`/${String(props.count.max)}`}
    </Text>
  )
}

function SharedItemRow(props: { item: SharedContentItemView }): React.JSX.Element {
  const { item } = props
  // 체크는 줄의 완료만 본다. 취소선은 한도로 막힌 줄에도 긋는다. 더 진행할 수 없는 줄이다.
  const isStruck = item.isComplete || item.isWeeklyLimitClosed

  return (
    <View
      testID="shared-item"
      className="flex-row items-center gap-1.5"
      style={{ minHeight: ITEM_HEIGHT_PX }}
    >
      {/* 읽기 전용이라 `Pressable` 이 아니고 스크린리더에서도 숨긴다. 완료는 취소선이 말한다. 줄 높이 16 에 맞춰 `sm` 이다. */}
      <View testID="shared-checkbox" aria-hidden className="shrink-0">
        <CheckBox checked={item.isComplete} size="sm" />
      </View>
      <Text
        testID="shared-item-name"
        numberOfLines={1}
        className={`min-w-0 flex-1 text-xs leading-tight ${
          isStruck ? 'text-text-disabled line-through' : 'font-semibold text-text'
        }`}
      >
        {item.shortName}
      </Text>
      {item.count !== null && <CountValue count={item.count} testID="shared-count" />}
    </View>
  )
}

export function SharedContentsWidget({ data }: WidgetProps): React.JSX.Element {
  const selectMapleId = useTodaySharedMapleIdStore((state) => state.select)
  // 고를 메이플 ID 가 하나면 버튼을 그리지 않는다. 고를 것이 없다.
  const canSelect = data.sharedMapleIds.length >= 2 && data.selectedSharedMapleId !== null

  return (
    <View testID="widget-shared-contents" className="p-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="shrink-0 text-11 font-bold text-text-muted">계정 및 메이플 ID 공유 컨텐츠</Text>
        {canSelect && (
          <WidgetSelect
            label="공유 컨텐츠를 볼 메이플 ID"
            testID="shared-maple-id-select"
            options={data.sharedMapleIds.map((one) => ({ value: one.accountId, label: one.name }))}
            selected={data.selectedSharedMapleId ?? ''}
            onSelect={selectMapleId}
          />
        )}
      </View>

      {data.sharedContents.length > 0 && (
        <View className="flex-row gap-2 pt-2">
          {splitColumns(data.sharedContents)
            // 오른쪽이 비면 한 열이다. 반폭만 쓰면 그 자체가 여백이다.
            .filter((column) => column.length > 0)
            .map((column) => (
              <View key={column[0]?.category} testID="shared-column" className="min-w-0 flex-1 gap-2">
                {/* 갈래마다 `card-inset` 칸 하나. 칸의 색이 갈래 사이 경계라 구분선을 긋지 않는다. */}
                {column.map((group) => (
                  <View key={group.category} testID="shared-group" className="rounded-[10px] bg-card-inset px-2.5 py-2">
                    <View className="flex-row items-center justify-between gap-1.5">
                      <Text testID="shared-group-name" className="text-xs font-bold text-text">
                        {group.label}
                      </Text>
                      {group.weeklyLimit !== null && (
                        <CountValue count={group.weeklyLimit} testID="shared-group-count" />
                      )}
                    </View>
                    <View className="mt-1.5 gap-1.5">
                      {group.items.map((item) => (
                        <SharedItemRow key={item.contentKey} item={item} />
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
