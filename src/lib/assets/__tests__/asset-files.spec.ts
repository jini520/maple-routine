import { assetFilesTable, assetImage, parseAssetFiles } from '../asset-files'

const SHA = 'a'.repeat(64)
const row = (id: string, sha = SHA) => ({ id, file: `${sha}.webp`, sha256: sha, sizeBytes: 10, width: 4, height: 2 })

describe('parseAssetFiles', () => {
  // 내용이 같은 그림은 여러 줄일 수 있어 해시는 겹쳐도 된다. 줄 id 로만 가린다.
  it('id 가 없거나 겹치거나, 파일 이름이 해시와 다르거나, 크기가 없으면 표 전체를 버리고, 해시가 같은 줄은 받는다', () => {
    expect(parseAssetFiles({ updatedAt: 't', files: [row('a1')] })?.files).toHaveLength(1)
    expect(parseAssetFiles({ updatedAt: 't', files: [{ ...row('a1'), id: '' }] })).toBeNull()
    expect(parseAssetFiles({ updatedAt: 't', files: [row('a1'), row('a1')] })).toBeNull()
    expect(parseAssetFiles({ updatedAt: 't', files: [{ ...row('a1'), file: `${'b'.repeat(64)}.webp` }] })).toBeNull()
    expect(parseAssetFiles({ updatedAt: 't', files: [{ ...row('a1'), width: 0 }] })).toBeNull()
    expect(parseAssetFiles({ updatedAt: 't', files: [{ ...row('a1'), sizeBytes: 0 }] })).toBeNull()
    expect(parseAssetFiles({ updatedAt: 't', files: [row('a1'), row('a2')] })?.files).toHaveLength(2)
  })
})

describe('assetImage', () => {
  afterEach(() => assetFilesTable.set({ updatedAt: null, files: [] }))

  it('그림 id 로 기기 파일을 찾고, 모르는 id 와 빈 칸은 null 이다. 같은 그림은 같은 객체다', () => {
    assetFilesTable.set(parseAssetFiles({ updatedAt: 't', files: [row('a1')] })!)
    expect(assetImage('a1')).toEqual({ uri: `${SHA}.webp`, width: 4, height: 2 })
    expect(assetImage('a1')).toBe(assetImage('a1'))
    expect(assetImage('nope')).toBeNull()
    expect(assetImage(undefined)).toBeNull()
  })
})
