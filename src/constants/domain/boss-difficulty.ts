import type { BossDifficulty } from '../../types'

/**
 * 한 칸짜리 표기 ([[ADR-172]] 정정 2). 글자를 놓을 자리가 없는 데서 쓴다. 가계부의 처치 타일이
 * 첫 호출부다. 56px 그림 위에 '익스트림' 넉 자가 앉으면 초상을 거의 다 덮는다.
 *
 * 색은 이 축에서 안 갈린다. 색이 이미 난이도를 말하고 있어 한 칸은 그것을 확인만 하면 된다.
 */
export const DIFFICULTY_SHORT: Record<BossDifficulty, string> = {
  이지: 'E',
  노멀: 'N',
  하드: 'H',
  카오스: 'C',
  익스트림: 'EX',
}
