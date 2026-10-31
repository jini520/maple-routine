/**
 * 넥슨 캐릭터 그림의 동작 · 표정 프레임. `character/basic` 의 그림 주소에 값을 붙여 받는다.
 *
 * 프레임마다 300×300 PNG 한 장이다. 번호에 이름을 붙이는 것은 `A24.1` 만 보고는 무슨 그림인지 알 수 없어서다.
 */

const FRAME_QUERY = {
  idle0: 'action=A01.0',
  idle1: 'action=A01.1',
  idle2: 'action=A01.2',
  walk0: 'action=A03.0',
  walk1: 'action=A03.1',
  walk2: 'action=A03.2',
  walk3: 'action=A03.3',
  // 넥슨의 3장짜리 공격 번호는 맞지 않는 무기를 맨손으로 그린다. 어느 무기든 보이는 프레임을 잇는다.
  swing0: 'action=A25.0',
  swing1: 'action=A24.0',
  swing2: 'action=A24.1',
  wink: 'action=A01&emotion=E01',
  laugh: 'action=A01&emotion=E02',
  jump: 'action=A06',
} as const

export type LookFrame = keyof typeof FRAME_QUERY

export const LOOK_FRAMES = Object.keys(FRAME_QUERY) as LookFrame[]

/**
 * 프레임의 그림 주소.
 *
 * @param imageUrl `character/basic` 이 준 그림 주소
 * @param frame 프레임 이름
 */
export function lookFrameUrl(imageUrl: string, frame: LookFrame): string {
  return `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}${FRAME_QUERY[frame]}`
}

/**
 * 그림 안에서 머리가 좌우로 밀린 거리(그림 px). 음수가 왼쪽이다.
 *
 * 그대로 그리면 그 프레임에서 캐릭터가 옆으로 튄다. 값은 캐릭터 53명 중 52명이 같아 고정값이다.
 *
 * @param frame 프레임 이름
 */
export function lookFrameHeadShift(frame: LookFrame): number {
  return frame === 'swing2' ? -19 : 0
}
