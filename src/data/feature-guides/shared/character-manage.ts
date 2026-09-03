import type { FeatureGuide } from '../../../types'
// **`shared/` 에 있는 이유**. 이 안내는 `groups: ['content', 'boss', 'settings']` 로 **세 탭에 선다**
// (컨텐츠와 보스가 같은 피커를 쓰므로 같은 글 한 벌이어야 한다 정정 · 설정은
// RN 앱에서 그것을 **여는 자리**다).
// 그래서 어느 한쪽 폴더에 두면 나머지에서 찾을 수 없다.
//
// 이미지는 `src/assets/guide/character-manage/` 에 두고 여기서 import 한다.
import openImage from '../../../assets/guide/character-manage/01-open.webp'

export const characterManageGuide: FeatureGuide = {
  id: 'character-manage',
  title: '캐릭터 관리',
  groups: ['content', 'boss', 'settings'],
  sections: [
    {
      id: 'open',
      title: '사용 방법',
      blocks: [
        {
          image: {
            src: openImage,
            alt: '캐릭터 관리 화면. ‘체크한 캐릭터만 스케줄러 목록에 표시됩니다’ 안내와 캐릭터 카드 그리드, 고른 캐릭터에 별 표시',
          },
        },
        {
          // 여는 자리가 앱 버전에 따라 다르다. 안내는 두 앱이 같은 글 한 벌을 쓰므로 둘 다
          // 맞는 문장이어야 한다.
          text: '설정 화면의 ‘캐릭터 관리’에서 앱이 추적할 캐릭터를 고릅니다. 그 행이 보이지 않는다면 컨텐츠 스케줄러·보스 스케줄러 위쪽의 ‘캐릭터 관리’ 버튼이 같은 화면을 엽니다.',
        },
        {
          text: '고르지 않은 캐릭터는 화면에 나오지 않고, 조회도 하지 않습니다. 필요한 캐릭터만 골라 두면 그만큼 조회가 가벼워집니다.',
        },
      ],
    },
    {
      id: 'active-only',
      title: '선택 할 수 있는 캐릭터',
      blocks: [
        // TODO(#198): 캐릭터 관리 피커 목록. 아직 스크린샷이 없다
        {
          text: '조회가 가능한 것으로 확인된 캐릭터만 목록에 나옵니다. 넥슨 API가 아직 응답하지 않은 캐릭터는 확인이 끝난 뒤에 나타납니다.',
        },
        {
          text: '목록이 비어 보인다면 아직 확인 중이거나, 조회할 수 있는 캐릭터가 없는 것입니다. 화면이 둘을 구분해 알려 줍니다.',
        },
        {
          text: '선택 가능한 캐릭터의 조건은 다음과 같습니다.',
        },
        {
          text: '1. 최근 1주일 이내 접속 기록이 있는 캐릭터.',
        },
        {
          text: '2. 최근 2주일 이내 컨텐츠(일퀘, 주간퀘, 보스)를 완료한 기록이 있는 캐릭터.',
        },
      ],
    },
  ],
}
