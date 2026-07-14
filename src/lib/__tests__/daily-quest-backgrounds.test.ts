import { describe, expect, it } from 'vitest'
import { getDailyQuestBackgroundUrl, getDailyQuestRegionCrop } from '../daily-quest-backgrounds'

describe('getDailyQuestBackgroundUrl', () => {
  it('slug가 null이면 null을 반환한다', () => {
    expect(getDailyQuestBackgroundUrl(null)).toBeNull()
  })

  it('실제로 존재하는 slug면 URL을 반환한다 (lachelein -> lachelein.webp)', () => {
    const url = getDailyQuestBackgroundUrl('lachelein')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('lachelein'))
  })

  it('존재하지 않는 slug면 null을 반환한다', () => {
    expect(getDailyQuestBackgroundUrl('존재하지않는슬러그')).toBeNull()
  })
})

describe('getDailyQuestRegionCrop', () => {
  it('slug가 null이면 기본 폴백(cover/center)을 반환한다', () => {
    expect(getDailyQuestRegionCrop(null)).toEqual({ size: 'cover', position: 'center' })
  })

  it('daily-quest-region-crops.json에 매핑이 없는 slug면 기본 폴백(cover/center)을 반환한다', () => {
    expect(getDailyQuestRegionCrop('존재하지않는슬러그')).toEqual({ size: 'cover', position: 'center' })
  })
})
