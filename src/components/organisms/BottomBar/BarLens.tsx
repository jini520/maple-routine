/**
 * iOS 하단바를 누르고 끄는 동안 알약을 볼록 렌즈로 그리는 Skia 캔버스.
 *
 * 시스템 탭 바의 렌즈(`_UILiquidLensView`)는 비공개라 앱이 쓸 수 없어서 SkSL 셰이더로 같은 모양을 그린다.
 * 휘는 그림(`lens-images.tsx` 가 뜬다)은 넷이다. 항목 줄 비활성 색 · 선택 색 · 바 판, 그리고 렌즈 뒤 화면.
 * 알약 자리 · 크기 · 렌즈 세기는 Reanimated 공유값에서 셰이더 uniform 으로 바로 가므로 UI 스레드에서만 돈다.
 */
import { useMemo } from 'react'
import { Canvas, Fill, ImageShader, Shader, Skia } from '@shopify/react-native-skia'
import { useAnimatedReaction, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated'

import type { LensRowImages, PageImages } from './lens-images'

const SKSL = `
uniform shader base;
uniform shader accent;
uniform shader plate;
uniform shader page;
uniform shader pageBlur;
uniform float2 center;
uniform float2 size;
uniform float lens;
uniform float zoom;
uniform float hasPage;
uniform float2 barCenter;
uniform float2 barHalf;
uniform float4 glassTint;
uniform float4 pillFill;
uniform float body;
uniform float lensLift;
uniform float appear;
uniform float vertical;
uniform float4 pageBg;

// 세로 막대(오른쪽 레일)에서는 캔버스 좌표의 가로 · 세로를 바꿔, 아래 계산을 가로 바와 똑같이 한다(x = 칸이 늘어선 방향).
// 그림을 뽑을 때는 다시 캔버스 좌표로 돌린다.
float2 S(float2 v) {
  return vertical > 0.5 ? v.yx : v;
}

float sdRoundRect(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

half4 main(float2 xyIn) {
  float2 xy = S(xyIn);
  float2 hs = size * 0.5;
  float r = min(hs.x, hs.y);
  float2 p = xy - center;
  float d = sdRoundRect(p, hs, r);
  half4 outside = base.eval(xyIn);
  if (d > 1.0) { return outside; }
  // 안쪽은 휨 없이 고르게 확대한다. 테 띠(rho 0.82 바깥)는 한 장의 상을 한 번만 뽑되 반지름 방향으로 늘인다.
  // 누른 정도(몸통이 빠진 정도). 판 끝선은 이것을 따르고, 확대 · 테 띠 번짐은 휨 세기를 따른다.
  float pressed = 1.0 - body;
  float mag = mix(1.0, 1.0 + zoom, lens);
  float ex = abs(p.x) / hs.x;
  float rho = length(p / hs);
  float band0 = 0.82;
  // 테 띠 늘임: 0.82 바깥을 0.45 배로 누르되, 0.82 에서 꺾이지 않게 부드럽게 들어간다(기울기 연속).
  // 꺾이면 그 둘레를 지나는 바 둥근 끝 · 화면 가장자리가 살짝 물결졌다.
  float over = max(rho - band0, 0.0);
  float overS = over * over / (over + 0.06);
  float rhoS = rho - 0.55 * overS * lens;
  float2 q = center + (p * (rhoS / max(rho, 0.0001))) / mag;
  half4 col = accent.eval(S(q));
  half4 bg;
  // 뒤에 비치는 바 판(뜬 화면)의 세로만 따로 그린다. 시스템 녹화를 재 보면 렌즈 가운데에서 판 끝선이 렌즈 밖
  // 끝선보다 3.3pt 안쪽에 있고, 그 위아래로 판 밖의 화면이 띠로 비친다. 띠 양쪽(가운데에서 반폭의 0.4 ~ 0.55)에서
  // 끝선이 반원처럼 꺾여 렌즈 밖 끝선과 이어진다. 그 모양대로 판을 세로로만 줄여 뽑는다.
  float t = clamp((ex - 0.4) / 0.15, 0.0, 1.0);
  // 바 둥근 끝 구역(끝에서 반지름 안쪽)에서는 끝선을 끝까지 안쪽에 둔다. 그러면 위아래 어두운 띠가 둥근 끝을 따라
  // 한 띠로 감싸 돌고, 띠가 끝나며 바깥 끝선으로 돌아가는 턱이 둥근 끝 옆에 생기지 않는다.
  float capZone = smoothstep(barHalf.x - barHalf.y - 4.0, barHalf.x - barHalf.y, abs(xy.x - barCenter.x));
  float inset = 3.5 * max(sqrt(1.0 - t * t), capZone);
  float fy = barHalf.y / max(barHalf.y - inset, 1.0);
  // 판 끝선 · 판은 휨 세기(lens)가 아니라 누름(몸통이 빠진 정도)에 묶는다. 제자리에서 눌러도 누르는 순간부터 같은
  // 판 모양이고, 끌기로 넘어갈 때 판이 바뀌지 않는다. 확대 · 테 띠 늘임만 휨 세기를 따른다.
  float2 qb = float2(q.x, mix(q.y, center.y + p.y * fy, pressed));
  // 렌즈 안 판은 실제 자리(xy)의 캡슐 하나로 그린다. 렌즈 가운데에서는 위아래를 inset 만큼 줄이고,
  // 둥근 끝 반지름도 함께 줄여 한 덩어리로 매끈하게 잇는다. 가로 끝과 세로 끝선을 따로 재 합치면 둥근 끝 근처가 울렁였다.
  float plateHalfY = barHalf.y - inset * pressed;
  float plateD = sdRoundRect(xy - barCenter, float2(barHalf.x, plateHalfY), plateHalfY);
  float onPlate = 1.0 - smoothstep(-0.5, 0.5, plateD);
  if (hasPage > 0.5) {
    // 뜬 화면에는 유리 바가 없다. 바 판 자리는 흐린 화면 위에 테마의 바 색을 덮어 그린다.
    // 뜬 화면에서 투명한 자리(레일 화면의 오른쪽 빈 자리 등)는 테마 바탕색 위에 얹는다. 그냥 쓰면 검게 비쳤다.
    half4 pg = mix(page.eval(S(qb)), pageBlur.eval(S(qb)), half(onPlate));
    half3 under = pg.rgb + half3(pageBg.rgb) * (1.0 - pg.a);
    half3 glassed = mix(under, half3(glassTint.rgb), half(glassTint.a));
    bg = half4(mix(under, glassed, half(onPlate)), 1.0);
  } else {
    bg = plate.eval(S(q));
  }
  bg = bg * half(pressed);
  // 알약 몸통. 쉴 때는 테마 색의 옅은 판(아래 진짜 유리 바가 비친다)이고, 누르는 순간 바로 빠져 투명한 렌즈가 된다.
  // 유리 알약을 따로 두면 실기기에서 하얗게 떴다.
  bg = bg + half4(pillFill) * half(body) * (1.0 - bg.a);
  // 시스템 다크 탭 바는 렌즈 안 바 판이 렌즈 밖보다 밝다(녹화 밝기 약 80 대 43). 렌즈의 성질이라 끌 때만이 아니라
  // 누르는 순간부터(몸통이 빠지는 것과 함께) 렌즈 안 판에 흰빛을 얹는다.
  half lift = half(lensLift * (1.0 - body) * onPlate);
  bg = half4(1.0) * lift + bg * (1.0 - lift);
  col = col + bg * (1.0 - col.a);
  // 유리 가장자리 반사광(선 없이 부드럽게, 위쪽이 조금 밝게).
  float edgeGlow = smoothstep(-3.5, 0.0, d) * mix(0.35, 1.0, lens);
  float topLight = 0.55 + 0.45 * clamp(-p.y / hs.y, 0.0, 1.0);
  col = half4(col.rgb + half3(half(edgeGlow * 0.18 * topLight)), max(col.a, half(edgeGlow * 0.18 * topLight)));
  float inside = 1.0 - smoothstep(-0.5, 0.5, d);
  return mix(outside, col, half(inside * appear));
}
`

let effect: ReturnType<typeof Skia.RuntimeEffect.Make> | undefined

/** 셰이더. 처음 그릴 때 한 번 컴파일한다. 모듈을 불러오는 것만으로 Skia 를 깨우지 않으려는 것이다. */
function lensEffect(): ReturnType<typeof Skia.RuntimeEffect.Make> {
  if (effect === undefined) effect = Skia.RuntimeEffect.Make(SKSL)
  return effect
}

/** 캔버스를 바 양 끝 밖으로 넓히는 폭. 들린 알약 반폭(약 49) − 칸 끝 여백 + 테 띠를 덮는다. */
const EXT_X = 40

export interface LensCanvasProps {
  images: LensRowImages
  /** 칸이 늘어선 방향의 길이(바 길이). */
  width: number
  /** 가로지르는 방향의 길이(캔버스 두께). */
  height: number
  /** 세로 막대(오른쪽 레일)인지. 그러면 width 가 세로, height 가 가로다. */
  vertical?: boolean
  /** 테마 바탕색(0~1 네 개). 뜬 화면의 투명한 자리를 채운다. */
  pageBg: number[]
  pillX: SharedValue<number>
  pillW: number
  pillH: number
  /** 알약 크기 배율 값들. 바의 알약과 같은 식으로 크기를 낸다. */
  hold: SharedValue<number>
  wobW: SharedValue<number>
  wobH: SharedValue<number>
  tint: SharedValue<number>
  lensAmt: SharedValue<number>
  holdW: number
  holdH: number
  zoom: number
  /** 캔버스를 바 위로 올리는 양. */
  top: number
  page: PageImages | null
  /** 창 크기와 캔버스 왼쪽 위의 창 좌표. 뜬 화면을 캔버스 좌표로 옮긴다. */
  windowW: number
  windowH: number
  originX: SharedValue<number>
  originY: number
  barW: SharedValue<number>
  barH: number
  glassTint: number[]
  /** 쉬는 알약 몸통 색(premultiplied rgba). */
  pillFill: number[]
  /** 쉬는 알약 몸통의 세기(0~1). */
  body: SharedValue<number>
  /** 렌즈 안 바 판에 얹는 흰빛 세기(다크만). */
  lensLift: number
  /** 행 전환 때 알약 등장(0 → 1)과 시작 크기 배율. */
  enter: SharedValue<number>
  enterFrom: number
  /** 이 캔버스가 그리는 행과 지금 보이는 행. 행이 바뀌면 빠지는 옛 행의 알약은 제자리에 멈춘 채 함께 사라진다. */
  rowKey: string
  currentRow: SharedValue<string>
}

export function LensCanvas(props: LensCanvasProps): React.JSX.Element | null {
  const { images, width, height, pillX, pillW, pillH, hold, wobW, wobH, tint, lensAmt, holdW, holdH, zoom, top } = props
  const vertical = props.vertical ?? false
  const pageBg = props.pageBg
  const { page, windowW, windowH, originX, originY, barW, barH, glassTint, pillFill, body, lensLift, enter, enterFrom } = props
  const hasPage = page === null ? 0 : 1
  const { rowKey, currentRow } = props
  const rowPillX = useSharedValue(pillX.value)
  useAnimatedReaction(
    () => (currentRow.value === rowKey ? pillX.value : null),
    (value) => {
      if (value !== null) rowPillX.value = value
    },
  )
  const uniforms = useDerivedValue(() => {
    const grow = enterFrom + (1 - enterFrom) * enter.value
    const w = pillW * (1 + holdW * hold.value + wobW.value) * grow
    const h = pillH * (1 + holdH * hold.value + wobH.value) * grow
    return {
      center: [rowPillX.value + EXT_X, height / 2],
      size: [w, h],
      lens: (1 - tint.value) * lensAmt.value,
      zoom,
      hasPage,
      barCenter: [barW.value / 2 + EXT_X, height / 2],
      barHalf: [barW.value / 2, barH / 2],
      glassTint,
      pillFill,
      body: body.value,
      lensLift,
      appear: enter.value,
      vertical: vertical ? 1 : 0,
      pageBg,
    }
  })
  // 캔버스를 바 양 끝 밖으로 EXT_X 씩 넓힌다. 양 끝 칸에서 들린 렌즈가 바 밖으로 나가도 그 자리를 그린다.
  // 세로 막대는 캔버스를 세로로 세운다(칸 방향 = 세로). 그림 · 화면 상자도 그 좌표로 둔다.
  const rect = useMemo(
    () => (vertical ? { x: 0, y: EXT_X, width: height, height: width } : { x: EXT_X, y: 0, width, height }),
    [width, height, vertical],
  )
  const pageRect = useDerivedValue(() =>
    vertical
      ? { x: -originY, y: -originX.value + EXT_X, width: windowW, height: windowH }
      : { x: -originX.value + EXT_X, y: -originY, width: windowW, height: windowH },
  )
  const source = lensEffect()
  if (source === null) return null
  return (
    <Canvas
      style={
        vertical
          ? { position: 'absolute', top: -EXT_X, left: top, height: width + EXT_X * 2, width: height }
          : { position: 'absolute', left: -EXT_X, top, width: width + EXT_X * 2, height }
      }
      pointerEvents="none"
    >
      <Fill>
        <Shader source={source} uniforms={uniforms}>
          <ImageShader image={images.base} fit="fill" rect={rect} tx="decal" ty="decal" />
          <ImageShader image={images.accent} fit="fill" rect={rect} tx="decal" ty="decal" />
          <ImageShader image={images.edge} fit="fill" rect={rect} tx="decal" ty="decal" />
          <ImageShader image={page?.sharp ?? images.edge} fit="fill" rect={page ? pageRect : rect} />
          <ImageShader image={page?.blurred ?? images.edge} fit="fill" rect={page ? pageRect : rect} />
        </Shader>
      </Fill>
    </Canvas>
  )
}
