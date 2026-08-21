/**
 * 소스가 쓰는 **Vite 전용 `import.meta` 확장의 타입 선언만**.
 *
 * ## 왜 필요한가
 *
 * `features/live-update/store.ts` 가 모듈 최상위에서 `import.meta.env` 를 읽는다. 그 스토어의 타입을
 * 가져오는 화면이 있으므로 tsc 가 그 파일을 검사하는데, 이 프로젝트엔 `vite/client` 타입이 없어
 * `Property '…' does not exist on type 'ImportMeta'` 로 죽는다.
 *
 * `vite/client` 를 `types` 에 넣는 안은 기각했다 — RN 앱이 Vite 의 앰비언트 타입 **전부**(`*.svg`
 * 모듈 선언·`ImportMetaEnv` …)를 들이게 되고, 그중 어느 것이 RN 에서 사실이 아닌지 구분이 안 된다.
 * 필요한 것은 아래 한 시그니처뿐이다.
 *
 * ## `glob` 선언은 [[ADR-129]] 에서 없앴다
 *
 * 에셋 목록이 빌드 타임 `import.meta.glob` 에서 **커밋된 생성물**로 바뀌면서 glob 사용처가
 * 0이 됐다. 선언을 남겨 두면 *"쓰면 타입은 통과하고 런타임에 죽는"* 함정이 그대로 살아 있으므로
 * 함께 지운다 — 이제 제품 코드에서 `import.meta.glob` 을 쓰면 **tsc 가 먼저 막는다.**
 * 그 자리를 지키던 전수 목록 테스트는 "0이어야 한다"로 뒤집혀
 * `src/__tests__/vite-only-api-policy.test.ts` 에 산다([[ADR-155]]).
 */
interface ImportMeta {
  /**
   * Vite 가 빌드 시점에 치환하는 환경 변수 — **`glob` 만이 Vite 전용 API 가 아니었다**(4단계 step 0).
   *
   * 이것을 쓰는 곳은 `src/features/live-update/store.ts` 한 곳이고, **모듈 최상위**에서
   * `VITE_LIVE_UPDATE_CHANNEL` 을 읽는다([[ADR-024]] 빌드 시점 채널 분리). 그 스토어의 타입을
   * 가져오려면(`app/UpdatePromptModal.tsx` 가 상태 아홉을 두 벌로 만들지 않으려고 `import type`
   * 한다) 이 선언이 있어야 tsc 가 그 파일을 검사할 수 있다.
   *
   * **`glob` 과 똑같이, 이 선언도 사실이 아니다.** RN 런타임에서 `import.meta.env` 는 `undefined`
   * 라, 그 스토어를 값으로 import 하면 그 자리에서 `TypeError` 로 죽는다(실측 2026-08-12).
   * 그래서 앱 코드에서 `import.meta.env` 를 쓰면 안 된다 — 빌드 시점 값이 필요하면
   * `process.env.EXPO_PUBLIC_*`(`native/adapters/rn-ads.ts` 가 쓰는 방식)이다.
   * 이 사실은 `src/__tests__/boot-order.test.tsx` 가 계약으로 들고 있다.
   */
  readonly env: Record<string, string | undefined>
}
