/** 서버 그림 목록(`assets` 칸) 조회. 앱이 그리는 그림은 게임 데이터 표의 그림 칸이 든 id 로 이 목록에서 찾는다. */
import type { AssetFileRow, AssetFilesTable } from '../../types/game-data'
import type { DownloadedImage } from '../../types/image-asset'
import { isNonEmptyString, isPositiveInteger, isRow, rowsOf, uniqueBy, updatedAtOf, type Row } from '../game-data/contract'
import { derive, gameTable } from '../game-data/table'

export type AssetFile = AssetFileRow

const SHA256 = /^[0-9a-f]{64}$/
const FILE = /^([0-9a-f]{64})\.(png|webp|jpg)$/

function toFile(row: Row): AssetFileRow | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.path)) return null
  if (typeof row.file !== 'string' || typeof row.sha256 !== 'string') return null
  // 기기에서 받은 파일을 이 해시로 확인한다. 이름과 해시가 다르면 확인할 수 없다.
  const file = FILE.exec(row.file)
  if (!SHA256.test(row.sha256) || file?.[1] !== row.sha256) return null
  if (!isPositiveInteger(row.size) || !isPositiveInteger(row.width) || !isPositiveInteger(row.height)) return null
  return {
    id: row.id,
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
  if (files === null || !uniqueBy(files, (file) => file.id) || !uniqueBy(files, (file) => file.path)) return null
  return { updatedAt, files }
}

/** 받기 전에는 비어 있다. 잠금 화면이 다 받기 전에는 화면을 열지 않는다. */
export const assetFilesTable = gameTable<AssetFilesTable>('assets', { updatedAt: null, files: [] }, parseAssetFiles)

const byId = derive(assetFilesTable, (table) => new Map(table.files.map((file) => [file.id, file])))

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
  let image = cache.get(file.id)
  if (image === undefined) {
    image = { uri: `${baseUri}${file.file}`, width: file.width, height: file.height }
    cache.set(file.id, image)
  }
  return image
}

/** 그림 id 의 그림. 목록에 없거나 칸이 비면 `null` 이고 화면은 그림 없이 선다. */
export function assetImage(assetId: string | null | undefined): DownloadedImage | null {
  if (assetId == null) return null
  const file = byId().get(assetId)
  return file === undefined ? null : imageOf(file)
}
