/**
 * 위젯 9 — **계정 및 메이플 ID 공유 컨텐츠**(`4×auto`, [[ADR-147]] 정정 28~31).
 *
 * ## 계열은 **두 열**로 선다 ([[ADR-182]] 결정 1·2)
 *
 * 항목이 일곱뿐인데 한 줄에 하나씩 서면 오른쪽 절반이 통째로 빈다. 열 폭은 반반이고, 계열은 자기 열
 * 안에서 세로로 쌓인다. **오른쪽 열이 비면 한 열로 그린다** — 계열이 하나뿐일 때 반폭만 쓰면 그
 * 자체가 여백이다.
 *
 * 가르는 자리는 **순서를 지키면서 두 열의 «줄 수»(제목 1 + 항목 수)가 가장 고른 지점**이다.
 * 지그재그(홀짝)로 나누면 계열 셋에서 왼쪽이 «에픽던전 + 유니온»(7줄)이 되어 타일이 한 줄 더 높다.
 *
 * ## 완료는 **체크와 취소선**이 말한다 ([[ADR-182]] 결정 3)
 *
 * **체크박스는 누를 수 없다**(사용자 지정) — 이 값은 게임에서 오는 것이라 앱이 뒤집을 수 있는 것이
 * 아니고, 못 뒤집는 것을 누를 수 있게 두면 무반응이 «고장» 으로 읽힌다. 이 타일에서 누를 수 있는
 * 것은 여전히 머리의 `?` 하나다. **채운 상자의 색은 `primary` 다**([[ADR-182]] 정정 1) —
 * 근거는 `Checkbox` 바로 위에 있다.
 *
 * 이름에는 취소선과 `text-disabled` 를 **함께** 건다 — 취소선만으로는 «지운 것/흐린 것» 이
 * 애매하고, 색만으로는 흑백 화면에서 안 보인다.
 *
 * ## 축이 월드/계정이 아니라 «컨텐츠 계열» 이다
 *
 * 공유 단위(월드·계정)를 그리려면 **월드를 가를 수 있어야 하는데 가를 수 없다** — Open API 는 월드
 * 공유 항목을 마지막 접속 월드 기준으로 돌려준다([[ADR-030]] 결정 6). 「에픽던전 / 몬스터파크 /
 * 메이플 유니온」으로 묶으면 **월드 라벨을 한 번도 안 쓰므로 틀린 말을 할 자리가 없다.** 한계가
 * 사라진 것이 아니라 화면이 그 축을 주장하지 않게 된 것이다(사용자 지정).
 *
 * ## 오른쪽 열은 **카운트 하나만** 그린다 ([[ADR-182]] 결정 4)
 *
 * ```
 * 카운트 있음(= 미완료) → n/max
 * 그 밖                → 빈칸
 * ```
 *
 * **`CLEAR` 배지를 걷었다**(사용자 지시) — 체크박스와 취소선이 이미 완료를 말하므로 배지는 같은
 * 말을 세 번째로 하는 것이었고, 반폭 열에서 그 46px 이 긴 이름(「익스트림 몬스터파커」·「PC방 주간
 * 드래곤 퇴치」)을 말줄임으로 밀어냈다. [[ADR-147]] 정정 33 의 «완료 → CLEAR» 는 이 위젯에서 죽고,
 * 같은 정정의 **«완료하면 카운트를 안 준다»(뷰모델이 `count = null`)는 그대로 살아 있다** — 그래서
 * 여기서는 `count` 하나만 물으면 된다.
 *
 * 항목 이름을 하나도 안 물어보므로 새 공유 컨텐츠가 붙어도 분기가 안 는다.
 *
 * - **미완료라도 분모가 없으면 비운다**(사용자 지정) — 퀘스트형에 `0/1` 을 붙이려면 API 에 없는
 *   분모를 앱이 지어내야 한다.
 * - 분자와 분모는 **붙여** 그린다([[ADR-147]] 정정 7 이 결정석 링에서 정한 것과 같은 이유 —
 *   벌어지면 두 값, 붙으면 분수로 읽힌다).
 *
 * ## 머리의 `?` 가 월드 한계를 말한다 ([[ADR-147]] 정정 34)
 *
 * 계열로 묶어 월드 축을 **안 그리는** 것과 그 한계를 **말하는** 것은 다르다. 화면이 아무 말도 안
 * 하면 «이 몬스터파크 7회» 가 전 월드 합인 것처럼 읽히므로, 물어보는 사람에게만 한 문장을 준다
 * ([[ADR-030]] 결정 6 의 «받아들이는 한계» 를 화면이 처음으로 말하는 자리다).
 *
 * **말풍선은 카드 «안» 에 절대 배치한다.** 인라인으로 펼치면 `h: 'auto'` 가 다시 재서 아래 타일이
 * 전부 밀리고(정정 27 이 아코디언에서 겪은 자리다), 카드 밖으로 내보내면 격자의 절대 배치 위에서
 * 잘릴 자리가 생긴다. 안에 겹치면 **타일 높이가 안 변한다**.
 *
 * ## 캐릭터가 없다
 *
 * 진행이 공유되므로 캐릭터마다 세면 하루 한 번 할 일이 캐릭터 수만큼 부푼다. 그 부풀림을 없애는
 * 것이 이 위젯의 존재 이유라, 초상화도 캐릭터 이름도 여기 없다.
 *
 * ## 누를 수 없는 타일이다
 *
 * `target` 이 없다 — 위젯 2 와 같다. 목적지는 열린 질문이고, 갈 데가 정해지기 전까지 누를 수 있게
 * 두면 무반응이 «고장» 으로 읽힌다.
 */

import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { Text } from '../../../components/atoms'
import { CheckIcon, CircleQuestionMarkIcon } from '../../../lib/icons'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import type { SharedContentGroupView, SharedContentItemView } from '../view-model'
import type { WidgetProps } from './types'

/** 한 줄의 **고정 높이** — 위젯 2 의 수치 줄과 같은 이유다(빈 오른쪽 칸이 행을 접으면 안 된다). */
const ITEM_HEIGHT_PX = 16

/**
 * `?` 가 말하는 한 문장 (사용자 지정 문안, [[ADR-147]] 정정 34).
 *
 * [[ADR-030]] 결정 6 이 «받아들이는 한계» 로 적어 둔 사실이다 — Open API 는 월드 공유 항목을
 * 마지막 접속 월드 기준으로 돌려주고, 어느 월드 것인지 구분할 신호가 응답에 없다.
 */
const WORLD_NOTE = '계정 및 메이플 ID 공유 컨텐츠는 가장 마지막에 접속한 월드 기준으로 표시됩니다.'

/** 계열이 차지하는 **줄 수** — 제목 한 줄 + 항목들. 두 열의 높이를 견주는 자다. */
function groupRows(group: SharedContentGroupView): number {
  return 1 + group.items.length
}

/**
 * 계열을 두 열로 가른다 — **순서를 지키면서** 두 열의 줄 수가 가장 고른 지점 하나를 고른다
 * ([[ADR-182]] 결정 2).
 *
 * 순서를 안 바꾸므로 카탈로그 순서(`sharedGroupOrder`)가 화면에서 그대로 읽히고, 높이 차가 최소라
 * 타일이 가장 낮다. 오른쪽이 빈 배열이면 호출부가 **한 열만** 그린다.
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
 * 읽기 전용 체크박스 — `Pressable` 이 아니다([[ADR-182]] 결정 3).
 *
 * 채운 상자는 **`primary`** 다([[ADR-182]] 정정 1). 처음에는 앱의 「완료」 계보(`secondary`)를
 * 따랐는데, 그것은 테마의 **두 번째 시드**라 메인 컬러와 색상(H)이 아예 무관하다 — 렌은 빨강
 * 테마에 틸, 엔젤릭버스터는 분홍 테마에 하늘이 앉아 «테마 밖의 색» 으로 읽혔다(사용자 판정).
 * 앱의 다른 체크박스 셋(설정 캐시 비우기 · 가계부 사냥 입력 · 테마 선택)이 전부 이 색이다.
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
  // 기억하지 않는다 — 위젯 2 의 아코디언과 같은 태도다(다음에 열었을 때 설명이 떠 있으면 «닫는 법»
  // 을 다시 찾게 된다).
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
          // 아이콘이 12px 이라 그대로면 누를 자리가 손가락보다 작다 — 보이는 크기는 두고 **눌리는
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
        // 카드 «안» 절대 배치라 타일 높이가 안 변한다(파일 머리). 말풍선 자체를 눌러도 닫힌다 —
        // 닫는 방법이 `?` 뿐이면 그 자리를 다시 찾아야 한다.
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
            // 오른쪽이 비면 한 열이다 — 반폭만 쓰면 그 자체가 여백이다([[ADR-182]] 결정 1).
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
