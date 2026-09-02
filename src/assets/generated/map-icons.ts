// ⚠️ 이 파일은 생성물이다. **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
//
// 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs)
// 무엇: 지역 아이콘. `lib/daily-quest-icons.ts`(배경과 같은 슬러그를 쓴다)
// 원본: src/assets/maps/icons/*.{png,webp}
//
// 값의 타입은 번들러가 정한다. 웹(Vite)은 URL 문자열, RN(Metro)은 에셋 id 다. 그 차이를
// 한 줄로 적어 둔 것이 `ImageAssetRef` 이고, 이 파일은 웹·RN 이 **같은 것을 본다**.

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../maps/icons/Arcs.webp'
import a1 from '../maps/icons/anglerCompany.png'
import a2 from '../maps/icons/arcana.webp'
import a3 from '../maps/icons/arteria.webp'
import a4 from '../maps/icons/carcion.webp'
import a5 from '../maps/icons/cernium.webp'
import a6 from '../maps/icons/chewChew.webp'
import a7 from '../maps/icons/critias.webp'
import a8 from '../maps/icons/dowonkyung.webp'
import a9 from '../maps/icons/esfera.webp'
import a10 from '../maps/icons/fallenWorldTree.webp'
import a11 from '../maps/icons/geardrak.webp'
import a12 from '../maps/icons/haven.webp'
import a13 from '../maps/icons/highMountain.png'
import a14 from '../maps/icons/lacheln.webp'
import a15 from '../maps/icons/limen.webp'
import a16 from '../maps/icons/monsterPark.png'
import a17 from '../maps/icons/moonBridge.webp'
import a18 from '../maps/icons/morass.webp'
import a19 from '../maps/icons/muruengRaid.webp'
import a20 from '../maps/icons/nightmareParadise.png'
import a21 from '../maps/icons/odium.webp'
import a22 from '../maps/icons/roadOfVanishing.webp'
import a23 from '../maps/icons/tallahart.webp'
import a24 from '../maps/icons/theLabyrinthOfSuffering.webp'

export const DAILY_QUEST_ICON_ASSETS: Record<string, ImageAssetRef> = {
  "Arcs": a0,
  "anglerCompany": a1,
  "arcana": a2,
  "arteria": a3,
  "carcion": a4,
  "cernium": a5,
  "chewChew": a6,
  "critias": a7,
  "dowonkyung": a8,
  "esfera": a9,
  "fallenWorldTree": a10,
  "geardrak": a11,
  "haven": a12,
  "highMountain": a13,
  "lacheln": a14,
  "limen": a15,
  "monsterPark": a16,
  "moonBridge": a17,
  "morass": a18,
  "muruengRaid": a19,
  "nightmareParadise": a20,
  "odium": a21,
  "roadOfVanishing": a22,
  "tallahart": a23,
  "theLabyrinthOfSuffering": a24,
}
