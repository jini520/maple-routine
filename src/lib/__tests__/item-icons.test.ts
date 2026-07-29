import { describe, expect, it } from 'vitest'
import { getItemIconUrl, getItemIconUrlByFile } from '../item-icons'

describe('getItemIconUrl', () => {
  it('item-icons.json에 매핑된 일반 아이템은 URL을 반환한다 (홍옥의 보스 반지 상자 -> boss_ring_box_red.png)', () => {
    const url = getItemIconUrl('홍옥의 보스 반지 상자')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('boss_ring_box_red'))
  })

  it('boss-ring-boxes.json의 반지는 rings/ 하위 파일로 조회된다 (리스트레인트 링 -> Ring_of_Restraint.webp)', () => {
    const url = getItemIconUrl('리스트레인트 링')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('Ring_of_Restraint'))
  })

  it('슬롯별 이름의 익셉셔널 해머는 각 슬롯 아이콘으로 조회된다 (이름에 슬롯 포함, 2026-07-27)', () => {
    expect(getItemIconUrl('익셉셔널 해머(얼굴장식)')).toEqual(expect.stringContaining('except_face_acc'))
    expect(getItemIconUrl('익셉셔널 해머(눈장식)')).toEqual(expect.stringContaining('except_eye_acc'))
    expect(getItemIconUrl('익셉셔널 해머(훈장)')).toEqual(expect.stringContaining('except_merit'))
    expect(getItemIconUrl('익셉셔널 해머(귀고리)')).toEqual(expect.stringContaining('except_earring'))
    expect(getItemIconUrl('익셉셔널 해머(벨트)')).toEqual(expect.stringContaining('except_belt'))
  })

  it('슬롯 접미사 없는 옛 익셉셔널 해머 이름은 더 이상 매핑되지 않는다', () => {
    expect(getItemIconUrl('익셉셔널 해머', '얼굴장식')).toBeNull()
  })

  it("'기타'(백옥 밖 저가치 반지 묶음, ADR-041)는 리밋 링 아이콘으로 조회된다", () => {
    const url = getItemIconUrl('기타')

    expect(url).not.toBeNull()
    expect(url).toEqual(expect.stringContaining('Limit_Ring'))
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

  it('매핑이 없는 아이템은 null을 반환한다', () => {
    expect(getItemIconUrl('존재하지 않는 아이템')).toBeNull()
  })

  it('NFC/NFD 정규화가 달라도 동일하게 조회된다', () => {
    const nfd = '홍옥의 보스 반지 상자'.normalize('NFD')

    expect(getItemIconUrl(nfd)).toEqual(expect.stringContaining('boss_ring_box_red'))
  })
})

describe('getItemIconUrlByFile', () => {
  it('파일명으로 표시전용 아이콘(솔 에르다 단위)을 조회한다', () => {
    expect(getItemIconUrlByFile('sole_500.webp')).toEqual(expect.stringContaining('sole_500'))
    expect(getItemIconUrlByFile('sole_10.png')).toEqual(expect.stringContaining('sole_10'))
  })

  it('없는 파일은 null을 반환한다', () => {
    expect(getItemIconUrlByFile('nope.png')).toBeNull()
  })
})
