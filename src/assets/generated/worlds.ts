// ⚠️ 이 파일은 생성물이다. **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
//
// 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs)
// 무엇: 월드 엠블럼 — `lib/world-emblem.ts` 가 `world-emblems.json` 의 basename 으로 찾는다
// 원본: src/assets/worlds/*.{png,webp}
//
// 값의 타입은 번들러가 정한다. 웹(Vite)은 URL 문자열, RN(Metro)은 에셋 id 다. 그 차이를
// 한 줄로 적어 둔 것이 `ImageAssetRef` 이고, 이 파일은 웹·RN 이 **같은 것을 본다**.

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../worlds/arcane.png'
import a1 from '../worlds/aurora.png'
import a2 from '../worlds/bera.png'
import a3 from '../worlds/challengers.png'
import a4 from '../worlds/croa.png'
import a5 from '../worlds/elysium.png'
import a6 from '../worlds/enosis.png'
import a7 from '../worlds/eos.png'
import a8 from '../worlds/helios.png'
import a9 from '../worlds/luna.png'
import a10 from '../worlds/nova.png'
import a11 from '../worlds/red.png'
import a12 from '../worlds/scania.png'
import a13 from '../worlds/union.png'
import a14 from '../worlds/zenith.png'

export const WORLD_EMBLEM_ASSETS: Record<string, ImageAssetRef> = {
  "arcane": a0,
  "aurora": a1,
  "bera": a2,
  "challengers": a3,
  "croa": a4,
  "elysium": a5,
  "enosis": a6,
  "eos": a7,
  "helios": a8,
  "luna": a9,
  "nova": a10,
  "red": a11,
  "scania": a12,
  "union": a13,
  "zenith": a14,
}
