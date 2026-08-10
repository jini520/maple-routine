import type { FeatureGuide } from '../../../types'

// 이미지를 넣을 때: `src/assets/guide/ingame-sync-content/` 에 두고 여기서 import 한다.
// import refreshImage from '../../../assets/guide/ingame-sync-content/01-refresh.webp'

export const ingameSyncContentGuide: FeatureGuide = {
  id: 'ingame-sync-content',
  title: '인게임 데이터 연동 방법 (컨텐츠)',
  groups: ['content'],
  sections: [
    {
      id: 'what',
      title: '무엇이 연동되나',
      blocks: [
        {
          text: '앱은 넥슨이 공개한 API로 게임 기록을 읽어 옵니다. 컨텐츠에서는 게임 스케줄러에 등록한 일간·주간 컨텐츠와 그 진행 수치를 가져옵니다.',
        },
        { text: '읽기만 합니다. 앱에서 무엇을 하더라도 게임 쪽 기록은 바뀌지 않습니다.' },
      ],
    },
    {
      id: 'refresh',
      title: '언제 갱신되나',
      blocks: [
        // TODO(#198): 컨텐츠 스케줄러에서 당겨서 새로고침 하는 순간
        {
          text: '화면에 들어올 때 갱신되고, 목록을 아래로 당겨도 다시 불러옵니다. 오른쪽 위 새로고침 버튼도 같은 일을 합니다.',
        },
        {
          text: '방금 불러온 뒤라면 다시 부르지 않고 가지고 있던 값을 그대로 보여 줍니다. 같은 것을 반복해서 조회하면 하루 호출 한도만 줄기 때문입니다.',
        },
      ],
    },
    {
      id: 'limits',
      title: '반영이 늦거나 안 보일 때',
      blocks: [
        {
          text: '게임에서 방금 한 일이 앱에 바로 보이지 않을 수 있습니다. 넥슨 API가 내려 주는 값 자체가 실시간이 아니기 때문이고, 앱이 더 자주 불러도 달라지지 않습니다.',
        },
        {
          text: '자동 모드인데 목록이 비어 있다면 게임 스케줄러에 등록된 것이 없는 것입니다. 앱에서 채울 수 있는 것이 아니라 게임에서 먼저 등록해야 합니다.',
        },
      ],
    },
  ],
}
