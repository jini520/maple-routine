// 이미지 내보내기용 네이티브 모듈을 부르는 JS 가 **못박기가 살아 있는 동안** OTA 로 나가는 것을
// 막는다.
//
// ## 무엇이 위험한가
//
// 이 세 모듈은 다음 스토어 바이너리부터 들어간다. 기기에 깔린 1.0.6 바이너리에는 없다.
// 그런데 `PINNED_RUNTIME_VERSIONS` 가 살아 있는 동안은 **못박은 지문이 트리 계산값을 이겨서**,
// 네이티브 그래프가 달라져도 발행이 그냥 성공한다. 평소에는 지문이 달라지면 매니페스트 이름이
// 갈려 옛 기기가 그 번들을 아예 안 받는데, 못박은 동안은 그 차단이 없다.
//
// 그래서 이 모듈을 부르는 화면이 OTA 로 나가면 **모듈이 없는 기기에서 그 화면이 죽는다.**
// 배포도 성공하고 테스트도 통과하므로 사람이 기억하는 것 말고는 막을 것이 없다. 그 자리를
// 여기서 막는다.
//
// ## `expo-file-system` 이 목록에 없는 이유
//
// 그것은 `expo` 자신의 의존성이라 1.0.6 바이너리에 이미 들어 있다(그때의 `Podfile.lock` 에
// `ExpoFileSystem (57.0.2)`). 지금 불러도 안전하다. 같은 이유로 그 패키지의 **버전은 올리지
// 않는다** — 올리면 새 JS 가 옛 네이티브 위에서 돈다.
//
// ## 상수를 비우는 날 이 파일도 지운다
//
// 새 스토어 바이너리가 나가면 못박기가 사라지고 트리 계산값이 곧 바이너리의 값이 된다. 그때부터
// 지문 불일치가 다시 막아 주므로 이 가드는 할 일이 없다. 못박기가 비면 아래 스위트는 `skip` 으로
// 뜬다 — 지워 달라는 표시다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { PINNED_RUNTIME_VERSIONS } from '../ota-runtime-version.mjs'

// `import.meta` 는 못 쓴다. jest 가 이 파일을 babel 로 CJS 로 바꿔 돌리므로 그 자리에서 죽는다.
const SRC = join(__dirname, '..', '..', 'src')

/** 다음 스토어 바이너리에 처음 들어가는 모듈. 그전까지 `src/` 가 부르면 안 된다. */
const NOT_IN_STORE_BINARY_YET = ['react-native-view-shot', 'expo-sharing', 'expo-media-library']

const pinnedPlatforms = Object.keys(PINNED_RUNTIME_VERSIONS)
const describeWhilePinned = pinnedPlatforms.length > 0 ? describe : describe.skip

function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== '__snapshots__') out.push(...sourceFiles(path))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

/** `'expo-sharing'` 과 `'expo-sharing/무엇'` 을 함께 잡는다. import·require·동적 import 공통. */
function importsModule(source, moduleName) {
  return new RegExp(`['"]${moduleName}(/[^'"]*)?['"]`).test(source)
}

describeWhilePinned(`발행 지문을 못박은 동안(${pinnedPlatforms.join('·')})`, () => {
  const files = sourceFiles(SRC)

  it('훑을 파일을 실제로 찾았다', () => {
    // 경로가 틀려 0개를 훑고도 통과하는 것이 이런 가드의 흔한 실패다.
    expect(files.length).toBeGreaterThan(300)
  })

  it('src 가 스토어 바이너리에 아직 없는 네이티브 모듈을 부르지 않는다', () => {
    const offenders = []

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const moduleName of NOT_IN_STORE_BINARY_YET) {
        if (importsModule(source, moduleName)) {
          offenders.push(`${file.slice(SRC.length + 1)}: ${moduleName}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('가드가 실제로 무언가를 잡는다', () => {
    // 정규식이 죽으면 위 테스트가 «아무도 안 부른다» 로 조용히 통과한다.
    expect(importsModule(`import { captureRef } from 'react-native-view-shot'`, 'react-native-view-shot')).toBe(true)
    expect(importsModule(`await import('expo-media-library/next')`, 'expo-media-library')).toBe(true)
    expect(importsModule(`import * as FileSystem from 'expo-file-system'`, 'expo-sharing')).toBe(false)
  })
})
