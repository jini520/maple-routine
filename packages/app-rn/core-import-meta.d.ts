/**
 * `import.meta.glob` 의 **타입 선언만** — `core-shims.js` 의 런타임 치환과 짝이다.
 *
 * ## 왜 필요한가
 *
 * `tsc` 는 상대 import 를 `paths` 로 못 돌리므로(그리고 번들러 치환도 모르므로) `@core/lib/theme-registry`
 * 를 타입 검사하면 core 의 **원본** `theme-backgrounds.ts` 까지 따라 들어간다. 그 파일은 Vite 의
 * 컴파일 타임 API 를 쓰는데 이 패키지에는 `vite/client` 타입이 없어 이렇게 죽는다:
 *
 *     error TS2339: Property 'glob' does not exist on type 'ImportMeta'.
 *
 * `vite/client` 를 `types` 에 넣는 안은 기각했다 — RN 앱이 Vite 의 앰비언트 타입 **전부**(`*.svg`
 * 모듈 선언·`ImportMetaEnv` …)를 들이게 되고, 그중 어느 것이 RN 에서 사실이 아닌지 구분이 안 된다.
 * 필요한 것은 딱 이 한 시그니처다.
 *
 * ## 이 선언이 사실이 아니라는 점을 분명히 해 둔다
 *
 * RN 런타임에는 `import.meta.glob` 이 **없다**(Expo 가 채우는 `import.meta` 에는 `glob` 이 없어 부르면
 * 던진다). 그래서 이것은 *"RN 에서 이 API 를 쓸 수 있다"* 는 선언이 아니라 **"core 의 소스를 타입
 * 검사할 수 있게 하는 선언"** 이다. 실제로 평가되지 않도록 막는 것은 `core-shims.js` 의 모듈 치환이고,
 * **치환되지 않은 glob 모듈을 import 하면 타입은 통과하고 런타임에 죽는다** — 그 함정이 조용히
 * 남지 않도록 `src/__tests__/core-shims.test.ts` 가 core 의 glob 모듈 전수 목록을 고정한다.
 */
interface ImportMeta {
  // `query` 는 step 4 에서 더했다 — `lib/world-emblem.ts` 가 `query: '?url'` 를 쓰는데, 그 파일이
  // molecules 를 통해 타입 그래프에 들어오면서 드러났다. 옵션을 좁게 적어 둘수록 이렇게 **core 가
  // 실제로 쓰는 형태**가 하나씩 밝혀진다(넓게 `any` 로 열면 그 정보가 사라진다).
  glob(
    pattern: string,
    options?: { eager?: boolean; import?: string; query?: string },
  ): Record<string, unknown>

  /**
   * Vite 가 빌드 시점에 치환하는 환경 변수 — **`glob` 만이 Vite 전용 API 가 아니었다**(4단계 step 0).
   *
   * core 에서 이것을 쓰는 곳은 `features/live-update/store.ts` 한 곳이고, **모듈 최상위**에서
   * `VITE_LIVE_UPDATE_CHANNEL` 을 읽는다([[ADR-024]] 빌드 시점 채널 분리). 그 스토어의 타입을
   * 가져오려면(`app/UpdatePromptModal.tsx` 가 상태 아홉을 두 벌로 만들지 않으려고 `import type`
   * 한다) 이 선언이 있어야 tsc 가 core 원본을 검사할 수 있다.
   *
   * **`glob` 과 똑같이, 이 선언도 사실이 아니다.** RN 런타임에서 `import.meta.env` 는 `undefined`
   * 라, 그 스토어를 값으로 import 하면 그 자리에서 `TypeError` 로 죽는다(실측 2026-08-12).
   * 그래서 앱 코드에서 `import.meta.env` 를 쓰면 안 된다 — 빌드 시점 값이 필요하면
   * `process.env.EXPO_PUBLIC_*`(`native/adapters/rn-ads.ts` 가 쓰는 방식)이다.
   * 이 사실은 `src/__tests__/core-shims.test.ts` 가 계약으로 들고 있다.
   */
  readonly env: Record<string, string | undefined>
}
