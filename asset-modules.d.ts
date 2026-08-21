/**
 * 그림 파일 import 의 **타입 선언** ([[ADR-129]]).
 *
 * `packages/core/src/assets/generated/*.ts` 는 `import a0 from '../worlds/nova.png'` 처럼 에셋을
 * 그냥 import 한다 — 웹은 `vite/client` 가 그 모듈을 `string`(URL)으로 선언해 주지만, 이 패키지에는
 * `vite/client` 가 없고 Expo·RN 도 이미지 모듈 선언을 주지 않는다. 없으면 `Cannot find module` 이다.
 *
 * **값이 `number` 인 것이 요점이다.** Metro 는 에셋을 `AssetRegistry` 에 등록하고 그 **id** 를
 * 돌려준다(`<Image source={id} />`). 그래서 이 선언은 `types/image-asset.native.ts` 의
 * `ImageAssetRef = number` 와 짝이고, 둘이 어긋나면 생성물이 타입 에러로 **시끄럽게** 깨진다.
 *
 * jest 는 값이 다르다 — RN 프리셋의 에셋 트랜스포머가 `{ testUri }` 라는 **테스트 대역**을 낸다.
 * 타입은 앱이 보는 값을 적는 것이라 대역에 맞추지 않는다(자세한 이유는 `image-asset.native.ts`).
 *
 * `core-import-meta.d.ts` 와 달리 이 선언은 **사실이다.** 그 파일은 RN 에 없는 API 를 타입 검사만
 * 통과시키려고 적은 것이지만, 이쪽은 Metro 가 실제로 그렇게 동작한다.
 */
declare module '*.png' {
  const asset: number
  export default asset
}

declare module '*.webp' {
  const asset: number
  export default asset
}

declare module '*.jpg' {
  const asset: number
  export default asset
}
