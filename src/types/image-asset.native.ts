/**
 * `image-asset.ts` 의 RN 짝. 번들 그림은 에셋 id(`number`)이고 받은 그림은 `DownloadedImage` 다.
 *
 * Metro 는 `import x from './a.webp'` 를 `AssetRegistry` 에 등록된 에셋 id 로 만든다.
 * `<Image source={ref} />` 가 그 숫자를 그대로 받는다. **원격 URI 처럼 `{ uri }` 로 감싸지 말 것.**
 * 감싸면 안 뜬다. 번들 에셋과 원격 이미지는 다른 물건이다.
 *
 * jest 에서는 실제 값이 `{ testUri: … }` 지만 그래도 `number` 로 적는다. RN 이 일부러 만든 테스트
 * 대역이고, 타입을 그쪽에 맞추면 제품 코드가 테스트 사정을 알게 된다.
 */
export type ImageAssetRef = number | DownloadedImage

/**
 * 서버에서 받아 기기에 둔 그림. 가로 · 세로는 서버 목록의 픽셀이다.
 *
 * `Image.resolveAssetSource` 가 이 객체를 그대로 돌려주므로, 번들 그림의 크기를 읽던 크롭 · 종횡비 계산이 같은 길로
 * 받은 그림의 크기를 읽는다.
 */
export interface DownloadedImage {
  uri: string
  width: number
  height: number
}
