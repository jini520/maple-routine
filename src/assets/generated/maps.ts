/**
 * ⚠️ 이 파일은 생성물이다. **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
 *
 * 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs)
 * 무엇: 일일/주간 콘텐츠 카드 지역 배경. `lib/daily-quest-backgrounds.ts`
 * 원본: src/assets/maps/*.{webp,jpg,png}
 *
 * 값의 타입은 번들러가 정한다. Metro 는 에셋 id(숫자)를 준다. 그것을
 * 한 줄로 적어 둔 것이 `ImageAssetRef` 다.
 */

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../maps/Arcs.webp'
import a1 from '../maps/arcana.webp'
import a2 from '../maps/arteria.webp'
import a3 from '../maps/aurumRegis.webp'
import a4 from '../maps/carcion.webp'
import a5 from '../maps/cernium.webp'
import a6 from '../maps/chewChew.webp'
import a7 from '../maps/critias.webp'
import a8 from '../maps/dowonkyung.webp'
import a9 from '../maps/esfera.webp'
import a10 from '../maps/fallenWorldTree.webp'
import a11 from '../maps/flagRace.jpg'
import a12 from '../maps/geardrak.webp'
import a13 from '../maps/hallOfHeroes.webp'
import a14 from '../maps/haven.webp'
import a15 from '../maps/lacheln.webp'
import a16 from '../maps/limen.webp'
import a17 from '../maps/monsterPark.webp'
import a18 from '../maps/moonBridge.webp'
import a19 from '../maps/morass.webp'
import a20 from '../maps/muruengRaid.webp'
import a21 from '../maps/odium.webp'
import a22 from '../maps/roadOfVanishing.webp'
import a23 from '../maps/tallahart.webp'
import a24 from '../maps/theLabyrinthOfSuffering.webp'

export const DAILY_QUEST_BACKGROUND_ASSETS: Record<string, ImageAssetRef> = {
  "Arcs": a0,
  "arcana": a1,
  "arteria": a2,
  "aurumRegis": a3,
  "carcion": a4,
  "cernium": a5,
  "chewChew": a6,
  "critias": a7,
  "dowonkyung": a8,
  "esfera": a9,
  "fallenWorldTree": a10,
  "flagRace": a11,
  "geardrak": a12,
  "hallOfHeroes": a13,
  "haven": a14,
  "lacheln": a15,
  "limen": a16,
  "monsterPark": a17,
  "moonBridge": a18,
  "morass": a19,
  "muruengRaid": a20,
  "odium": a21,
  "roadOfVanishing": a22,
  "tallahart": a23,
  "theLabyrinthOfSuffering": a24,
}
