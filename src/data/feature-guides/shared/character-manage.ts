import type { FeatureGuide } from '../../../types'

// **`shared/` 에 있는 이유** — 이 안내는 `groups: ['content', 'boss']` 로 **두 탭에 선다**
// (컨텐츠와 보스가 같은 피커를 쓰므로 같은 글 한 벌이어야 한다, [[ADR-125]] 결정 1 정정).
// 그래서 `content/` 든 `boss/` 든 한쪽 폴더에 두면 나머지 한쪽에서 찾을 수 없다.
//
// 이미지를 넣을 때: `src/assets/guide/character-manage/` 에 두고 여기서 import 한다.
// import openImage from '../../../assets/guide/character-manage/01-open.webp'

export const characterManageGuide: FeatureGuide = {
  id: 'character-manage',
  title: '캐릭터 관리',
  groups: ['content', 'boss'],
  sections: [
    {
      id: 'open',
      title: '어디서 여나',
      blocks: [
        // TODO(#198): 스케줄러 헤더의 캐릭터 드롭다운 + 「캐릭터 관리」
        {
          text: '컨텐츠 스케줄러와 보스 스케줄러 위쪽의 캐릭터 이름을 누르면 「캐릭터 관리」가 열립니다. 여기서 앱이 따라갈 캐릭터를 고릅니다.',
        },
        {
          text: '고르지 않은 캐릭터는 화면에 나오지 않고, 조회도 하지 않습니다. 필요한 캐릭터만 골라 두면 그만큼 조회가 가벼워집니다.',
        },
      ],
    },
    {
      id: 'active-only',
      title: '고를 수 있는 캐릭터',
      blocks: [
        // TODO(#198): 캐릭터 관리 피커 목록
        {
          text: '조회가 가능한 것으로 확인된 캐릭터만 목록에 나옵니다. 넥슨 API가 아직 응답하지 않은 캐릭터는 확인이 끝난 뒤에 나타납니다.',
        },
        {
          text: '목록이 비어 보인다면 아직 확인 중이거나, 조회할 수 있는 캐릭터가 없는 것입니다. 화면이 둘을 구분해 알려 줍니다.',
        },
      ],
    },
    {
      id: 'independent',
      title: '컨텐츠와 보스는 목록이 따로입니다',
      blocks: [
        {
          text: '가장 헷갈리기 쉬운 부분입니다. 컨텐츠에서 고른 캐릭터와 보스에서 고른 캐릭터는 서로 다른 목록입니다.',
        },
        {
          text: '일일 컨텐츠는 여러 캐릭터로 돌리고 보스는 본캐만 잡는 식으로 쓸 수 있게 갈라 둔 것입니다. 한쪽에서 골라도 다른 쪽에는 반영되지 않으니, 양쪽 다 필요하면 각각 골라 주세요.',
        },
      ],
    },
  ],
}
