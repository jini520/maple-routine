import type { FeatureGuide } from '../../../types'

// 이미지를 넣을 때: `src/assets/guide/boss-party/` 에 두고 여기서 import 한다.
// import cardImage from '../../../assets/guide/boss-party/01-card.webp'
// import modalImage from '../../../assets/guide/boss-party/02-modal.webp'
//
// `card` 마디는 v1.0.4 개발 노트가 `guideSectionId` 로 가리키는 착지점이다([[ADR-125]] 결정 7) —
// **id 를 바꾸면 그 링크가 깨진다.** 데이터 테스트가 그 조합을 검사한다.

export const bossPartyGuide: FeatureGuide = {
  id: 'boss-party',
  title: '파티 인원 관리',
  groups: ['boss'],
  sections: [
    {
      id: 'why',
      title: '파티 인원이 왜 필요한가',
      blocks: [
        {
          text: '보스를 잡고 받는 결정석 값은 파티 인원으로 나눕니다. 그래서 인원을 정해 두어야 수익이 실제로 손에 들어온 만큼 계산됩니다.',
        },
        { text: '혼자 잡으면 1로 두면 됩니다.' },
      ],
    },
    {
      id: 'card',
      title: '보스 카드를 눌러 그 자리에서 고치기',
      blocks: [
        // TODO(#198): 보스 스케줄러 목록에서 보스 카드가 보이는 화면
        // { image: { src: cardImage, alt: '보스 스케줄러의 보스 카드' } },
        {
          text: '보스 스케줄러에서 보스 카드를 누르면 파티 인원과 난이도를 바로 고칠 수 있습니다. 목록을 훑다 "이 보스 3인이었지" 하고 알아챈 자리에서 바로 고치라고 만든 것입니다.',
        },
        // TODO(#198): 카드를 눌러 열린 파티 인원·난이도 모달
        { text: '위쪽에서 난이도를 고르고, 아래 스테퍼로 인원을 정합니다.' },
      ],
    },
    {
      id: 'difficulty',
      title: '인원은 난이도마다 따로 기억됩니다',
      blocks: [
        {
          text: '파티 인원은 보스가 아니라 (보스 + 난이도)에 붙습니다. 난이도를 바꾸면 인원도 그 난이도에 저장해 둔 값으로 바뀝니다 — 값이 사라진 것이 아니라 다른 칸을 보는 것입니다.',
        },
        {
          text: '고를 수 있는 최대 인원도 난이도마다 다릅니다. 예를 들어 스우는 하드가 6인까지지만 익스트림은 2인까지입니다.',
        },
      ],
    },
    {
      id: 'manage-screen',
      title: '보스 관리 화면에서 한꺼번에',
      blocks: [
        {
          text: '여러 보스를 한 번에 손보려면 「보스 관리」로 들어가는 편이 빠릅니다. 아직 등록하지 않은 보스의 인원도 미리 정해 둘 수 있습니다.',
        },
      ],
    },
  ],
}
