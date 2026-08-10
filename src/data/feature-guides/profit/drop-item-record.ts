import type { FeatureGuide } from '../../../types'

// 이미지를 넣을 때: `src/assets/guide/drop-item-record/` 에 두고 여기서 import 한다.

export const dropItemRecordGuide: FeatureGuide = {
  id: 'drop-item-record',
  title: '아이템 기록 방법',
  groups: ['profit'],
  sections: [
    {
      id: 'open',
      title: '드롭 기록 열기',
      blocks: [
        // TODO(#198): 보스 수익에서 드롭 시트를 연 화면(아이템 타일 그리드)
        {
          text: '보스에서 먹은 아이템은 그 보스의 드롭 목록에서 기록합니다. 아이템이 타일로 깔려 있고, 누르면 그 자리에서 기록됩니다.',
        },
        { text: '확인창은 없습니다. 잘못 눌렀으면 다시 눌러 취소하면 됩니다.' },
      ],
    },
    {
      id: 'container',
      title: '상자·반지처럼 결과를 고르는 것',
      blocks: [
        {
          text: '열어 봐야 내용이 정해지는 아이템은 무엇이 나왔는지까지 고릅니다. 반지 상자라면 어떤 반지가 나왔는지를 기록합니다.',
        },
        {
          text: '주문의 흔적처럼 난이도만 알면 수량이 정해지는 고정 드롭은 목록에 없습니다. 고를 것이 없기 때문입니다.',
        },
      ],
    },
    {
      id: 'price-prompt',
      title: '기록한 김에 가격까지',
      blocks: [
        {
          text: '아이템을 기록하면 바로 옆에 「판매 가격을 입력할까요?」가 뜹니다. 값을 아는 아이템이면 그 자리에서 넣는 편이 빠릅니다.',
        },
        {
          text: '「나중에」를 눌러도 됩니다. 아직 팔지 않았다면 나중에 아이템 가격 화면에서 이어서 넣으면 됩니다.',
        },
      ],
    },
  ],
}
