// 아이템 가격 버튼 안에서 도는 드럼의 값. 판정과 그리기를 가른다.
//
// 값이 컴포넌트 밖에 있는 것은 애니메이션을 띄우지 않고도 규칙을 검증할 수 있어야 하기
// 때문이다. 이 드럼이 말하려는 것은 **셋이 겹치지 않고 하나씩 지나간다** 인데, 그것은 렌더된
// 프레임으로는 붙들기 어렵다. `speed-dial-motion.ts` 가 같은 이유로 갈라져 있다.
import {
  FAB_ITEM_BLUR,
  FAB_ITEM_LOOP_MS,
  FAB_ITEM_MOVE_MS,
  FAB_ITEM_SLOTS,
  FAB_ITEM_STEP_MS,
  FAB_ITEM_TRAVEL_PX,
  slotOpacity,
  slotPhase,
  slotTranslateY,
  veilIntensity,
} from '../drop-price-fab-motion'

/** 이동이 차지하는 몫. 나머지가 한 그림이 가만히 서 있는 시간이다. */
const MOVE = FAB_ITEM_MOVE_MS / FAB_ITEM_STEP_MS
const DWELL = 1 - MOVE

describe('슬롯이 자기 자리를 아는 법', () => {
  it('진행률이 0 이면 첫 슬롯이 가운데다', () => {
    expect(slotPhase(0, 0)).toBe(0)
  })

  // 슬롯 하나가 가운데 설 때 나머지 둘은 **뒤에 줄 서 있다**. 셋이 한 값에서 자기 자리를
  // 계산하므로 어긋날 자리가 없다.
  it('나머지 둘은 자기 차례만큼 뒤에 선다', () => {
    expect(slotPhase(0, 1)).toBe(2)
    expect(slotPhase(0, 2)).toBe(1)
  })

  it('한 바퀴를 돌면 처음으로 돌아온다', () => {
    expect(slotPhase(FAB_ITEM_SLOTS, 0)).toBe(0)
  })

  // 진행률이 슬롯 번호보다 작은 구간에서도 음수가 안 나와야 한다. 나오면 그 슬롯이
  // 잘림 구간 밖으로 튀어 화면에서 사라진다.
  it('진행률이 슬롯 번호보다 작아도 음수가 안 나온다', () => {
    expect(slotPhase(0.5, 2)).toBeCloseTo(1.5)
  })
})

describe('그림의 자리', () => {
  it('머무는 동안은 가운데에 붙어 있다', () => {
    expect(slotTranslateY(0)).toBe(0)
    expect(slotTranslateY(DWELL / 2)).toBe(0)
    expect(slotTranslateY(DWELL)).toBe(0)
  })

  it('나갈 때는 위로 빠진다', () => {
    expect(slotTranslateY(DWELL + MOVE / 2)).toBeCloseTo(-FAB_ITEM_TRAVEL_PX / 2)
    expect(slotTranslateY(1)).toBeCloseTo(-FAB_ITEM_TRAVEL_PX)
  })

  // 나간 뒤에는 **아래에서** 기다린다. 나간 자리에 그대로 두면 다음 차례에 위에서 떨어진다.
  it('차례를 기다리는 동안은 아래에 있다', () => {
    expect(slotTranslateY(1.5)).toBe(FAB_ITEM_TRAVEL_PX)
    expect(slotTranslateY(2)).toBe(FAB_ITEM_TRAVEL_PX)
  })

  it('들어올 때는 아래에서 올라온다', () => {
    expect(slotTranslateY(FAB_ITEM_SLOTS - MOVE)).toBeCloseTo(FAB_ITEM_TRAVEL_PX)
    expect(slotTranslateY(FAB_ITEM_SLOTS - MOVE / 2)).toBeCloseTo(FAB_ITEM_TRAVEL_PX / 2)
    expect(slotTranslateY(FAB_ITEM_SLOTS)).toBeCloseTo(0)
  })
})

describe('그림의 불투명도', () => {
  it('머무는 동안은 또렷하고 차례를 기다릴 때는 안 보인다', () => {
    expect(slotOpacity(0)).toBe(1)
    expect(slotOpacity(DWELL)).toBe(1)
    expect(slotOpacity(1)).toBeCloseTo(0)
    expect(slotOpacity(1.5)).toBe(0)
  })

  // **원이 한 순간도 비지 않고, 두 그림이 동시에 진하지도 않는다.** 나가는 쪽이 잃는 만큼
  // 들어오는 쪽이 얻으므로 셋의 합이 언제나 1 이다. 이 한 줄이 드럼의 계약 전부다.
  it('어느 순간에도 셋의 합이 1 이다', () => {
    for (let step = 0; step <= 60; step += 1) {
      const progress = (step / 60) * FAB_ITEM_SLOTS
      const sum =
        slotOpacity(slotPhase(progress, 0)) +
        slotOpacity(slotPhase(progress, 1)) +
        slotOpacity(slotPhase(progress, 2))

      expect(sum).toBeCloseTo(1)
    }
  })
})

describe('흐림의 세기', () => {
  it('그림이 자리를 잡고 있는 동안은 0 이다', () => {
    expect(veilIntensity(0)).toBe(0)
    expect(veilIntensity(DWELL)).toBe(0)
    expect(veilIntensity(1)).toBeCloseTo(0)
  })

  // 넘어가는 한가운데가 가장 짙다. 초점을 놓쳤다가 다시 잡는 읽힘이라 몇 프레임짜리
  // 슬라이드보다 길게 느껴진다.
  it('넘어가는 한가운데가 가장 짙다', () => {
    expect(veilIntensity(DWELL + MOVE / 2)).toBeCloseTo(FAB_ITEM_BLUR)
  })

  it('슬롯이 바뀌어도 같은 자리에서 같은 세기다', () => {
    expect(veilIntensity(1 + DWELL + MOVE / 2)).toBeCloseTo(FAB_ITEM_BLUR)
    expect(veilIntensity(2 + DWELL + MOVE / 2)).toBeCloseTo(FAB_ITEM_BLUR)
  })
})

describe('시간', () => {
  it('한 바퀴가 슬롯 수만큼의 걸음이다', () => {
    expect(FAB_ITEM_LOOP_MS).toBe(FAB_ITEM_SLOTS * FAB_ITEM_STEP_MS)
  })

  // 넘어가는 시간이 서 있는 시간보다 길면 무엇을 보고 있는지 알기 전에 다음 것이 온다.
  it('넘어가는 시간이 서 있는 시간보다 짧다', () => {
    expect(FAB_ITEM_MOVE_MS).toBeLessThan(FAB_ITEM_STEP_MS - FAB_ITEM_MOVE_MS)
  })
})
