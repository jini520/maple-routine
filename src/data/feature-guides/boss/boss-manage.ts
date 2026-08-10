import type { FeatureGuide } from '../../../types'

// 이미지를 넣을 때: `src/assets/guide/boss-manage/` 에 두고 여기서 import 한다.
// import autoImage from '../../../assets/guide/boss-manage/01-auto.webp'

export const bossManageGuide: FeatureGuide = {
  id: 'boss-manage',
  title: '보스 관리 방법',
  groups: ['boss'],
  sections: [
    {
      id: 'mode',
      title: '자동과 수동, 무엇이 다른가',
      blocks: [
        {
          text: '컨텐츠와 같은 설정을 씁니다. 설정 › 스케줄 관리 방법이 「자동」이면 게임에 등록한 보스를 그대로 따라가고, 「수동」이면 앱에서 직접 고릅니다.',
        },
      ],
    },
    {
      id: 'auto',
      title: '자동 — 목록은 게임 등록 기준',
      blocks: [
        // TODO(#198): 자동 모드의 보스 관리 화면(상단 안내 + 「등록된 보스만 보기」 토글)
        {
          text: '자동 모드에서는 보스 관리 화면에 체크가 없습니다. 목록이 게임 등록 기준이라, 여기서 할 수 있는 것은 파티 인원을 정하는 일입니다.',
        },
        {
          text: '「등록된 보스만 보기」가 기본으로 켜져 있습니다. 끄면 등록하지 않은 보스도 함께 보이고, 미리 파티 인원을 정해 둘 수 있습니다.',
        },
      ],
    },
    {
      id: 'manual',
      title: '수동 — 직접 골라 담는다',
      blocks: [
        // TODO(#198): 수동 모드의 보스 관리 화면(체크 목록 + 난이도)
        { text: '보스 스케줄러 위쪽 「보스 관리」로 들어가 보스와 난이도를 고릅니다.' },
        {
          text: '목록에는 그 캐릭터가 실제로 고를 수 있는 보스만 나옵니다. 아직 출시되지 않은 보스는 빠지고, 시즌 보스는 챌린저스 월드 캐릭터에게만 보입니다.',
        },
      ],
    },
    {
      id: 'limit',
      title: '주간 보스는 12개까지',
      blocks: [
        {
          text: '한 캐릭터가 한 주에 잡을 수 있는 주간 보스는 12개입니다. 앱도 같은 한도를 지키므로 13번째는 고를 수 없습니다.',
        },
        {
          text: '이미 고른 보스의 난이도만 바꾸는 것은 개수가 늘지 않으므로 한도에 걸리지 않습니다.',
        },
      ],
    },
  ],
}
