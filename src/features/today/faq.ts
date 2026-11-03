/**
 * today 머리의 물음표가 여는 FAQ. **문구는 사용자가 확정한 것**이라 임의로 손대지 말 것.
 *
 * 공유 컨텐츠의 표시 기준은 위젯의 툴팁에 있던 내용이다. 툴팁을 걷고 여기로 옮겼다.
 */
import type { FaqItem } from '../../components/organisms/FaqSheet/FaqSheet'

export const TODAY_FAQ: readonly FaqItem[] = [
  {
    question: 'today에서는 무엇을 할 수 있나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '여러 화면의 정보를 모아 오늘 할 일과 이번 주 결과를 한눈에 보여 주는 화면이에요. 남은 스케줄, 다음 파티 스케줄, 이번 주 수입 등을 확인할 수 있고, ‘빠른 이동’으로 원하는 화면에 바로 갈 수 있어요.',
      },
    ],
  },
  {
    question: '공유 컨텐츠가 실제 캐릭터의 진행과 달라요.',
    answer: [
      {
        kind: 'paragraph',
        text: '공유 컨텐츠는 넥슨 스케줄러 API가 주는 기준을 그대로 따라요. 몬스터파크와 익스트림 몬스터파커는 마지막에 접속한 캐릭터, 에픽 던전과 메이플 유니온은 메이플 ID가 기준이에요. 그래서 일부 컨텐츠의 완료 여부가 실제와 다르게 보일 수 있어요.',
      },
    ],
  },
  {
    question: '정보를 다시 불러오려면 어떻게 하나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '화면을 아래로 당기면 새로고침돼요. 다른 화면에서도 대부분 같은 방법으로 새로고침할 수 있어요.',
      },
    ],
  },
]
