import type { FeatureGuide } from '../../../types'
// 이미지는 `src/assets/guide/drop-item-record/` 에 두고 여기서 import 한다.
import buttonImage from '../../../assets/guide/drop-item-record/01-button.webp'
import confirmImage from '../../../assets/guide/drop-item-record/03-confirm.webp'
import sheetImage from '../../../assets/guide/drop-item-record/02-sheet.webp'

export const dropItemRecordGuide: FeatureGuide = {
  id: 'drop-item-record',
  title: '아이템 기록 방법',
  groups: ['profit'],
  sections: [
    {
      id: 'open',
      title: '드롭 기록 열기',
      blocks: [
        {
          image: {
            src: buttonImage,
            alt: '보스 수익의 보스 한 줄. 난이도 칩과 보스 이름, 파티 인원 스테퍼, 오른쪽 위 ‘+ 드롭 추가’ 버튼',
          },
        },
        {
          image: {
            src: sheetImage,
            alt: '드롭 시트. ‘획득한 아이템을 선택하세요’ 안내 아래 장비·소비 아이템 타일 그리드와 고정 드롭, 맨 아래 ‘추가 완료’',
          },
        },
        {
          text: '보스에서 먹은 아이템은 그 보스의 드롭 목록에서 기록합니다. 보스에서 획득 가능한 아이템을 미리 설정해 두었고, 아이템을 누르면 그 자리에서 기록됩니다.',
        },
      ],
    },
    {
      id: 'container',
      title: '상자·반지처럼 결과를 고르는 것',
      blocks: [
        {
          text: '열어 봐야 내용이 정해지는 아이템은 무엇이 나왔는지까지 고릅니다. 반지 상자라면 어떤 반지가 나왔는지를 기록합니다.',
        },
      ],
    },
    {
      id: 'price-prompt',
      title: '기록한 김에 가격까지',
      blocks: [
        {
          image: {
            src: confirmImage,
            alt: '아이템을 기록한 직후 뜨는 확인 줄. ‘◯◯ 기록됨 / 판매 가격을 입력할까요?’ 와 ‘나중에’·‘가격 입력’',
          },
        },
        {
          text: '아이템을 기록하면 바로 옆에 ‘판매 가격을 입력할까요?’ 가 뜹니다. 값을 아는 아이템이면 그 자리에서 넣는 편이 빠릅니다.',
        },
        {
          text: '‘나중에’ 를 눌러도 됩니다. 나중에 ‘아이템 가격’ 화면에서 이어서 넣으면 됩니다.',
        },
      ],
    },
  ],
}
