// Vite 전용 API 를 쓰는 core 모듈의 치환 — **이 자리가 조용해지지 않게** 지킨다.
//
// 사슬을 다시 적어 둔다(경위는 `core-shims.js`·`core-import-meta.d.ts`):
//   · core 는 에셋 목록을 `import.meta.glob` 으로 만든다 — Metro 에는 짝이 없어 **모듈 평가 시점에**
//     `__ExpoImportMetaRegistry.glob is not a function` 으로 죽는다.
//   · 그래도 타입 검사는 통과해야 하므로 `ImportMeta.glob` 앰비언트 선언을 두었다.
//   · 그 선언 때문에 **치환되지 않은 glob 모듈을 import 하면 tsc·lint 는 초록이고 런타임에만 죽는다.**
//
// 마지막 줄이 이 파일이 있는 이유다. core 에 glob 모듈이 하나 늘거나 이름이 바뀌면 여기가 빨개져,
// 그 모듈을 쓰기 시작할 때 치환이 필요하다는 사실을 **미리** 알게 된다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { getThemeBackgroundUrl } from '@core/lib/theme-backgrounds'
import { DEFAULT_THEME, buildThemeCss, getThemeDefinition } from '@core/lib/theme-registry'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SHIMMED_CORE_MODULES } = require('../../core-shims') as {
  SHIMMED_CORE_MODULES: { core: string; shim: string; why: string }[]
}

const CORE_SRC = path.resolve(__dirname, '../../../core/src')

/** `packages/core/src` 아래 `.ts`/`.tsx` 를 전부 훑는다(테스트 파일은 제품 코드가 아니라 제외). */
function coreSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : coreSourceFiles(full)
    }
    return /\.tsx?$/.test(entry) ? [path.relative(CORE_SRC, full)] : []
  })
}

describe('core 모듈 치환', () => {
  it('치환 대상은 지금 하나이고, 그 대체 파일이 실재한다', () => {
    expect(SHIMMED_CORE_MODULES.map(({ core }) => core)).toEqual(['lib/theme-backgrounds'])

    for (const { shim, why } of SHIMMED_CORE_MODULES) {
      expect(statSync(path.resolve(__dirname, '../..', shim)).isFile()).toBe(true)
      expect(why.length).toBeGreaterThan(0)
    }
  })

  // `@core/…` 형태와 core 안의 상대 경로 형태 **둘 다** 잡혀야 한다 — 정작 문제를 일으키는 것은
  // 후자다(`theme-registry.ts` 가 `./theme-backgrounds` 를 부른다).
  it('직접 import 해도 RN 대체 구현이 온다', () => {
    expect(getThemeBackgroundUrl('blackmage-background')).toBeNull()
  })

  it('그래서 `theme-registry` 를 평가할 수 있다(치환이 없으면 여기서 죽는다)', () => {
    expect(getThemeDefinition(DEFAULT_THEME).mode).toBe('light')
  })

  // 배경 슬러그가 해석되지 않으므로 `--theme-bg-*` 는 한 줄도 안 나온다 — 색 38토큰은 그대로 흐르고
  // 배경만 없다([[ADR-088]] 결정 3 의 정상 경로). **RN 에서 배경 가진 두 테마가 단색으로 열린다**는
  // 사실을 조용히 두지 않기 위해 계약으로 적는다(뷰 레이어에서 채워질 자리다).
  it('RN 에서는 테마 배경이 아직 없다 — 색만 흐른다', () => {
    const css = buildThemeCss(getThemeDefinition('검은마법사'))

    expect(getThemeDefinition('검은마법사').background).toBeDefined()
    expect(css).not.toContain('--theme-bg')
    expect(css).toContain('--color-primary')
  })
})

describe('아직 치환되지 않은 glob 모듈', () => {
  // 목록을 손으로 적어 둔 것이 요점이다 — core 가 glob 모듈을 늘리면 이 단언이 깨지고, 그때
  // "치환이 필요한 자리가 하나 늘었다"를 **읽게 된다**(앰비언트 타입 선언이 그 사실을 숨기므로).
  const KNOWN_GLOB_MODULES = [
    'data/feature-guides/index.ts',
    'lib/boss-icons.ts',
    'lib/daily-quest-backgrounds.ts',
    'lib/daily-quest-icons.ts',
    'lib/drop-effect-frames.ts',
    'lib/item-icons.ts',
    'lib/theme-backgrounds.ts',
    'lib/world-emblem.ts',
  ]

  it('core 의 glob 모듈 목록이 그대로다', () => {
    const found = coreSourceFiles(CORE_SRC)
      .filter((relative) => readFileSync(path.join(CORE_SRC, relative), 'utf8').includes('import.meta.glob'))
      .sort()

    expect(found).toEqual(KNOWN_GLOB_MODULES)
  })

  // 여덟 중 하나만 치환됐다. 나머지 일곱은 **쓰기 시작할 때** 같은 처리가 필요하다(에셋 해석을
  // 포트로 뒤집는 것이 제대로 된 답이고, 그건 core 인터페이스를 늘리는 별도 결정이다).
  it('여덟 중 치환된 것은 테마 배경 하나뿐이다', () => {
    const shimmed = SHIMMED_CORE_MODULES.map(({ core }) => `${core}.ts`)

    expect(KNOWN_GLOB_MODULES.filter((module) => shimmed.includes(module))).toEqual([
      'lib/theme-backgrounds.ts',
    ])
  })
})
