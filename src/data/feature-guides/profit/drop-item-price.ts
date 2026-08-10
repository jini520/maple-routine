import type { FeatureGuide } from '../../../types'

// 이미지를 넣을 때: `src/assets/guide/drop-item-price/` 에 두고 여기서 import 한다.
// import whereImage from '../../../assets/guide/drop-item-price/01-entry.webp'
// import screenImage from '../../../assets/guide/drop-item-price/02-screen.webp'
// import padImage from '../../../assets/guide/drop-item-price/03-pad.webp'
//
// v1.0.4 개발 노트가 **두 마디**를 각각 가리킨다([[ADR-125]] 결정 7) — `where`(판매가 입력)와
// `total`(결정석·아이템 갈라 보기). **id 를 바꾸면 그 링크가 깨지고**, 데이터 테스트가 잡는다.

export const dropItemPriceGuide: FeatureGuide = {
  id: 'drop-item-price',
  title: '아이템 가격 기록 방법',
  groups: ['profit'],
  sections: [
    {
      id: 'where',
      title: '가격 기록 화면 열기',
      blocks: [
        // TODO(#198): 보스 수익 화면 제목 줄의 「아이템 가격」 링크
        // { image: { src: whereImage, alt: '보스 수익 제목 줄의 아이템 가격 링크' } },
        {
          text: '보스 수익 화면에서 「아이템 가격」을 누르면, 그 기간에 기록해 둔 드롭에 실제로 판 금액을 매길 수 있습니다.',
        },
        // TODO(#198): 가격 기록 화면 — 요약(미입력 건수) + 캐릭터별 목록
        {
          text: '캐릭터별로 드롭 기록이 모여 있고, 맨 위에 아직 값을 넣지 않은 건수가 나옵니다. 보스 수익에서 보던 주(또는 달)를 그대로 이어받아 열립니다.',
        },
      ],
    },
    {
      id: 'keypad',
      title: '금액 넣기',
      blocks: [
        // TODO(#198): 금액 키패드 — 단위 칩 + 분배 인원 스테퍼
        {
          text: '금액은 앱 안의 키패드로 넣습니다. 「+100만」·「+1억」 같은 칩으로 자릿수를 빠르게 올릴 수 있습니다.',
        },
        {
          text: '「분배 인원」을 정하면 그 수로 나눈 몫이 수익에 들어갑니다. 기본값은 그 보스의 파티 인원이지만, 저장하고 나면 그 값과 상관없이 그대로 남습니다.',
        },
      ],
    },
    {
      id: 'skip',
      title: '「기록 안함」과 「스킵」은 다릅니다',
      blocks: [
        { text: '「기록 안함」은 값을 매기지 않기로 한 결정입니다. 미입력 건수에서 빠집니다.' },
        {
          text: '「스킵」은 아직 팔지 않았다는 뜻입니다. 아무것도 저장하지 않고 미입력으로 남겨 두어, 나중에 팔았을 때 다시 찾아갈 수 있습니다.',
        },
      ],
    },
    {
      id: 'total',
      title: '총 수익에서 갈라 보기',
      blocks: [
        { text: '가격을 매기면 그 금액이 캐릭터별 수익과 총 수익에 함께 더해집니다.' },
        {
          text: '총 수익의 「자세히 보기」를 누르면 결정석과 아이템이 갈라져 나옵니다. 보스 한 줄에 「아이템 +금액」 칩이 붙어 있으면 그 줄의 숫자가 결정석만이 아니라는 표시입니다.',
        },
      ],
    },
  ],
}
