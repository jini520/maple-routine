import { assetFilesTable, assetImage, parseAssetFiles } from '../asset-files'

const SHA = 'a'.repeat(64)
const row = (id: string, path: string, sha = SHA) => ({ id, path, file: `${sha}.webp`, sha256: sha, size: 10, width: 4, height: 2 })

describe('parseAssetFiles', () => {
  it('id 가 없거나 겹치거나, 파일 이름이 해시와 다르거나, 크기가 없거나, 경로가 겹치면 표 전체를 버린다', () => {
    expect(parseAssetFiles({ updatedAt: 't', files: [row('a1', 'bosses/a.webp')] })?.files).toHaveLength(1)
    expect(parseAssetFiles({ updatedAt: 't', files: [{ ...row('a1', 'bosses/a.webp'), id: '' }] })).toBeNull()
    expect(parseAssetFiles({ updatedAt: 't', files: [row('a1', 'bosses/a.webp'), row('a1', 'bosses/b.webp')] })).toBeNull()
    expect(
      parseAssetFiles({ updatedAt: 't', files: [{ ...row('a1', 'bosses/a.webp'), file: `${'b'.repeat(64)}.webp` }] }),
    ).toBeNull()
    expect(parseAssetFiles({ updatedAt: 't', files: [{ ...row('a1', 'bosses/a.webp'), width: 0 }] })).toBeNull()
    expect(parseAssetFiles({ updatedAt: 't', files: [row('a1', 'bosses/a.webp'), row('a2', 'bosses/a.webp')] })).toBeNull()
  })
})

describe('assetImage', () => {
  afterEach(() => assetFilesTable.set({ updatedAt: null, files: [] }))

  it('그림 id 로 기기 파일을 찾고, 모르는 id 와 빈 칸은 null 이다. 같은 그림은 같은 객체다', () => {
    assetFilesTable.set(parseAssetFiles({ updatedAt: 't', files: [row('a1', 'items/가.png')] })!)
    expect(assetImage('a1')).toEqual({ uri: `${SHA}.webp`, width: 4, height: 2 })
    expect(assetImage('a1')).toBe(assetImage('a1'))
    expect(assetImage('nope')).toBeNull()
    expect(assetImage(undefined)).toBeNull()
  })
})
