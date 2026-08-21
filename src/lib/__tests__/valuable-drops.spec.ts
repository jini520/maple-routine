import itemDropTable from '../../data/item-drop-table.json'
import valuableDrops from '../../data/valuable-drops.json'
import { isValuableDrop } from '../valuable-drops'

describe('isValuableDrop', () => {
  it('칠흑의 보스 세트 구성원은 고가 (장신구·비장신구 모두)', () => {
    expect(isValuableDrop('루즈 컨트롤 머신 마크')).toBe(true) // 장신구
    expect(isValuableDrop('컴플리트 언더컨트롤')).toBe(true) // 기계심장(비장신구)
    expect(isValuableDrop('창세의 뱃지')).toBe(true) // 뱃지(비장신구)
    expect(isValuableDrop('미트라의 분노 선택 상자')).toBe(true) // 선택 상자류
  })

  it('광휘의 보스 세트 구성원은 고가 (불멸의 유산=훈장·오만의 원죄 set 필드 포함)', () => {
    expect(isValuableDrop('불멸의 유산')).toBe(true)
    expect(isValuableDrop('근원의 속삭임')).toBe(true)
    expect(isValuableDrop('오만의 원죄')).toBe(true) // set: 광휘의 보스 세트 (사용자 데이터, 2026-07-27)
  })

  it('개별 지정 아이템(연마석 2종·칠흑 장신구 상자·익셉셔널 해머 슬롯별 5종)은 고가', () => {
    expect(isValuableDrop('생명의 연마석')).toBe(true)
    expect(isValuableDrop('신념의 연마석')).toBe(true)
    expect(isValuableDrop('혼돈의 칠흑 장신구 상자')).toBe(true)
    expect(isValuableDrop('메이린의 칠흑 장신구 상자')).toBe(true)
    // 익셉셔널 해머는 슬롯별 이름으로 분리(2026-07-27) — 5종 모두 고가
    expect(isValuableDrop('익셉셔널 해머(얼굴장식)')).toBe(true)
    expect(isValuableDrop('익셉셔널 해머(눈장식)')).toBe(true)
    expect(isValuableDrop('익셉셔널 해머(훈장)')).toBe(true)
    expect(isValuableDrop('익셉셔널 해머(귀고리)')).toBe(true)
    expect(isValuableDrop('익셉셔널 해머(벨트)')).toBe(true)
  })

  it('여명 세트·일반 아이템은 고가 아님', () => {
    expect(isValuableDrop('데이브레이크 펜던트')).toBe(false) // 여명 세트
    expect(isValuableDrop('주문의 흔적')).toBe(false)
    expect(isValuableDrop('리스트레인트 링')).toBe(false)
    expect(isValuableDrop('홍옥의 보스 반지 상자')).toBe(false)
  })

  // 아이템 이름 드리프트(예: 익셉셔널 해머 슬롯별 개편) 시 물욕 목록이 조용히 매칭 실패하는 것을 막는다.
  it('valuable-drops.json의 items는 모두 item-drop-table.json에 실재하는 아이템명이다', () => {
    const dropTableNames = new Set<string>()
    for (const entry of itemDropTable.rewards) {
      for (const category of ['fixed', 'equipment', 'consumable'] as const) {
        for (const item of (entry.rewards as Record<string, { name: string }[]>)[category] ?? []) {
          dropTableNames.add(item.name.normalize('NFC'))
        }
      }
    }
    for (const name of valuableDrops.items) {
      expect(dropTableNames.has(name.normalize('NFC'))).toBe(true)
    }
  })
})
