import type { FeatureGuide } from '../../../types'

// 컨텐츠 편(`content/ingame-sync-content.ts`)과 **다른 글**이다([[ADR-125]] 결정 1 정정) —
// 같은 넥슨 API를 쓰지만 사용자가 신경 쓸 것이 다르다(난이도 단위 기록·조회 실패 시 자동 기록 정지).
//
// 이미지를 넣을 때: `src/assets/guide/ingame-sync-boss/` 에 두고 여기서 import 한다.

export const ingameSyncBossGuide: FeatureGuide = {
  id: 'ingame-sync-boss',
  title: '인게임 데이터 연동 방법 (보스)',
  groups: ['boss'],
  sections: [
    {
      id: 'what',
      title: '무엇이 연동되나',
      blocks: [
        {
          text: '게임 스케줄러에 등록한 보스와 그 처치 여부를 가져옵니다. 컨텐츠와 같은 넥슨 API를 쓰고, 역시 읽기만 합니다.',
        },
        {
          text: '보스는 난이도별로 기록됩니다. 같은 보스라도 하드와 익스트림은 서로 다른 항목입니다.',
        },
      ],
    },
    {
      id: 'refresh',
      title: '언제 갱신되나',
      blocks: [
        {
          text: '화면 진입·당겨서 새로고침·새로고침 버튼 셋 다 같은 갱신입니다. 방금 불러온 직후라면 가지고 있던 값을 그대로 씁니다.',
        },
      ],
    },
    {
      id: 'limits',
      title: '반영이 늦거나 안 맞을 때',
      blocks: [
        {
          text: '처치한 보스가 아직 안 보일 수 있습니다. API 값이 실시간이 아니기 때문이고, 잠시 뒤 새로고침하면 반영됩니다.',
        },
        {
          text: '조회에 실패한 캐릭터는 마지막으로 받아 둔 값을 그대로 보여 줍니다. 그 상태에서는 수익도 새로 기록하지 않습니다 — 오래된 값이 이번 주 기록으로 남지 않도록 막아 둔 것입니다.',
        },
      ],
    },
  ],
}
