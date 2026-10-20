
import { getBossPortraitCrop, getBossPortraitUrl } from '../assets/asset-lookup'

describe('getBossPortraitUrl', () => {
  it('portraitSlug가 null이면 null을 반환한다', () => {
    expect(getBossPortraitUrl(null)).toBeNull()
  })

  it('존재하지 않는 slug면 null을 반환한다', () => {
    expect(getBossPortraitUrl('존재하지않는슬러그')).toBeNull()
  })
})

describe('getBossPortraitCrop', () => {
  it('portraitSlug가 null이면 기본 폴백(cover/center)을 반환한다', () => {
    expect(getBossPortraitCrop(null)).toEqual({ size: 'cover', position: 'center' })
  })

  it('boss-portrait-crops.json에 매핑이 없는 slug면 기본 폴백(cover/center)을 반환한다', () => {
    expect(getBossPortraitCrop('존재하지않는슬러그')).toEqual({ size: 'cover', position: 'center' })
  })
})
