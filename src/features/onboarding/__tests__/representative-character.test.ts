import { describe, expect, it } from 'vitest'
import type { MapleCharacter } from '../../../types'
import { pickRepresentativeCharacter } from '../representative-character'

function character(overrides: Partial<MapleCharacter> & { name: string; level: number }): MapleCharacter {
  return {
    ocid: `ocid-${overrides.name}`,
    world: '베라',
    jobClass: '렌',
    ...overrides,
  }
}

describe('pickRepresentativeCharacter', () => {
  it('레벨이 다르면 가장 레벨이 높은 캐릭터를 고른다', () => {
    const characters = [
      character({ name: '낮은레벨', level: 100 }),
      character({ name: '가장높음', level: 293 }),
      character({ name: '중간레벨', level: 200 }),
    ]

    expect(pickRepresentativeCharacter(characters).name).toBe('가장높음')
  })

  it('레벨이 동률이면 한글 이름을 알파벳/숫자보다 우선한다', () => {
    const characters = [
      character({ name: 'Alpha', level: 200 }),
      character({ name: '123캐릭', level: 200 }),
      character({ name: '나다캐릭', level: 200 }),
    ]

    expect(pickRepresentativeCharacter(characters).name).toBe('나다캐릭')
  })

  it('한글끼리 동률이면 가나다순으로 첫 번째를 고른다', () => {
    const characters = [
      character({ name: '다람쥐', level: 200 }),
      character({ name: '가람이', level: 200 }),
      character({ name: '나비야', level: 200 }),
    ]

    expect(pickRepresentativeCharacter(characters).name).toBe('가람이')
  })

  it('알파벳끼리 동률이면 abc순으로 첫 번째를 고른다(한글이 없을 때)', () => {
    const characters = [
      character({ name: 'Charlie', level: 200 }),
      character({ name: 'Alpha', level: 200 }),
      character({ name: 'Bravo', level: 200 }),
    ]

    expect(pickRepresentativeCharacter(characters).name).toBe('Alpha')
  })

  it('숫자끼리 동률이면 123순으로 첫 번째를 고른다(한글/알파벳이 없을 때)', () => {
    const characters = [
      character({ name: '9번캐릭', level: 200 }),
      character({ name: '10번캐릭', level: 200 }),
      character({ name: '2번캐릭', level: 200 }),
    ]

    expect(pickRepresentativeCharacter(characters).name).toBe('2번캐릭')
  })

  it('한글 > 알파벳 > 숫자 그룹 순서를 지킨다', () => {
    const characters = [
      character({ name: '9번캐릭', level: 200 }),
      character({ name: 'Zeta', level: 200 }),
      character({ name: '하나둘', level: 200 }),
    ]

    expect(pickRepresentativeCharacter(characters).name).toBe('하나둘')
  })
})
