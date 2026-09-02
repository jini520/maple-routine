import { DROP_EFFECT_FRAMES, DROP_EFFECT_ORIGINS } from '../drop-effect-layout'
import { buildPillarFrames, buildScreenFrames } from '../frame-layout'

const PHASES = ['pre', 'loop', 'end'] as const

describe('DROP_EFFECT_ORIGINS', () => {
  // 테이블은 에셋 비트맵에서 계측한 값이라 프레임과 인덱스로만 묶여 있다. 에셋을 다시 export 해
  // 프레임 수가 바뀌면 기둥이 엉뚱한 위치로 튀므로, 조용히 어긋나지 않게 개수를 고정한다.
  it.each(PHASES)('%s: origin 개수가 실제 프레임 수와 일치한다', (phase) => {
    expect(DROP_EFFECT_ORIGINS[phase]).toHaveLength(DROP_EFFECT_FRAMES[phase].length)
    expect(DROP_EFFECT_ORIGINS[phase].length).toBeGreaterThan(0)
  })

  it.each(PHASES)('%s: origin이 모두 유한한 양수 좌표다', (phase) => {
    for (const [x, y] of DROP_EFFECT_ORIGINS[phase]) {
      expect(Number.isFinite(x) && x > 0).toBe(true)
      expect(Number.isFinite(y) && y > 0).toBe(true)
    }
  })
})

// ★ 회귀 가드 — **재생은 `source` 를 갈아끼우지 않고 전 프레임을 마운트해 둔다**.
//
// 갈아끼우던 시절, 아직 안 그려 본 프레임으로 바꾸면 디코드가 비동기라 그 한 장이 통째로 비었다.
// 예열로 미리 디코드해 둬도 55장(약 79MB)이 비트맵 캐시 한도를 넘겨 일부가 밀려났고, 밀려난 프레임은
// 자기 차례를 거의 다 놓친 뒤 8ms 만 스쳤다(2026-08-26 갤럭시 Z Flip3 실측 — 버스트 9·12번).
// 그래서 목록을 미리 만들어 **전부 마운트**한다. 이 테스트는 그 목록이 빠짐없이 만들어지는지 본다.
describe('스프라이트 프레임 목록', () => {
  const sizeOf = (): { width: number; height: number } => ({ width: 100, height: 200 })

  it('기둥은 pre·loop·end 를 모두 담고 키가 겹치지 않는다', () => {
    const frames = buildPillarFrames(sizeOf)
    expect(frames).toHaveLength(
      DROP_EFFECT_FRAMES.pre.length + DROP_EFFECT_FRAMES.loop.length + DROP_EFFECT_FRAMES.end.length,
    )
    expect(new Set(frames.map((f) => f.key)).size).toBe(frames.length)
  })

  it('버스트는 screen 전 장을 담는다', () => {
    expect(buildScreenFrames(1.28, sizeOf)).toHaveLength(DROP_EFFECT_FRAMES.screen.length)
  })

  // 크기를 모르는 프레임은 그리지 않는 계약이 그대로다(`frame-layout.ts`).
  it('비트맵 크기를 모르면 그 프레임은 목록에서 빠진다', () => {
    expect(buildPillarFrames(() => null)).toHaveLength(0)
    expect(buildScreenFrames(1.28, () => null)).toHaveLength(0)
  })
})
