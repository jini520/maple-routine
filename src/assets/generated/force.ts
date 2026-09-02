/**
 * ⚠️ 이 파일은 생성물이다. **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
 *
 * 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs)
 * 무엇: 아케인/어센틱 포스 배지 그림. `lib/force-icons.ts`
 * 원본: src/assets/force/*.{png,webp}
 *
 * 값의 타입은 번들러가 정한다. 웹(Vite)은 URL 문자열, RN(Metro)은 에셋 id 다. 그 차이를
 * 한 줄로 적어 둔 것이 `ImageAssetRef` 이고, 이 파일은 웹·RN 이 **같은 것을 본다**.
 */

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../force/arcane-force.png'
import a1 from '../force/authentic-force.png'

export const FORCE_ASSETS: Record<string, ImageAssetRef> = {
  "arcane-force": a0,
  "authentic-force": a1,
}
