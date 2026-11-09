import { appImage, appImageFrames, appImagesTable, parseAppImages } from '../app-images'
import { assetFilesTable } from '../asset-files'

/** 그림마다 해시가 달라야 어느 그림이 섰는지 주소로 가린다. */
const SHA: Record<string, string> = { m: 'a', f0: 'b', f2: 'c', f10: 'd', x: 'e' }
const file = (id: string) => {
  const sha = (SHA[id] ?? 'f').repeat(64)
  return { id, path: `p/${id}.webp`, file: `${sha}.webp`, sha256: sha, size: 1, width: 3, height: 3 }
}
const uriOf = (id: string) => file(id).file

describe('parseAppImages', () => {
  it('key 나 그림 id 가 비거나 key 가 겹치면 표 전체를 버린다', () => {
    const row = { key: 'meso_pouch', assetId: 'a1' }
    expect(parseAppImages({ updatedAt: 't', images: [row] })?.images).toEqual([row])
    expect(parseAppImages({ updatedAt: 't', images: [{ ...row, assetId: '' }] })).toBeNull()
    expect(parseAppImages({ updatedAt: 't', images: [row, row] })).toBeNull()
  })
})

describe('appImage · appImageFrames', () => {
  afterEach(() => {
    appImagesTable.set({ updatedAt: null, images: [] })
    assetFilesTable.set({ updatedAt: null, files: [] })
  })

  it('key 의 그림을 그림 id 로 찾고, 연출 프레임은 단계마다 번호 차례로 모은다', () => {
    assetFilesTable.set({ updatedAt: 't', files: ['m', 'f2', 'f10', 'f0', 'x'].map(file) })
    appImagesTable.set({
      updatedAt: 't',
      images: [
        { key: 'meso_pouch', assetId: 'm' },
        { key: 'drop_effect_loop_10', assetId: 'f10' },
        { key: 'drop_effect_loop_2', assetId: 'f2' },
        { key: 'drop_effect_loop_0', assetId: 'f0' },
        { key: 'drop_effect_end_0', assetId: 'x' },
      ],
    })
    expect(appImage('meso_pouch')).toEqual({ uri: uriOf('m'), width: 3, height: 3 })
    expect(appImage('union_wealth')).toBeNull()
    expect(appImageFrames('loop').map((image) => image.uri)).toEqual([uriOf('f0'), uriOf('f2'), uriOf('f10')])
    expect(appImageFrames('pre')).toEqual([])
  })
})
