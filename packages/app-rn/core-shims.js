// `packages/core` 의 일부 모듈을 **RN 쪽 구현으로 갈아끼우는 표**. Metro 와 jest 가 같은 표를 읽는다.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────────────
//
// core 는 Vite 를 전제로 쓰여 있고, 에셋 목록을 `import.meta.glob` 로 만든다(`lib/theme-backgrounds.ts`
// 외 6개). 그것은 **번들러의 컴파일 타임 API** 라 Metro 에는 짝이 없다 — Expo 가 `import.meta` 자체는
// 채워 주지만 `glob` 은 없어서 모듈을 **평가하는 순간** 이렇게 죽는다(실측 2026-08-11):
//
//     TypeError: globalThis.__ExpoImportMetaRegistry.glob is not a function
//
// 그래서 `@core/lib/theme-registry` 를 import 하는 것만으로 RN 이 부팅에 실패한다(그 파일이
// `./theme-backgrounds` 를 부른다). 테마 시스템은 `getThemeDefinition`·`DEFAULT_THEME` 을 그 레지스트리
// 에서 가져와야 하므로([[ADR-064]] 결정 10 — "개별 파일을 손으로 동기화하지 않는다") 피해 갈 수 없다.
//
// ── 왜 core 를 안 고치는가 ─────────────────────────────────────────────────────────
//
// core 는 `app-capacitor` 와 공유되고 그쪽은 지금 배포 중이다([[ADR-127]] 원칙 3). 에셋 해석을 포트로
// 뒤집는 것이 제대로 된 답이지만 그건 core 의 인터페이스를 늘리는 일이라 별도 결정이다. 그때까지는
// **앱이 자기 번들러에게 대체 모듈을 알려주는** 방식으로 둔다 — core 는 한 글자도 안 바뀐다.
//
// ── 한 벌로 두는 이유 ─────────────────────────────────────────────────────────────
//
// Metro 와 jest 에 같은 표를 따로 적으면 "앱은 도는데 테스트만 죽는"(또는 반대) 어긋남이 조용히 생긴다.
// `nativewind.config.js` 를 두 곳이 공유하는 것과 같은 판단이고, 그래서 판정 로직도 여기 하나뿐이다 —
// 두 도구가 **완전히 같은 규칙**으로 갈아끼운다.
//
// `.js`(CJS)인 이유: `metro.config.js`·`jest.config.js` 가 CJS 라 `require` 로 읽어야 한다.

const path = require('node:path')

/**
 * 갈아끼우는 모듈 목록.
 *
 * `core` 는 `packages/core/src/` 기준 경로, `shim` 은 이 패키지 기준 경로다. 하나를 더할 때는
 * **왜** 갈아끼우는지를 `why` 에 적는다 — 나중에 포트로 뒤집을 때 그 목록이 곧 작업 명세가 된다.
 */
const SHIMMED_CORE_MODULES = [
  {
    core: 'lib/theme-backgrounds',
    shim: 'src/lib/rn-theme-backgrounds.ts',
    why: 'import.meta.glob 으로 테마 배경 에셋 목록을 만든다 — Metro 에 짝이 없다.',
  },
  {
    core: 'lib/boss-icons',
    shim: 'src/lib/rn-boss-icons.ts',
    why: 'import.meta.glob 으로 보스 일러스트 목록을 만든다. 크롭 두 표(JSON)는 대체 구현이 그대로 답하고 URL 만 null 이다.',
  },
  {
    core: 'lib/world-emblem',
    shim: 'src/lib/rn-world-emblem.ts',
    why: 'import.meta.glob 으로 월드 엠블럼 목록을 만든다. isChallengersWorld(JSON 판정)는 그대로 살고 URL 만 null 이다.',
  },
  {
    core: 'lib/item-icons',
    shim: 'src/lib/rn-item-icons.ts',
    why: 'import.meta.glob 으로 아이템 아이콘 목록을 만든다 — 모듈 전체가 이름→파일→URL 한 사슬이라 URL 이 없으면 남는 것이 없다.',
  },
]

/**
 * 한 모듈이 요청될 수 있는 두 형태.
 *
 * - `./theme-backgrounds` — **core 안에서** 상대 경로로 부르는 형태(`theme-registry.ts` 가 이렇게 부른다).
 *   tsconfig `paths` 로는 못 잡는다(상대 경로는 `paths` 를 타지 않는다).
 * - `@core/lib/theme-backgrounds` — 앱이 직접 부르는 형태.
 *
 * 상대 형태를 출처(origin) 확인 없이 잡는 것은 의도적이다 — 그래야 Metro(출처를 안다)와
 * jest 의 `moduleNameMapper`(출처를 모른다)가 **같은 규칙**으로 돈다. 이 패키지에 같은 이름의
 * 모듈을 두지 않으면 충돌하지 않으므로, 대체 구현 이름에 `rn-` 을 붙인다.
 */
function requestForms(coreModule) {
  const basename = coreModule.slice(coreModule.lastIndexOf('/') + 1)
  return [`./${basename}`, `@core/${coreModule}`]
}

const SHIM_BY_REQUEST = new Map(
  SHIMMED_CORE_MODULES.flatMap(({ core, shim }) =>
    requestForms(core).map((request) => [request, path.join(__dirname, shim)]),
  ),
)

/** 갈아끼울 대상이면 대체 파일의 절대 경로, 아니면 `undefined`. Metro 가 쓴다. */
function resolveCoreShim(moduleName) {
  return SHIM_BY_REQUEST.get(moduleName)
}

/** 같은 표를 jest 의 `moduleNameMapper` 형태로 낸다(키가 정규식이라 통째로 이스케이프한다). */
function coreShimModuleNameMapper() {
  return Object.fromEntries(
    [...SHIM_BY_REQUEST].map(([request, file]) => [
      `^${request.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      file,
    ]),
  )
}

module.exports = {
  SHIMMED_CORE_MODULES,
  coreShimModuleNameMapper,
  resolveCoreShim,
}
