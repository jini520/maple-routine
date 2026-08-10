import type { FeatureGuide } from '../../../types'

// 이미지를 넣을 때: `src/assets/guide/boss-profit-record/` 에 두고 여기서 import 한다.

export const bossProfitRecordGuide: FeatureGuide = {
  id: 'boss-profit-record',
  title: '보스 수익 기록 방법',
  groups: ['profit'],
  sections: [
    {
      id: 'auto',
      title: '따로 기록하지 않아도 쌓입니다',
      blocks: [
        // TODO(#198): 보스 수익 화면(총 수익 + 캐릭터 카드)
        {
          text: '보스 수익은 직접 입력하는 화면이 아닙니다. 스케줄러에서 처치가 확인된 보스를 앱이 알아서 그 기간의 수익으로 기록합니다.',
        },
        {
          text: '금액은 보스와 난이도로 정해지는 결정석 값을 파티 인원으로 나눈 것입니다. 그래서 파티 인원을 정확히 두는 것이 곧 정확한 수익입니다.',
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
          text: '월간 탭에서는 그 달에 속한 주차 소계가 함께 나옵니다. 같은 주가 주간 탭과 다른 숫자로 보이지 않도록 계산 기준을 맞춰 두었습니다.',
        },
      ],
    },
    {
      id: 'crystal-limit',
      title: '결정석 판매 한도 90',
      blocks: [
        {
          text: '결정석은 월드마다 한 주에 90개까지 팔 수 있습니다. 캐릭터마다가 아니라 월드 단위이고, 안 판 몫은 다음 주로 넘어가지 않습니다.',
        },
        {
          text: '주간 보스만 셉니다. 월간 보스 결정석과 시즌 보스는 이 수에 들어가지 않습니다.',
        },
      ],
    },
  ],
}
