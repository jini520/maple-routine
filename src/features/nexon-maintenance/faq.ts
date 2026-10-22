/**
 * 점검 배너가 여는 FAQ. **문구는 사용자가 확정한 것**이라 임의로 손대지 말 것.
 *
 * **막히는 것을 넓게 적는다.** 메이플스토리 API 점검 때 어느 경로가 막히는지는 한 번 잰 것뿐이고 점검마다 다를 수 있다.
 * 좁게 적으면 적지 않은 것이 막혔을 때 사용자가 앱이 틀렸다고 읽는다.
 */
import type { FaqItem } from '../../components/organisms/FaqSheet/FaqSheet'

/** 시트 머리에 서는 이름. */
export const MAINTENANCE_FAQ_TITLE = 'Open API 점검'

export const MAINTENANCE_FAQ: readonly FaqItem[] = [
  {
    question: '점검 중에는 무엇을 불러올 수 없나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '캐릭터 정보, 컨텐츠와 보스 진행 상태처럼 넥슨에서 받아 오는 정보는 대부분 불러올 수 없습니다. 그래서 대부분의 기능은 마지막으로 불러온 기록을 기준으로 보여 줍니다. 실제 게임 속 데이터와 다를 수 있습니다. 가계부, 보스 수익 기록, 통계처럼 앱에 저장된 기록은 그대로 쓸 수 있습니다.',
      },
    ],
  },
  {
    question: '기록이 사라지나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '사라지지 않습니다. 기기에 저장된 기록과 마지막으로 불러온 정보를 그대로 보여 줍니다.',
      },
    ],
  },
  {
    question: '어떻게 해야 하나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '점검이 끝나면 다음 조회 때 앱이 알아서 다시 불러오고, 배너도 사라집니다. 기다려주세요.',
      },
    ],
  },
]
