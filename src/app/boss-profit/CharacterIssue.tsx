/**
 * 캐릭터 동기화 **실패 표식과 그 설명 팝오버**.
 *
 * 표식을 누르면 공용 팝오버(`AnchoredPopover`)가 금액 칸에 꼬리를 대고 뜬다. 별도 네이티브 창이라 카드 셸에 잘리지 않고,
 * 위치와 꼬리 계산도 공용 상자가 맡는다.
 */
import { Pressable, View } from 'react-native'

import { AlertTriangleIcon, BanIcon, Button, Text } from '../../components/atoms'
import { AnchoredPopover } from '../../components/molecules/Popover/Popover'
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

/** 설명 팝오버의 폭. 날짜 팝오버 · 아이템 수익 상자와 같다. */
const ISSUE_POPOVER_WIDTH = 248

// 금액의 좌상단에 절대배치한다. 흐름에 두면 헤더 가로폭을 캐릭터명과 다투고 화면 폭에 따라
// 겹침이 생긴다.
//
// 기준은 금액 래퍼의 왼쪽 끝 = 숫자가 시작하는 위치다. 거기서 4px 만 밀어 원형 배지의 시각적
// 왼쪽 변이 첫 자리 글자와 한 줄로 맞게 한다. 원은 사각 글리프보다 안쪽으로 들어가 보인다.
//
// 높이 14px 이면 글자 위쪽 여백만 쓰므로 겹치지 않고, 그래서 좌측에 폭을 비울 필요도 없다.
// 이 두 값을 클래스가 아니라 값으로 적는 것은 안 풀리는 클래스가 조용히 사라지기 때문이다.
const BADGE_OFFSET = { top: -14, left: -4 } as const

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
 * 표식을 누르면 뜨는 설명. 닫기 버튼 없이 바깥을 누르면 닫히고, 조회 불가일 때만 갈 곳을 버튼 하나로 준다.
 *
 * @example
 * {isIssueOpen && <CharacterIssuePopover issue={issue} anchor={issueAnchor} onClose={closeIssue} onOpenCharacterManage={open} />}
 */
export function CharacterIssuePopover(props: {
  issue: CharacterIssue
  /** 금액 칸을 잰 값. `null` 이면 아직 못 쟀다 */
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
