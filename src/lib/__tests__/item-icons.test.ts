import { describe, expect, it } from 'vitest'
import { getItemIconUrl } from '../item-icons'

describe('getItemIconUrl', () => {
  it('item-icons.json에 매핑된 일반 아이템은 URL을 반환한다 (홍옥의 보스 반지 상자 -> boss_ring_box_red.png)', () => {
    const url = getItemIconUrl('홍옥의 보스 반지 상자')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('boss_ring_box_red'))
  })

  it('boss-ring-boxes.json의 반지는 rings/ 하위 파일로 조회된다 (리스트레인트 링 -> Ring_of_Restraint.png)', () => {
    const url = getItemIconUrl('리스트레인트 링')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('Ring_of_Restraint'))
  })

  it('iconFileBySlot 아이템은 slot으로 아이콘을 고른다 (익셉셔널 해머 얼굴장식 -> except_face_acc.png)', () => {
    const url = getItemIconUrl('익셉셔널 해머', '얼굴장식')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('except_face_acc'))
  })

  it('iconFileBySlot 아이템에 slot이 없으면 null (어느 슬롯 아이콘인지 특정 불가)', () => {
    expect(getItemIconUrl('익셉셔널 해머')).toBeNull()
  })

  it('iconFileBySlot 아이템에 없는 slot을 주면 null', () => {
    expect(getItemIconUrl('익셉셔널 해머', '없는슬롯')).toBeNull()
  })

  it("'기타'(백옥 밖 저가치 반지 묶음, ADR-041)는 레벨퍼프 링 아이콘으로 조회된다", () => {
    const url = getItemIconUrl('기타')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('Level_Jump_Ring'))
  })

  it('영롱한 달빛 포션은 luminous_moonshine_potion.png로 조회된다', () => {
    const url = getItemIconUrl('영롱한 달빛 포션')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('luminous_moonshine_potion'))
  })

  it('여러 상자에 겹치는 생명의 연마석은 item-icons.json의 whetstone로 조회된다', () => {
    const url = getItemIconUrl('생명의 연마석')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('whetstone_life'))
  })

  it('매핑이 없는 아이템은 null을 반환한다 (주문의 흔적)', () => {
    expect(getItemIconUrl('주문의 흔적')).toBeNull()
  })

  it('NFC/NFD 정규화가 달라도 동일하게 조회된다', () => {
    const nfd = '홍옥의 보스 반지 상자'.normalize('NFD')

    expect(getItemIconUrl(nfd)).toEqual(expect.stringContaining('boss_ring_box_red'))
  })
})
