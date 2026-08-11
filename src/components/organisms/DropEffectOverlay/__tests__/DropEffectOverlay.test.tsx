// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DROP_EFFECT_FRAMES } from '@core/lib/drop-effect-frames'
import {
  DROP_EFFECT_ORIGINS,
  DROP_PILLAR_SCALE,
  dropFrameTransform,
  screenEffectScale,
} from '@core/lib/drop-effect-layout'
import { DropEffectOverlay } from '../DropEffectOverlay'

// jsdom 은 이미지를 실제로 로드하지 않아 src 를 넣으면 complete 가 계속 false 다. 연출은 프레임을
// 미리 디코드해 두고 complete 를 보고 좌표를 옮기므로(ADR-048), 테스트에서 그 상태를 흉내 낸다.
let restoreComplete: (() => void) | null = null

function setImageComplete(value: boolean): void {
  const proto = window.HTMLImageElement.prototype
  const original = Object.getOwnPropertyDescriptor(proto, 'complete')
  Object.defineProperty(proto, 'complete', { configurable: true, get: () => value })
  restoreComplete ??= () => {
    if (original !== undefined) Object.defineProperty(proto, 'complete', original)
  }
}

beforeEach(() => setImageComplete(true)) // 기본 = 프리로드가 끝난 정상 상황

afterEach(() => {
  restoreComplete?.()
  restoreComplete = null
  cleanup()
  vi.useRealTimers()
})

// 프레임 비트맵은 크기가 제각각이라 src만 바꾸고 transform을 안 맞추면 기둥이 좌우로 흔들린다(ADR-048).
// 지금 붙어 있는 src가 어느 단계 몇 번 프레임인지 역추적해, transform이 그 프레임 origin과 일치하는지 본다.
function expectPillarFrameInSync(pillar: HTMLImageElement): void {
  const src = pillar.getAttribute('src')
  if (src === null || src === '') return // 아직 등장 전(pre 트리거 이전)
  const phase = (['pre', 'loop', 'end'] as const).find((p) => DROP_EFFECT_FRAMES[p].includes(src))
  expect(phase, `알 수 없는 DropEff 프레임: ${src}`).toBeDefined()
  const index = DROP_EFFECT_FRAMES[phase!].indexOf(src)
  expect(pillar.style.transform).toBe(
    dropFrameTransform(DROP_EFFECT_ORIGINS[phase!][index], DROP_PILLAR_SCALE),
  )
}

describe('DropEffectOverlay', () => {
  // 시트(vaul/Radix)가 열려 있으면 dismissable-layer가 body에 pointer-events:none을 걸어(ADR-039),
  // 상속으로 이 오버레이의 탭이 먹지 않고 뒤 시트로 통과된다. 루트가 pointer-events-auto를 잃으면
  // 그 버그가 재발하므로 회귀 방지로 고정한다. (jsdom은 실제 hit-testing을 못 해 클래스로 가드.)
  it('오버레이 루트는 pointer-events-auto로 탭을 받는다', () => {
    render(<DropEffectOverlay itemName="칠흑의 보스 반지" onClose={vi.fn()} />)
    expect(screen.getByTestId('drop-effect-overlay')).toHaveClass('pointer-events-auto')
  })

  // 이 오버레이 위 pointerdown이 시트를 dismiss하지 않도록 BottomSheet의 onPointerDownOutside
  // 가드가 [data-sheet-keep-open] 마커로 인식한다(ADR-039). 마커가 빠지면 연출 탭이 시트를 닫는다.
  it('오버레이 루트에 data-sheet-keep-open 마커가 있다', () => {
    render(<DropEffectOverlay itemName="칠흑의 보스 반지" onClose={vi.fn()} />)
    expect(screen.getByTestId('drop-effect-overlay')).toHaveAttribute('data-sheet-keep-open')
  })

  // 하단-중앙 앵커로는 프레임마다 기둥 축이 최대 26px 어긋난다(ADR-048). pre→loop 전 구간에서
  // src와 transform이 항상 같은 프레임을 가리켜야 하나의 빛 기둥으로 보인다.
  it('pre→loop 재생 내내 src와 transform이 같은 프레임 origin을 가리킨다', () => {
    vi.useFakeTimers()
    render(<DropEffectOverlay itemName="칠흑의 보스 반지" onClose={vi.fn()} />)
    const pillar = screen.getByTestId('drop-effect-pillar') as HTMLImageElement

    let advanced = 0
    while (advanced < 4000) {
      vi.advanceTimersByTime(100)
      advanced += 100
      expectPillarFrameInSync(pillar)
    }
    // pre(8f/14fps=571ms)를 지나 loop 에 진입해 있어야 위 검사가 두 단계를 모두 훑은 것이 된다.
    expect(DROP_EFFECT_FRAMES.loop).toContain(pillar.getAttribute('src'))
  })

  it('탭으로 닫는 end 재생 중에도 src와 transform이 같은 프레임 origin을 가리킨다', () => {
    vi.useFakeTimers()
    render(<DropEffectOverlay itemName="칠흑의 보스 반지" onClose={vi.fn()} />)
    const pillar = screen.getByTestId('drop-effect-pillar') as HTMLImageElement

    vi.advanceTimersByTime(1000)
    fireEvent.click(screen.getByTestId('drop-effect-overlay'))
    expect(DROP_EFFECT_FRAMES.end).toContain(pillar.getAttribute('src'))
    expectPillarFrameInSync(pillar)

    for (let i = 0; i < DROP_EFFECT_FRAMES.end.length - 1; i++) {
      vi.advanceTimersByTime(1000 / 18)
      expectPillarFrameInSync(pillar)
    }
  })

  // 재생 속도는 ADR-103 이 정한 결정이다(1.5배 — screen 22.5 · pre 21 · loop 17.25 · end 18).
  // 배율을 되돌리거나 더 올리면 아래 네 시점이 전부 밀리므로, 상수가 아니라 실제 타임라인으로 고정한다.
  // 아래 시점들은 1배(옛 값)와 2배(너무 빠르다고 반려된 값) 양쪽에서 모두 깨지도록 골랐다.
  it('ScreenEff 8프레임(≈356ms) 시점에 아이템과 기둥이 등장한다', () => {
    vi.useFakeTimers()
    render(<DropEffectOverlay itemName="생명의 연마석" onClose={vi.fn()} />)
    const pillar = screen.getByTestId('drop-effect-pillar') as HTMLImageElement

    vi.advanceTimersByTime(300) // 아직 8프레임 전(2배였다면 이미 등장해 있다)
    expect(pillar.getAttribute('src')).toBeNull()

    vi.advanceTimersByTime(100) // 누적 400ms — 8프레임을 지났다(1배였다면 아직이다)
    expect(DROP_EFFECT_FRAMES.pre).toContain(pillar.getAttribute('src'))
    expect(screen.getByAltText('생명의 연마석').style.opacity).toBe('1')
  })

  it('pre 8프레임(≈381ms)을 지나 loop 로 넘어간다', () => {
    vi.useFakeTimers()
    render(<DropEffectOverlay itemName="칠흑의 보스 반지" onClose={vi.fn()} />)
    const pillar = screen.getByTestId('drop-effect-pillar') as HTMLImageElement

    vi.advanceTimersByTime(700) // 등장 356ms + pre 381ms = 737ms 직전
    expect(DROP_EFFECT_FRAMES.pre).toContain(pillar.getAttribute('src'))

    vi.advanceTimersByTime(100) // 누적 800ms
    expect(DROP_EFFECT_FRAMES.loop).toContain(pillar.getAttribute('src'))
  })

  it('ScreenEff 16프레임(≈711ms)이 끝나면 버스트가 사라진다', () => {
    vi.useFakeTimers()
    render(<DropEffectOverlay itemName="칠흑의 보스 반지" onClose={vi.fn()} />)
    const screenEff = screen.getByTestId('drop-effect-screen')

    vi.advanceTimersByTime(600)
    expect(screenEff.style.opacity).toBe('1')

    vi.advanceTimersByTime(180) // 누적 780ms
    expect(screenEff.style.opacity).toBe('0')
  })

  it('탭하면 end 7프레임(≈389ms) 재생 후 닫힌다', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<DropEffectOverlay itemName="칠흑의 보스 반지" onClose={onClose} />)

    vi.advanceTimersByTime(1000)
    fireEvent.click(screen.getByTestId('drop-effect-overlay'))

    vi.advanceTimersByTime(340)
    expect(onClose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(80) // 누적 420ms
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // 팝인은 fps 가 아니라 CSS transition 이라 fps 를 올려도 혼자 옛 속도로 남는다. 버스트 종료(711ms)와
  // 팝인 종료(356+333=689ms)가 함께 끝나도록 같은 배율로 줄여둔 값이다(ADR-103 결정 2).
  it('아이템 팝인은 버스트 종료에 맞춘 1.5배속이다', () => {
    render(<DropEffectOverlay itemName="생명의 연마석" onClose={vi.fn()} />)
    const item = screen.getByAltText('생명의 연마석')

    expect(item.style.transition).toBe(
      'opacity .233s ease, transform .333s cubic-bezier(.2,1.3,.35,1)',
    )
  })

  // src 교체는 비동기다 — 새 프레임 픽셀이 아직 안 그려졌는데 transform 만 먼저 옮기면 이전 프레임이
  // 새 origin 으로 그려져 딱 한 프레임 옆으로 튄다. 프레임 크기가 제각각이라 그 오차가 최대 26px.
  it('프레임 픽셀이 아직 준비되지 않았으면 transform을 먼저 옮기지 않는다', () => {
    setImageComplete(false)
    vi.useFakeTimers()
    render(<DropEffectOverlay itemName="칠흑의 보스 반지" onClose={vi.fn()} />)
    const pillar = screen.getByTestId('drop-effect-pillar') as HTMLImageElement

    vi.advanceTimersByTime(2000)

    // 프레임 진행은 계속되지만(src 는 붙는다)
    expect(DROP_EFFECT_FRAMES.pre.concat(DROP_EFFECT_FRAMES.loop)).toContain(
      pillar.getAttribute('src'),
    )
    // 좌표는 픽셀보다 앞서가지 않고, 좌표 없는 프레임을 보여주지도 않는다.
    expect(pillar.style.transform).toBe('')
    expect(pillar.style.opacity).not.toBe('1')
  })

  // object-fit:cover 는 프레임마다 자기 비트맵 크기로 배율을 따로 잡아(1.232~2.198) 버스트가 들썩인다.
  // 전 프레임이 같은 배율로 그려져야 한다(ADR-048 결정 5).
  it('ScreenEff는 프레임별 cover 배율 대신 단일 고정 배율로 그린다', () => {
    render(<DropEffectOverlay itemName="칠흑의 보스 반지" onClose={vi.fn()} />)
    const screenEff = screen.getByTestId('drop-effect-screen')

    expect(screenEff).not.toHaveClass('object-cover')
    // preflight 의 img{max-width:100%} 가 살아 있으면 큰 프레임이 컨테이너 폭으로 줄어 배율이 깨진다.
    expect(screenEff).toHaveClass('max-w-none')
    expect(screenEff.style.transform).toBe(
      `translate(-50%, -50%) scale(${screenEffectScale(window.innerWidth, window.innerHeight)})`,
    )
  })
})

describe('screenEffectScale', () => {
  // 기준 프레임(1146x685)이 화면을 덮는 배율. 세로로 긴 모바일 뷰포트는 세로가 결정한다.
  it('세로가 긴 뷰포트는 높이 기준으로 덮는다', () => {
    expect(screenEffectScale(390, 844)).toBe(1.232)
  })

  it('가로가 긴 뷰포트는 너비 기준으로 덮는다', () => {
    expect(screenEffectScale(1600, 500)).toBe(1.396)
  })
})
