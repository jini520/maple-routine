import type { FeatureGuide } from '../../../types'

// 이미지를 넣을 때: `src/assets/guide/drop-history/` 에 두고 여기서 import 한다.

export const dropHistoryGuide: FeatureGuide = {
  id: 'drop-history',
  title: '히스토리',
  groups: ['profit'],
  sections: [
    {
      id: 'where',
      title: '전 기간 기록 보기',
      blocks: [
        // TODO(#198): 드롭 히스토리 화면
        {
          text: '보스 수익 화면의 「히스토리」로 들어가면, 기간에 상관없이 지금까지 기록한 아이템을 한 줄로 이어 볼 수 있습니다.',
        },
        {
          text: '보스 수익 화면이 한 주(또는 한 달)를 보는 자리라면, 히스토리는 전체를 훑는 자리입니다.',
        },
      ],
    },
    {
      id: 'readonly',
      title: '여기서는 고치지 않습니다',
      blocks: [
        {
          text: '히스토리는 읽기 전용입니다. 잘못 기록한 것을 지우거나 고치는 일은 드롭 기록 화면에서 합니다 — 기록이 두 곳에서 바뀌면 어느 쪽이 맞는지 알 수 없게 되기 때문입니다.',
        },
      ],
    },
  ],
}
