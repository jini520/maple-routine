/**
 * 캐릭터 동기화 **실패 배지와 그 설명 팝오버**.
 *
 * 배지를 누르면 공용 팝오버(`AnchoredPopover`)가 배지에 꼬리를 대고 뜬다. 별도 네이티브 창이라 카드 셸에 잘리지 않고,
 * 위치와 꼬리 계산도 공용 상자가 맡는다.
 */
import { Pressable, View } from 'react-native'

import { Badge, Button, Text } from '../../components/atoms'
import { AnchoredPopover } from '../../components/molecules/Popover/Popover'
import { UnavailableBadge } from '../../components/molecules/UnavailableBadge/UnavailableBadge'
import type { PopoverAnchorRect } from '../../hooks/useAnchoredPopover'

// 동기화가 실패한 캐릭터를 카드에서 식별한다. 토스트는 인원 수만 알려 어느 카드인지 알 수 없다.
//
// 문구가 처방을 가른다. 조회 불가는 캐릭터 관리에서 손봐야 하고, 동기화 실패는 새로고침이면
// 풀린다. today 남은 스케줄 줄의 배지와 같은 말이다.
export const CHARACTER_ISSUE_LABEL = {
  unavailable: '조회 불가',
  failed: '동기화 실패',
} as const

// 누르면 무엇을 하면 되는지를 설명한다. 배지 글자는 원인만 말한다.
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

/** 설명 팝오버의 폭. 날짜 팝오버 · 아이템 수익 상자와 같다. */
const ISSUE_POPOVER_WIDTH = 248

/**
 * 카드 머리의 금액 위 칸에 서는 실패 배지. 원인을 글자로 적고, 누르면 설명 팝오버를 연다.
 *
 * @example
 * <CharacterIssueBadge ref={issueAnchorRef} issue={badgeIssue} onToggle={toggleIssue} />
 */
export function CharacterIssueBadge({
  ref,
  ...props
}: {
  issue: CharacterIssue
  onToggle: () => void
  /** 설명 팝오버가 꼬리를 대는 자리. */
  ref?: React.Ref<View>
}): React.JSX.Element {
  const label = CHARACTER_ISSUE_LABEL[props.issue]
  return (
    <Pressable ref={ref} testID="character-issue-badge" role="button" aria-label={label} onPress={props.onToggle}>
      <Badge variant="error" size="xs" weight="bold">
        {label}
      </Badge>
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
 * 금액 위 배지(`CharacterIssueBadge`)와 **함께 서지 않는다.** 둘 다 같은 말을 하고 팝오버도 같다.
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
 * 배지를 누르면 뜨는 설명. 닫기 버튼 없이 바깥을 누르면 닫히고, 조회 불가일 때만 갈 곳을 버튼 하나로 준다.
 *
 * @example
 * {isIssueOpen && <CharacterIssuePopover issue={issue} anchor={issueAnchor} onClose={closeIssue} onOpenCharacterManage={open} />}
 */
export function CharacterIssuePopover(props: {
  issue: CharacterIssue
  /** 배지(금액 칸에 알약이 서면 금액 칸)를 잰 값. `null` 이면 아직 못 쟀다 */
  anchor: PopoverAnchorRect | null
  onClose: () => void
  /**
   * 캐릭터 관리로 보낸다. **`unavailable` 에서만 선다** - 그 처방이 해제하거나 바꾸는 것이라서다.
   * `failed` 의 처방은 새로고침이고, 갈 이유가 없는 길을 주면 화면이 두 말을 한다.
   */
  onOpenCharacterManage?: () => void
}): React.JSX.Element {
  const copy = CHARACTER_ISSUE_EXPLANATION[props.issue]
  return (
    <AnchoredPopover
      testID="character-issue-popover"
      ariaLabel={copy.title}
      closeLabel="설명 닫기"
      anchor={props.anchor}
      width={ISSUE_POPOVER_WIDTH}
      onClose={props.onClose}
      className="p-3"
    >
      <Text className="text-xs font-bold text-text">{copy.title}</Text>
      <Text className="mt-1 text-11 leading-relaxed text-text-muted">{copy.body}</Text>
      {props.issue === 'unavailable' && props.onOpenCharacterManage !== undefined && (
        <View className="mt-2.5 flex-row justify-end">
          <Button variant="soft" size="sm" hitSlop={8} onPress={props.onOpenCharacterManage}>
            캐릭터 관리로 이동
          </Button>
        </View>
      )}
    </AnchoredPopover>
  )
}
