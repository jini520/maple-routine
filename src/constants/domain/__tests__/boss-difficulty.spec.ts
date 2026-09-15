import { BOSS_DIFFICULTIES } from '../../../types'
import { DIFFICULTY_NAME, DIFFICULTY_SHORT, difficultyKeyOfName } from '../boss-difficulty'

// 난이도 key 는 API 값 그대로이고 한글은 표시용이다.
describe('boss-difficulty', () => {
  it('난이도 key 다섯마다 한글 이름과 한 칸 표기가 있다', () => {
    expect(BOSS_DIFFICULTIES.map((key) => DIFFICULTY_NAME[key])).toEqual(['이지', '노멀', '하드', '카오스', '익스트림'])
    expect(BOSS_DIFFICULTIES.map((key) => DIFFICULTY_SHORT[key])).toEqual(['E', 'N', 'H', 'C', 'EX'])
  })

  // 한글 난이도를 든 옛 기록 · 수동 추적 항목을 옮기는 이관이 쓴다.
  it('한글 난이도에서 key 를 찾고 모르는 글자는 null 이다', () => {
    expect(difficultyKeyOfName('카오스')).toBe('chaos')
    expect(difficultyKeyOfName('chaos')).toBeNull()
    expect(difficultyKeyOfName('헬')).toBeNull()
  })
})
