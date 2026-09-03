
import { assetUri } from '../../assets/__tests__/asset-uri'
import { getBossPortraitCrop, getBossPortraitUrl } from '../assets/asset-lookup'

describe('getBossPortraitUrl', () => {
  it('portraitSlug가 null이면 null을 반환한다', () => {
    expect(getBossPortraitUrl(null)).toBeNull()
  })

  it('실제로 존재하는 slug면 URL을 반환한다 (lucid -> lucid.webp, 난이도 무관 통합 이미지)', () => {
    const url = getBossPortraitUrl('lucid')

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('lucid')
  })

  it('존재하지 않는 slug면 null을 반환한다', () => {
    expect(getBossPortraitUrl('존재하지않는슬러그')).toBeNull()
  })

  it('확장자가 png인 경우에도 URL을 반환한다(에픽 던전/길드 배경)', () => {
    const url = getBossPortraitUrl('senya')

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('senya')
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
