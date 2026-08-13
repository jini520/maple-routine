import type { FeatureGuide } from '../../../types'

// 컨텐츠 편(`content/ingame-sync-content.ts`)과 **다른 글**이다([[ADR-125]] 결정 1 정정) —
// 같은 넥슨 API를 쓰지만 사용자가 신경 쓸 것이 다르다(난이도 단위 기록·조회 실패 시 자동 기록 정지).
//
// 이미지를 넣을 때: `packages/core/src/assets/guide/ingame-sync-boss/` 에 두고 여기서 import 한다.

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
          text: '처치한 보스가 아직 안 보일 수 있습니다. 넥슨 API가 데이터를 제공해 주기까지 시간이 걸립니다.',
        },
        {
          text: '인게임에서 캐시샵에 방문하거나, 접속 종료 후 재접속하면 더 빨리 반영됩니다.'
        },
      ],
    },
  ],
}
