import type { FeatureGuide } from '../../../types'
// 이미지는 `src/assets/guide/boss-party/` 에 두고 여기서 import 한다. 명시적 import 라
// 파일명이 틀리면 **빌드가 실패한다**([[ADR-125]] 결정 4).
import manageImage from '../../../assets/guide/boss-party/03-manage.webp'
import modalImage from '../../../assets/guide/boss-party/02-modal.webp'

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
        {
          image: {
            src: modalImage,
            alt: '보스 카드를 눌러 연 모달 — 보스 이름과 난이도 칩, 파티 인원 스테퍼',
          },
        },
        {
          text: '보스 스케줄러에서 보스 카드를 누르면 파티 인원과 난이도를 바로 고칠 수 있습니다.',
        },
      ],
    },
    {
      id: 'difficulty',
      title: '인원은 난이도마다 따로 기억됩니다',
      blocks: [
        {
          text: '파티 인원은 보스 별, 난이도 별로 각각 관리합니다.',
        },
        {
          text: '고를 수 있는 최대 인원도 난이도마다 다릅니다.',
        },
      ],
    },
    {
      id: 'manage-screen',
      title: '보스 관리 화면에서 한꺼번에',
      blocks: [
        {
          image: {
            src: manageImage,
            alt: '보스 관리 화면 — 「등록된 보스만 보기」 토글과, 보스마다 붙은 파티 인원 스테퍼·난이도 칩',
          },
        },
        {
          text: '「보스 관리」 로 이동하시면 여러 보스를 한 번에 관리할 수 있습니다. 그리고 아직 등록하지 않은 보스의 인원도 미리 정해 둘 수 있습니다.',
        },
      ],
    },
  ],
}
