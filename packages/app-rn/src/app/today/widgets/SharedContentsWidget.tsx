/**
 * 위젯 9 — **계정 및 메이플 ID 공유 컨텐츠**(`4×auto`, [[ADR-146]] 정정 28~31).
 *
 * ## 축이 월드/계정이 아니라 «컨텐츠 계열» 이다
 *
 * 공유 단위(월드·계정)를 그리려면 **월드를 가를 수 있어야 하는데 가를 수 없다** — Open API 는 월드
 * 공유 항목을 마지막 접속 월드 기준으로 돌려준다([[ADR-030]] 결정 6). 「에픽던전 / 몬스터파크 /
 * 메이플 유니온」으로 묶으면 **월드 라벨을 한 번도 안 쓰므로 틀린 말을 할 자리가 없다.** 한계가
 * 사라진 것이 아니라 화면이 그 축을 주장하지 않게 된 것이다(사용자 지정).
 *
 * ## 오른쪽 열의 규칙은 하나뿐이다 ([[ADR-146]] 정정 33)
 *
 * ```
 * 완료               → CLEAR
 * 미완료 · 카운트 있음 → n/max
 * 미완료 · 카운트 없음 → 빈칸
 * ```
 *
 * 항목 이름을 하나도 안 물어보므로 새 공유 컨텐츠가 붙어도 분기가 안 는다 — 갈림은 뷰모델이
 * `count`(있음/`null`)로 이미 끝냈고, 여기서는 그 값을 그릴 뿐이다.
 *
 * - **미완료는 오른쪽을 비운다**(사용자 지정) — 퀘스트형에 `0/1` 을 붙이려면 API 에 없는 분모를
 *   앱이 지어내야 한다.
 * - **완료는 카운트형도 `CLEAR` 다**(사용자 지시) — 완료한 항목의 «몇 번 했나» 는 언제나 `max`
 *   라 `14/14` 가 더 말하는 것이 없다. 「익스트림만 예외」로 적으면 그것이 정정 31 이 카탈로그로
 *   밀어낸 «이름으로 유추하는 규칙» 이 코드로 되돌아온다.
 * - 분자와 분모는 **붙여** 그린다([[ADR-146]] 정정 7 이 결정석 링에서 정한 것과 같은 이유 —
 *   벌어지면 두 값, 붙으면 분수로 읽힌다).
 *
 * ## 머리의 `?` 가 월드 한계를 말한다 ([[ADR-146]] 정정 34)
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
import { Pressable, Text, View } from 'react-native'

import { CircleQuestionMarkIcon } from '../../../lib/icons'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import type { SharedContentItemView } from '../view-model'
import type { WidgetProps } from './types'

/** 한 줄의 **고정 높이** — 위젯 2 의 수치 줄과 같은 이유다(빈 오른쪽 칸이 행을 접으면 안 된다). */
const ITEM_HEIGHT_PX = 16

/**
 * `?` 가 말하는 한 문장 (사용자 지정 문안, [[ADR-146]] 정정 34).
 *
 * [[ADR-030]] 결정 6 이 «받아들이는 한계» 로 적어 둔 사실이다 — Open API 는 월드 공유 항목을
 * 마지막 접속 월드 기준으로 돌려주고, 어느 월드 것인지 구분할 신호가 응답에 없다.
 */
const WORLD_NOTE = '계정 및 메이플 ID 공유 컨텐츠는 가장 마지막에 접속한 월드 기준으로 표시됩니다.'

function CountValue(props: { count: { now: number; max: number } }): React.JSX.Element {
  return (
    <Text testID="shared-count" style={TABULAR_NUMS} className="shrink-0 text-[11px] text-text-muted">
      <Text style={TABULAR_NUMS} className="text-[11px] font-extrabold text-text">
        {String(props.count.now)}
      </Text>
      {`/${String(props.count.max)}`}
    </Text>
  )
}

/** 위젯 2 의 `StatusBadge` 와 같은 톤 — 같은 말(`CLEAR`)이 격자에서 다르게 보이면 안 된다. */
function ClearBadge(): React.JSX.Element {
  return (
    <Text
      testID="shared-clear"
      className="shrink-0 rounded-full bg-secondary-tint px-2 py-0.5 text-[10px] font-bold text-secondary-ink"
    >
      CLEAR
    </Text>
  )
}

function SharedItemRow(props: { item: SharedContentItemView }): React.JSX.Element {
  const { item } = props

  return (
    <View
      testID="shared-item"
      className="flex-row items-center gap-2"
      style={{ minHeight: ITEM_HEIGHT_PX }}
    >
      <Text
        numberOfLines={1}
        className={`min-w-0 flex-1 text-[11px] leading-tight ${
          item.isComplete ? 'text-text-disabled' : 'text-text'
        }`}
      >
        {item.shortName}
      </Text>
      {item.isComplete ? (
        <ClearBadge />
      ) : item.count !== null ? (
        <CountValue count={item.count} />
      ) : null}
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
        <Text className="text-[11px] font-bold text-text-muted">계정 및 메이플 ID 공유 컨텐츠</Text>
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
        <Text className="ml-auto text-[11px] text-text-muted">
          <Text testID="shared-total" style={TABULAR_NUMS} className="text-[11px] font-extrabold text-text">
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
          <Text className="text-[10.5px] leading-snug text-text-muted">{WORLD_NOTE}</Text>
        </Pressable>
      )}

      {data.sharedContents.map((group, index) => (
        <View
          key={group.group}
          testID="shared-group"
          className={index === 0 ? 'py-2' : 'border-t border-border py-2'}
        >
          <Text testID="shared-group-name" className="text-[11.5px] font-bold text-text">
            {group.group}
          </Text>
          <View className="mt-1 gap-0.5">
            {group.items.map((item) => (
              <SharedItemRow key={item.name} item={item} />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}
