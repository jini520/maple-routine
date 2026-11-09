/**
 * 앱 코드가 정한 이름으로 찾는 그림이 게임 데이터에서 찾아지는지 본다. 그림 칸의 id 는 서버가 FK 로 지키지만, 앱 그림 표의
 * key 와 가계부 줄 표식의 갈래는 앱 코드가 적는다. 어긋나면 에러 없이 그림만 빠진다.
 *
 * 목록은 fixture(운영 서버 `GET /v1/game-data`)다.
 */
import { MVP_GRADE_KEYS } from '../../../types/game-data'
import { APP_IMAGE_KEYS, DROP_EFFECT_STAGES, appImage, appImageFrames } from '../app-images'
import { cashbookRowIconOf, mvpPlateAsset, solErdaFragmentIcon } from '../asset-lookup'

describe('코드가 이름으로 찾는 그림', () => {
  it('앱 그림 표가 코드의 key 를 모두 들고, 연출 프레임은 단계마다 있다', () => {
    for (const key of APP_IMAGE_KEYS) expect([key, appImage(key)]).not.toContain(null)
    for (const stage of DROP_EFFECT_STAGES) expect([stage, appImageFrames(stage).length > 0]).toEqual([stage, true])
  })

  it('가계부 줄 표식 · 일반을 뺀 MVP 명패 · 솔 에르다 조각이 표에서 찾아진다', () => {
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
    for (const grade of MVP_GRADE_KEYS.filter((g) => g !== 'normal')) expect([grade, mvpPlateAsset(grade)]).not.toContain(null)
    expect(mvpPlateAsset('normal')).toBeNull()
    expect(solErdaFragmentIcon()).not.toBeNull()
  })
})
