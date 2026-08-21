// Vite 전용 API 를 쓰는 core 모듈의 치환 — **이 자리가 조용해지지 않게** 지킨다.
//
// ══ 이 파일의 목적이 한 번 뒤집혔다 ([[ADR-129]]) ═══════════════════════════════════
//
// 원래 사슬은 이랬다:
//   · core 는 에셋 목록을 빌드 타임 글롭(`import.meta.glob`)으로 만든다 — Metro 에 짝이 없어
//     **모듈 평가 시점에** `__ExpoImportMetaRegistry.glob is not a function` 으로 죽었다.
//   · 그래도 타입 검사는 통과해야 해서 `ImportMeta.glob` 앰비언트 선언을 두었다.
//   · 그 선언 때문에 **치환되지 않은 glob 모듈을 import 하면 tsc·lint 는 초록이고 런타임에만 죽었다.**
//   · 그래서 이 파일이 core 의 glob 모듈 **여덟 개 목록을 손으로 고정**해, 하나가 늘면 알게 했다.
//
// [[ADR-129]] 가 목록을 커밋된 생성물로 옮기면서 그 사슬의 **첫 고리가 사라졌다** — core 에 글롭
// 사용처가 0이 되고, 다섯 치환이 전부 필요 없어졌으며, `ImportMeta.glob` 선언도 함께 지웠다.
// 그래서 「전수 목록」테스트는 **「0이어야 한다」로 뒤집는다**: 감시 대상이 없어진 것이 아니라
// *"없는 상태가 유지되는가"* 가 감시 대상이 됐다. 누가 core 에 글롭을 다시 쓰면 여기가 빨개진다
// (그리고 선언이 없으니 tsc 가 먼저 막는다 — 방어가 두 겹이다).
//
// 남은 벽 하나는 `import.meta.env` 다(`features/live-update/store.ts`). 그것은 아직 치환도 대체도
// 없고 **아무도 값으로 import 하지 않아서** 조용한 것이라, 그 사실은 `boot-order.test.tsx` 가 든다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import bossPortraitIconCrops from '@core/data/boss-portrait-icon-crops.json'
import worldEmblems from '@core/data/world-emblems.json'
import { getBossPortraitIconCrop, getBossPortraitUrl } from '@core/lib/boss-icons'
import { DROP_EFFECT_FRAMES } from '@core/lib/drop-effect-frames'
import { getItemIconUrl, getItemIconUrlByFile } from '@core/lib/item-icons'
import { getThemeBackgroundUrl } from '@core/lib/theme-backgrounds'
import { DEFAULT_THEME, getThemeDefinition } from '@core/lib/theme-registry'
import { isChallengersWorld, worldEmblemUrl } from '@core/lib/world-emblem'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SHIMMED_CORE_MODULES } = require('../../core-shims') as {
  SHIMMED_CORE_MODULES: { core: string; shim: string; why: string }[]
}

const CORE_SRC = path.resolve(__dirname, '../../core')

/** `core/` 아래 `.ts`/`.tsx` 를 전부 훑는다(테스트 파일은 제품 코드가 아니라 제외). */
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
  // 비어 있다는 것을 **적어 두는** 것이 요점이다. 표가 사라진 것이 아니라 지금 채울 것이 없는
  // 상태이고(`core-shims.js` 파일 머리 — `import.meta.env` 벽이 남아 있다), 누가 하나를 더하면
  // 여기가 빨개져 그 사실이 리뷰에 올라온다.
  it('지금은 치환하는 core 모듈이 없다', () => {
    expect(SHIMMED_CORE_MODULES).toEqual([])
  })

  // 표가 비어도 **배선은 살아 있어야 한다** — 다음에 하나를 더할 때 Metro·jest 양쪽이 그대로
  // 집도록. 규칙이 한 벌인지(둘이 갈라지지 않았는지)를 형태로 확인한다.
  it('그래도 Metro·jest 가 같은 표를 읽는 배선은 남아 있다', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shims = require('../../core-shims') as {
      resolveCoreShim: (request: string) => string | undefined
      coreShimModuleNameMapper: () => Record<string, string>
    }

    expect(typeof shims.resolveCoreShim).toBe('function')
    expect(shims.resolveCoreShim('@core/lib/boss-icons')).toBeUndefined()
    expect(shims.coreShimModuleNameMapper()).toEqual({})
  })

  it('`theme-registry` 를 그냥 평가할 수 있다(치환 없이)', () => {
    expect(getThemeDefinition(DEFAULT_THEME).mode).toBe('light')
  })
})

// 3단계가 *"에셋 레이어가 오면 여기가 바뀐다"* 고 적어 둔 자리들이다. 그 레이어가 [[ADR-129]] 다.
describe('에셋이 RN 번들에 들어왔다', () => {
  /**
   * 에셋 참조가 **어느 파일로 해석됐는지** 읽는다.
   *
   * 앱에서 이 값은 Metro 의 에셋 id(숫자)지만, jest 에서는 RN 프리셋이 `{ testUri }` 라는 테스트
   * 대역을 준다(`types/image-asset.native.ts`). 그래서 *"숫자인가"* 를 묻는 대신 대역이 알려주는
   * 경로를 본다 — 조회 함수의 진짜 계약은 타입이 아니라 **슬러그 → 그 파일**이다.
   */
  function resolvedFile(ref: unknown): string {
    // jest 의 `expect` 는 vitest 와 달리 메시지 인자를 안 받는다 — 그래서 직접 던진다.
    const uri = (ref as { testUri?: string } | null)?.testUri
    if (uri === undefined) throw new Error(`에셋이 해석되지 않았다: ${JSON.stringify(ref)}`)
    return uri.slice(uri.lastIndexOf('/') + 1)
  }

  it.each([
    ['보스 일러스트', (): unknown => getBossPortraitUrl('lucid'), 'lucid.webp'],
    ['월드 엠블럼', (): unknown => worldEmblemUrl('엘리시움'), 'elysium.png'],
    // 이름 → `iconFile` → 파일 사슬이 통째로 도는지 본다([[ADR-011]] 결정 6 · [[ADR-041]]).
    ['아이템 아이콘(이름)', (): unknown => getItemIconUrl('흑옥의 보스 반지 상자'), 'boss_ring_box_black.png'],
    ['아이템 아이콘(파일명)', (): unknown => getItemIconUrlByFile('Limit_Ring.webp'), 'Limit_Ring.webp'],
    ['테마 배경', (): unknown => getThemeBackgroundUrl('blackmage-background'), 'blackmage-background.webp'],
  ])('%s 이 그 슬러그의 파일로 해석된다', (_label, resolve, file) => {
    expect(resolvedFile(resolve())).toBe(file)
  })

  // 없는 것은 여전히 `null` 이다 — 폴백 경로(보스 초상 `?` 원 · 아이템 회색 원 · 엠블럼 생략)는
  // 사라진 것이 아니라 **매핑에 없을 때만** 타는 원래 자리로 돌아갔다.
  it.each([
    ['보스 일러스트', (): unknown => getBossPortraitUrl('없는보스')],
    ['월드 엠블럼', (): unknown => worldEmblemUrl('없는월드')],
    ['아이템 아이콘', (): unknown => getItemIconUrl('없는아이템')],
    ['테마 배경', (): unknown => getThemeBackgroundUrl('없는배경')],
  ])('%s — 매핑에 없으면 그대로 null 이다', (_label, resolve) => {
    expect(resolve()).toBeNull()
  })

  // 네 단계가 전부 차 있어야 재생 엔진(step 7 이 못 쓴 그것)을 쓸 수 있다([[ADR-038]]).
  // 개수와 순서를 지키는 것은 core 쪽 생성물 테스트이고, 여기서는 **RN 번들에 도착했는가**만 본다.
  it('고가 드롭 연출 프레임이 네 단계 모두 들어왔다', () => {
    for (const phase of ['screen', 'pre', 'loop', 'end'] as const) {
      expect(DROP_EFFECT_FRAMES[phase].length).toBeGreaterThan(0)
      // 배열 인덱스 = 프레임 번호여야 재생 엔진이 성립한다(순서 자체는 core 쪽 생성물 테스트가 본다).
      expect(resolvedFile(DROP_EFFECT_FRAMES[phase][0])).toMatch(/^0\./)
    }
  })
})

// 반대쪽 — 에셋이 아닌 것은 예전에도 지금도 그대로다. 기대값은 손으로 적지 않고 같은 JSON 에서
// 뽑는다([[ADR-006]] · `render-atom.tsx` 와 같은 규칙).
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

describe('core 에 Vite 전용 글롭이 남아 있지 않다', () => {
  // **0이어야 한다**(파일 머리). 하나라도 생기면 그 모듈은 Metro 에서 평가 즉시 죽으므로, 그때는
  // 치환 표를 채우거나 — 더 나은 답으로 — 목록을 [[ADR-129]] 의 생성물로 옮겨야 한다.
  //
  // 문자열을 쪼개 두는 이유: 이 파일 자신이 검사 대상 디렉터리 밖에 있어 걸리진 않지만, 같은
  // 리터럴을 core 쪽 주석에 적었다가 **주석 때문에 빨개지는** 일이 실제로 있었다(생성기 명세 파일).
  const GLOB_API = ['import.meta', 'glob'].join('.')

  it('글롭을 쓰는 core 소스가 0개다', () => {
    const found = coreSourceFiles(CORE_SRC)
      .filter((relative) => readFileSync(path.join(CORE_SRC, relative), 'utf8').includes(GLOB_API))
      .sort()

    expect(found).toEqual([])
  })
})
