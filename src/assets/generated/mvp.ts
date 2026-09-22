/**
 * ⚠️ 이 파일은 생성물이다. **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
 *
 * 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs)
 * 무엇: MVP 등급 명패. `lib/assets/asset-lookup.ts` 의 `mvpPlateAsset` 이 등급 key 로 찾는다. 일반은 그림이 없다
 * 원본: src/assets/mvp/*.{webp}
 *
 * 값의 타입은 번들러가 정한다. Metro 는 에셋 id(숫자)를 준다. 그것을
 * 한 줄로 적어 둔 것이 `ImageAssetRef` 다.
 */

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../mvp/black.webp'
import a1 from '../mvp/bronze.webp'
import a2 from '../mvp/diamond.webp'
import a3 from '../mvp/gold.webp'
import a4 from '../mvp/red.webp'
import a5 from '../mvp/silver.webp'

export const MVP_PLATE_ASSETS: Record<string, ImageAssetRef> = {
  "black": a0,
  "bronze": a1,
  "diamond": a2,
  "gold": a3,
  "red": a4,
  "silver": a5,
}
