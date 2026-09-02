/**
 * `image-asset.ts` 의 RN 짝 — **웹 프로그램은 이 파일을 보지 않는다.**
 *
 * Metro 는 `import x from './a.webp'` 를 `AssetRegistry` 에 등록된 **에셋 id(number)** 로 만든다.
 * `<Image source={ref} />` 가 그 숫자를 그대로 받고, 원격 URI 처럼 `{ uri }` 로 감싸지 않는다
 * (감싸면 안 뜬다. 번들 에셋과 원격 이미지는 다른 물건이다).
 *
 * 이 파일이 선택되는 것은 `packages/app-rn/tsconfig.json` 의 `moduleSuffixes: [".native", ""]`
 * 때문이고, 런타임에서는 Metro 와 jest 가 같은 규칙(`.native.*` 우선)으로 고른다. 셋이 **같은
 * 규칙**이라 "타입은 통과하는데 런타임에 죽는" 어긋남이 생길 자리가 없다.
 *
 * ## jest 에서는 숫자가 아니다. 그래도 `number` 로 적는다
 *
 * `@react-native/jest-preset` 의 에셋 트랜스포머가 `{ testUri: '<상대 경로>' }` 를 돌려준다(실측).
 * RN 이 일부러 그렇게 만든 **테스트 대역**이고(스냅샷이 읽히고 안정적이 된다), `<Image source>` 는
 * 둘 다 받는다. 타입은 **앱이 실제로 보는 값**을 적어야 하므로 대역에 맞추지 않는다. 대신 그
 * 사실을 여기 적고, 테스트는 숫자인지 묻는 대신 `testUri` 로 *"어느 파일로 해석됐는가"* 를 본다
 * (그게 이 조회 함수들의 진짜 계약이다).
 */
export type ImageAssetRef = number
