// ⚠️ 이 파일은 생성물이다 — **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
//
// 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs)
// 무엇: 보스 일러스트 — `lib/boss-icons.ts` 가 `portraitSlug` 로 찾는다
// 원본: src/assets/bosses/*.{webp,png}
//
// 값의 타입은 번들러가 정한다 — 웹(Vite)은 URL 문자열, RN(Metro)은 에셋 id 다. 그 차이를
// 한 줄로 적어 둔 것이 `ImageAssetRef` 이고, 이 파일은 웹·RN 이 **같은 것을 본다**.

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../bosses/adversary.webp'
import a1 from '../bosses/ancientGodMitra.webp'
import a2 from '../bosses/arcanus.webp'
import a3 from '../bosses/armorDragon.webp'
import a4 from '../bosses/baekyeon.webp'
import a5 from '../bosses/bardrix.webp'
import a6 from '../bosses/bellona.webp'
import a7 from '../bosses/blackMage.webp'
import a8 from '../bosses/crimsonQueen.webp'
import a9 from '../bosses/damien.webp'
import a10 from '../bosses/darknell.webp'
import a11 from '../bosses/gloom.webp'
import a12 from '../bosses/jupiter.webp'
import a13 from '../bosses/kaling.webp'
import a14 from '../bosses/kalos.webp'
import a15 from '../bosses/limbo.webp'
import a16 from '../bosses/lotus.webp'
import a17 from '../bosses/lucid.webp'
import a18 from '../bosses/maerin.webp'
import a19 from '../bosses/magnus.webp'
import a20 from '../bosses/maleficStar.webp'
import a21 from '../bosses/papulatus.webp'
import a22 from '../bosses/pierre.webp'
import a23 from '../bosses/senya.webp'
import a24 from '../bosses/seren.webp'
import a25 from '../bosses/slime.webp'
import a26 from '../bosses/vellum.webp'
import a27 from '../bosses/verusHilla.webp'
import a28 from '../bosses/vonBon.webp'
import a29 from '../bosses/will.webp'
import a30 from '../bosses/zakum.webp'

export const BOSS_PORTRAIT_ASSETS: Record<string, ImageAssetRef> = {
  "adversary": a0,
  "ancientGodMitra": a1,
  "arcanus": a2,
  "armorDragon": a3,
  "baekyeon": a4,
  "bardrix": a5,
  "bellona": a6,
  "blackMage": a7,
  "crimsonQueen": a8,
  "damien": a9,
  "darknell": a10,
  "gloom": a11,
  "jupiter": a12,
  "kaling": a13,
  "kalos": a14,
  "limbo": a15,
  "lotus": a16,
  "lucid": a17,
  "maerin": a18,
  "magnus": a19,
  "maleficStar": a20,
  "papulatus": a21,
  "pierre": a22,
  "senya": a23,
  "seren": a24,
  "slime": a25,
  "vellum": a26,
  "verusHilla": a27,
  "vonBon": a28,
  "will": a29,
  "zakum": a30,
}
