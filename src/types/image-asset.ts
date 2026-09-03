/**
 * 번들에 든 그림 한 장을 가리키는 값의 타입.
 *
 * RN(Metro)에서는 같은 import 가 **에셋 id(number)** 로 오고 짝인 `image-asset.native.ts` 가 그
 * 사실을 적는다. 어느 쪽을 볼지는 tsc 의 `moduleSuffixes` 가 정한다.
 *
 * 갈라야 하는 것은 목록도 조회 함수도 아니고 **에셋 참조란 무엇인가 한 줄**뿐이다. 에셋 목록
 * (`assets/generated/*.ts`)에는 평범한 ESM import 만 있고 값이 무엇이 되는지는 번들러가 정한다.
 */
export type ImageAssetRef = string
