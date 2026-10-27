/**
 * 고가 드롭 카드의 홀로그램 빛. 기울기 센서를 붙잡고 놓는 일이 이 부품의 책임이라, 그 수명을 본다.
 */
import { act, fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { __resetNativePortsForTest, setTiltPort } from '../../../../native/ports'
import { HologramSheen } from '../HologramSheen'

jest.mock('react-native-reanimated', () =>
  require('../../../__tests__/reduced-motion').reanimatedWithReducedMotion(),
)
import { mockReducedMotion } from '../../../__tests__/reduced-motion'

/** 크기를 알아야 빛을 얼마나 옮길지 정하므로, 구독은 첫 레이아웃 뒤에 시작한다. */
async function layout(view: Awaited<ReturnType<typeof renderAtom>>, height = 68): Promise<void> {
  await act(async () => {
    fireEvent(view.getByTestId('hologram-sheen'), 'layout', { nativeEvent: { layout: { width: 320, height } } })
  })
}

describe('HologramSheen', () => {
  const release = jest.fn()
  const subscribe = jest.fn(() => release)

  beforeEach(() => {
    release.mockClear()
    subscribe.mockClear()
    setTiltPort({ subscribe })
  })

  afterEach(() => {
    mockReducedMotion(false)
    __resetNativePortsForTest()
  })

  it('붙으면 기울기를 구독하고, 떨어지면 놓는다', async () => {
    const view = await renderAtom(<HologramSheen variant="card" />)
    await layout(view)
    expect(subscribe).toHaveBeenCalledTimes(1)

    await view.unmount()
    // 놓지 않으면 카드가 사라진 뒤에도 센서가 계속 돈다.
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('움직임 줄이기면 구독하지 않고 빛은 그대로 그린다', async () => {
    mockReducedMotion(true)
    const view = await renderAtom(<HologramSheen variant="row" />)
    await layout(view)

    expect(subscribe).not.toHaveBeenCalled()
    expect(view.getByTestId('hologram-sheen')).toBeTruthy()
  })

  it('접힌 높이는 빛이 하나이고, 펼친 높이는 띠마다 하나씩 늘어난다', async () => {
    const view = await renderAtom(<HologramSheen variant="card" />)
    await layout(view)
    expect(view.getAllByTestId('hologram-sheen-light')).toHaveLength(1)

    // 빛 하나로 큰 카드를 덮으면 빛의 중심이 카드 밖까지 나가 한쪽 가장자리만 빛난다.
    await layout(view, 600)
    expect(view.getAllByTestId('hologram-sheen-light')).toHaveLength(4)
  })
})
