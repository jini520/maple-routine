// ⚠️ 이 파일은 생성물이다 — **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
//
// 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs · [[ADR-129]])
// 무엇: 고가 드롭 연출 프레임 — `lib/drop-effect-frames.ts`([[ADR-038]] 결정 8)
// 원본: src/assets/drop-effect/screen/*.{jpg,webp} · src/assets/drop-effect/pre/*.{jpg,webp} · src/assets/drop-effect/loop/*.{jpg,webp} · src/assets/drop-effect/end/*.{jpg,webp}
//
// 값의 타입은 번들러가 정한다 — 웹(Vite)은 URL 문자열, RN(Metro)은 에셋 id 다. 그 차이를
// 한 줄로 적어 둔 것이 `ImageAssetRef` 이고, 이 파일은 웹·RN 이 **같은 것을 본다**.
//
// 순서가 곧 재생 순서다 — 파일 이름 앞의 숫자로 정렬해 둔다(렉시코 정렬은 10 < 2).

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../drop-effect/screen/0.webp'
import a1 from '../drop-effect/screen/1.webp'
import a2 from '../drop-effect/screen/2.webp'
import a3 from '../drop-effect/screen/3.webp'
import a4 from '../drop-effect/screen/4.webp'
import a5 from '../drop-effect/screen/5.webp'
import a6 from '../drop-effect/screen/6.webp'
import a7 from '../drop-effect/screen/7.webp'
import a8 from '../drop-effect/screen/8.webp'
import a9 from '../drop-effect/screen/9.webp'
import a10 from '../drop-effect/screen/10.webp'
import a11 from '../drop-effect/screen/11.webp'
import a12 from '../drop-effect/screen/12.webp'
import a13 from '../drop-effect/screen/13.webp'
import a14 from '../drop-effect/screen/14.webp'
import a15 from '../drop-effect/screen/15.webp'
import a16 from '../drop-effect/pre/0.webp'
import a17 from '../drop-effect/pre/1.webp'
import a18 from '../drop-effect/pre/2.webp'
import a19 from '../drop-effect/pre/3.webp'
import a20 from '../drop-effect/pre/4.webp'
import a21 from '../drop-effect/pre/5.webp'
import a22 from '../drop-effect/pre/6.webp'
import a23 from '../drop-effect/pre/7.webp'
import a24 from '../drop-effect/loop/0.webp'
import a25 from '../drop-effect/loop/1.webp'
import a26 from '../drop-effect/loop/2.webp'
import a27 from '../drop-effect/loop/3.webp'
import a28 from '../drop-effect/loop/4.webp'
import a29 from '../drop-effect/loop/5.webp'
import a30 from '../drop-effect/loop/6.webp'
import a31 from '../drop-effect/loop/7.webp'
import a32 from '../drop-effect/loop/8.webp'
import a33 from '../drop-effect/loop/9.webp'
import a34 from '../drop-effect/loop/10.webp'
import a35 from '../drop-effect/loop/11.webp'
import a36 from '../drop-effect/loop/12.webp'
import a37 from '../drop-effect/loop/13.webp'
import a38 from '../drop-effect/loop/14.webp'
import a39 from '../drop-effect/loop/15.webp'
import a40 from '../drop-effect/loop/16.webp'
import a41 from '../drop-effect/loop/17.webp'
import a42 from '../drop-effect/loop/18.webp'
import a43 from '../drop-effect/loop/19.webp'
import a44 from '../drop-effect/loop/20.webp'
import a45 from '../drop-effect/loop/21.webp'
import a46 from '../drop-effect/loop/22.webp'
import a47 from '../drop-effect/loop/23.webp'
import a48 from '../drop-effect/end/0.webp'
import a49 from '../drop-effect/end/1.webp'
import a50 from '../drop-effect/end/2.webp'
import a51 from '../drop-effect/end/3.webp'
import a52 from '../drop-effect/end/4.webp'
import a53 from '../drop-effect/end/5.webp'
import a54 from '../drop-effect/end/6.webp'

export const DROP_EFFECT_ASSETS: Record<string, ImageAssetRef[]> = {
  "screen": [a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15],
  "pre": [a16, a17, a18, a19, a20, a21, a22, a23],
  "loop": [a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47],
  "end": [a48, a49, a50, a51, a52, a53, a54],
}
