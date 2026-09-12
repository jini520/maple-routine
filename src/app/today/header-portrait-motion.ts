/**
 * today 머리 버튼 안에서 얼굴이 넘어가는 값. 판정과 그리기를 가른다.
 *
 * 자리와 불투명도가 전부 **진행률 하나**에서 나온다. 슬롯마다 타이머를 두면 서로 어긋날 수
 * 있는데, 값이 하나면 어긋날 자리가 없다.
 *
 * 보스 수익의 드럼(`app/boss-profit/drop-price-fab-motion.ts`)과 지키는 것이 같고 **슬롯 수가
 * 변수**인 점이 다르다. 추적 캐릭터가 한 명일 수도 있어서 3 을 상수로 박으면 그때 원이 두 칸을
 * 빈 채로 돈다. 흐림 판도 없다(32 짜리 원에 `expo-blur` 를 얹을 자리가 아니다).
 *
 * 함수들이 `'worklet'` 인 것은 `useAnimatedStyle` 안에서 불리기 때문이다. 지시어가 없으면
 * 리애니메이티드가 매 프레임 JS 스레드를 깨운다.
 */

/** 머리 버튼이 돌리는 얼굴의 최대 수. 추적이 45명이어도 이 셋만 돈다. */
export const HEADER_PORTRAIT_MAX = 3

/** 얼굴 하나가 자기 차례를 갖는 시간. 아래 이동 시간을 포함한다. */
export const HEADER_PORTRAIT_STEP_MS = 2000

/** 그중 넘어가는 데 쓰는 시간. 나가는 얼굴과 들어오는 얼굴이 같은 길이를 쓴다. */
export const HEADER_PORTRAIT_MOVE_MS = 420

/**
 * 얼굴이 오르내리는 거리(px).
 *
 * 원의 지름이 32 이고 얼굴이 그 원을 꽉 채운다. 8 은 지름의 1/4 이라 가장 많이 밀린 순간에도
 * 얼굴의 3/4 이 남고, 그 순간의 불투명도는 이미 0 에 가깝다.
 */
export const HEADER_PORTRAIT_TRAVEL_PX = 8

/** 이동이 차지하는 몫. 나머지가 가만히 서 있는 시간이다. */
const MOVE = HEADER_PORTRAIT_MOVE_MS / HEADER_PORTRAIT_STEP_MS
const DWELL = 1 - MOVE

/**
 * 진행률 한 바퀴의 시간. 얼굴 수에 비례한다.
 *
 * 얼굴이 없어도 0 을 내지 않는다. 0ms 애니메이션을 리애니메이티드에 넘기지 않기 위한 하한이다.
 *
 * @param slots 도는 얼굴 수
 */
export function headerLoopMs(slots: number): number {
  return Math.max(slots, 1) * HEADER_PORTRAIT_STEP_MS
}

/**
 * 진행률의 끝 값. 얼굴이 하나뿐이면 0 이라 아무것도 안 돈다.
 *
 * 돌 것이 없는데 진행률을 굴리면 그 한 장이 2초마다 혼자 빠지고 돌아온다.
 *
 * @param slots 도는 얼굴 수
 */
export function loopTo(slots: number): number {
  return slots < 2 ? 0 : slots
}

/** 구간 안에서의 0~1. 밖은 잘린다. */
function ramp(value: number, from: number, to: number): number {
  'worklet'
  return Math.min(Math.max((value - from) / (to - from), 0), 1)
}

/** 들어오는 얼굴이 움직이기 시작하는 자리. 나가는 쪽과 같은 길이를 쓰도록 뒤에서 뗀다. */
function enterFrom(slots: number): number {
  'worklet'
  return slots - MOVE
}

/**
 * 이 슬롯이 자기 차례의 어디쯤인가. 0 이 가운데이고 `slots` 에서 다시 0 이 된다.
 *
 * 음수가 나오면 그 슬롯이 화면에서 사라지므로 나머지를 두 번 접어 항상 양수로 만든다.
 *
 * @param progress 0 에서 `slots` 까지 도는 진행률
 * @param slot 슬롯 번호
 * @param slots 도는 얼굴 수
 */
export function slotPhase(progress: number, slot: number, slots: number): number {
  'worklet'
  return (((progress - slot) % slots) + slots) % slots
}

/**
 * 얼굴의 세로 자리. 위로 빠지고 아래에서 들어온다.
 *
 * 차례를 기다리는 동안 **아래에** 있는 것이 중요하다. 나간 자리에 그대로 두면 다음 차례에 위에서
 * 떨어져 도는 방향이 뒤집힌다.
 *
 * @param phase `slotPhase` 가 낸 값
 * @param slots 도는 얼굴 수
 */
export function slotTranslateY(phase: number, slots: number): number {
  'worklet'
  if (phase <= DWELL) return 0
  if (phase <= 1) return -HEADER_PORTRAIT_TRAVEL_PX * ramp(phase, DWELL, 1)
  if (phase < enterFrom(slots)) return HEADER_PORTRAIT_TRAVEL_PX
  return HEADER_PORTRAIT_TRAVEL_PX * (1 - ramp(phase, enterFrom(slots), slots))
}

/**
 * 얼굴의 불투명도.
 *
 * 나가는 쪽이 잃는 만큼 들어오는 쪽이 얻어 합이 언제나 1 이다. 그래서 원이 한 순간도 비지 않고
 * 두 얼굴이 동시에 진하지도 않다.
 *
 * @param phase `slotPhase` 가 낸 값
 * @param slots 도는 얼굴 수
 */
export function slotOpacity(phase: number, slots: number): number {
  'worklet'
  if (phase <= DWELL) return 1
  if (phase <= 1) return 1 - ramp(phase, DWELL, 1)
  if (phase < enterFrom(slots)) return 0
  return ramp(phase, enterFrom(slots), slots)
}
