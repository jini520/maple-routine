// 머리 버튼 안에서 얼굴이 넘어가는 값. **판정과 그리기를 가른 쪽의 판정**이다.
//
// 보스 수익의 드럼(`drop-price-fab-motion`)과 지키는 것이 같고 슬롯 수가 **변수**인 점이 다르다.
// 추적 캐릭터가 한 명일 수도 있어서, 3 을 상수로 박으면 그때 원이 두 칸을 빈 채로 돈다.
import {
  HEADER_PORTRAIT_MAX,
  HEADER_PORTRAIT_MOVE_MS,
  HEADER_PORTRAIT_STEP_MS,
  HEADER_PORTRAIT_TRAVEL_PX,
  headerLoopMs,
  loopTo,
  slotOpacity,
  slotPhase,
  slotTranslateY,
} from '../header-portrait-motion'

/** 이동이 차지하는 몫을 뺀 나머지. 가만히 서 있는 구간이다. */
const DWELL = 1 - HEADER_PORTRAIT_MOVE_MS / HEADER_PORTRAIT_STEP_MS

describe('한 바퀴', () => {
  it('슬롯 수만큼 돈다. 얼굴 하나가 제 차례를 같은 길이로 갖는다', () => {
    expect(headerLoopMs(3)).toBe(3 * HEADER_PORTRAIT_STEP_MS)
    expect(headerLoopMs(2)).toBe(2 * HEADER_PORTRAIT_STEP_MS)
  })

  // 돌 것이 없으면 안 돈다. 한 명뿐인데 진행률을 굴리면 그 얼굴이 2초마다 혼자 빠지고 돌아온다.
  it('얼굴이 하나면 진행률이 0 에 머문다', () => {
    expect(loopTo(1)).toBe(0)
    expect(loopTo(0)).toBe(0)
    expect(loopTo(2)).toBe(2)
    expect(loopTo(3)).toBe(3)
  })

  it('도는 얼굴은 셋까지다', () => {
    expect(HEADER_PORTRAIT_MAX).toBe(3)
  })
})

describe('슬롯의 자리', () => {
  it('머무는 동안은 가운데에 진하게 서 있다', () => {
    expect(slotTranslateY(0, 3)).toBe(0)
    expect(slotOpacity(0, 3)).toBe(1)
    expect(slotTranslateY(DWELL, 3)).toBe(0)
  })

  it('자기 차례가 끝나면 위로 빠진다', () => {
    expect(slotTranslateY(1, 3)).toBe(-HEADER_PORTRAIT_TRAVEL_PX)
    expect(slotOpacity(1, 3)).toBe(0)
  })

  // 나간 자리에 그대로 두면 다음 차례에 **위에서 떨어져** 도는 방향이 뒤집힌다.
  it('차례를 기다리는 동안 아래에 있다', () => {
    expect(slotTranslateY(1.5, 3)).toBe(HEADER_PORTRAIT_TRAVEL_PX)
    expect(slotOpacity(1.5, 3)).toBe(0)
  })

  it('아래에서 올라와 제자리에 선다', () => {
    expect(slotTranslateY(3, 3)).toBe(0)
    expect(slotOpacity(3, 3)).toBe(1)
  })

  // 음수가 나오면 그 슬롯이 화면에서 사라진다. 나머지를 두 번 접어 항상 양수로 만든다.
  it('내 차례가 지나간 슬롯도 양수 구간에 있다', () => {
    expect(slotPhase(0, 2, 3)).toBe(1)
    expect(slotPhase(0, 1, 2)).toBe(1)
  })
})

// 나가는 쪽이 잃는 만큼 들어오는 쪽이 얻는다. 그래서 원이 한 순간도 비지 않고 두 얼굴이 동시에
// 진하지도 않다. **슬롯 수가 변수라 이 성질이 2 에서도 성립해야 한다.**
describe('불투명도의 합은 언제나 1', () => {
  function sum(progress: number, slots: number): number {
    let total = 0
    for (let slot = 0; slot < slots; slot += 1) {
      total += slotOpacity(slotPhase(progress, slot, slots), slots)
    }
    return total
  }

  it('셋이 돌 때', () => {
    for (const progress of [0, 0.5, DWELL, 0.9, 1, 1.5, 2.85, 3]) {
      expect(sum(progress, 3)).toBeCloseTo(1, 5)
    }
  })

  it('둘이 돌 때', () => {
    for (const progress of [0, 0.5, DWELL, 0.9, 1, 1.5, 1.9, 2]) {
      expect(sum(progress, 2)).toBeCloseTo(1, 5)
    }
  })
})
