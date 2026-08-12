// 웹의 `@keyframes` 와 RN 구현 상수를 **원본을 읽어** 대조한다(step 7).
//
// ## 왜 값을 베끼지 않고 파일을 읽는가
//
// 애니메이션은 "같아 보이는가"를 눈으로만 판정할 수 있고, 그 판정은 4단계(화면)에서야 가능하다.
// 그때까지 **숫자만이라도 갈라지지 않게** 붙들어 두는 것이 이 파일의 일이다. 값을 여기 손으로
// 적으면 웹이 바뀌어도 조용히 통과하므로, `packages/app-capacitor/src/index.css` 를 실제로 읽는다
// (`tailwind-v4-axes.cjs` 가 `tailwindcss/theme.css` 를 읽는 것과 같은 이유·같은 방식).
//
// ## 수명
//
// 이 파일은 **전환이 끝나면 함께 사라진다** — `app-capacitor` 가 걷히면 대조할 원본이 없어진다
// ([[ADR-128]] 최종 상태). 그때까지는 두 앱이 한 저장소에 있으므로 경로가 성립한다.
//
// ## 인벤토리가 계약이다
//
// `KEYFRAMES` 는 웹 CSS 의 `@keyframes` **전부**를 이 phase 의 몫과 화면(4단계) 몫으로 갈라 적은
// 것이고, 아래 첫 케이스가 그 목록이 실제 CSS 와 정확히 일치하는지 본다. 웹에 새 `@keyframes` 가
// 생기면 **분류될 때까지 빨개진다** — 조용히 누락되는 것이 이 전환에서 가장 비싼 실패라서다.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  MAPLE_TRAIL_DURATION_MS,
  MAPLE_TRAIL_TO_DASH_OFFSET,
} from '../components/atoms/MapleSpinner/MapleSpinner'
import {
  MAPLE_SWEEP_DURATION_MS,
  MAPLE_SWEEP_TRAVEL,
} from '../components/atoms/MapleSweepSpinner/MapleSweepSpinner'
import { WIDTH_TRANSITION } from '../components/atoms/ProgressBar/width-transition'
import { MAPLE_LEAF_PATH_LENGTH } from '../components/mapleLeafPath'
import { VALUABLE_ROW_PULSE, VALUABLE_ROW_TINT } from '../app/boss-profit/valuable-row-glow'
import {
  VALUABLE_CARD_GLOW_DURATION_MS,
  VALUABLE_CARD_GLOW_HIGH,
  VALUABLE_CARD_GLOW_LOW,
  VALUABLE_CARD_GLOW_STATIC,
  VALUABLE_CARD_GLOW_TIMING,
  VALUABLE_CARD_RING_COLOR,
} from '../app/boss-profit/valuable-card-glow'
import { FLOAT_ANIMATION } from '../components/organisms/DropEffectOverlay/float-animation'
import { TIMER_ANIMATION_BASE } from '../components/organisms/Toast/timer-animation'

const WEB_SRC = join(__dirname, '../../../app-capacitor/src')

const INDEX_CSS = readFileSync(join(WEB_SRC, 'index.css'), 'utf8')

/** Tailwind 가 `transition-*` 에 쓰는 프리셋 기본값 — 웹이 실제로 컴파일에 쓰는 그 파일에서 읽는다. */
const V4_THEME_CSS = readFileSync(
  require.resolve('tailwindcss/theme.css', {
    paths: [join(__dirname, '../../../app-capacitor')],
  }),
  'utf8',
)

/**
 * 웹 `index.css` 의 `@keyframes` 전부. 갈리는 기준은 난이도가 아니라 **그 애니메이션이 붙는 요소가
 * 어느 계층에 사는가** 다.
 *
 * **`screenLayer` 는 «아직 4단계가 손대지 않은 것» 이고, step 8(4단계 마지막)로 비었다.** 셋이 어디로
 * 갔는지는 아래 두 칸이 말한다 — 그래서 이 목록은 진행 상황이 아니라 **결과**를 적은 표가 됐다.
 */
const KEYFRAMES = {
  /** 컴포넌트 계층(atoms·organisms)에 붙어 3단계가 옮겼다. */
  ported: ['toast-shrink', 'maple-trail', 'maple-sweep', 'fx-drop-float'],
  /**
   * `app/boss-profit/*` 의 화면·행에만 붙어 **4단계가 옮겼다**([[ADR-045]]·[[ADR-071]]) —
   * `valuable-drop-row-pulse` 는 step 6(보스 행)이 옮기고 step 8(가격 기록 행)이 두 번째 호출부가
   * 되어 `valuable-row-glow.ts` 로 나왔다. `valuable-drop-glow` 는 step 7(캐릭터 카드)이다.
   * 컴포넌트 계층에는 이 둘을 쓰는 자리가 하나도 없다(아래 셋째 케이스).
   */
  portedByScreens: ['valuable-drop-glow', 'valuable-drop-row-pulse'],
  /**
   * **4단계가 아직 안 옮긴 것 — 비어 있어야 한다.** step 8 이 4단계의 마지막이므로 여기 이름이
   * 남아 있다면 그것이 곧 미완이고, 아래 둘째 케이스가 그것을 잡는다.
   */
  screenLayer: [] as readonly string[],
  /**
   * **옮기지 않고 degrade 시킨 것** — RN 에 conic-gradient 도 `mask-composite: xor` 도 없어
   * 회전 샤인 링을 그릴 방법이 없다. 임시방편이 아니라 [[ADR-045]] 가 `@property` 미지원 WebView
   * 를 위해 **이미 설계해 둔 폴백**(정적 골드 테두리)을 그대로 쓴다 — 그래서 «못 옮김» 이 아니라
   * 별도 칸이고, 아래 전용 describe 가 *"웹에도 그 폴백이 실재하는가"* 를 본다.
   */
  degraded: ['valuable-drop-spin'],
} as const

/** `@keyframes <name>` 의 이름만 뽑는다. */
function keyframeNames(css: string): string[] {
  return [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])
}

/** `animation: <name> <duration> <easing> <count>` 한 줄을 통째로 집는다. */
function animationShorthand(css: string, name: string): string {
  const match = new RegExp(`animation:\\s*${name}\\s+([^;]+);`).exec(css)
  if (match === null) throw new Error(`index.css 에서 \`animation: ${name} …\` 를 못 찾았다`)
  return match[1].trim()
}

/** `--<name>: <value>;` 한 줄. */
function themeValue(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(V4_THEME_CSS)
  if (match === null) throw new Error(`tailwindcss/theme.css 에서 --${name} 를 못 찾았다`)
  return match[1].trim()
}

/**
 * 웹 `box-shadow` 선언을 겹 단위 문자열 배열로 — `0 0 6px 0 rgba(…)` 처럼 공백이 정규화된다.
 * 여러 겹은 `),` 로 갈린다(색이 `rgba(…)` 라 단순 콤마 분리로는 색 안이 잘린다).
 */
function webShadowLayers(declaration: string): string[] {
  return declaration
    .split(/\),\s*/)
    .map((layer, index, all) => {
      const text = index === all.length - 1 ? layer : `${layer})`
      // 웹은 0 에 단위를 안 붙인다(`0 0 8px 0`) — 대조 전에 그 한 가지만 맞춘다.
      return text.trim().replace(/\s+/g, ' ').replace(/\b0px\b/g, '0')
    })
    .filter((layer) => layer.length > 0)
}

/** RN `boxShadow` 겹 하나를 웹 문법으로 — 대조는 이 문자열끼리 한다. */
function shadowLayerText(layer: {
  offsetX: number
  offsetY: number
  blurRadius: number
  spreadDistance: number
  color: string
}): string {
  const px = (value: number): string => (value === 0 ? '0' : `${value}px`)
  return `${px(layer.offsetX)} ${px(layer.offsetY)} ${px(layer.blurRadius)} ${px(layer.spreadDistance)} ${layer.color}`
}

/** CSS 의 `2.6s`·`900ms` 를 ms 숫자로. */
function toMs(duration: string): number {
  const match = /^([\d.]+)(ms|s)$/.exec(duration)
  if (match === null) throw new Error(`읽을 수 없는 지속시간: ${duration}`)
  return match[2] === 's' ? Number(match[1]) * 1000 : Number(match[1])
}

describe('@keyframes 인벤토리', () => {
  it('웹 CSS 의 @keyframes 는 네 칸으로 남김없이 갈린다', () => {
    // 새 `@keyframes` 가 생기면 여기서 잡힌다 — 분류하지 않고 지나갈 수 없다.
    expect(keyframeNames(INDEX_CSS).sort()).toEqual(
      [
        ...KEYFRAMES.ported,
        ...KEYFRAMES.portedByScreens,
        ...KEYFRAMES.screenLayer,
        ...KEYFRAMES.degraded,
      ].sort(),
    )
  })

  it('«화면 몫» 이 비었다 — step 8 이 4단계의 마지막이라 남은 이름이 곧 미완이다', () => {
    expect(KEYFRAMES.screenLayer).toEqual([])
  })

  it('화면이 소유하는 셋은 컴포넌트 계층 어디에도 안 쓰인다 — 4단계 몫이라는 근거', () => {
    const webComponents = readFileSync(
      join(WEB_SRC, 'components/organisms/DropEffectOverlay/DropEffectOverlay.tsx'),
      'utf8',
    )
    // 웹에서도 이 셋을 쓰는 곳은 `app/` 뿐이라, 컴포넌트를 옮긴 3단계가 건드릴 자리가 없었다.
    for (const name of [...KEYFRAMES.portedByScreens, ...KEYFRAMES.degraded]) {
      expect(webComponents).not.toContain(name)
    }
  })
})

describe('maple-trail — MapleSpinner', () => {
  it('지속시간·이징·반복이 웹과 같다', () => {
    // `animate-maple-trail` = `maple-trail 0.9s linear infinite`
    const [duration, easing, count] = animationShorthand(INDEX_CSS, 'maple-trail').split(/\s+/)

    expect(toMs(duration)).toBe(MAPLE_TRAIL_DURATION_MS)
    expect(easing).toBe('linear')
    expect(count).toBe('infinite')
  })

  it('한 주기가 둘레 한 바퀴다 — 정규화가 없어 값은 다르고 뜻은 같다', () => {
    // 웹은 `pathLength={300}` 정규화 위에서 `stroke-dashoffset: -300` 까지 굴렸다. RN 은 그 속성이
    // 없어 **실측 둘레**까지 굴린다(`mapleLeafPath.ts`). 숫자를 맞출 수 없으므로 "한 주기 = 둘레"
    // 라는 성질을 대신 지킨다 — 이게 깨지면 반복 이음매에서 트레일이 튄다.
    expect(/stroke-dashoffset:\s*-300/.test(INDEX_CSS)).toBe(true)
    expect(MAPLE_TRAIL_TO_DASH_OFFSET).toBe(-MAPLE_LEAF_PATH_LENGTH)
  })
})

describe('maple-sweep — MapleSweepSpinner', () => {
  it('지속시간·이징·반복이 웹과 같다', () => {
    const [duration, ...rest] = animationShorthand(INDEX_CSS, 'maple-sweep').split(/\s+/)

    expect(toMs(duration)).toBe(MAPLE_SWEEP_DURATION_MS)
    expect(rest).toEqual(['ease-in-out', 'infinite'])
  })

  it('띠가 움직이는 거리가 웹의 translateY 와 같다', () => {
    // 웹: `@keyframes maple-sweep { to { transform: translateY(-230px) } }`
    const match = /@keyframes maple-sweep\s*\{[^}]*translateY\((-?[\d.]+)px\)/.exec(INDEX_CSS)
    expect(match).not.toBeNull()

    // RN 은 transform 이 아니라 `<Rect>` 의 `y` 를 굴리므로 **부호가 반대**다(좌표는 아래로 갈수록
    // 커지고 translateY 는 위로 갈수록 작아진다). 견주는 것은 이동 거리다.
    expect(MAPLE_SWEEP_TRAVEL).toBe(Math.abs(Number(match?.[1])))
  })
})

describe('fx-drop-float — DropEffectOverlay', () => {
  it('지속시간·이징·반복이 웹과 같다', () => {
    const [duration, ...rest] = animationShorthand(INDEX_CSS, 'fx-drop-float').split(/\s+/)

    expect(toMs(duration)).toBe(toMs(FLOAT_ANIMATION.animationDuration))
    expect(rest).toEqual([
      FLOAT_ANIMATION.animationTimingFunction,
      FLOAT_ANIMATION.animationIterationCount,
    ])
  })

  it('진폭이 웹의 키프레임과 같다 — −5 → 5 → −5', () => {
    const block = /@keyframes fx-drop-float\s*\{([\s\S]*?)\n\}/.exec(INDEX_CSS)?.[1] ?? ''
    const offsets = [...block.matchAll(/translateY\((-?[\d.]+)px\)/g)].map((m) => Number(m[1]))

    // 웹은 `0%,100%` 를 한 블록으로 묶어 두 값만 적는다(−5, 5). RN 은 `from`·`50%`·`to` 세 마디다.
    expect(offsets).toEqual([-5, 5])
    expect([
      FLOAT_ANIMATION.animationName.from.transform[0].translateY,
      FLOAT_ANIMATION.animationName['50%'].transform[0].translateY,
      FLOAT_ANIMATION.animationName.to.transform[0].translateY,
    ]).toEqual([-5, 5, -5])
  })
})

describe('toast-shrink — Toast', () => {
  it('scaleX 1 → 0 이다', () => {
    const block = /@keyframes toast-shrink\s*\{([\s\S]*?)\n\}/.exec(INDEX_CSS)?.[1] ?? ''
    expect([...block.matchAll(/scaleX\(([\d.]+)\)/g)].map((m) => Number(m[1]))).toEqual([1, 0])

    expect(TIMER_ANIMATION_BASE.animationName.from.transform[0].scaleX).toBe(1)
    expect(TIMER_ANIMATION_BASE.animationName.to.transform[0].scaleX).toBe(0)
  })

  it('이징·채우기가 웹의 인라인 선언과 같다 — 지속시간만 토스트가 정한다', () => {
    // 웹은 지속시간이 토스트마다 달라 클래스로 못 적고 인라인으로 넣었다
    // (`Toast.tsx`: `animation: toast-shrink ${toast.duration}ms linear forwards`).
    const webToast = readFileSync(join(WEB_SRC, 'components/organisms/Toast/Toast.tsx'), 'utf8')
    const match = /animation: `toast-shrink \$\{toast\.duration\}ms ([\w-]+) ([\w-]+)`/.exec(webToast)

    expect(match).not.toBeNull()
    expect(TIMER_ANIMATION_BASE.animationTimingFunction).toBe(match?.[1])
    expect(TIMER_ANIMATION_BASE.animationFillMode).toBe(match?.[2])
  })
})

describe('transition-[width] — ProgressBar', () => {
  it('Tailwind 프리셋 기본값을 그대로 편다 — RN 에는 그 프리셋이 없다', () => {
    // 웹 호출부에 `duration-*`·`ease-*` 가 없으므로 이 두 기본값이 곧 실제 값이다.
    expect(toMs(themeValue('default-transition-duration'))).toBe(
      toMs(WIDTH_TRANSITION.transitionDuration),
    )

    const bezier = /cubic-bezier\(([^)]+)\)/.exec(themeValue('default-transition-timing-function'))
    const [x1, y1, x2, y2] = (bezier?.[1] ?? '').split(',').map((n) => Number(n.trim()))
    expect({ x1, y1, x2, y2 }).toMatchObject(WIDTH_TRANSITION.transitionTimingFunction)
  })
})

describe('valuable-drop-row-pulse — BossProfitBossRow', () => {
  it('지속시간·이징·반복이 웹과 같다', () => {
    const [duration, ...rest] = animationShorthand(INDEX_CSS, 'valuable-drop-row-pulse').split(/\s+/)

    expect(toMs(duration)).toBe(toMs(VALUABLE_ROW_PULSE.animationDuration))
    expect(rest).toEqual([
      VALUABLE_ROW_PULSE.animationTimingFunction,
      VALUABLE_ROW_PULSE.animationIterationCount,
    ])
  })

  it('맥동하는 두 색이 웹의 키프레임과 같다', () => {
    const block = /@keyframes valuable-drop-row-pulse\s*\{([\s\S]*?)\n\}/.exec(INDEX_CSS)?.[1] ?? ''
    const colors = [...block.matchAll(/background-color:\s*([^;]+);/g)].map((m) => m[1].trim())

    // 웹은 `0%,100%` 를 한 블록으로 묶어 두 값만 적는다. RN 은 `from`·`50%`·`to` 세 마디다.
    expect(colors).toHaveLength(2)
    expect([
      VALUABLE_ROW_PULSE.animationName.from.backgroundColor,
      VALUABLE_ROW_PULSE.animationName['50%'].backgroundColor,
      VALUABLE_ROW_PULSE.animationName.to.backgroundColor,
    ]).toEqual([colors[0], colors[1], colors[0]])
  })

  it('정적 폴백 틴트도 웹의 `.valuable-drop-row` 와 같다 — 모션을 끈 사용자가 보는 색이다', () => {
    const block = /\.valuable-drop-row\s*\{([\s\S]*?)\n\}/.exec(INDEX_CSS)?.[1] ?? ''
    const fallback = /background-color:\s*([^;]+);/.exec(block)?.[1].trim()

    expect(fallback).toBe(VALUABLE_ROW_TINT)
  })
})

describe('valuable-drop-glow — CharacterAccordion (step 7)', () => {
  it('지속시간·이징·반복이 웹과 같다', () => {
    const [duration, ...rest] = animationShorthand(INDEX_CSS, 'valuable-drop-glow').split(/\s+/)

    expect(toMs(duration)).toBe(VALUABLE_CARD_GLOW_DURATION_MS)
    expect(rest).toEqual([VALUABLE_CARD_GLOW_TIMING, 'infinite'])
  })

  it('맥동 두 끝점이 웹의 키프레임과 같다 — 중간만 알파 교차다', () => {
    // RN 은 `box-shadow` 를 보간하지 않아 파라미터를 굴릴 수 없다. 두 끝점을 각각 가진 겹을
    // 반대 방향 `opacity` 로 교차시키므로, **지켜야 하는 것은 그 두 끝점**이다.
    const block = /@keyframes valuable-drop-glow\s*\{([\s\S]*?)\n\}/.exec(INDEX_CSS)?.[1] ?? ''
    const shadows = [...block.matchAll(/box-shadow:([\s\S]*?);/g)].map((m) => m[1])

    // 웹은 `0%,100%` 를 한 블록으로 묶어 두 마디만 적는다.
    expect(shadows).toHaveLength(2)
    expect(shadows.map(webShadowLayers)).toEqual([
      VALUABLE_CARD_GLOW_LOW.map(shadowLayerText),
      VALUABLE_CARD_GLOW_HIGH.map(shadowLayerText),
    ])
  })

  it('정적 폴백 글로우도 웹의 `.valuable-drop-card` 와 같다 — 펼침·모션 줄이기가 보는 값이다', () => {
    // 웹은 이 값을 세 자리에서 보여 준다: `@property` 미지원 · `prefers-reduced-motion` ·
    // 펼침(`animation: none`, [[ADR-045]] 결정 4). RN 도 뒤의 둘에서 이 그림 하나로 간다.
    const block = /\.valuable-drop-card\s*\{([\s\S]*?)\n\}/.exec(INDEX_CSS)?.[1] ?? ''
    const shadow = /box-shadow:([\s\S]*?);/.exec(block)?.[1] ?? ''

    expect(webShadowLayers(shadow)).toEqual(VALUABLE_CARD_GLOW_STATIC.map(shadowLayerText))
  })
})

describe('valuable-drop-spin — degrade (step 7)', () => {
  it('웹이 정한 폴백 각도에서 링은 베이스 골드 한 색이다 — RN 이 그리는 그림이 그것이다', () => {
    // [[ADR-045]] 는 `@property` 미지원 WebView 를 위해 `--vd-angle: 0deg` 폴백을 명시했고, 그
    // 각도에서 conic 링의 시작·끝 정지점이 모두 베이스 골드다. RN 에 conic gradient 가 없어
    // 우리가 그리는 것이 정확히 그 폴백이므로, **웹에 그 폴백이 실재하는지**를 여기서 붙든다.
    const block = /\.valuable-drop-card::before\s*\{([\s\S]*?)\n\}/.exec(INDEX_CSS)?.[1] ?? ''

    expect(block).toContain('--vd-angle: 0deg')
    expect(/from var\(--vd-angle\),\s*(#[0-9a-f]{6}) 0deg/i.exec(block)?.[1]).toBe(
      VALUABLE_CARD_RING_COLOR,
    )
    // 링 두께 — 웹은 `padding: 2px` + mask(xor) 로 2px 만 남긴다.
    expect(block).toContain('padding: 2px')
  })
})
