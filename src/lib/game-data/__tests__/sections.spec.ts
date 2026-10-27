import { INITIAL_GAME_DATA, SECTIONS, currentGameData } from '../sections'
import { GAME_DATA_SECTIONS } from '../../../types/game-data'

describe('SECTIONS', () => {
  it('칸 열넷이 GAME_DATA_SECTIONS 와 같은 차례다', () => {
    expect(Object.keys(SECTIONS)).toEqual(GAME_DATA_SECTIONS)
  })

  // 표의 초기값은 계약을 통과한 값이다. 한 번 더 통과시켜도 같아야 응답을 덮어도 모양이 그대로다.
  it('번들 열넷은 전부 계약을 통과하고, 통과한 값을 다시 통과시켜도 같다', () => {
    for (const section of GAME_DATA_SECTIONS) {
      expect(SECTIONS[section].parse(INITIAL_GAME_DATA[section])).toEqual(INITIAL_GAME_DATA[section])
    }
  })
})

describe('currentGameData', () => {
  afterEach(() => {
    SECTIONS.mvpGrades.table.set(INITIAL_GAME_DATA.mvpGrades)
  })

  it('처음에는 번들 열넷이다', () => {
    expect(currentGameData()).toEqual(INITIAL_GAME_DATA)
  })

  it('표를 덮으면 그 칸이 새 값이다', () => {
    const 새표 = { ...INITIAL_GAME_DATA.mvpGrades, updatedAt: '2026-10-18T00:00:00.000Z' }
    SECTIONS.mvpGrades.table.set(새표)

    expect(currentGameData().mvpGrades).toBe(새표)
    expect(currentGameData().bosses).toBe(INITIAL_GAME_DATA.bosses)
  })
})
