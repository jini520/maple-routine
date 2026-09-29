import { sectionsToReveal } from '../reveal'

describe('sectionsToReveal', () => {
  const positions = new Map([
    ['trend', 400],
    ['characters', 900],
    ['cumulative', 1800],
  ])

  // 섹션 윗변이 화면 아래 끝에서 여유만큼 올라와야 보인 것이다. 끝에 한 줄 걸친 것은 아직이다.
  it('화면 아래 끝보다 여유만큼 위에 윗변이 들어온 섹션만 낸다', () => {
    expect(sectionsToReveal(positions, 0, 800, new Set())).toEqual(['trend'])
    expect(sectionsToReveal(positions, 200, 800, new Set())).toEqual(['trend', 'characters'])
  })

  it('이미 보인 섹션은 다시 내지 않는다', () => {
    expect(sectionsToReveal(positions, 1200, 800, new Set(['trend', 'characters']))).toEqual(['cumulative'])
    expect(sectionsToReveal(positions, 1200, 800, new Set(['trend', 'characters', 'cumulative']))).toEqual([])
  })
})
