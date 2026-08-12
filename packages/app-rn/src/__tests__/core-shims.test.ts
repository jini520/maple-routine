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

import bossPortraitIconCrops from '@core/data/boss-portrait-icon-crops.json'
import worldEmblems from '@core/data/world-emblems.json'
import { getBossPortraitIconCrop, getBossPortraitUrl } from '@core/lib/boss-icons'
import { DROP_EFFECT_FRAMES } from '@core/lib/drop-effect-frames'
import { getItemIconUrl, getItemIconUrlByFile } from '@core/lib/item-icons'
import { getThemeBackgroundUrl } from '@core/lib/theme-backgrounds'
import { DEFAULT_THEME, buildThemeCss, getThemeDefinition } from '@core/lib/theme-registry'
import { isChallengersWorld, worldEmblemUrl } from '@core/lib/world-emblem'

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
  it('치환 대상은 지금 다섯이고, 그 대체 파일이 실재한다', () => {
    expect(SHIMMED_CORE_MODULES.map(({ core }) => core)).toEqual([
      'lib/theme-backgrounds',
      'lib/boss-icons',
      'lib/world-emblem',
      'lib/item-icons',
      'lib/drop-effect-frames',
    ])

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

  // step 4(molecules)가 더한 세 치환. **에셋 URL 만 없고 나머지는 진짜다** — 그 경계를 계약으로
  // 적어 둔다(에셋 레이어가 오면 위 배경 테스트와 함께 여기가 바뀐다).
  describe('에셋 URL 세 자리 — 지금은 전부 null 이다', () => {
    it.each([
      ['보스 일러스트', () => getBossPortraitUrl('lucid')],
      ['월드 엠블럼', () => worldEmblemUrl('엘리시움')],
      ['아이템 아이콘(이름)', () => getItemIconUrl('칠흑의 보스 반지 상자')],
      ['아이템 아이콘(파일명)', () => getItemIconUrlByFile('Limit_Ring.webp')],
    ])('%s 은 RN 번들에 없다', (_label, resolve) => {
      expect(resolve()).toBeNull()
    })

    // step 5(organisms)가 더한 넷째 자리. 여기만 `null` 이 아니라 **빈 배열**인 이유는 원본이
    // 그렇게 정의해 뒀기 때문이다 — `DropEffectOverlay` 는 `loop.length === 0` 을 보고 "연출 없이
    // 닫기만" 분기로 간다([[ADR-038]]).
    it('고가 드롭 연출 프레임은 네 단계 모두 비어 있다', () => {
      expect(DROP_EFFECT_FRAMES).toEqual({ screen: [], pre: [], loop: [], end: [] })
    })
  })

  // 반대쪽 — 에셋과 무관한 로직은 **대체 구현에서도 그대로 답해야 한다**. 기대값은 손으로 적지 않고
  // 같은 JSON 에서 뽑는다([[ADR-006]] · `render-atom.tsx` 와 같은 규칙).
  describe('에셋이 아닌 것은 그대로 산다', () => {
    it('보스 원형 아이콘 크롭 표는 JSON 그대로다 ([[ADR-018]])', () => {
      const [slug, crop] = Object.entries(bossPortraitIconCrops)[0]

      expect(getBossPortraitIconCrop(slug)).toEqual(crop)
      expect(getBossPortraitIconCrop('없는슬러그')).toEqual({ size: 'cover', position: 'center' })
      expect(getBossPortraitIconCrop(null)).toEqual({ size: 'cover', position: 'center' })
    })

    // 이 판정이 조용히 틀리면 보스 스케줄러의 시즌 보스 표시가 무너진다([[ADR-031]]).
    it('챌린저스 월드 판정은 매핑값을 그대로 본다 ([[ADR-031]])', () => {
      const emblems = worldEmblems as Record<string, string>
      const challengers = Object.keys(emblems).filter((world) => emblems[world] === 'challengers')
      const others = Object.keys(emblems).filter((world) => emblems[world] !== 'challengers')

      expect(challengers.length).toBeGreaterThan(0)
      expect(challengers.every(isChallengersWorld)).toBe(true)
      expect(others.some(isChallengersWorld)).toBe(false)
      expect(isChallengersWorld('없는월드')).toBe(false)
    })
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

  // 여덟 중 다섯이 치환됐다(step 3 하나 → step 4 가 셋 → step 5 가 `drop-effect-frames` 하나 —
  // 그 컴포넌트를 옮길 때마다 필요한 것이 하나씩 드러났다). 남은 셋은 **쓰기 시작할 때** 같은
  // 처리가 필요하다(에셋 해석을 포트로 뒤집는 것이 제대로 된 답이고, 그건 core 인터페이스를
  // 늘리는 별도 결정이다).
  it('여덟 중 치환된 것은 다섯이다', () => {
    const shimmed = SHIMMED_CORE_MODULES.map(({ core }) => `${core}.ts`)

    expect(KNOWN_GLOB_MODULES.filter((module) => shimmed.includes(module))).toEqual([
      'lib/boss-icons.ts',
      'lib/drop-effect-frames.ts',
      'lib/item-icons.ts',
      'lib/theme-backgrounds.ts',
      'lib/world-emblem.ts',
    ])
    expect(KNOWN_GLOB_MODULES.filter((module) => !shimmed.includes(module))).toEqual([
      'data/feature-guides/index.ts',
      'lib/daily-quest-backgrounds.ts',
      'lib/daily-quest-icons.ts',
    ])
  })
})
