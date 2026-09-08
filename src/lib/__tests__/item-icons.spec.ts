
import { assetUri } from '../../assets/__tests__/asset-uri'
import { cashbookRowIconOf, getItemIconUrl, getItemIconUrlByFile } from '../assets/asset-lookup'

describe('getItemIconUrl', () => {
  it('item-icons.json에 매핑된 일반 아이템은 URL을 반환한다 (홍옥의 보스 반지 상자 -> boss_ring_box_red.png)', () => {
    const url = getItemIconUrl('홍옥의 보스 반지 상자')

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('boss_ring_box_red')
  })

  it('boss-ring-boxes.json의 반지는 rings/ 하위 파일로 조회된다 (리스트레인트 링 -> Ring_of_Restraint.webp)', () => {
    const url = getItemIconUrl('리스트레인트 링')

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('Ring_of_Restraint')
  })

  it('슬롯별 이름의 익셉셔널 해머는 각 슬롯 아이콘으로 조회된다 (이름에 슬롯 포함, 2026-07-27)', () => {
    expect(assetUri(getItemIconUrl('익셉셔널 해머(얼굴장식)'))).toContain('except_face_acc')
    expect(assetUri(getItemIconUrl('익셉셔널 해머(눈장식)'))).toContain('except_eye_acc')
    expect(assetUri(getItemIconUrl('익셉셔널 해머(훈장)'))).toContain('except_merit')
    expect(assetUri(getItemIconUrl('익셉셔널 해머(귀고리)'))).toContain('except_earring')
    expect(assetUri(getItemIconUrl('익셉셔널 해머(벨트)'))).toContain('except_belt')
  })

  it('슬롯 접미사 없는 옛 익셉셔널 해머 이름은 더 이상 매핑되지 않는다', () => {
    expect(getItemIconUrl('익셉셔널 해머', '얼굴장식')).toBeNull()
  })

  it("'기타'(백옥 밖 저가치 반지 묶음)는 리밋 링 아이콘으로 조회된다", () => {
    const url = getItemIconUrl('기타')

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('Limit_Ring')
  })

  it('영롱한 달빛 포션은 luminous_moonshine_potion.png로 조회된다', () => {
    const url = getItemIconUrl('영롱한 달빛 포션')

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('luminous_moonshine_potion')
  })

  it('여러 상자에 겹치는 생명의 연마석은 item-icons.json의 whetstone로 조회된다', () => {
    const url = getItemIconUrl('생명의 연마석')

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('whetstone_life')
  })

  it('주문서 교환권 3종은 각자의 아이콘으로 조회된다', () => {
    expect(assetUri(getItemIconUrl('프리미엄 악세서리 스크롤 교환권'))).toContain('premium_accessory_scroll_coupon')
    expect(assetUri(getItemIconUrl('프리미엄 펫장비 스크롤 교환권'))).toContain('premium_petequip_scroll_coupon')
    expect(assetUri(getItemIconUrl('매지컬 무기 주문서 교환권'))).toContain('magical_weapon_scroll_coupon')
  })

  it('파풀라투스 마크는 실제 아이콘으로 조회된다 (플레이스홀더 교체)', () => {
    expect(assetUri(getItemIconUrl('파풀라투스 마크'))).toContain('papulatus_mark')
  })

  it('매핑이 없는 아이템은 null을 반환한다', () => {
    expect(getItemIconUrl('존재하지 않는 아이템')).toBeNull()
  })

  it('NFC/NFD 정규화가 달라도 동일하게 조회된다', () => {
    const nfd = '홍옥의 보스 반지 상자'.normalize('NFD')

    expect(assetUri(getItemIconUrl(nfd))).toContain('boss_ring_box_red')
  })
})

describe('getItemIconUrlByFile', () => {
  it('파일명으로 표시전용 아이콘(솔 에르다 단위)을 조회한다', () => {
    expect(assetUri(getItemIconUrlByFile('sole_500.webp'))).toContain('sole_500')
    expect(assetUri(getItemIconUrlByFile('sole_10.png'))).toContain('sole_10')
  })

  it('없는 파일은 null을 반환한다', () => {
    expect(getItemIconUrlByFile('nope.png')).toBeNull()
  })
})

// 가계부 줄 표식이 실제 파일에 닿는가.
//
// 표에 파일 이름을 손으로 적으므로 오타 한 글자면 그 줄만 조용히 아이콘으로 남는다. 화면에서는
// **아직 안 바꿨나** 로 보여 고장으로 안 읽힌다.
describe('가계부 줄 표식', () => {
  it.each([
    '보스 결정석',
    '큐브 재설정',
    '스타포스',
    '잠재능력',
    '에디셔널 잠재능력',
    '사냥',
    '버프',
  ])('%s 줄이 그림을 찾는다', (key) => {
    expect(cashbookRowIconOf(key)).not.toBeNull()
  })

  // 표에 없는 갈래는 `null` 이어야 화면이 아이콘으로 떨어진다. 폴백 그림을 두면 틀린 것을 그린다.
  it.each(['아이템 판매', '컨텐츠', '이벤트·BM', '아이템 구매', '기타'])(
    '%s 줄은 그림이 없다',
    (key) => {
      expect(cashbookRowIconOf(key)).toBeNull()
    },
  )
})
