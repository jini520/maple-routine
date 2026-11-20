/** 넥슨 캐릭터 그림의 행동 값. 넥슨 스펙의 `A00` ~ `A41` */
export type LookAction =
  | 'A00' | 'A01' | 'A02' | 'A03' | 'A04' | 'A05' | 'A06' | 'A07' | 'A08' | 'A09'
  | 'A10' | 'A11' | 'A12' | 'A13' | 'A14' | 'A15' | 'A16' | 'A17' | 'A18' | 'A19'
  | 'A20' | 'A21' | 'A22' | 'A23' | 'A24' | 'A25' | 'A26' | 'A27' | 'A28' | 'A29'
  | 'A30' | 'A31' | 'A32' | 'A33' | 'A34' | 'A35' | 'A36' | 'A37' | 'A38' | 'A39'
  | 'A40' | 'A41'

/** 넥슨 캐릭터 그림의 표정 값. 넥슨 스펙의 `E00` ~ `E24` */
export type LookEmotion =
  | 'E00' | 'E01' | 'E02' | 'E03' | 'E04' | 'E05' | 'E06' | 'E07' | 'E08' | 'E09'
  | 'E10' | 'E11' | 'E12' | 'E13' | 'E14' | 'E15' | 'E16' | 'E17' | 'E18' | 'E19'
  | 'E20' | 'E21' | 'E22' | 'E23' | 'E24'

/** 그림 한 장. 행동의 한 프레임에 표정의 한 프레임을 붙인다 */
export interface LookFrame {
  action: LookAction
  frame: number
  emotion: LookEmotion
  emotionFrame: number
}

/** 행동 하나를 하는 시간 */
export type FigureDurationMs = 3000 | 5000 | 10000 | 20000

/** 대표 캐릭터 한 명이 할 것. 캐릭터마다 저장한다 */
export interface FigureMotion {
  actions: LookAction[]
  emotions: LookEmotion[]
  durationMs: FigureDurationMs
  /** 참이면 행동 사이마다 동작 시간만큼 대기 동작을 한다 */
  rest: boolean
}
