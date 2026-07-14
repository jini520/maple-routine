import { describe, expect, it } from 'vitest'
import { getDailyQuestRegionIconUrl } from '../daily-quest-icons'

describe('getDailyQuestRegionIconUrl', () => {
  it('slug가 null이면 null을 반환한다', () => {
    expect(getDailyQuestRegionIconUrl(null)).toBeNull()
  })

  // 실제 아이콘 파일의 확장자(png/webp)는 언제든 바뀔 수 있어 특정 확장자를 전제하지 않는다 —
  // 확장자와 무관하게 slug만으로 조회되는지가 검증 대상이다.
  it('실제로 존재하는 slug면 확장자와 무관하게 URL을 반환한다', () => {
    const url = getDailyQuestRegionIconUrl('lachelein')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('lachelein'))
  })

  it('존재하지 않는 slug면 null을 반환한다', () => {
    expect(getDailyQuestRegionIconUrl('존재하지않는슬러그')).toBeNull()
  })
})
