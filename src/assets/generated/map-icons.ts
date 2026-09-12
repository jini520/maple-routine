/**
 * ⚠️ 이 파일은 생성물이다. **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
 *
 * 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs)
 * 무엇: 지역 아이콘. `lib/daily-quest-icons.ts`(배경과 같은 슬러그를 쓴다)
 * 원본: src/assets/maps/icons/*.{png,webp}
 *
 * 값의 타입은 번들러가 정한다. Metro 는 에셋 id(숫자)를 준다. 그것을
 * 한 줄로 적어 둔 것이 `ImageAssetRef` 다.
 */

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../maps/icons/Arcs.webp'
import a1 from '../maps/icons/anglerCompany.png'
import a2 from '../maps/icons/arcana.webp'
import a3 from '../maps/icons/arteria.webp'
import a4 from '../maps/icons/aurumRegis.webp'
import a5 from '../maps/icons/carcion.webp'
import a6 from '../maps/icons/cernium.webp'
import a7 from '../maps/icons/chewChew.webp'
import a8 from '../maps/icons/critias.webp'
import a9 from '../maps/icons/dowonkyung.webp'
import a10 from '../maps/icons/esfera.webp'
import a11 from '../maps/icons/fallenWorldTree.webp'
import a12 from '../maps/icons/geardrak.webp'
import a13 from '../maps/icons/haven.webp'
import a14 from '../maps/icons/highMountain.png'
import a15 from '../maps/icons/lacheln.webp'
import a16 from '../maps/icons/limen.webp'
import a17 from '../maps/icons/monsterPark.png'
import a18 from '../maps/icons/moonBridge.webp'
import a19 from '../maps/icons/morass.webp'
import a20 from '../maps/icons/muruengRaid.webp'
import a21 from '../maps/icons/nightmareParadise.png'
import a22 from '../maps/icons/odium.webp'
import a23 from '../maps/icons/roadOfVanishing.webp'
import a24 from '../maps/icons/tallahart.webp'
import a25 from '../maps/icons/theLabyrinthOfSuffering.webp'

export const DAILY_QUEST_ICON_ASSETS: Record<string, ImageAssetRef> = {
  "Arcs": a0,
  "anglerCompany": a1,
  "arcana": a2,
  "arteria": a3,
  "aurumRegis": a4,
  "carcion": a5,
  "cernium": a6,
  "chewChew": a7,
  "critias": a8,
  "dowonkyung": a9,
  "esfera": a10,
  "fallenWorldTree": a11,
  "geardrak": a12,
  "haven": a13,
  "highMountain": a14,
  "lacheln": a15,
  "limen": a16,
  "monsterPark": a17,
  "moonBridge": a18,
  "morass": a19,
  "muruengRaid": a20,
  "nightmareParadise": a21,
  "odium": a22,
  "roadOfVanishing": a23,
  "tallahart": a24,
  "theLabyrinthOfSuffering": a25,
}
