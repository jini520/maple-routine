// 조각 안 글자는 테마와 상관없이 흰색 하나다. 테마의 rise-ink · fall-ink 가 바뀌어도 모든 단계에서 읽혀야 한다.

import themes from '../../../data/job-themes.json'
import { contrastHex } from '../../color'
import { SLICE_LABEL_INK, SLICE_LIGHTNESS, restSliceColor, sliceColor } from '../slice-steps'

const 테마들 = Object.entries(themes as Record<string, { riseInk: string; fallInk: string }>)

describe('도넛 조각 색', () => {
  it.each(테마들)('%s 테마의 모든 조각에서 흰 글자 대비가 4.5 이상이다', (_name, theme) => {
    for (const ink of [theme.riseInk, theme.fallInk]) {
      SLICE_LIGHTNESS.forEach((_, index) => {
        expect(contrastHex(sliceColor(ink, index), SLICE_LABEL_INK)).toBeGreaterThanOrEqual(4.5)
      })
      expect(contrastHex(restSliceColor(ink), SLICE_LABEL_INK)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
