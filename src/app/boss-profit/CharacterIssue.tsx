// 캐릭터 동기화 **실패 표식과 그 설명 팝오버**([[ADR-068]] 결정 3, ADR-094 결정 7로 분리).
//
// 셋이 한 덩어리인 이유 — 배지를 탭하면 팝오버가 열리고, 그 팝오버의 가로 위치를
// `measureIssueAnchor` 가 카드 폭 안에서 실측해 정한다. 서로를 전제하므로 갈라 두면
// 한쪽만 고쳐지는 종류의 버그가 생긴다.
//
// z-[20] 은 **카드 루트의 isolate 가 카드 안에 가둔다** — 페이지 sticky 헤더(z-10)나 하단
// fixed nav 위로 올라가지 않는다. 그 관계는 CharacterAccordion 이 소유하고 여기는 층 번호만 안다.

import { anchorPopover } from '../../lib/popover-anchor'
import type { PopoverAnchorGeometry } from '../../lib/popover-anchor'
import { AlertTriangle, Ban } from 'lucide-react'

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

// 팝오버는 **셸 바깥**(카드 루트 relative isolate)에 둔다 — 셸은 펼침 상태에서 overflow-clip이라
// ([[ADR-049]]) 안에 두면 잘린다. 고가 드롭 배지를 셸 바깥에 둔 것과 같은 이유다([[ADR-047]]).
//
// z-[20]: 카드 안 층 순서는 드롭 아이콘 1~3 < sticky 헤더 5 < 골드 링 6 < 고가 드롭 배지 10이므로
// 그 전부보다 위다. **카드 루트의 isolate가 이 z를 카드 안에 가두므로** 페이지 sticky 헤더(z-10)나
// 하단 fixed nav 위로는 절대 올라가지 않는다 — 다른 화면 요소를 가릴 수 없다.
export const ISSUE_POPOVER_WIDTH = 220

export const ISSUE_POPOVER_EDGE_GAP = 12

// 아이콘 바로 아래에 붙인다(사용자 지정 2026-07-31). 아이콘은 헤더에서 y 9~23px을 차지하고 꼬리는
// 팝오버 위로 6px 튀어나오므로, 30px이면 꼬리 끝이 아이콘 밑변에서 1px 아래에 온다 — 닿아 보이면서
// 아이콘을 덮지는 않는다(팝오버가 z-20이라 덮으면 아이콘이 잘려 보인다).
// **금액 글자를 덮는 것은 허용**한다("메소 가려도 되니까 위치를 아이콘이랑 맞춰") — 열린 동안
// 그 카드의 금액 대신 팝오버가 말한다.
export const ISSUE_POPOVER_TOP = 30

export const ISSUE_CARET_SIZE = 8
// **금액의 좌상단에 절대배치한다**(사용자 지정 2026-07-31) — 흐름에 두면 헤더 가로폭을 캐릭터명과
// 다투고(라벨 배지가 6자 이름을 잘라먹은 이유, [[ADR-054]] 정정 7) 화면 폭에 따라 겹침이 생긴다.
//
// 기준은 금액 래퍼의 왼쪽 끝 = **숫자가 시작하는 위치**다. 거기서 `-left-1`(4px)만 밀어 원형 배지의
// **시각적** 왼쪽 변이 첫 자리 글자와 한 줄로 맞게 한다(원은 사각 글리프보다 안쪽으로 들어가 보인다,
// 사용자 미세 조정 2026-07-31).
//
// 처음 좌상단에 뒀을 때 숫자를 덮은 것은 위치가 아니라 **높이** 문제였다(-top-1.5, 6px) —
// `-top-3.5`(14px)면 글자 위쪽 여백만 쓰므로 겹치지 않고, 그래서 좌측에 폭을 비울 필요도 없다
// (초기 시도에서는 20px을 비웠다).
export function CharacterIssueBadge(props: {
  issue: 'unavailable' | 'failed'
  onToggle: () => void
}): React.JSX.Element {
  const isPermanent = props.issue === 'unavailable'
  return (
    // span으로 두는 이유: 카드 헤더 자체가 <button>이라 그 안에 button을 넣으면 중첩 인터랙티브가
    // 된다(HTML 위반 + 클릭 충돌). span은 인터랙티브 콘텐츠가 아니므로 중첩이 허용되고, 클릭을
    // stopPropagation해 아코디언 토글과 갈라낸다. 대가는 키보드 포커스를 못 받는 것 — 상태 자체는
    // aria-label로 읽히고 원인 문구는 토스트([[ADR-063]])가 담당한다.
    <span
      data-testid="character-issue-badge"
      role="img"
      aria-label={CHARACTER_ISSUE_LABEL[props.issue]}
      title={CHARACTER_ISSUE_EXPLANATION[props.issue].title}
      onClick={(event) => {
        event.stopPropagation()
        event.preventDefault()
        props.onToggle()
      }}
      className={
        isPermanent
          ? 'absolute -top-3.5 -left-1 z-[7] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-info-tint text-info-ink ring-1 ring-bg'
          : 'absolute -top-3.5 -left-1 z-[7] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-error-tint text-error-ink ring-1 ring-bg'
      }
    >
      {isPermanent ? (
        <Ban className="h-2 w-2" strokeWidth={3} aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-2 w-2" strokeWidth={3} aria-hidden="true" />
      )}
    </span>
  )
}

/**
 * 배지 x좌표를 실측해 팝오버 위치로 넘긴다. 금액은 자릿수에 따라 폭이 변해 **배지의 x를 고정값으로
 * 알 수 없다** — clamp·꼬리 계산은 순수 함수(`lib/popover-anchor`)가 맡고 여기서는 측정만 한다.
 */
export function measureIssueAnchor(card: HTMLElement | null, money: HTMLElement | null): PopoverAnchorGeometry {
  if (card === null || money === null) {
    return { left: ISSUE_POPOVER_EDGE_GAP, caretLeft: ISSUE_POPOVER_WIDTH / 2 }
  }
  const cardRect = card.getBoundingClientRect()
  const moneyRect = money.getBoundingClientRect()
  return anchorPopover({
    containerWidth: cardRect.width,
    // 배지는 금액 왼쪽 끝에서 4px 밀려 있고(-left-1) 폭이 14px이므로 중심은 그 +7px이다.
    anchorCenterX: moneyRect.left - cardRect.left - 4 + 7,
    popoverWidth: ISSUE_POPOVER_WIDTH,
    edgeGap: ISSUE_POPOVER_EDGE_GAP,
    caretSize: ISSUE_CARET_SIZE,
  })
}

export function CharacterIssuePopover(props: {
  issue: 'unavailable' | 'failed'
  geometry: PopoverAnchorGeometry
  onClose: () => void
}): React.JSX.Element {
  const copy = CHARACTER_ISSUE_EXPLANATION[props.issue]
  return (
    <div
      data-testid="character-issue-popover"
      role="status"
      style={{ left: props.geometry.left, width: ISSUE_POPOVER_WIDTH, top: ISSUE_POPOVER_TOP }}
      className="absolute z-[20] rounded-[12px] border border-border bg-surface p-3 shadow-lg"
    >
      {/* 꼬리: 45도 회전한 정사각형의 위·왼쪽 테두리만 남겨 카드 배경과 이어 붙인다. */}
      <span
        aria-hidden="true"
        style={{ left: props.geometry.caretLeft, width: ISSUE_CARET_SIZE, height: ISSUE_CARET_SIZE }}
        className="absolute -top-[5px] rotate-45 border-l border-t border-border bg-surface"
      />
      <p className="text-xs font-bold text-text">{copy.title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{copy.body}</p>
      <button
        type="button"
        onClick={props.onClose}
        className="mt-2 text-[11px] font-semibold text-primary-ink underline"
      >
        닫기
      </button>
    </div>
  )
}
