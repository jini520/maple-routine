import { BOSS_DIFFICULTIES, type BossDifficulty } from '../../types'

/** 난이도 key 의 한글 이름. 화면 글자 · 배지 글자 · 문장이 이것을 쓴다. */
export const DIFFICULTY_NAME: Record<BossDifficulty, string> = {
  easy: '이지',
  normal: '노멀',
  hard: '하드',
  chaos: '카오스',
  extreme: '익스트림',
}

/**
 * 한 칸짜리 표기. 글자를 놓을 자리가 없는 데서 쓴다. 가계부의 처치 타일이
 * 첫 호출부다. 56px 그림 위에 '익스트림' 넉 자가 앉으면 초상을 거의 다 덮는다.
 *
 * 색은 이 축에서 안 갈린다. 색이 이미 난이도를 말하고 있어 한 칸은 그것을 확인만 하면 된다.
 */
export const DIFFICULTY_SHORT: Record<BossDifficulty, string> = {
  easy: 'E',
  normal: 'N',
  hard: 'H',
  chaos: 'C',
  extreme: 'EX',
}

/** 한글 난이도에서 key. 한글 난이도가 저장된 옛 기록을 옮기는 이관이 쓴다. 모르는 이름은 `null` 이다. */
export function difficultyKeyOfName(name: string): BossDifficulty | null {
  return BOSS_DIFFICULTIES.find((key) => DIFFICULTY_NAME[key] === name) ?? null
}
