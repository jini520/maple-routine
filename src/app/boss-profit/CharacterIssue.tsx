// 캐릭터 동기화 **실패 표식과 그 설명 팝오버**([[ADR-068]] 결정 3, [[ADR-094]] 결정 7로 분리).
//
// 셋이 한 덩어리인 이유 — 배지를 탭하면 팝오버가 열리고, 그 팝오버의 가로 위치를
// `resolveIssueAnchor` 가 카드 폭 안에서 정한다. 서로를 전제하므로 갈라 두면 한쪽만 고쳐지는
// 종류의 버그가 생긴다.
//
// `zIndex: 20` 은 **카드 루트가 카드 안에 가둔다** — 페이지 헤더나 탭바 위로 올라가지 않는다.
// 그 관계는 `CharacterAccordion` 이 소유하고 여기는 층 번호만 안다.
//
// ══ RN 으로 옮기며 갈린 것 넷 ═════════════════════════════════════════════════════
//
// ① **배지가 `<span>` 에서 `Pressable` 이 된다 — 웹의 대가가 사라진다.** 웹이 span 을 쓴 이유는
//    카드 헤더가 `<button>` 이라 그 안의 button 이 **중첩 인터랙티브(HTML 위반)** 가 되기
//    때문이었고, 대가로 "키보드 포커스를 못 받는다"를 감수했다. RN 에는 그 규칙이 없고 터치는
//    **가장 깊은 곳이 가져간다**(responder) — 중첩 `Pressable` 이 정상이고 부모 아코디언은 안
//    열린다. 그래서 웹의 `stopPropagation` + `preventDefault` 두 줄도 함께 사라진다.
// ② **측정이 이 파일에서 나간다.** 웹의 `measureIssueAnchor(card, money)` 는 두 요소를 받아 그
//    자리에서 `getBoundingClientRect()` 를 불렀다. RN 의 측정은 **비동기**(`measureInWindow`)라
//    같은 자리에서 못 부르므로, 재는 일은 호출부(step 7 의 `CharacterAccordion`)가 하고 여기는
//    **잰 값을 받아 앵커 기하로 환산**한다. 이름도 그 사실에 맞춰 `resolveIssueAnchor` 다 —
//    배지 x 를 어떻게 앵커 중심으로 옮기는지(`-4 + 7`)는 여전히 이 파일의 지식이다.
// ③ `ring-1 ring-bg` → 같은 크기의 `boxShadow` 확산. Tailwind 의 ring 은 **박스 바깥**에 그려져
//    레이아웃을 안 건드리는데 `borderWidth` 로 옮기면 14px 원 안쪽을 깎아 아이콘이 작아진다
//    (`ValuableDropBadge` 가 먼저 밟은 자리).
// ④ `title`(마우스 툴팁)은 RN 에 짝이 없어 사라진다 — 터치 기기에서는 웹에서도 뜨지 않았다.
//    팝오버가 그 문구를 이미 말한다.
import { Pressable, View } from 'react-native'

import { anchorPopover } from '../../lib/popover-anchor'
import type { PopoverAnchorGeometry } from '../../lib/popover-anchor'

import { Text } from '../../components/atoms/Text/Text'
import { AlertTriangleIcon, BanIcon } from '../../lib/icons'
import { useThemeAppearance } from '../../theme/context'
import type { PopoverAnchorRect } from './ItemRevenuePopover'

// ADR-068 결정 3: 동기화가 실패한 캐릭터를 **카드에서** 식별한다. 전에는 토스트가 인원 수만 알려
// 어느 카드인지 알 수 없었다([[ADR-063]]가 남긴 숙제, 이슈 #78 B).
//
// **표식은 아이콘 하나다 — 금액 옆, 라벨 없음**(시안 A에서 두 번 정정, 실물 확인 후 사용자 확정
// 2026-07-31). 경위:
//  ① 시안 A는 "금액 자리를 배지가 대체"였다. 전제는 그 금액이 낡은 캐시에서 온 값이라는 것.
//  ② [[ADR-067]] 결정 7·4 구현 후 카드 금액은 **DB 기록에서만** 나온다 → 가릴 이유가 약해졌다.
//  ③ 실물을 띄워보니 라벨 배지("조회 불가")가 캐릭터명 폭을 먹어 **6자 이름부터 잘렸다**
//     (`내옆에최성일` → `내옆에…`). `n/12` 숫자 표기를 보류한 것과 같은 문제다([[ADR-054]] 정정 7).
// 그래서 라벨을 버리고 아이콘만 남긴다 — 이름·금액·합계가 모두 온전하다. 원인 문구는 토스트가
// 담당하고([[ADR-063]]) 스크린리더에는 role="img" + aria-label로 전달한다.
export const CHARACTER_ISSUE_LABEL = {
  unavailable: '조회 불가',
  failed: '실패',
} as const

// 탭했을 때 "왜 이 아이콘이 떠 있는가"를 설명한다(사용자 요청 2026-07-31). 아이콘만으로는 원인을
// 말할 수 없고, 그 대가를 팝오버가 받는다.
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

// 팝오버는 **셸 바깥**(카드 루트)에 둔다 — 셸은 펼침 상태에서 잘라내므로([[ADR-049]]) 안에 두면
// 잘린다. 고가 드롭 배지를 셸 바깥에 둔 것과 같은 이유다([[ADR-047]]).
export const ISSUE_POPOVER_WIDTH = 220

export const ISSUE_POPOVER_EDGE_GAP = 12

// 아이콘 바로 아래에 붙인다(사용자 지정 2026-07-31). 아이콘은 헤더에서 y 9~23px을 차지하고 꼬리는
// 팝오버 위로 6px 튀어나오므로, 30px이면 꼬리 끝이 아이콘 밑변에서 1px 아래에 온다 — 닿아 보이면서
// 아이콘을 덮지는 않는다. **금액 글자를 덮는 것은 허용**한다("메소 가려도 되니까 위치를 아이콘이랑
// 맞춰") — 열린 동안 그 카드의 금액 대신 팝오버가 말한다.
export const ISSUE_POPOVER_TOP = 30

export const ISSUE_CARET_SIZE = 8

// **금액의 좌상단에 절대배치한다**(사용자 지정 2026-07-31) — 흐름에 두면 헤더 가로폭을 캐릭터명과
// 다투고(라벨 배지가 6자 이름을 잘라먹은 이유, [[ADR-054]] 정정 7) 화면 폭에 따라 겹침이 생긴다.
//
// 기준은 금액 래퍼의 왼쪽 끝 = **숫자가 시작하는 위치**다. 거기서 4px 만 밀어 원형 배지의 **시각적**
// 왼쪽 변이 첫 자리 글자와 한 줄로 맞게 한다(원은 사각 글리프보다 안쪽으로 들어가 보인다, 사용자
// 미세 조정 2026-07-31).
//
// 처음 좌상단에 뒀을 때 숫자를 덮은 것은 위치가 아니라 **높이** 문제였다(6px) — 14px면 글자 위쪽
// 여백만 쓰므로 겹치지 않고, 그래서 좌측에 폭을 비울 필요도 없다(초기 시도에서는 20px을 비웠다).
// 웹의 `-top-3.5 -left-1` 을 값으로 적는 이유는 파일 머리 ③ 과 같다 — 안 풀리는 클래스는 조용히
// 사라지고, 이 두 값은 위 문단이 근거를 갖는 **미세 조정값**이라 사라지면 안 된다.
const BADGE_OFFSET = { top: -14, left: -4 } as const
/** 배지 지름 — 앵커 중심 계산(`left + 지름/2`)이 이 값을 쓴다. */
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
 * 잰 두 상자를 팝오버 기하로 환산한다.
 *
 * 금액은 자릿수에 따라 폭이 변해 **배지의 x를 고정값으로 알 수 없다** — clamp·꼬리 계산은 순수
 * 함수(`src/lib/popover-anchor`)가 맡고 여기서는 좌표계를 옮기기만 한다. 재는 일은 호출부가
 * 한다(파일 머리 ②).
 *
 * 둘 다 **같은 기준**(윈도우)에서 잰 값이어야 한다 — 뺄셈으로 카드 기준 좌표를 만든다.
 */
export function resolveIssueAnchor(
  card: PopoverAnchorRect | null,
  money: PopoverAnchorRect | null,
): PopoverAnchorGeometry {
  if (card === null || money === null) {
    return { left: ISSUE_POPOVER_EDGE_GAP, caretLeft: ISSUE_POPOVER_WIDTH / 2 }
  }
  return anchorPopover({
    containerWidth: card.width,
    // 배지는 금액 왼쪽 끝에서 4px 밀려 있고 폭이 14px이므로 중심은 그 +7px이다.
    anchorCenterX: money.left - card.left + BADGE_OFFSET.left + BADGE_SIZE / 2,
    popoverWidth: ISSUE_POPOVER_WIDTH,
    edgeGap: ISSUE_POPOVER_EDGE_GAP,
    caretSize: ISSUE_CARET_SIZE,
  })
}

export function CharacterIssuePopover(props: {
  issue: CharacterIssue
  geometry: PopoverAnchorGeometry
  onClose: () => void
}): React.JSX.Element {
  const copy = CHARACTER_ISSUE_EXPLANATION[props.issue]
  return (
    <View
      testID="character-issue-popover"
      role="status"
      style={{ left: props.geometry.left, width: ISSUE_POPOVER_WIDTH, top: ISSUE_POPOVER_TOP }}
      className="absolute z-[20] rounded-[12px] border border-border bg-surface p-3 shadow-lg"
    >
      {/* 꼬리: 45도 회전한 정사각형의 위·왼쪽 테두리만 남겨 카드 배경과 이어 붙인다. */}
      <View
        aria-hidden
        style={{ left: props.geometry.caretLeft, width: ISSUE_CARET_SIZE, height: ISSUE_CARET_SIZE, top: -5 }}
        className="absolute rotate-45 border-l border-t border-border bg-surface"
      />
      <Text className="text-xs font-bold text-text">{copy.title}</Text>
      <Text className="mt-1 text-[11px] leading-relaxed text-text-muted">{copy.body}</Text>
      <Pressable role="button" onPress={props.onClose} className="mt-2 self-start">
        <Text className="text-[11px] font-semibold text-primary-ink underline">닫기</Text>
      </Pressable>
    </View>
  )
}
