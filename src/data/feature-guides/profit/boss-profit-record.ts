import type { FeatureGuide } from '../../../types'
// 이미지는 `packages/core/src/assets/guide/boss-profit-record/` 에 두고 여기서 import 한다.
import listImage from '../../../assets/guide/boss-profit-record/01-list.webp'

export const bossProfitRecordGuide: FeatureGuide = {
  id: 'boss-profit-record',
  title: '보스 수익 기록 방법',
  groups: ['profit'],
  sections: [
    {
      id: 'auto',
      title: '기록하지 않아도 쌓입니다',
      blocks: [
        {
          image: {
            src: listImage,
            alt: '보스 수익 화면. 주간·월간 탭과 이번 주 총 수익, 그 아래 캐릭터별 수익 카드 목록',
          },
        },
        {
          text: '보스 수익은 직접 입력하는 화면이 아닙니다. 스케줄러에서 처치가 확인된 보스를 앱이 알아서 그 기간의 수익으로 기록합니다.',
        },
        {
          text: '금액은 보스와 난이도로 정해지는 결정석 값을 파티 인원으로 나눈 것입니다. ‘보스 관리’ 에서 파티 인원을 미리 설정해 두면 자동으로 계산됩니다.',
        },
        {
          text: '미리 설정해 두지 않으셨어도 수동으로 언제든 바꿀 수 있습니다. 여기서 파티 인원을 바꾸더라도 ‘보스 관리’ 에 설정된 값을 바꾸지는 않습니다.',
        },
      ],
    },
    {
      id: 'period',
      title: '주간과 월간',
      blocks: [
        {
          text: '위쪽 탭으로 주간과 월간을 오갑니다. 화살표로 지난 주(달)를 볼 수 있고, 과거 기간은 그때 기록된 것을 그대로 보여 줍니다.',
        },
        {
          text: '과거의 결정석 수익은 기기에 저장된 데이터에 의존합니다. 넥슨 API는 2주간의 데이터만 제공하기 때문에 기기에 저장되지 않은 기록은 더이상 조회할 수 없습니다.',
        },
        {
          text: '월간 탭에서는 그 달에 속한 주차 소계가 함께 나옵니다. 같은 주가 주간 탭과 다른 숫자로 보이지 않도록 계산 기준을 맞춰 두었습니다.',
        },
      ],
    },
  ],
}
