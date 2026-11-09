import { assetFilesTable, assetImage } from '../../lib/assets/asset-files'
import type { ImageAssetRef } from '../../types/image-asset'

/**
 * 그림 참조가 어느 파일로 해석됐는가 를 꺼내는 도우미. 테스트가 물어야 하는 것은 *"이 슬러그가 그 파일로 갔는가"* 다.
 *
 * 번들 그림은 jest 에서 RN 대역 `{ testUri: '<상대 경로>' }` 로 온다. 받은 그림은 `{ uri: '<기기 디렉터리>/<해시>.<확장자>' }`
 * 라 해시만 보이므로, 그림 목록에서 그 파일의 서버 경로(`items/meso.webp`)로 되짚어 돌려준다.
 */
export function assetUri(ref: unknown): string {
  if (ref === null || ref === undefined) return ''
  if (typeof ref === 'string') return ref
  const testUri = (ref as { testUri?: unknown }).testUri
  if (typeof testUri === 'string') return testUri
  const uri = (ref as { uri?: unknown }).uri
  if (typeof uri === 'string') return assetFilesTable.get().files.find((file) => uri.endsWith(file.file))?.path ?? uri
  return String(ref)
}

/** fixture 그림 목록에서 경로로 찾은 그림. 앱은 그림 id 로만 찾으므로 테스트가 기대하는 그림을 적을 때만 쓴다. */
export function imageOfPath(path: string): ImageAssetRef | null {
  return assetImage(assetFilesTable.get().files.find((file) => file.path === path)?.id)
}

/** fixture 그림 목록에서 경로로 찾은 그림 id. 게임 데이터 칸이 든 id 를 테스트가 기대값으로 적을 때 쓴다. */
export function assetIdOfPath(path: string): string | undefined {
  return assetFilesTable.get().files.find((file) => file.path === path)?.id
}
