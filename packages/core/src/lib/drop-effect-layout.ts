// 고가 드롭 연출의 프레임 배치 기하(ADR-048) — DropEff 프레임별 origin·기둥 배율, ScreenEff 고정 배율.
//
// DropEff origin: 각 값은 "그 프레임 비트맵 자신의 픽셀 좌표"로 표현한 빛 기둥의 지면 접점 [x, y]이고,
// DropEffectOverlay 는 이 점을 화면의 고정 앵커에 맞춰 프레임을 배치한다.
//
// 인게임 클라이언트는 WZ 스프라이트마다 origin 을 갖지만 이 에셋은 원본 PNG 시퀀스를 검은배경 JPEG 로
// 최적화하면서(ADR-038 결정 9) origin 메타데이터가 유실됐다. 그래서 값을 추정하지 않고 커밋된 비트맵에서
// 계측해 복원했다 — x 는 loop 평균을 템플릿으로 한 matched filter 정합(수렴 후 서브픽셀 보간),
// y 는 전 프레임 비트맵 하단(콘텐츠 하단 여백이 3~6px 로 일정 = 기둥이 지면선에서 잘려 있음).
//
// CRITICAL: 에셋(`packages/core/src/assets/drop-effect/{pre,loop,end}`)을 다시 export 하면 이 테이블도 함께 다시
// 계측해야 한다. 프레임 수가 어긋나는 것만 테스트가 잡고, 값의 드리프트는 잡지 못한다.
// 재계측: `python3 scripts/measure-drop-effect-origins.py` — 아래 테이블을 그대로 찍어 준다.

export type DropEffectPhase = 'pre' | 'loop' | 'end'

export type DropEffectOrigin = readonly [x: number, y: number]

// 주석의 WxH 는 그 origin 을 계측한 비트맵 크기(최적화본 JPEG 기준).
export const DROP_EFFECT_ORIGINS: Record<DropEffectPhase, readonly DropEffectOrigin[]> = {
  pre: [
    [58.8, 288], // 0 (125x288)
    [69.1, 640], // 1 (144x640)
    [119, 739], // 2 (243x739)
    [133.9, 774], // 3 (262x774)
    [142.4, 790], // 4 (282x790)
    [145.3, 797], // 5 (285x797)
    [144.9, 800], // 6 (285x800)
    [138.8, 803], // 7 (275x803)
  ],
  loop: [
    [114.6, 822], // 0 (250x822)
    [113.8, 822], // 1 (250x822)
    [100.1, 826], // 2 (234x826)
    [108.1, 822], // 3 (221x822)
    [111.9, 813], // 4 (227x813)
    [112.6, 813], // 5 (214x813)
    [99.1, 813], // 6 (202x813)
    [96.8, 816], // 7 (198x816)
    [106.9, 819], // 8 (208x819)
    [117.8, 819], // 9 (221x819)
    [119.3, 819], // 10 (221x819)
    [112.5, 819], // 11 (214x819)
    [117.6, 819], // 12 (230x819)
    [106.6, 819], // 13 (218x819)
    [116.9, 819], // 14 (230x819)
    [102.6, 822], // 15 (230x822)
    [106.1, 822], // 16 (218x822)
    [107.1, 822], // 17 (221x822)
    [114.2, 822], // 18 (240x822)
    [109, 822], // 19 (214x822)
    [103.4, 816], // 20 (221x816)
    [102.5, 816], // 21 (208x816)
    [114, 816], // 22 (218x816)
    [115.1, 816], // 23 (234x816)
  ],
  end: [
    [100, 806], // 0 (234x806)
    [107.8, 803], // 1 (221x803)
    [110.4, 800], // 2 (227x800)
    [102.4, 790], // 3 (198x790)
    [81.5, 790], // 4 (170x790)
    [17.9, 618], // 5 (42x618)
    [19, 598], // 6 (38x598) — 전 픽셀 검정(완전 페이드 아웃)이라 정합 대상 없음, 하단-중앙
  ],
}

// origin 점이 요소 좌상단(= 화면 앵커)에 오도록, 스케일된 origin 만큼 되민다.
// `transformOrigin: '0 0'` 과 짝으로 쓴다. 소수 origin × 스케일의 부동소수 꼬리는 잘라 낸다.
export function dropFrameTransform(origin: DropEffectOrigin, scale: number): string {
  const px = (v: number): number => Math.round(v * -scale * 100) / 100
  return `translate(${px(origin[0])}px, ${px(origin[1])}px) scale(${scale})`
}

// DropEff 기둥 확대 배율(앵커 = 기둥의 지면 접점).
export const DROP_PILLAR_SCALE = 1.3

// ScreenEff 기준 프레임 크기(최적화본 중 최대). 프레임마다 크롭이 달라(544x384~1146x685)
// `object-fit:cover` 로 두면 프레임마다 "화면을 덮는 배율"이 따로 정해져 버스트가 들썩인다
// (390x844 기준 1.232~2.198, 프레임 0→1 에서 42% 점프 — ADR-048 결정 5).
// DropEff 와 달리 origin 테이블은 필요 없다 — ScreenEff 크롭은 이미 버스트 원점 기준 중앙 정렬이라
// `translate(-50%,-50%)` 로 맞고, 기준 프레임이 화면을 덮는 배율 하나만 전 프레임에 똑같이 적용하면 된다.
const SCREEN_REF_W = 1146
const SCREEN_REF_H = 685

export function screenEffectScale(viewportW: number, viewportH: number): number {
  const s = Math.max(viewportW / SCREEN_REF_W, viewportH / SCREEN_REF_H)
  return Math.round(s * 1000) / 1000
}
