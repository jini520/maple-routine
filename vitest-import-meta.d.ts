/**
 * **vitest 프로그램에만** 켜는 `import.meta.glob` 선언(`tsconfig.vitest.json` 이 이 파일을 include
 * 한다). 앱 프로그램(`tsconfig.json`)은 이것을 안 본다.
 *
 * ## 왜 전역에 두지 않는가
 *
 * [[ADR-129]] 가 에셋 목록을 빌드 타임 `import.meta.glob` 에서 **커밋된 생성물**로 바꾸면서 core 의
 * 제품 코드에서 glob 사용처가 0이 됐고, 그 선언까지 함께 지웠다 — 남겨 두면 *"쓰면 타입은 통과하고
 * RN 런타임에 죽는"* 함정이 그대로 산다(`core-import-meta.d.ts` 에 그 판단이 적혀 있다).
 *
 * 그런데 **vitest 테스트에서는 그 API 가 사실이다** — 그쪽은 Vite 위에서 돈다. 그래서 선언을 없애는
 * 대신 **프로그램을 갈랐다**([[ADR-155]] 결정 6). 지금 이것을 쓰는 곳은 한 곳이다:
 * `core/data/__tests__/feature-guides.test.ts` 가 안내 파일 목록과 `index.ts` 가 어긋나지 않는지
 * 폴더를 훑어 대조한다.
 *
 * 종전에는 `tsconfig.base.json` 의 `types: ["vite/client"]` 가 이 자리를 메웠다. 그것을 그대로
 * 되살리지 않은 이유는 Vite 의 앰비언트 타입이 에셋 모듈을 `string`(URL)으로 선언해서다 — RN 은
 * 같은 import 가 `number`(모듈 id)라, 켜는 순간 `core/assets/generated/*.ts` 가 통째로 빨개진다.
 */
interface ImportMeta {
  glob<T = unknown>(pattern: string, options: { eager: true }): Record<string, T>
}
