import { assetFilesTable, findAssetFile, parseAssetFiles } from '../asset-files'

const SHA = 'a'.repeat(64)
const row = (path: string, sha = SHA) => ({ path, file: `${sha}.webp`, sha256: sha, size: 10, width: 4, height: 2 })

describe('parseAssetFiles', () => {
  it('파일 이름이 해시와 다르거나, 크기가 없거나, 경로가 겹치면 표 전체를 버린다', () => {
    expect(parseAssetFiles({ updatedAt: 't', files: [row('bosses/a.webp')] })?.files).toHaveLength(1)
    expect(parseAssetFiles({ updatedAt: 't', files: [{ ...row('bosses/a.webp'), file: `${'b'.repeat(64)}.webp` }] })).toBeNull()
    expect(parseAssetFiles({ updatedAt: 't', files: [{ ...row('bosses/a.webp'), width: 0 }] })).toBeNull()
    expect(parseAssetFiles({ updatedAt: 't', files: [row('bosses/a.webp'), row('bosses/a.webp')] })).toBeNull()
  })
})

describe('findAssetFile', () => {
  afterEach(() => assetFilesTable.set({ updatedAt: null, files: [] }))

  it('macOS 가 NFD 로 준 경로도 NFC 목록에서 찾는다', () => {
    assetFilesTable.set(parseAssetFiles({ updatedAt: 't', files: [row('items/가.png'.normalize('NFD'))] })!)
    expect(findAssetFile('items/가.png'.normalize('NFD'))?.sha256).toBe(SHA)
    expect(findAssetFile('items/나.png')).toBeNull()
  })
})
