// 단상 닉네임을 어디서 꺾는가(사용자 지정). 줄바꿈을 RN 에 맡기면 폭에 따라 `또뽀메/르` 처럼 한 자만 넘어간다.
import { podiumAmountScale, podiumBlockPadding, podiumNameLines } from '../podium-name'

describe('podiumNameLines', () => {
  it.each(['렌', '지내우시', 'abcd'])('네 자까지(%p)는 블록을 조금 넘쳐도 한 줄이다', (name) => {
    expect(podiumNameLines(name)).toEqual([name])
  })

  it('다섯 자는 3 / 2 로 꺾는다', () => {
    expect(podiumNameLines('또뽀메르다')).toEqual(['또뽀메', '르다'])
  })

  it('여섯 자는 3 / 3 으로 꺾는다', () => {
    expect(podiumNameLines('조용한메이플')).toEqual(['조용한', '메이플'])
  })

  it('일곱 자 넘는 영문 이름도 두 줄을 넘지 않고, 앞줄이 하나 더 길다', () => {
    expect(podiumNameLines('MapleRoutine1')).toEqual(['MapleRo', 'utine1'])
  })
})

// 블록마다 제 줄 수만 쓰면 1위가 한 줄이고 2위가 두 줄일 때 2위 블록이 더 높아진다.
describe('podiumBlockPadding', () => {
  const 줄높이 = 15 * 1.2
  const 조합 = [1, 2].flatMap((a) => [1, 2].flatMap((b) => [1, 2].map((c) => [a, b, c])))

  it.each(조합)('줄 수가 %p · %p · %p 여도 블록은 1 · 2 · 3위 차례로 낮아진다', (...lineCounts) => {
    const 높이 = lineCounts.map((lines, rank) => lines * 줄높이 + podiumBlockPadding(lineCounts, rank, 줄높이))
    expect(높이[0]).toBeGreaterThan(높이[1]!)
    expect(높이[1]).toBeGreaterThan(높이[2]!)
  })
})

// 한 블록만 줄이면 `+12.43억` 만 옆의 `+5.61억` 보다 작아 보인다(사용자 지정).
describe('podiumAmountScale', () => {
  it('가장 많이 줄여야 하는 금액의 비율을 고르고, 그 비율이면 셋 다 블록에 들어간다', () => {
    const widths = [52, 40, 40]
    const scale = podiumAmountScale(widths, 41)

    expect(scale).toBeLessThan(1)
    for (const width of widths) expect(width * scale).toBeLessThanOrEqual(41)
  })

  it('셋 다 들어가면 줄이지 않는다. 아직 못 잰 폭이 있어도 마찬가지다', () => {
    expect(podiumAmountScale([30, 40], 41)).toBe(1)
    expect(podiumAmountScale([], 0)).toBe(1)
  })
})
