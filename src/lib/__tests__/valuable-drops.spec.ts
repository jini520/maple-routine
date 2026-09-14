import { isValuableDropItem } from '../drop/valuable-drops'

describe('isValuableDropItem', () => {
  it('칠흑의 보스 세트 구성원은 고가 (장신구·비장신구 모두)', () => {
    expect(isValuableDropItem('loose_control_machine_mark')).toBe(true) // 루즈 컨트롤 머신 마크, 장신구
    expect(isValuableDropItem('complete_under_control')).toBe(true) // 컴플리트 언더컨트롤, 기계심장
    expect(isValuableDropItem('genesis_badge')).toBe(true) // 창세의 뱃지
    expect(isValuableDropItem('mitra_rage_selection_box')).toBe(true) // 미트라의 분노 선택 상자
  })

  it('광휘의 보스 세트 구성원은 고가 (불멸의 유산=훈장·오만의 원죄 set 필드 포함)', () => {
    expect(isValuableDropItem('immortal_legacy')).toBe(true)
    expect(isValuableDropItem('whisper_of_origin')).toBe(true)
    expect(isValuableDropItem('original_sin_of_arrogance')).toBe(true) // set: 광휘의 보스 세트 (사용자 데이터, 2026-07-27)
  })

  it('소울 에테르 1~4단계는 고가 (2026-09-17 패치, 사용자 확인)', () => {
    for (const tier of [1, 2, 3, 4]) {
      expect(isValuableDropItem(`soul_ether_${tier}`)).toBe(true)
    }
  })

  it('개별 지정 아이템(연마석 2종·칠흑 장신구 상자·익셉셔널 해머 슬롯별 5종)은 고가', () => {
    expect(isValuableDropItem('life_whetstone')).toBe(true)
    expect(isValuableDropItem('faith_whetstone')).toBe(true)
    expect(isValuableDropItem('chaos_pitch_black_accessory_box')).toBe(true)
    expect(isValuableDropItem('meirin_pitch_black_accessory_box')).toBe(true)
    for (const slot of ['face_accessory', 'eye_accessory', 'medal', 'earring', 'belt']) {
      expect(isValuableDropItem(`exceptional_hammer_${slot}`)).toBe(true)
    }
  })

  it('여명 세트·일반 아이템은 고가 아님', () => {
    expect(isValuableDropItem('daybreak_pendant')).toBe(false) // 여명 세트
    expect(isValuableDropItem('spell_trace')).toBe(false)
    expect(isValuableDropItem('restraint_ring')).toBe(false)
    expect(isValuableDropItem('red_boss_ring_box')).toBe(false)
  })

  // 이관이 이름을 못 찾은 옛 기록이다. 무엇인지 모르는 것을 고가로 그리지 않는다.
  it('key 가 없거나 모르는 key 는 고가가 아니다', () => {
    expect(isValuableDropItem(null)).toBe(false)
    expect(isValuableDropItem(undefined)).toBe(false)
    expect(isValuableDropItem('루즈 컨트롤 머신 마크')).toBe(false)
  })
})
