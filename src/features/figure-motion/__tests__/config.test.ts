// 대표 캐릭터가 할 행동 · 표정의 고르기 규칙과 저장된 값 읽기.
import type { FigureMotion } from '../../../types/figure-motion'
import {
  DEFAULT_FIGURE_MOTION,
  FIGURE_ACTION_GROUPS,
  FIGURE_NAMES,
  PICKABLE_EMOTIONS,
  figureMotionOf,
  parseFigureMotions,
  toggleFigureAction,
  toggleFigureEmotion,
} from '../config'

const 고른것: FigureMotion = { actions: ['A03'], emotions: ['E02'], durationMs: 10000, rest: true }

describe('후보', () => {
  it('행동은 넥슨이 주는 42개가 묶음마다 한 번씩 든다', () => {
    const 행동 = FIGURE_ACTION_GROUPS.flatMap((group) => group.actions)

    expect(new Set(행동).size).toBe(42)
    expect(행동).toHaveLength(42)
  })

  // 깜빡임은 기본 표정 사이에 앱이 넣는다(사용자 지정).
  it('표정에 깜빡임은 없다', () => {
    expect(PICKABLE_EMOTIONS).not.toContain('E06')
    expect(PICKABLE_EMOTIONS).toHaveLength(24)
  })

  it('후보마다 이름이 있다', () => {
    const 후보 = [...FIGURE_ACTION_GROUPS.flatMap((group) => group.actions), ...PICKABLE_EMOTIONS]

    후보.forEach((code) => {
      expect(FIGURE_NAMES[code]).toBeTruthy()
    })
  })
})

describe('고르기', () => {
  it('고른 행동을 다시 누르면 빠진다', () => {
    const 더함 = toggleFigureAction(고른것, 'A24')

    expect(더함.actions).toEqual(['A03', 'A24'])
    expect(toggleFigureAction(더함, 'A03').actions).toEqual(['A24'])
  })

  it('행동이 다 찼으면 새 행동을 더하지 않는다', () => {
    const 찼음: FigureMotion = { ...고른것, actions: ['A00', 'A03', 'A24'] }

    expect(toggleFigureAction(찼음, 'A06').actions).toEqual(['A00', 'A03', 'A24'])
  })

  it('표정이 다 찼으면 새 표정을 더하지 않는다', () => {
    const 찼음: FigureMotion = { ...고른것, emotions: ['E00', 'E01', 'E02', 'E03', 'E04'] }

    expect(toggleFigureEmotion(찼음, 'E05').emotions).toEqual(['E00', 'E01', 'E02', 'E03', 'E04'])
    expect(toggleFigureEmotion(찼음, 'E01').emotions).toEqual(['E00', 'E02', 'E03', 'E04'])
  })
})

describe('고르지 않은 캐릭터', () => {
  it('저장된 값이 없는 캐릭터는 처음 값을 받는다', () => {
    expect(figureMotionOf({ 'ocid-a': 고른것 }, 'ocid-b')).toEqual(DEFAULT_FIGURE_MOTION)
    expect(figureMotionOf({ 'ocid-a': 고른것 }, 'ocid-a')).toEqual(고른것)
  })
})

describe('저장된 값 읽기', () => {
  it('캐릭터마다 따로 읽는다', () => {
    expect(parseFigureMotions({ a: 고른것, b: DEFAULT_FIGURE_MOTION })).toEqual({ a: 고른것, b: DEFAULT_FIGURE_MOTION })
  })

  // 앱이 모르는 값으로 그림 주소를 만들면 넥슨이 기본 그림을 돌려줘 엉뚱한 동작이 선다.
  it('모르는 행동 · 표정과 깜빡임은 버리고, 상한을 넘는 몫은 자른다', () => {
    const 읽음 = parseFigureMotions({
      a: {
        actions: ['A99', 'A03', 'A03', 'A24', 'A06', 'A00'],
        emotions: ['E06', 'E02', 'X', 'E00', 'E01', 'E03', 'E04', 'E05'],
        durationMs: 5000,
        rest: false,
      },
    })

    expect(읽음.a.actions).toEqual(['A03', 'A24', 'A06'])
    expect(읽음.a.emotions).toEqual(['E02', 'E00', 'E01', 'E03', 'E04'])
  })

  it('정한 값이 아닌 동작 시간은 5초, 참이 아닌 쉬는 시간은 꺼짐으로 읽는다', () => {
    const 읽음 = parseFigureMotions({ a: { actions: ['A03'], emotions: ['E02'], durationMs: 7000, rest: 'yes' } })

    expect(읽음.a.durationMs).toBe(5000)
    expect(읽음.a.rest).toBe(false)
  })

  it('행동이나 표정이 하나도 안 남는 캐릭터는 고르지 않은 것으로 본다', () => {
    const 읽음 = parseFigureMotions({
      a: { actions: ['A99'], emotions: ['E02'], durationMs: 5000, rest: false },
      b: { actions: ['A03'], emotions: [], durationMs: 5000, rest: false },
      c: 'broken',
    })

    expect(읽음).toEqual({})
  })

  it.each([null, 'text', 3, ['a']])('모양이 깨진 값 %p 는 빈 값이다', (raw) => {
    expect(parseFigureMotions(raw)).toEqual({})
  })
})
