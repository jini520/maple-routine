import { ownerFaceOcid, type OwnerCharacter } from '../owner-face'

const SCANIA = { accountId: 'maple-a', worldKey: 'scania' }

function character(ocid: string, level: number, extra: Partial<OwnerCharacter> = {}): OwnerCharacter {
  return { ocid, name: ocid, level, ...SCANIA, unavailable: false, ...extra }
}

describe('ownerFaceOcid', () => {
  it('앱의 대표 캐릭터가 그 메이플 ID · 월드에 있으면 레벨과 상관없이 그 캐릭터다', () => {
    const characters = [character('high', 290), character('rep', 220)]

    expect(ownerFaceOcid(SCANIA, characters, 'rep')).toBe('rep')
  })

  it('대표 캐릭터가 다른 메이플 ID · 월드에 있으면 이 주인의 캐릭터에서 고른다', () => {
    const characters = [character('rep', 290, { worldKey: 'bera' }), character('mine', 220)]

    expect(ownerFaceOcid(SCANIA, characters, 'rep')).toBe('mine')
  })

  it('대표가 없으면 조회 가능한 캐릭터 가운데 레벨이 가장 높은 캐릭터다', () => {
    const characters = [character('blocked', 295, { unavailable: true }), character('low', 200), character('high', 280)]

    expect(ownerFaceOcid(SCANIA, characters, null)).toBe('high')
  })

  it('모두 조회 불가면 레벨이 가장 높은 캐릭터다', () => {
    const characters = [character('low', 200, { unavailable: true }), character('high', 280, { unavailable: true })]

    expect(ownerFaceOcid(SCANIA, characters, null)).toBe('high')
  })

  it('레벨이 같으면 이름순이다', () => {
    const characters = [character('나비', 250), character('가람', 250)]

    expect(ownerFaceOcid(SCANIA, characters, null)).toBe('가람')
  })

  it('그 메이플 ID · 월드에 추적 캐릭터가 없으면 얼굴이 없다', () => {
    expect(ownerFaceOcid(SCANIA, [character('other', 250, { accountId: 'maple-b' })], null)).toBeNull()
  })
})
