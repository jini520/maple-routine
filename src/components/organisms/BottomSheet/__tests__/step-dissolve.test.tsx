// 단계를 갈아탈 때 서는 흐림 층의 **타이밍**.
//
// 여기서 보는 것은 흐림이 서느냐가 아니라 **언제 서느냐** 다. 새 단계가 그려진 커밋에 흐림이
// 아직 없으면 그 커밋이 그대로 화면에 나가고, 새 화면이 또렷한 채로 한두 프레임 번쩍인다
// (사용자 보고 · 60fps 녹화의 f01062~f01063 에서 확인).
//
// 그래서 커밋마다 기록을 남기고, 새 단계를 그린 커밋 중 흐림이 없는 것이 하나도 없어야 한다고
// 못박는다. 렌더가 아니라 커밋인 것이 핵심이다. 렌더 도중에 버려지는 패스는 화면에 안 나간다.
import { useLayoutEffect } from 'react'
import { render } from '@testing-library/react-native'

import { useStepDissolve } from '../step-dissolve'

/** 커밋된 것만 쌓인다. 버려진 렌더 패스의 레이아웃 효과는 안 돈다. */
const committed: Array<{ step: string; busy: boolean }> = []

function Probe({ stepKey }: { stepKey: string }): null {
  const { busy } = useStepDissolve(stepKey)
  useLayoutEffect(() => {
    committed.push({ step: stepKey, busy })
  })
  return null
}

beforeEach(() => {
  committed.length = 0
})

describe('useStepDissolve', () => {
  it('처음 그릴 때는 흐리지 않다', async () => {
    await render(<Probe stepKey="갈래" />)

    expect(committed).toEqual([{ step: '갈래', busy: false }])
  })

  it('단계가 바뀌면 **그 단계를 그린 첫 커밋부터** 흐림이 서 있다', async () => {
    const view = await render(<Probe stepKey="갈래" />)
    committed.length = 0

    await view.rerender(<Probe stepKey="사냥" />)

    expect(committed.length).toBeGreaterThan(0)
    expect(committed.filter((commit) => !commit.busy)).toEqual([])
  })
})
