/**
 * 캐릭터 동기화 **실패 표식과 그 설명 팝오버**(분리).
 *
 * 셋이 한 덩어리인 이유. 배지를 탭하면 팝오버가 열리고, 그 팝오버의 가로 위치를
 * `resolveIssueAnchor` 가 카드 폭 안에서 정한다. 서로를 전제하므로 갈라 두면 한쪽만 고쳐지는
 * 종류의 버그가 생긴다.
 *
 * `zIndex: 20` 은 **카드 루트가 카드 안에 가둔다**. 페이지 헤더나 탭바 위로 올라가지 않는다.
 * 그 관계는 `CharacterAccordion` 이 소유하고 여기는 층 번호만 안다.
 */
import { Pressable, View } from 'react-native'

import { anchorPopover } from '../../lib/popover-anchor'
import type { PopoverAnchorGeometry } from '../../lib/popover-anchor'

import { AlertTriangleIcon, BanIcon, Text } from '../../components/atoms'
import { UnavailableBadge } from '../../components/molecules/UnavailableBadge/UnavailableBadge'
import { useThemeAppearance } from '../../theme/context'
import type { PopoverAnchorRect } from '../../hooks/useAnchoredPopover'

// 동기화가 실패한 캐릭터를 카드에서 식별한다. 토스트는 인원 수만 알려 어느 카드인지 알 수 없다.
//
// 표식은 아이콘 하나다. 금액 옆, 라벨 없음. 라벨 배지(`조회 불가`)는 캐릭터명 폭을 먹어 6자
// 이름부터 잘린다(`내옆에최성일` → `내옆에…`). 원인 문구는 토스트가 담당하고 스크린리더에는
// `role="img"` + `aria-label` 로 전달한다.
export const CHARACTER_ISSUE_LABEL = {
  unavailable: '조회 불가',
  failed: '실패',
} as const

// 탭했을 때 왜 이 아이콘이 떠 있는가 를 설명한다. 아이콘만으로는 원인을 말할 수 없고, 그 대가를
// 팝오버가 받는다.
export const CHARACTER_ISSUE_EXPLANATION = {
  unavailable: {
    title: '조회할 수 없는 캐릭터입니다',
    body: '넥슨 API가 이 캐릭터를 조회하지 못합니다. 캐릭터 관리에서 추적을 해제할 수 있습니다.',
  },
  failed: {
    title: '동기화하지 못했습니다',
    body: '마지막으로 확인한 기록을 보여주고 있습니다. 새로고침하면 다시 시도합니다.',
  },
} as const

export type CharacterIssue = keyof typeof CHARACTER_ISSUE_LABEL

// 팝오버는 셸 바깥(카드 루트)에 둔다. 셸은 펼침 상태에서 잘라내므로 안에 두면 잘린다.
export const ISSUE_POPOVER_WIDTH = 220

export const ISSUE_POPOVER_EDGE_GAP = 12

/**
 * 트리거를 못 쟀을 때의 세로 자리. **평소에는 잰 값을 쓴다**(`resolveIssueAnchor`).
 *
 * 상수 하나로 두면 트리거 모양이 바뀔 때마다 어긋난다. 원형 배지는 금액 왼쪽 위에 떠 있고
 * 알약은 금액 칸을 통째로 차지해 밑변이 서로 다른 자리에 있다.
 */
export const ISSUE_POPOVER_TOP = 30

/** 트리거 밑변과 팝오버 사이. 꼬리가 팝오버 위로 6px 튀어나오므로 그만큼은 비워야 닿아 보인다. */
export const ISSUE_POPOVER_GAP = 7

export const ISSUE_CARET_SIZE = 8

// 금액의 좌상단에 절대배치한다. 흐름에 두면 헤더 가로폭을 캐릭터명과 다투고 화면 폭에 따라
// 겹침이 생긴다.
//
// 기준은 금액 래퍼의 왼쪽 끝 = 숫자가 시작하는 위치다. 거기서 4px 만 밀어 원형 배지의 시각적
// 왼쪽 변이 첫 자리 글자와 한 줄로 맞게 한다. 원은 사각 글리프보다 안쪽으로 들어가 보인다.
//
// 높이 14px 이면 글자 위쪽 여백만 쓰므로 겹치지 않고, 그래서 좌측에 폭을 비울 필요도 없다.
// 이 두 값을 클래스가 아니라 값으로 적는 것은 안 풀리는 클래스가 조용히 사라지기 때문이다.
const BADGE_OFFSET = { top: -14, left: -4 } as const
/** 배지 지름. 앵커 중심 계산(`left + 지름/2`)이 이 값을 쓴다. */
const BADGE_SIZE = 14

export function CharacterIssueBadge(props: {
  issue: CharacterIssue
  onToggle: () => void
}): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const isPermanent = props.issue === 'unavailable'

  return (
    <Pressable
      testID="character-issue-badge"
      role="button"
      aria-label={CHARACTER_ISSUE_LABEL[props.issue]}
      onPress={props.onToggle}
      style={{
        ...BADGE_OFFSET,
        boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: definition.bg }],
      }}
      className={
        isPermanent
          ? 'absolute z-[7] h-3.5 w-3.5 items-center justify-center rounded-full bg-info-tint'
          : 'absolute z-[7] h-3.5 w-3.5 items-center justify-center rounded-full bg-error-tint'
      }
    >
      {isPermanent ? (
        <BanIcon className="h-2 w-2 text-info-ink" strokeWidth={3} aria-hidden />
      ) : (
        <AlertTriangleIcon className="h-2 w-2 text-error-ink" strokeWidth={3} aria-hidden />
      )}
    </Pressable>
  )
}

/**
 * **금액 자리에 서는 조회 불가 배지.** 금액을 말할 수 없는 카드가 이것으로 그 자리를 채운다.
 *
 * 조회할 수 없게 된 캐릭터가 그 주에 기록도 없으면 금액이 `0 메소` 로 나오는데, 그것은
 * **0원을 벌었다는 단정**이라 우리가 할 수 없는 말이다. 자리를 비울 수도 없어(카드 오른쪽이
 * 빈 칸이 된다) 모른다는 사실 자체를 그 자리에 적는다.
 *
 * 여기서는 라벨을 글자로 쓴다. 위 `CharacterIssueBadge` 가 아이콘만인 것은 캐릭터명과 폭을
 * 다투기 때문인데, 이 자리는 금액을 **대신하는** 것이라 다툴 상대가 없다.
 *
 * 원형 배지와 **함께 서지 않는다.** 둘 다 같은 말을 하고 팝오버도 같다.
 *
 * 색은 `error` 다(사용자 지정). 위 원형 배지는 영구·일시를 `info`·`error` 로 갈라 칠하는데, 이
 * 자리는 **금액이 있어야 할 칸을 대신 차지한 것**이라 그 축과 성격이 다르다.
 */
export function CharacterIssueAmount(props: { onToggle: () => void }): React.JSX.Element {
  return (
    <UnavailableBadge
      testID="character-issue-amount"
      label={CHARACTER_ISSUE_LABEL.unavailable}
      onPress={props.onToggle}
    />
  )
}

/**
 * 잰 두 상자를 팝오버 기하로 옮기는 환산.
 *
 * 금액은 자릿수에 따라 폭이 변해 배지의 x 를 고정값으로 알 수 없다. clamp·꼬리 계산은 순수
 * 함수(`src/lib/popover-anchor`)가 맡고 여기서는 좌표계를 옮기기만 한다.
 *
 * 둘 다 같은 기준(윈도우)에서 잰 값이어야 한다. 뺄셈으로 카드 기준 좌표를 만든다.
 */
/** 팝오버를 여는 트리거의 모양. 둘의 밑변과 중심이 서로 다른 자리에 있다. */
export type IssueTriggerShape = 'dot' | 'amount'

/** 세로 자리까지 담는다. 트리거 모양마다 밑변이 달라 상수로 둘 수 없다. */
export interface IssuePopoverGeometry extends PopoverAnchorGeometry {
  top: number
}

export function resolveIssueAnchor(
  card: PopoverAnchorRect | null,
  money: PopoverAnchorRect | null,
  shape: IssueTriggerShape = 'dot',
): IssuePopoverGeometry {
  if (card === null || money === null) {
    return { left: ISSUE_POPOVER_EDGE_GAP, caretLeft: ISSUE_POPOVER_WIDTH / 2, top: ISSUE_POPOVER_TOP }
  }
  const moneyLeft = money.left - card.left
  return {
    ...anchorPopover({
      containerWidth: card.width,
      // 원형 배지는 금액 왼쪽 끝에서 4px 밀려 있고 폭이 14px 이라 중심이 그 +7px 이다. 알약은
      // 금액 칸을 통째로 차지하므로 그 칸의 가운데가 곧 중심이다.
      anchorCenterX:
        shape === 'amount'
          ? moneyLeft + money.width / 2
          : moneyLeft + BADGE_OFFSET.left + BADGE_SIZE / 2,
      popoverWidth: ISSUE_POPOVER_WIDTH,
      edgeGap: ISSUE_POPOVER_EDGE_GAP,
      caretSize: ISSUE_CARET_SIZE,
    }),
    // 잰 상자의 밑변에 붙인다. 금액 글자를 덮는 것은 허용한다. 열린 동안 그 카드의 금액 대신
    // 팝오버가 말한다.
    top: money.top - card.top + money.height + ISSUE_POPOVER_GAP,
  }
}

export function CharacterIssuePopover(props: {
  issue: CharacterIssue
  geometry: IssuePopoverGeometry
  onClose: () => void
  /**
   * 캐릭터 관리로 보낸다. **`unavailable` 에서만 선다** - 그 처방이 해제하거나 바꾸는 것이라서다.
   * `failed` 의 처방은 새로고침이고, 갈 이유가 없는 길을 주면 화면이 두 말을 한다.
   *
   * 안 주면 버튼이 안 선다. 카드가 네비게이션을 모르고 화면에서 내려받기 때문이다.
   */
  onOpenCharacterManage?: () => void
}): React.JSX.Element {
  const copy = CHARACTER_ISSUE_EXPLANATION[props.issue]
  return (
    <View
      testID="character-issue-popover"
      role="status"
      style={{ left: props.geometry.left, width: ISSUE_POPOVER_WIDTH, top: props.geometry.top }}
      className="absolute z-[20] rounded-[12px] border border-border bg-surface p-3 shadow-lg"
    >
      {/* 꼬리: 45도 회전한 정사각형의 위·왼쪽 테두리만 남겨 카드 배경과 이어 붙인다. */}
      <View
        aria-hidden
        style={{ left: props.geometry.caretLeft, width: ISSUE_CARET_SIZE, height: ISSUE_CARET_SIZE, top: -5 }}
        className="absolute rotate-45 border-l border-t border-border bg-surface"
      />
      <Text className="text-xs font-bold text-text">{copy.title}</Text>
      <Text className="mt-1 text-11 leading-relaxed text-text-muted">{copy.body}</Text>
      {/* 오른쪽에 선다. 강조는 **다음에 할 일** 이 갖고 닫기는 물러나는 쪽이라 안 가져간다. */}
      <View className="mt-2 flex-row items-center justify-end gap-3">
        <Pressable role="button" onPress={props.onClose}>
          <Text className="text-11 text-text-muted">닫기</Text>
        </Pressable>
        {props.issue === 'unavailable' && props.onOpenCharacterManage !== undefined && (
          <Pressable role="button" onPress={props.onOpenCharacterManage}>
            <Text className="text-11 font-semibold text-primary-ink underline">
              캐릭터 관리로 이동하기
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}
