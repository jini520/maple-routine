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
    question: '보스를 잡았는데 완료가 되지 않아요.',
    answer: [
      {
        kind: 'paragraph',
        text: '보스 완료 기록은 넥슨이 API로 주는 데이터를 사용해서 처리하고 있습니다. 넥슨에서 완료 기록을 주지 않는 경우 보스를 잡았어도 처리가 완료로 표시되지 않을 수 있습니다.',
      },
    ],
  },
  {
    question: '직접 완료로 기록하면 어떻게 되나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '자동으로 완료한 방식과 똑같이 처리됩니다. 다만, 기록 작성 중 실수를 할 수 있기 때문에 직접 입력된 데이터임을 표시하고 기록을 수정하거나 삭제할 수 있습니다. 작성 후 넥슨에서 정상적인 데이터를 주면 자동으로 동기화 데이터로 전환되고 직접 완료 표시가 사라집니다.',
      },
    ],
  },
  {
    question: '아무 보스나 직접 완료할 수 있나요?',
    answer: [
      {
        kind: 'paragraph',
        text: '아닙니다. 현재는 이 기능을 제한적으로 도입하려고 합니다. 충분한 기간 검토를 진행하여 정식 기능으로 도입할지 지켜볼 예정입니다.',
      },
    ],
  },
]
