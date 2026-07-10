import { describe, expect, it } from 'vitest'
import { getBossPortraitUrl } from '../boss-icons'

describe('getBossPortraitUrl', () => {
  it('portraitSlug가 null이면 null을 반환한다', () => {
    expect(getBossPortraitUrl(null, '하드')).toBeNull()
  })

  it('실제로 존재하는 slug+난이도 조합이면 URL을 반환한다 (lucid + 하드 -> hard_lucid.png)', () => {
    const url = getBossPortraitUrl('lucid', '하드')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('hard_lucid'))
  })

  it('slug는 존재하지만 그 난이도의 파일은 없으면 null을 반환한다 (루시드는 카오스 파일이 없음)', () => {
    expect(getBossPortraitUrl('lucid', '카오스')).toBeNull()
  })

  it('존재하지 않는 slug면 null을 반환한다', () => {
    expect(getBossPortraitUrl('존재하지않는슬러그', '하드')).toBeNull()
  })
})
