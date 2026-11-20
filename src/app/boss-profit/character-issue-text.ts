/** 캐릭터 동기화 실패 배지와 설명 팝오버의 문구. 배지 · 팝오버(`CharacterIssue.tsx`)와 테스트가 함께 읽는다. */

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
