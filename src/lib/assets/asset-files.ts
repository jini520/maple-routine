/** 서버 그림 목록(`assets` 칸) 조회. 앱이 그리는 그림은 이 목록의 경로로 찾는다. */
import type { AssetFileRow, AssetFilesTable } from '../../types/game-data'
import type { DownloadedImage } from '../../types/image-asset'
import { isNonEmptyString, isPositiveInteger, isRow, rowsOf, uniqueBy, updatedAtOf, type Row } from '../game-data/contract'
import { derive, gameTable } from '../game-data/table'

export type AssetFile = AssetFileRow

const SHA256 = /^[0-9a-f]{64}$/
const FILE = /^([0-9a-f]{64})\.(png|webp|jpg)$/

function toFile(row: Row): AssetFileRow | null {
  if (!isNonEmptyString(row.path) || typeof row.file !== 'string' || typeof row.sha256 !== 'string') return null
  // 기기에서 받은 파일을 이 해시로 확인한다. 이름과 해시가 다르면 확인할 수 없다.
  const file = FILE.exec(row.file)
  if (!SHA256.test(row.sha256) || file?.[1] !== row.sha256) return null
  if (!isPositiveInteger(row.size) || !isPositiveInteger(row.width) || !isPositiveInteger(row.height)) return null
  return {
    path: row.path.normalize('NFC'),
    file: row.file,
    sha256: row.sha256,
    size: row.size,
    width: row.width,
    height: row.height,
  }
}

/** 계약을 지킨 값만 통과시킨다. 어긴 값은 표 전체가 `null` 이다. */
export function parseAssetFiles(value: unknown): AssetFilesTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const files = rowsOf(value.files, toFile)
  if (files === null || !uniqueBy(files, (file) => file.path)) return null
  return { updatedAt, files }
}

/** 받기 전에는 비어 있다. 잠금 화면이 다 받기 전에는 화면을 열지 않는다. */
export const assetFilesTable = gameTable<AssetFilesTable>('assets', { updatedAt: null, files: [] }, parseAssetFiles)

const byPath = derive(assetFilesTable, (table) => new Map(table.files.map((file) => [file.path, file])))

/** 경로의 그림 한 장. 목록에 없으면 `null`. 경로는 NFC 로 맞춰 찾는다. */
export function findAssetFile(path: string): AssetFile | null {
  return byPath().get(path.normalize('NFC')) ?? null
}

let baseUri = ''

/** 기기의 그림 디렉터리 주소(끝 `/` 포함). 켤 때 저장소 어댑터가 정한다. */
export function setAssetBaseUri(uri: string): void {
  baseUri = uri
}

let cache = new Map<string, DownloadedImage>()
let cacheTable: AssetFilesTable | null = null
let cacheBase = ''

/**
 * 같은 그림이면 같은 객체를 돌려준다. 렌더마다 새 객체면 `Image` 가 소스가 바뀐 것으로 읽고, 메모한 계산이 매번 다시 돈다.
 */
function imageOf(file: AssetFile): DownloadedImage {
  const table = assetFilesTable.get()
  if (table !== cacheTable || baseUri !== cacheBase) {
    cache = new Map()
    cacheTable = table
    cacheBase = baseUri
  }
  let image = cache.get(file.path)
  if (image === undefined) {
    image = { uri: `${baseUri}${file.file}`, width: file.width, height: file.height }
    cache.set(file.path, image)
  }
  return image
}

/** 경로의 그림. 목록에 없으면 `null` 이고 화면은 그림 없이 선다. */
export function assetImage(path: string): DownloadedImage | null {
  const file = findAssetFile(path)
  return file === null ? null : imageOf(file)
}

/** 확장자를 뗀 이름으로 찾는 그림. 디렉터리마다 확장자가 섞여 있어 차례로 본다. */
export function assetImageBySlug(dir: string, slug: string | null | undefined): DownloadedImage | null {
  if (slug == null) return null
  for (const ext of ['webp', 'png', 'jpg']) {
    const image = assetImage(`${dir}/${slug}.${ext}`)
    if (image !== null) return image
  }
  return null
}

const NUMBERED = /^(\d+)\.\w+$/

/**
 * 디렉터리 바로 아래 숫자 이름 그림을 숫자 차례로. 연출 프레임이 쓴다. 글자 차례면 `10 < 2` 라 프레임이 뒤섞인다.
 */
export function assetFrames(dir: string): DownloadedImage[] {
  const prefix = `${dir}/`
  return assetFilesTable
    .get()
    .files.flatMap((file) => {
      if (!file.path.startsWith(prefix)) return []
      const index = NUMBERED.exec(file.path.slice(prefix.length))
      return index === null ? [] : [{ index: Number(index[1]), file }]
    })
    .sort((a, b) => a.index - b.index)
    .map(({ file }) => imageOf(file))
}
