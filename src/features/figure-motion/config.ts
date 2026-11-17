/**
 * 대표 캐릭터가 할 행동 · 표정의 후보와 고르기 규칙. 고른 값은 캐릭터마다 저장한다.
 */
import { LOOK_ACTIONS, LOOK_EMOTIONS } from '../../lib/character-look'
import type { FigureDurationMs, FigureMotion, LookAction, LookEmotion } from '../../types/figure-motion'

export const FIGURE_DURATIONS_MS: readonly FigureDurationMs[] = [3000, 5000, 10000, 20000]

/** 조합마다 그림을 따로 받아야 해서 고르는 수를 막는다 */
export const MAX_FIGURE_ACTIONS = 3
export const MAX_FIGURE_EMOTIONS = 5

/** 고르지 않은 캐릭터. 서기 1 과 기본 표정을 쉬지 않고 계속한다 */
export const DEFAULT_FIGURE_MOTION: FigureMotion = { actions: ['A00'], emotions: ['E00'], durationMs: 5000, rest: false }

/** 깜빡임. 고르지 않고 기본 표정 사이에 앱이 넣는다 */
export const BLINK_EMOTION: LookEmotion = 'E06'

export const PICKABLE_EMOTIONS: readonly LookEmotion[] = LOOK_EMOTIONS.filter((emotion) => emotion !== BLINK_EMOTION)

function actionsBetween(from: number, to: number): LookAction[] {
  return LOOK_ACTIONS.slice(from, to + 1)
}

/** 시트의 행동 카드. 넥슨 값 차례다 */
export const FIGURE_ACTION_GROUPS: readonly { label: string; actions: readonly LookAction[] }[] = [
  { label: '서기 · 이동', actions: actionsBetween(0, 9) },
  { label: '회복 · 숨돌리기', actions: actionsBetween(10, 11) },
  { label: '공격', actions: actionsBetween(12, 32) },
  { label: '유령', actions: actionsBetween(33, 41) },
]

/** 칸 이름. 넥슨 스펙에는 영어 이름만 있다 */
export const FIGURE_NAMES: Readonly<Record<LookAction | LookEmotion, string>> = {
  A00: '서기 1',
  A01: '서기 2',
  A02: '걷기 1',
  A03: '걷기 2',
  A04: '엎드리기',
  A05: '날기',
  A06: '점프',
  A07: '앉기',
  A08: '사다리',
  A09: '밧줄',
  A10: '회복',
  A11: '숨돌리기',
  A12: '엎드려 찌르기',
  A13: '한손 휘두르기 1',
  A14: '한손 휘두르기 2',
  A15: '한손 휘두르기 3',
  A16: '한손 휘두르기 4',
  A17: '폴암 휘두르기 1',
  A18: '폴암 휘두르기 2',
  A19: '폴암 휘두르기 3',
  A20: '두손 휘두르기 1',
  A21: '두손 휘두르기 2',
  A22: '두손 휘두르기 3',
  A23: '두손 휘두르기 4',
  A24: '한손 찌르기 1',
  A25: '한손 찌르기 2',
  A26: '한손 찌르기 3',
  A27: '두손 찌르기 1',
  A28: '두손 찌르기 2',
  A29: '두손 찌르기 3',
  A30: '쏘기 1',
  A31: '쏘기 2',
  A32: '쏘기 3',
  A33: '죽음',
  A34: '유령 걷기',
  A35: '유령 서기',
  A36: '유령 점프',
  A37: '유령 찌르기',
  A38: '유령 사다리',
  A39: '유령 밧줄',
  A40: '유령 날기',
  A41: '유령 앉기',
  E00: '기본',
  E01: '윙크',
  E02: '웃음',
  E03: '울음',
  E04: '분노',
  E05: '당황',
  E06: '깜빡임',
  E07: '활활',
  E08: '꾸벅꾸벅',
  E09: '꺄오',
  E10: '뽀뽀',
  E11: '메롱',
  E12: '후하후하',
  E13: '초롱초롱',
  E14: '피격',
  E15: '앗뜨거',
  E16: '흐음',
  E17: '뿅',
  E18: '허걱허걱',
  E19: '눈물찍',
  E20: '허걱',
  E21: '창백',
  E22: '반짝반짝',
  E23: '곤란',
  E24: '울렁울',
}

function toggled<T>(list: readonly T[], item: T, max: number): T[] {
  if (list.includes(item)) return list.filter((each) => each !== item)
  return list.length >= max ? [...list] : [...list, item]
}

/** 행동 칸을 눌렀을 때. 다 찼으면 더하지 않는다 */
export function toggleFigureAction(motion: FigureMotion, action: LookAction): FigureMotion {
  return { ...motion, actions: toggled(motion.actions, action, MAX_FIGURE_ACTIONS) }
}

/** 표정 칸을 눌렀을 때. 다 찼으면 더하지 않는다 */
export function toggleFigureEmotion(motion: FigureMotion, emotion: LookEmotion): FigureMotion {
  return { ...motion, emotions: toggled(motion.emotions, emotion, MAX_FIGURE_EMOTIONS) }
}

/**
 * 그 캐릭터가 할 것. 고르지 않았으면 처음 값이다.
 *
 * @param motions 캐릭터마다 고른 값
 * @param ocid 캐릭터
 */
export function figureMotionOf(motions: Readonly<Record<string, FigureMotion>>, ocid: string): FigureMotion {
  return motions[ocid] ?? DEFAULT_FIGURE_MOTION
}

/** 아는 값만 차례대로 한 번씩, 상한까지 */
function knownCodes<T extends string>(value: unknown, allowed: readonly T[], max: number): T[] {
  if (!Array.isArray(value)) return []
  const codes = value.filter((code): code is T => allowed.includes(code as T))
  return [...new Set(codes)].slice(0, max)
}

function motionOf(value: unknown): FigureMotion | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const actions = knownCodes(raw.actions, LOOK_ACTIONS, MAX_FIGURE_ACTIONS)
  const emotions = knownCodes(raw.emotions, PICKABLE_EMOTIONS, MAX_FIGURE_EMOTIONS)
  if (actions.length === 0 || emotions.length === 0) return null
  const durationMs = FIGURE_DURATIONS_MS.includes(raw.durationMs as FigureDurationMs)
    ? (raw.durationMs as FigureDurationMs)
    : DEFAULT_FIGURE_MOTION.durationMs
  return { actions, emotions, durationMs, rest: raw.rest === true }
}

/**
 * 저장된 값을 캐릭터마다 읽는 함수. 상한 캐릭터 몫은 그 몫만 빼고 고르지 않은 것으로 본다.
 *
 * 모르는 값으로 그림 주소를 만들면 넥슨이 기본 그림을 돌려줘 엉뚱한 동작이 선다.
 *
 * @param raw 저장소에서 읽은 JSON
 */
export function parseFigureMotions(raw: unknown): Record<string, FigureMotion> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const motions: Record<string, FigureMotion> = {}
  for (const [ocid, value] of Object.entries(raw)) {
    const motion = motionOf(value)
    if (motion !== null) motions[ocid] = motion
  }
  return motions
}
