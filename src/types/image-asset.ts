/**
 * 번들에 든 그림 한 장을 가리키는 값.
 *
 * **웹(Vite)에서는 URL 문자열이다** — `<img src={ref}>` 에 그대로 들어가고 CSS `url("…")` 안에도
 * 넣을 수 있다. 이 파일이 그 사실을 적는다.
 *
 * RN(Metro)에서는 같은 import 가 **에셋 id(number)** 로 오고, 짝인 `image-asset.native.ts` 가 그
 * 사실을 적는다. 어느 쪽을 볼지는 tsc 의 `moduleSuffixes` 가 정한다(`packages/app-rn/tsconfig.json`).
 *
 * ## 왜 타입만 가르나
 *
 * 에셋 **목록**(`assets/generated/*.ts`)은 웹·RN 이 한 벌을 함께 쓴다 — 그 파일 안에는 평범한 ESM
 * 에셋 import 만 있고 값이 무엇이 되는지는 번들러가 정하기 때문이다. 그래서 갈라야 하는 것은 목록도
 * 조회 함수도 아니고 **"에셋 참조란 무엇인가" 한 줄**뿐이다.
 *
 * 조회 함수의 이름·인자·`null` 계약은 그대로다 — 반환값이 웹에서 `string | null`
 * 인 것도 그대로다. 바뀌는 것은 RN 에서 그 자리가 `number | null` 이 된다는 것뿐이고, 그건 **두
 * 플랫폼에서 에셋 참조가 실제로 다른 물건이기 때문**이다.
 */
export type ImageAssetRef = string
