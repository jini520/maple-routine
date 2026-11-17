/**
 * 넥슨 캐릭터 그림의 행동 · 표정 프레임. `character/basic` 의 그림 주소에 값을 붙여 받는다.
 *
 * 프레임마다 300×300 PNG 한 장이다. 프레임 수는 넥슨 스펙(`캐릭터 정보 조회` 의 `character_image` 설명)의 값이다.
 * 넥슨 그림은 모든 프레임이 같은 바닥선과 발 자리에 서므로 그대로 겹쳐 그린다.
 */
import type { LookAction, LookEmotion, LookFrame } from '../types/figure-motion'

export type { LookAction, LookEmotion, LookFrame }

/** 행동마다 프레임 수 */
export const LOOK_ACTION_FRAMES: Readonly<Record<LookAction, number>> = {
  A00: 3, A01: 3, A02: 4, A03: 4, A04: 1, A05: 2, A06: 1, A07: 1, A08: 2, A09: 2,
  A10: 3, A11: 3, A12: 2, A13: 3, A14: 3, A15: 3, A16: 4, A17: 3, A18: 3, A19: 4,
  A20: 3, A21: 3, A22: 3, A23: 4, A24: 2, A25: 2, A26: 3, A27: 3, A28: 3, A29: 4,
  A30: 3, A31: 5, A32: 3, A33: 1, A34: 4, A35: 3, A36: 1, A37: 2, A38: 2, A39: 2,
  A40: 2, A41: 1,
}

/** 표정마다 프레임 수 */
export const LOOK_EMOTION_FRAMES: Readonly<Record<LookEmotion, number>> = {
  E00: 1, E01: 1, E02: 1, E03: 1, E04: 1, E05: 1, E06: 3, E07: 2, E08: 2, E09: 1,
  E10: 1, E11: 2, E12: 2, E13: 2, E14: 1, E15: 2, E16: 2, E17: 2, E18: 1, E19: 1,
  E20: 1, E21: 1, E22: 1, E23: 1, E24: 2,
}

export const LOOK_ACTIONS = Object.keys(LOOK_ACTION_FRAMES) as LookAction[]
export const LOOK_EMOTIONS = Object.keys(LOOK_EMOTION_FRAMES) as LookEmotion[]

/** 기본 표정. 주소에 표정 값을 붙이지 않는다 */
export const DEFAULT_EMOTION: LookEmotion = 'E00'

/**
 * 그림 한 장의 주소. 기본 표정이면 표정 값을 빼서 행동 프레임과 같은 주소다.
 *
 * 시트의 칸과 위젯이 같은 주소를 써야 디스크에 받아 둔 그림을 함께 쓴다.
 *
 * @param imageUrl `character/basic` 이 준 그림 주소
 * @param frame 그림 한 장
 */
export function lookFrameUrl(imageUrl: string, frame: LookFrame): string {
  const action = `action=${frame.action}.${frame.frame}`
  const emotion = frame.emotion === DEFAULT_EMOTION ? '' : `&emotion=${frame.emotion}.${frame.emotionFrame}`
  return `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}${action}${emotion}`
}

/**
 * 그림 한 장을 가르는 열쇠. 같은 그림이면 같은 열쇠다.
 *
 * @param frame 그림 한 장
 */
export function lookFrameKey(frame: LookFrame): string {
  return `${frame.action}.${frame.frame}|${frame.emotion}.${frame.emotionFrame}`
}
