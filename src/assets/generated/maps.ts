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
import a3 from '../maps/carcion.webp'
import a4 from '../maps/cernium.webp'
import a5 from '../maps/chewChew.webp'
import a6 from '../maps/critias.webp'
import a7 from '../maps/dowonkyung.webp'
import a8 from '../maps/esfera.webp'
import a9 from '../maps/fallenWorldTree.webp'
import a10 from '../maps/flagRace.jpg'
import a11 from '../maps/geardrak.webp'
import a12 from '../maps/hallOfHeroes.webp'
import a13 from '../maps/haven.webp'
import a14 from '../maps/lacheln.webp'
import a15 from '../maps/limen.webp'
import a16 from '../maps/monsterPark.webp'
import a17 from '../maps/moonBridge.webp'
import a18 from '../maps/morass.webp'
import a19 from '../maps/muruengRaid.webp'
import a20 from '../maps/odium.webp'
import a21 from '../maps/roadOfVanishing.webp'
import a22 from '../maps/tallahart.webp'
import a23 from '../maps/theLabyrinthOfSuffering.webp'

export const DAILY_QUEST_BACKGROUND_ASSETS: Record<string, ImageAssetRef> = {
  "Arcs": a0,
  "arcana": a1,
  "arteria": a2,
  "carcion": a3,
  "cernium": a4,
  "chewChew": a5,
  "critias": a6,
  "dowonkyung": a7,
  "esfera": a8,
  "fallenWorldTree": a9,
  "flagRace": a10,
  "geardrak": a11,
  "hallOfHeroes": a12,
  "haven": a13,
  "lacheln": a14,
  "limen": a15,
  "monsterPark": a16,
  "moonBridge": a17,
  "morass": a18,
  "muruengRaid": a19,
  "odium": a20,
  "roadOfVanishing": a21,
  "tallahart": a22,
  "theLabyrinthOfSuffering": a23,
}
