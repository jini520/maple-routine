// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `#boot-cover` 실패 안전 타이머([[ADR-117]] 결정 3).
 *
 * 커버를 걷는 코드는 저장소 전체에서 `hideSplashScreen()` 하나이고 그 호출은 `App.tsx` 의
 * `useEffect` 타이머 안이라 **언마운트 클린업이 취소한다** — 앱이 죽으면 커버를 걷을 주체가
 * 사라진다. `index.html` 의 인라인 스크립트는 그 트리 밖에 있는 백스톱이라, 정확히 **앱이
 * 돌지 않는 상황**에서만 값이 있다. 그래서 이 테스트는 문자열 검사에서 멈추지 않고
 * 스크립트를 jsdom 안에서 **실제로 실행해** 동작을 단언한다.
 */
// 경로를 문자열로 풀어 쓴다 — jsdom 환경의 전역 `URL`(whatwg-url)은 node 의 `fileURLToPath` 가
// 받아주지 않아, 애널리틱스 테스트(node env)의 `new URL(...)` 형태를 그대로 쓰면 여기서 죽는다.
const HTML = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html'),
  'utf8',
)

// 속성 없는 `<script>` 는 이 스크립트뿐이다(애널리틱스는 src·async, 앱 번들은 type="module").
const INLINE_SCRIPT = /<script>(?<body>[\s\S]*?)<\/script>/.exec(HTML)?.groups?.body ?? ''

function runBootCoverScript(): void {
  new Function(INLINE_SCRIPT)()
}

function mountBootCover(): void {
  const cover = document.createElement('div')
  cover.id = 'boot-cover'
  document.body.appendChild(cover)
}

function stubSplashScreenPlugin(): ReturnType<typeof vi.fn> {
  const hide = vi.fn()
  ;(window as unknown as { Capacitor: unknown }).Capacitor = { Plugins: { SplashScreen: { hide } } }
  return hide
}

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  delete (window as unknown as { Capacitor?: unknown }).Capacitor
})

describe('index.html 부팅 커버 실패 안전 타이머', () => {
  it('앱 번들이 깨져도 도는 고전 스크립트다 — type="module" 이면 defer 되고 Vite 변환 대상이 된다', () => {
    expect(INLINE_SCRIPT).toContain('boot-cover')
    expect(HTML).toContain('<script>')
  })

  it('부팅이 끝나지 못하면 8초 뒤 커버를 걷고 네이티브 스플래시도 내린다', () => {
    vi.useFakeTimers()
    mountBootCover()
    const hide = stubSplashScreenPlugin()

    runBootCoverScript()
    vi.advanceTimersByTime(8000)

    expect(document.getElementById('boot-cover')).toBeNull()
    // DOM 커버만 걷으면 iOS 는 화면만 돌아오고 터치는 죽은 채다 — `show()` 가 건
    // `isUserInteractionEnabled = false` 는 네이티브 `tearDown()`(=`hide()`)에서만 풀린다.
    expect(hide).toHaveBeenCalledTimes(1)
  })

  it('정상 부팅(커버가 이미 걷힘)이면 아무것도 하지 않는다', () => {
    vi.useFakeTimers()
    const hide = stubSplashScreenPlugin()

    runBootCoverScript()
    vi.advanceTimersByTime(8000)

    // "아직 있을 때만" 가드의 회귀 테스트다. 가드가 없으면 정상 부팅 8초 뒤에 사용자가 마침
    // `지금 적용` 을 눌러 올라간 리로드 커버·네이티브 스플래시까지 이 타이머가 걷어버린다
    // (그 구간은 `apply()` 의 12초 타임아웃 몫이다, [[ADR-117]] 결정 1).
    expect(hide).not.toHaveBeenCalled()
  })

  it('8초 전에는 걷지 않는다 — 상한이 조용히 줄어드는 것을 막는다', () => {
    vi.useFakeTimers()
    mountBootCover()
    stubSplashScreenPlugin()

    runBootCoverScript()
    vi.advanceTimersByTime(7900)

    expect(document.getElementById('boot-cover')).not.toBeNull()
  })

  it('Capacitor 브릿지가 없어도(웹 개발 서버) 던지지 않고 커버는 걷는다', () => {
    vi.useFakeTimers()
    mountBootCover()

    runBootCoverScript()
    expect(() => vi.advanceTimersByTime(8000)).not.toThrow()

    expect(document.getElementById('boot-cover')).toBeNull()
  })
})
