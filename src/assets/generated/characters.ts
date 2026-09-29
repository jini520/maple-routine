/**
 * ⚠️ 이 파일은 생성물이다. **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
 *
 * 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs)
 * 무엇: 캐릭터 그림을 모를 때 서는 자리 그림. `lib/assets/asset-lookup.ts` 의 `unknownCharacterAsset` 이 찾는다
 * 원본: src/assets/characters/*.{png}
 *
 * 값의 타입은 번들러가 정한다. Metro 는 에셋 id(숫자)를 준다. 그것을
 * 한 줄로 적어 둔 것이 `ImageAssetRef` 다.
 */

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../characters/unknown.png'

export const CHARACTER_ASSETS: Record<string, ImageAssetRef> = {
  "unknown": a0,
}
