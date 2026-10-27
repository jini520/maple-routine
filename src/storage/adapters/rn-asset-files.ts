import { CryptoDigestAlgorithm, digest } from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'

import type { AssetFilesPort } from '../ports'

/**
 * `AssetFilesPort` 의 RN 구현. 문서 디렉터리 아래 `game-assets/` 에 둔다.
 *
 * 캐시 디렉터리가 아닌 이유는 저장 공간이 모자랄 때 iOS 가 캐시 디렉터리를 비우기 때문이다. 비워지면 쓰는 도중에
 * 잠금 화면이 다시 걸린다.
 */
let cached: Directory | null = null

/** 처음 쓸 때 만든다. 모듈을 읽는 순간 네이티브 모듈을 부르면 그 모듈이 없는 jest 와 헤드리스 실행이 import 만으로 죽는다. */
function directoryOf(): Directory {
  cached ??= new Directory(Paths.document, 'game-assets')
  return cached
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const rnAssetFilesPort: AssetFilesPort = {
  directoryUri() {
    const directory = directoryOf()
    return directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`
  },
  async list() {
    const directory = directoryOf()
    if (!directory.exists) return []
    return directory.list().flatMap((entry) => (entry instanceof File ? [entry.name] : []))
  },
  async download(url, fileName, sha256) {
    const directory = directoryOf()
    directory.create({ idempotent: true, intermediates: true })
    // 임시 이름에 받고 확인한 뒤 옮긴다. 확인 전의 파일이 제 이름으로 있으면 다음 실행이 받은 것으로 믿는다.
    const temp = new File(directory, `${fileName}.part`)
    if (temp.exists) temp.delete()
    const downloaded = await File.downloadFileAsync(url, temp, { idempotent: true })
    const bytes = await downloaded.bytes()
    if (hex(await digest(CryptoDigestAlgorithm.SHA256, bytes)) !== sha256) {
      downloaded.delete()
      throw new Error(`받은 그림의 해시가 다릅니다: ${fileName}`)
    }
    const target = new File(directory, fileName)
    if (target.exists) target.delete()
    await downloaded.move(target)
    return bytes.byteLength
  },
  async remove(fileName) {
    const directory = directoryOf()
    const file = new File(directory, fileName)
    if (file.exists) file.delete()
  },
  async clear() {
    const directory = directoryOf()
    if (directory.exists) directory.delete()
  },
  async size() {
    const directory = directoryOf()
    if (!directory.exists) return 0
    return directory.size ?? 0
  },
}
