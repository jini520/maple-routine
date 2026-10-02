/**
 * 펼치는 ＋ 의 움직임 값과 치수. 판정과 그리기를 가른다.
 *
 * 값이 컴포넌트 밖에 있는 것은 애니메이션을 띄우지 않고도 규칙을 검증할 수 있어야 하기 때문이다.
 *
 * - 펴기는 두 단계다. 아이콘 원만 ＋ 에 가까운 것부터 솟아 한 줄로 서고, 그 뒤 맨 위 원부터 알약으로 펼쳐진다.
 *   솟는 방향(아래 → 위)과 펼치는 방향(위 → 아래)이 엇갈려 한 흐름으로 읽힌다.
 * - 접기는 거울이고 더 짧다. 이름이 사라지고, 알약이 원으로 줄고, 먼 원부터 ＋ 로 들어간다.
 */
import { FAB_DIAMETER_PX } from '../../../lib/fab-metrics'

/** 한 요소가 움직이기 시작하는 때와 드는 시간(ms) */
export interface DialStep {
  readonly delayMs: number
  readonly durationMs: number
}

/** 갈래 하나가 쓰는 세 움직임 */
export interface DialTiming {
  /** 원이 ＋ 자리에서 제자리로 솟는다(이동 · 크기 · 투명도) */
  readonly rise: DialStep
  /** 원이 알약으로 늘어난다(폭) */
  readonly expand: DialStep
  /** 이름 · 설명이 나타난다(투명도) */
  readonly label: DialStep
}

/** 알약 높이. ＋ 와 같아서 펼치기 전의 원이 ＋ 와 같은 크기로 줄을 선다 */
export const PILL_HEIGHT_PX = FAB_DIAMETER_PX
/** 알약 사이와 맨 아래 알약과 ＋ 사이 */
export const DIAL_GAP_PX = 12
/** 알약 왼쪽의 아이콘 원 자리(여백 7 + 원 42 + 틈 11). 글자가 여기서 시작한다 */
export const PILL_ICON_SLOT_PX = 60
/** 글자 뒤 오른쪽 여백 */
export const PILL_END_PADDING_PX = 16
/** 원이 솟기 시작하는 크기 */
export const DIAL_RISE_START_SCALE = 0.5
/** ＋ 를 이만큼 돌리면 그대로 ✕ 다 */
export const FAB_OPEN_ROTATION_DEG = 45

const RISE_STAIR_MS = 40
const RISE_MS = 300
/** 마지막 원이 거의 자리를 잡은 뒤에 펼치기 시작한다 */
const EXPAND_START_MS = 220
const EXPAND_STAIR_MS = 50
const EXPAND_MS = 320
const LABEL_AFTER_EXPAND_MS = 120
const LABEL_MS = 180

const CLOSE_LABEL_MS = 70
const CLOSE_EXPAND_DELAY_MS = 30
const CLOSE_MS = 150
/** 알약이 원으로 다 줄어든 뒤 원이 들어간다 */
const CLOSE_RISE_DELAY_MS = CLOSE_EXPAND_DELAY_MS + CLOSE_MS - 30
const CLOSE_RISE_STAIR_MS = 25

/**
 * 갈래 하나의 움직임 값.
 *
 * @param index 위에서부터 차례(0 이 맨 위, `count - 1` 이 ＋ 에 가장 가깝다)
 * @param reduceMotion 움직임 줄이기. 지연을 0 으로 접는다. 계단은 이동이 있을 때만 보이고 지연만 남으면 툭 나타난다
 */
export function dialTiming(index: number, count: number, isOpen: boolean, reduceMotion: boolean): DialTiming {
  const fromFab = count - 1 - index
  const timing: DialTiming = isOpen
    ? (() => {
        const expandDelay = EXPAND_START_MS + (count - 1) * RISE_STAIR_MS + index * EXPAND_STAIR_MS
        return {
          rise: { delayMs: fromFab * RISE_STAIR_MS, durationMs: RISE_MS },
          expand: { delayMs: expandDelay, durationMs: EXPAND_MS },
          label: { delayMs: expandDelay + LABEL_AFTER_EXPAND_MS, durationMs: LABEL_MS },
        }
      })()
    : {
        rise: { delayMs: CLOSE_RISE_DELAY_MS + index * CLOSE_RISE_STAIR_MS, durationMs: CLOSE_MS },
        expand: { delayMs: CLOSE_EXPAND_DELAY_MS, durationMs: CLOSE_MS },
        label: { delayMs: 0, durationMs: CLOSE_LABEL_MS },
      }
  if (!reduceMotion) return timing
  return {
    rise: { ...timing.rise, delayMs: 0 },
    expand: { ...timing.expand, delayMs: 0 },
    label: { ...timing.label, delayMs: 0 },
  }
}

/** 스크림과 ＋ 회전. 펼 때는 기다리지 않고, 접을 때는 원이 들어가기 시작할 때 함께 걷힌다 */
export function chromeTiming(isOpen: boolean, reduceMotion: boolean): { scrim: DialStep; fab: DialStep } {
  const delayMs = isOpen || reduceMotion ? 0 : CLOSE_RISE_DELAY_MS
  return isOpen
    ? { scrim: { delayMs, durationMs: 180 }, fab: { delayMs, durationMs: RISE_MS } }
    : { scrim: { delayMs, durationMs: CLOSE_MS }, fab: { delayMs, durationMs: CLOSE_MS } }
}

/**
 * 펼친 알약의 폭. 모든 알약이 가장 긴 글자에 맞춘 한 폭을 쓴다.
 *
 * @param widestLabelPx 가장 긴 이름 · 설명의 폭. 아직 못 쟀으면 0 이고 그때는 원 크기다
 */
export function pillWidth(widestLabelPx: number): number {
  if (widestLabelPx <= 0) return PILL_HEIGHT_PX
  return PILL_ICON_SLOT_PX + Math.ceil(widestLabelPx) + PILL_END_PADDING_PX
}

/**
 * 원이 솟기 시작하는 자리까지의 거리. ＋ 중심에서 그 줄 중심까지다.
 *
 * @param fromFab ＋ 에서 몇 번째 줄인지(0 이 ＋ 바로 위)
 */
export function riseOffsetPx(fromFab: number): number {
  return (fromFab + 1) * (PILL_HEIGHT_PX + DIAL_GAP_PX)
}
