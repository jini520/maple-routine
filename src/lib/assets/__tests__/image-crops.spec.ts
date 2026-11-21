import { imageCropOf, imageCropsTable, parseImageCrops } from '../image-crops'

describe('parseImageCrops', () => {
  it('폭이 0 이하이거나 숫자가 아니면 표 전체를 버리고, 빈 표는 받는다', () => {
    const crop = { type: 'boss_portrait', assetId: 'zakum-id', widthPercent: 100, positionXPercent: 50, positionYPercent: 45 }
    expect(parseImageCrops({ updatedAt: 't', imageCrops: [crop] })?.imageCrops).toHaveLength(1)
    expect(parseImageCrops({ updatedAt: 't', imageCrops: [] })?.imageCrops).toEqual([])
    expect(parseImageCrops({ updatedAt: 't', imageCrops: [{ ...crop, widthPercent: 0 }] })).toBeNull()
    expect(parseImageCrops({ updatedAt: 't', imageCrops: [{ ...crop, positionXPercent: '50%' }] })).toBeNull()
    expect(parseImageCrops({ updatedAt: 't', imageCrops: [{ ...crop, type: 'boss_portrait_modal' }] })).toBeNull()
    expect(parseImageCrops({ updatedAt: 't', imageCrops: [{ ...crop, assetId: '' }] })).toBeNull()
    expect(parseImageCrops({ updatedAt: 't', imageCrops: [crop, crop] })).toBeNull()
  })
})

describe('imageCropOf', () => {
  afterEach(() => imageCropsTable.set({ updatedAt: null, imageCrops: [] }))

  it('같은 그림이라도 종류마다 다른 줄을 읽고, 없으면 상자를 덮는다', () => {
    imageCropsTable.set({
      updatedAt: 't',
      imageCrops: [
        { type: 'boss_portrait', assetId: 'zakum-id', widthPercent: 100, positionXPercent: 50, positionYPercent: 45 },
        { type: 'boss_portrait_icon', assetId: 'zakum-id', widthPercent: 200, positionXPercent: 50, positionYPercent: 20 },
      ],
    })
    expect(imageCropOf('boss_portrait_icon', 'zakum-id')).toEqual({
      kind: 'sized',
      widthPercent: 200,
      positionXPercent: 50,
      positionYPercent: 20,
    })
    expect(imageCropOf('daily_quest_region', 'zakum-id')).toEqual({ kind: 'cover' })
    expect(imageCropOf('boss_portrait', null)).toEqual({ kind: 'cover' })
  })
})
