// `packages/core` 의 일부 모듈을 **RN 쪽 구현으로 갈아끼우는 표**. Metro 와 jest 가 같은 표를 읽는다.
//
// ── 지금 이 표는 비어 있다 ────────────────────────────────────────────────────────
//
// 원래 이 자리를 채우던 다섯은 전부 **에셋 목록을 `import.meta.glob` 으로 만드는** core 모듈이었다
// (`theme-backgrounds`·`boss-icons`·`world-emblem`·`item-icons`·`drop-effect-frames`). 그것은
// 번들러의 컴파일 타임 API 라 Metro 에 짝이 없어, 모듈을 **평가하는 순간** 이렇게 죽었다:
//
//     TypeError: globalThis.__ExpoImportMetaRegistry.glob is not a function
//
// [[ADR-129]] 가 그 목록을 **빌드 타임이 아니라 커밋 타임에** 만들기로 하면서 glob 자체가 저장소에서
// 사라졌고, 그래서 다섯 모듈이 웹·RN 양쪽에서 그대로 돈다 — 치환할 것이 없어졌다.
//
// ── 그런데도 이 파일을 지우지 않는 이유 ───────────────────────────────────────────
//
// **벽이 하나 더 남아 있다.** `import.meta.env` 도 Vite 전용이고(`features/live-update/store.ts` 가
// 모듈 최상위에서 `VITE_LIVE_UPDATE_CHANNEL` 을 읽는다 — [[ADR-024]]), RN 런타임에서 `import.meta.env`
// 는 `undefined` 라 그 스토어를 **값으로 import 하면 그 자리에서 죽는다**(4단계 step 0 실측). 지금은
// 아무도 값으로 import 하지 않아 조용하지만, OTA 를 이을 때([[ADR-128]] 결정 7) 이 표가 그 자리를
// 맡을 가능성이 크다. 배선(Metro `resolveRequest` + jest `moduleNameMapper`)을 지웠다 다시 만드는
// 것보다, 표를 비워 두고 **비어 있다는 사실을 테스트로 적어 두는** 편이 정직하다.
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
 * 갈아끼우는 모듈 목록 — **지금은 비어 있다**(파일 머리).
 *
 * `core` 는 `packages/core/src/` 기준 경로, `shim` 은 이 패키지 기준 경로다. 하나를 더할 때는
 * **왜** 갈아끼우는지를 `why` 에 적는다 — 나중에 되돌릴 때 그 목록이 곧 작업 명세가 된다.
 *
 * 그리고 더하기 전에 한 번 물어라: **core 를 고쳐서 두 번들러가 같은 파일을 볼 수는 없는가.**
 * [[ADR-129]] 가 다섯을 한꺼번에 걷어낸 방법이 그것이었고, 치환은 그것이 불가능할 때의 차선이다.
 */
const SHIMMED_CORE_MODULES = []

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
