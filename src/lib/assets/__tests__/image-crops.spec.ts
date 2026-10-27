import { imageCropOf, imageCropsTable, parseImageCrops } from '../image-crops'

describe('parseImageCrops', () => {
  it('크롭 계산이 읽지 못하는 문법은 표 전체를 버리고, 빈 표는 받는다', () => {
    const crop = { kind: 'boss_portrait', slug: 'zakum', size: '100% auto', position: '50% 45%' }
    expect(parseImageCrops({ updatedAt: 't', crops: [crop] })?.crops).toHaveLength(1)
    expect(parseImageCrops({ updatedAt: 't', crops: [] })?.crops).toEqual([])
    expect(parseImageCrops({ updatedAt: 't', crops: [{ ...crop, size: 'cover' }] })).toBeNull()
    expect(parseImageCrops({ updatedAt: 't', crops: [{ ...crop, kind: 'nope' }] })).toBeNull()
    expect(parseImageCrops({ updatedAt: 't', crops: [crop, crop] })).toBeNull()
  })
})

describe('imageCropOf', () => {
  afterEach(() => imageCropsTable.set({ updatedAt: null, crops: [] }))

  it('같은 slug 라도 종류마다 다른 줄을 읽고, 없으면 cover · 가운데다', () => {
    imageCropsTable.set({
      updatedAt: 't',
      crops: [
        { kind: 'boss_portrait', slug: 'zakum', size: '100% auto', position: '50% 45%' },
        { kind: 'boss_portrait_icon', slug: 'zakum', size: '200% auto', position: '50% 20%' },
      ],
    })
    expect(imageCropOf('boss_portrait_icon', 'zakum')).toEqual({ size: '200% auto', position: '50% 20%' })
    expect(imageCropOf('boss_portrait_modal', 'zakum')).toEqual({ size: 'cover', position: 'center' })
    expect(imageCropOf('boss_portrait', null)).toEqual({ size: 'cover', position: 'center' })
  })
})
