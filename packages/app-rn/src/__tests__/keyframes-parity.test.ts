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
// ([[ADR-127]] 최종 상태). 그때까지는 두 앱이 한 저장소에 있으므로 경로가 성립한다.
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
 * 웹 `index.css` 의 `@keyframes` 전부. **이 phase 에서 옮긴 것과 4단계(화면) 몫이 갈린다** —
 * 갈리는 기준은 난이도가 아니라 **그 애니메이션이 붙는 요소가 어느 계층에 사는가** 다.
 */
const KEYFRAMES = {
  /** 컴포넌트 계층(atoms·organisms)에 붙어 이 phase 가 옮겼다. */
  ported: ['toast-shrink', 'maple-trail', 'maple-sweep', 'fx-drop-float'],
  /**
   * `app/boss-profit/*` 의 화면·행에만 붙는다([[ADR-045]]·[[ADR-071]]) — 그 화면이 아직 없으므로
   * **4단계 몫**이다. 컴포넌트 계층에는 이 셋을 쓰는 자리가 하나도 없다.
   */
  screenLayer: ['valuable-drop-glow', 'valuable-drop-spin', 'valuable-drop-row-pulse'],
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

/** CSS 의 `2.6s`·`900ms` 를 ms 숫자로. */
function toMs(duration: string): number {
  const match = /^([\d.]+)(ms|s)$/.exec(duration)
  if (match === null) throw new Error(`읽을 수 없는 지속시간: ${duration}`)
  return match[2] === 's' ? Number(match[1]) * 1000 : Number(match[1])
}

describe('@keyframes 인벤토리', () => {
  it('웹 CSS 의 @keyframes 는 이 phase 몫과 화면 몫으로 남김없이 갈린다', () => {
    // 새 `@keyframes` 가 생기면 여기서 잡힌다 — 분류하지 않고 지나갈 수 없다.
    expect(keyframeNames(INDEX_CSS).sort()).toEqual(
      [...KEYFRAMES.ported, ...KEYFRAMES.screenLayer].sort(),
    )
  })

  it('화면 몫 셋은 컴포넌트 계층 어디에도 안 쓰인다 — 4단계로 넘어간다는 근거', () => {
    const webComponents = readFileSync(
      join(WEB_SRC, 'components/organisms/DropEffectOverlay/DropEffectOverlay.tsx'),
      'utf8',
    )
    // 웹에서도 이 셋을 쓰는 곳은 `app/` 뿐이라, 컴포넌트를 옮긴 이 phase 가 건드릴 자리가 없었다.
    for (const name of KEYFRAMES.screenLayer) {
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
