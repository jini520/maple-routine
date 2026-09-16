/**
 * 결산 안내 줄이 여는 FAQ. **문구는 사용자가 확정한 것**(2026-09-16)이라 손대지 말 것.
 *
 * `22:00 ~ (익일) 04:00` 은 사용자가 준 값이고 **설명이지 판정이 아니다.** 앱은 이 시각으로
 * 결산을 가르지 않는다 - 그 판정은 서버가 밤마다 조회해서 한다. 안내 줄이 시각을 안 말하는 것과
 * 여기가 말하는 것은 자리가 달라서다. 줄은 상태를 알리고 시트는 설명한다.
 */
import type { FaqItem } from '../../components/organisms/FaqSheet/FaqSheet'

/** 시트 머리에 서는 이름. 그 화면의 말이다. */
export const SETTLEMENT_FAQ_TITLE = '스케줄러 결산'

export const SETTLEMENT_FAQ: readonly FaqItem[] = [
  {
    question: '결산이 무엇인가요?',
    answer: [
      {
        kind: 'paragraph',
        text: '넥슨이 일간, 주간 스케줄러 기록을 모아 확정하는 작업입니다. 00:00 ~ 04:00 사이에 진행되며, 결산 중에는 일부 기록이 조회되지 않습니다.',
      },
    ],
  },
  {
    question: '왜 보스가 완료 처리되지 않나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '결산 시간이 아닐 때 보스를 처치하더라도 결산 시간 전에 앱에서 기록을 호출하지 않으면 완료로 처리되지 않을 수 있습니다.',
      },
    ],
  },
  {
    question: '어떻게 해야 하나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '결산이 완료되면 다음 조회 시 앱이 알아서 데이터를 동기화합니다. 기다려주세요.',
      },
    ],
  },
]
