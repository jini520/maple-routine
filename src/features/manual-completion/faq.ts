/**
 * 직접 완료 안내 줄이 여는 FAQ.
 *
 * 줄은 상태를 알리고 시트는 설명한다. 어떤 보스가 열려 있는지는 여기서 말하지 않는다 - 그 목록은
 * 서버가 바꾸는 값이고, 문구에 박으면 넥슨이 고친 날 이 시트가 거짓말을 한다.
 */
import type { FaqItem } from '../../components/organisms/FaqSheet/FaqSheet'

/** 시트 머리에 서는 이름. 그 화면의 말이다. */
export const MANUAL_COMPLETION_FAQ_TITLE = '직접 완료'

export const MANUAL_COMPLETION_FAQ: readonly FaqItem[] = [
  {
    question: '잡았는데 왜 완료가 안 되나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '보스 완료는 넥슨이 주는 기록을 그대로 씁니다. 넥슨이 완료를 주지 않는 보스가 있어, 그런 보스는 잡아도 미완료로 남고 결정석 수익에도 안 들어갑니다.',
      },
    ],
  },
  {
    question: '직접 완료로 기록하면 어떻게 되나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '보스 수익 화면에서 난이도와 잡은 날, 파티 인원을 적으면 넥슨이 준 완료와 똑같이 셉니다. 보스 카드의 완료 표시, 주간 12마리, 결정석 수익, 가계부에 모두 들어갑니다.',
      },
      {
        kind: 'paragraph',
        text: '직접 적은 기록은 보스 이름 옆에 표식이 붙고, 언제든 고치거나 취소할 수 있습니다.',
      },
    ],
  },
  {
    question: '넥슨이 나중에 완료를 주면 어떻게 되나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '같은 난이도로 완료가 오면 표식만 사라지고 기록은 그대로 남습니다. 잡은 날도 직접 적은 날을 그대로 씁니다.',
      },
    ],
  },
  {
    question: '아무 보스나 적을 수 있나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '아닙니다. 넥슨이 완료를 주지 않는 것으로 확인된 보스만 열립니다. 넥슨이 다시 정상으로 주기 시작하면 그 보스는 닫힙니다.',
      },
    ],
  },
]
