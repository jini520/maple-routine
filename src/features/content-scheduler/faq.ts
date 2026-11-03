/** 컨텐츠 스케줄러와 컨텐츠 관리 머리의 물음표가 여는 FAQ. **문구는 사용자가 확정한 것**이라 임의로 손대지 말 것. */
import type { FaqItem } from '../../components/organisms/FaqSheet/FaqSheet'

export const CONTENT_SCHEDULER_FAQ: readonly FaqItem[] = [
  {
    question: '게임에서 방금 끝낸 컨텐츠가 아직 완료로 안 보여요.',
    answer: [
      {
        kind: 'paragraph',
        text: '넥슨 API가 게임 기록을 제공하기까지 시간이 걸려요. 게임에서 캐시샵에 들어갔다 나오거나 다시 접속하면 더 빨리 반영돼요.',
      },
    ],
  },
  {
    question: '컨텐츠를 앱에서 직접 추가하거나 뺄 수 있나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '‘자동’ 방식에서는 게임 내 스케줄러에 등록한 컨텐츠를 그대로 보여 줘서, 게임에서 등록하거나 빼야 해요. 더보기 탭 > 설정 > 스케줄 관리 방법을 ‘수동’으로 바꾸면 제목 오른쪽의 ‘컨텐츠 관리’에서 직접 고를 수 있어요. 다만 ‘수동’ 방식에서는 게임 내 스케줄러에서 항목을 바꿔도 앱에 반영되지 않아서 추천하지 않아요.',
      },
    ],
  },
]

export const CONTENT_MANAGE_FAQ: readonly FaqItem[] = [
  {
    question: '컨텐츠 관리에서는 무엇을 할 수 있나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '‘수동’ 방식에서 볼 컨텐츠를 직접 추가하거나 뺄 수 있어요.',
      },
    ],
  },
  {
    question: '게임 내 스케줄러에 새로 등록한 컨텐츠도 자동으로 추가되나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '‘수동’ 방식의 목록은 ‘수동’으로 바꿀 때 한 번만 게임 내 스케줄러에 맞춰 채워지고, 그 뒤로는 자동으로 반영되지 않아요. 게임 내 스케줄러를 그대로 따르려면 ‘자동’ 방식으로 바꿔 주세요.',
      },
    ],
  },
]
