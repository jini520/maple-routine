// 단상 닉네임을 어디서 꺾는가(사용자 지정). 줄바꿈을 RN 에 맡기면 폭에 따라 `또뽀메/르` 처럼 한 자만 넘어간다.
import { podiumNameLines } from '../podium-name'

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
