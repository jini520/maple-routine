/**
 * `@core/lib/drop-effect-frames` 의 RN 대체 — `core-shims.js` 가 번들러 수준에서 이 파일로 갈아끼운다.
 *
 * **시그니처는 한 글자도 다르지 않다**([[ADR-127]] 원칙 1). 네 단계 모두 **빈 배열**이다.
 *
 * ## 왜 갈아끼우나
 *
 * 원본은 `import.meta.glob` 으로 `assets/drop-effect/{screen,pre,loop,end}/*.{jpg,webp}` 를 모은다 —
 * Metro 에 짝이 없어 **모듈을 평가하는 순간** 죽는다(`core-shims.js` 파일 머리).
 *
 * ## 왜 조회 규칙을 옮기지 않나
 *
 * `rn-item-icons.ts` 와 같은 이유다 — 이 모듈은 전체가 "디렉터리 → 파일 → URL" 한 사슬이고 그 끝이
 * 에셋이다. 정렬 규칙(`parseInt` 로 숫자 순 — 파일명 렉시코 정렬에서 10 < 2 가 되는 함정을 피한다)만
 * 남겨 봐야 정렬할 대상이 없다. 에셋이 오면 원본의 사슬을 Metro 방식(`require`)으로 바꿔 쓰면 된다.
 *
 * ## 빈 배열은 원본이 정의해 둔 정상 경로다
 *
 * `DropEffectOverlay` 는 `frames.loop.length === 0` 이면 *"연출 없이 닫기만 가능"* 한 분기로 간다.
 * 그래서 지금 RN 에서 이 오버레이는 **배경·중앙 아이템 자리·안내 문구만 있는 정적 화면**이고,
 * 화면을 탭하면 곧바로 닫힌다(`end` 프레임이 없으므로 재생할 것도 없다). 프레임 재생 엔진과
 * [[ADR-048]] 의 프레임별 origin 정합은 **에셋 레이어 + step 7** 몫이다.
 */

import type { DropEffectPhase } from '@core/lib/drop-effect-layout'

/** 네 단계 전부 빈 배열 — RN 번들에 연출 프레임이 아직 없다(파일 머리). */
export const DROP_EFFECT_FRAMES: Record<DropEffectPhase | 'screen', string[]> = {
  screen: [],
  pre: [],
  loop: [],
  end: [],
}
