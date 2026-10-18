import { dropItemKeyOfName, dropItemNameOf, findDropItem, isValuableDropItem } from '../drop/drop-items'

// 드롭 아이템 마스터 표 조회. 기록은 key 를 들고 이름은 여기서 찾는다.
describe('drop-items', () => {
  it('key 로 표의 줄을 찾는다. 모르는 key 와 key 없음은 null 이다', () => {
    expect(findDropItem('dreamy_belt')).toMatchObject({ name: '몽환의 벨트', iconFile: 'dark_boss_belt.png' })
    expect(findDropItem('nope')).toBeNull()
    expect(findDropItem(null)).toBeNull()
  })

  // 이름을 바꿔도 옛 기록이 따라오게 표 이름이 이긴다. 표에 없으면 적어 둔 이름이다.
  it('보이는 이름은 표 이름이고, 못 찾으면 적어 둔 이름이다', () => {
    expect(dropItemNameOf('dreamy_belt', '옛 이름')).toBe('몽환의 벨트')
    expect(dropItemNameOf(null, '익셉셔널 해머')).toBe('익셉셔널 해머')
    expect(dropItemNameOf('nope', '익셉셔널 해머')).toBe('익셉셔널 해머')
  })

  // 이관만 쓴다. 파일시스템에서 온 NFD 글자도 같은 이름이다.
  it('이름에서 key 를 찾는다. NFC 로 맞추고 모르는 이름은 null 이다', () => {
    expect(dropItemKeyOfName('리스트레인트 링')).toBe('restraint_ring')
    expect(dropItemKeyOfName('고통의 근원'.normalize('NFD'))).toBe('source_of_suffering')
    expect(dropItemKeyOfName('기타')).toBe('other_ring')
    expect(dropItemKeyOfName('익셉셔널 해머')).toBeNull()
  })
})

// 고가 판정은 표의 valuable 한 칸이다. 세트 소속으로 추정하지 않는다.
describe('isValuableDropItem', () => {
  it('표에서 고가로 켠 아이템은 고가다', () => {
    expect(isValuableDropItem('loose_control_machine_mark')).toBe(true)
    expect(isValuableDropItem('soul_ether_1')).toBe(true)
    expect(isValuableDropItem('life_whetstone')).toBe(true)
  })

  it('안 켠 아이템은 고가가 아니다', () => {
    expect(isValuableDropItem('spell_trace')).toBe(false)
    expect(isValuableDropItem('red_boss_ring_box')).toBe(false)
  })

  // 이관이 이름을 못 찾은 옛 기록이다. 무엇인지 모르는 것을 고가로 그리지 않는다.
  it('key 가 없거나 모르는 key 는 고가가 아니다', () => {
    expect(isValuableDropItem(null)).toBe(false)
    expect(isValuableDropItem(undefined)).toBe(false)
    expect(isValuableDropItem('루즈 컨트롤 머신 마크')).toBe(false)
  })
})
