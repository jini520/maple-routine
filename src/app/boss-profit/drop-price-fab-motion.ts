/**
 * 아이템 가격 버튼 안에서 도는 드럼의 값. 판정과 그리기를 가른다.
 *
 * 자리·불투명도·흐림이 전부 **진행률 하나**에서 나온다. 슬롯마다 타이머를 두면 셋이 서로
 * 어긋날 수 있는데, 값이 하나면 어긋날 자리가 없다.
 *
 * 함수들이 `'worklet'` 인 것은 `useAnimatedStyle` 안에서 불리기 때문이다. 지시어가 없으면
 * 리애니메이티드가 매 프레임 JS 스레드를 깨운다.
 */

/** 도는 그림의 수. 슬롯 하나가 그림 하나다. */
export const FAB_ITEM_SLOTS = 3

/** 한 그림이 자기 차례를 갖는 시간. 아래 이동 시간을 포함한다. */
export const FAB_ITEM_STEP_MS = 2000

/** 그중 넘어가는 데 쓰는 시간. 나가는 그림과 들어오는 그림이 같은 길이를 쓴다. */
export const FAB_ITEM_MOVE_MS = 420

/** 드럼 한 바퀴. 진행률은 0 에서 `FAB_ITEM_SLOTS` 까지 이 시간 동안 선형으로 간다. */
export const FAB_ITEM_LOOP_MS = FAB_ITEM_SLOTS * FAB_ITEM_STEP_MS

/**
 * 그림이 오르내리는 거리(px).
 *
 * 원의 지름이 56 이라 이보다 크게 잡으면 그림이 잘리기 전에 이미 원 밖으로 나간 것처럼 보인다.
 */
export const FAB_ITEM_TRAVEL_PX = 20

/** 넘어가는 한가운데의 흐림 세기. `expo-blur` 의 세기는 1~100 이다. */
export const FAB_ITEM_BLUR = 36

/** 이동이 차지하는 몫. 나머지가 가만히 서 있는 시간이다. */
const MOVE = FAB_ITEM_MOVE_MS / FAB_ITEM_STEP_MS
const DWELL = 1 - MOVE

/** 들어오는 그림이 움직이기 시작하는 자리. 나가는 쪽과 같은 길이를 쓰도록 뒤에서 뗀다. */
const ENTER_FROM = FAB_ITEM_SLOTS - MOVE

/** 구간 안에서의 0~1. 밖은 잘린다. */
function ramp(value: number, from: number, to: number): number {
  'worklet'
  return Math.min(Math.max((value - from) / (to - from), 0), 1)
}

/**
 * 이 슬롯이 자기 차례의 어디쯤인가. 0 이 가운데이고 `FAB_ITEM_SLOTS` 에서 다시 0 이 된다.
 *
 * 음수가 나오면 그 슬롯이 화면에서 사라지므로 나머지를 두 번 접어 항상 양수로 만든다.
 *
 * @param progress 0 에서 `FAB_ITEM_SLOTS` 까지 도는 진행률
 * @param slot 슬롯 번호
 */
export function slotPhase(progress: number, slot: number): number {
  'worklet'
  return (((progress - slot) % FAB_ITEM_SLOTS) + FAB_ITEM_SLOTS) % FAB_ITEM_SLOTS
}

/**
 * 그림의 세로 자리. 위로 빠지고 아래에서 들어온다.
 *
 * 차례를 기다리는 동안 **아래에** 있는 것이 중요하다. 나간 자리에 그대로 두면 다음 차례에
 * 위에서 떨어져 도는 방향이 뒤집힌다.
 *
 * @param phase `slotPhase` 가 낸 값
 */
export function slotTranslateY(phase: number): number {
  'worklet'
  if (phase <= DWELL) return 0
  if (phase <= 1) return -FAB_ITEM_TRAVEL_PX * ramp(phase, DWELL, 1)
  if (phase < ENTER_FROM) return FAB_ITEM_TRAVEL_PX
  return FAB_ITEM_TRAVEL_PX * (1 - ramp(phase, ENTER_FROM, FAB_ITEM_SLOTS))
}

/**
 * 그림의 불투명도.
 *
 * 나가는 쪽이 잃는 만큼 들어오는 쪽이 얻어 셋의 합이 언제나 1 이다. 그래서 원이 한 순간도
 * 비지 않고 두 그림이 동시에 진하지도 않는다.
 *
 * @param phase `slotPhase` 가 낸 값
 */
export function slotOpacity(phase: number): number {
  'worklet'
  if (phase <= DWELL) return 1
  if (phase <= 1) return 1 - ramp(phase, DWELL, 1)
  if (phase < ENTER_FROM) return 0
  return ramp(phase, ENTER_FROM, FAB_ITEM_SLOTS)
}

/**
 * 원 위에 얹은 흐림의 세기. 머무는 동안은 0 이고 넘어가는 한가운데가 가장 짙다.
 *
 * 슬롯을 안 가리고 진행률의 소수부만 본다. 걸음마다 같은 일이 일어나기 때문이다.
 *
 * @param progress 0 에서 `FAB_ITEM_SLOTS` 까지 도는 진행률
 */
export function veilIntensity(progress: number): number {
  'worklet'
  const step = ((progress % 1) + 1) % 1
  if (step <= DWELL) return 0

  // 삼각형. 0 에서 올라 한가운데서 가장 짙고 다시 0 으로 내려온다.
  const moved = ramp(step, DWELL, 1)
  return FAB_ITEM_BLUR * (1 - Math.abs(moved * 2 - 1))
}
