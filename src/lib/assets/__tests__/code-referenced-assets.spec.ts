/**
 * 앱 코드가 이름으로 직접 가리키는 그림이 서버 목록에서 찾아지는지 본다. 게임 데이터 표가 가리키는 그림은 서버가
 * 쓰기 때 검사하지만, 코드에 적은 이름은 서버가 모른다. 오타가 나면 에러 없이 그림만 빠진다.
 *
 * 목록은 fixture(운영 서버 `GET /v1/game-data` 의 `assets` 칸)다.
 */
import {
  cashbookRowIconOf,
  forceIconOf,
  getItemIconUrlByFile,
  mvpPlateAsset,
  unknownCharacterAsset,
} from '../asset-lookup'
import { MVP_GRADE_KEYS } from '../../../types/game-data'

describe('코드가 가리키는 그림', () => {
  it('가계부 줄 표식 · 포스 · 일반을 뺀 MVP 명패 · 모르는 캐릭터 · 솔 에르다 조각이 목록에 있다', () => {
    for (const key of [
      'bossCrystal',
      'enhancement:cube_reset',
      'enhancement:starforce',
      'enhancement:potential',
      'enhancement:additional_potential',
      'enhancement:soul_potential',
      'income:hunting',
      'income:sol_erda_fragment',
      'income:etc',
      'spend:etc',
    ])
      expect([key, cashbookRowIconOf(key)]).toEqual([key, expect.objectContaining({ width: expect.any(Number) })])
    expect(forceIconOf('arcane')).not.toBeNull()
    expect(forceIconOf('authentic')).not.toBeNull()
    for (const grade of MVP_GRADE_KEYS.filter((g) => g !== 'normal')) expect([grade, mvpPlateAsset(grade)]).not.toContain(null)
    expect(unknownCharacterAsset()).not.toBeNull()
    expect(getItemIconUrlByFile('sol_erda_fragment.webp')).not.toBeNull()
  })
})
