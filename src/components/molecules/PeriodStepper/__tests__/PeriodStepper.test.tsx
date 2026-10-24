/**
 * 기간 이동 줄. 다섯 화면이 같은 부품을 쓰므로, 화면마다 달랐던 점(연도 · 왼쪽 겹화살표)이 받은 값으로만 갈리는지 본다.
 */
import { fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { __resetNativePortsForTest, setHapticsPort } from '../../../../native/ports'
import { PeriodStepper } from '../PeriodStepper'

const BASE = {
  primary: '이번 주',
  secondary: '10월 23일 ~ 10월 29일',
  prev: { label: '이전 기간', onPress: () => {} },
  next: { label: '다음 기간', onPress: () => {} },
}

describe('PeriodStepper', () => {
  const tap = jest.fn(async () => undefined)

  beforeEach(() => {
    tap.mockClear()
    setHapticsPort({ tap, select: async () => {} })
  })

  afterEach(__resetNativePortsForTest)

  it('쓸 수 없는 화살표는 숨지 않고 막힌다', async () => {
    const onNext = jest.fn()
    const { getByLabelText } = await renderAtom(
      <PeriodStepper
        {...BASE}
        next={{ label: '다음 기간', disabled: true, onPress: onNext }}
        jumpForward={{ label: '이번 주로 이동', disabled: true, onPress: () => {} }}
      />,
    )

    // 숨기면 줄 폭이 바뀌어 기간 이름이 흔들린다.
    expect(getByLabelText('다음 기간')).toBeDisabled()
    expect(getByLabelText('이번 주로 이동')).toBeDisabled()
    fireEvent.press(getByLabelText('다음 기간'))
    expect(onNext).not.toHaveBeenCalled()
    expect(tap).not.toHaveBeenCalled()
  })

  it('누르면 두드리고 그 화살표의 동작을 부른다', async () => {
    const onPrev = jest.fn()
    const { getByLabelText } = await renderAtom(
      <PeriodStepper {...BASE} prev={{ label: '이전 기간', onPress: onPrev }} />,
    )

    fireEvent.press(getByLabelText('이전 기간'))

    expect(tap).toHaveBeenCalledTimes(1)
    expect(onPrev).toHaveBeenCalledTimes(1)
  })

  it('연도와 겹화살표는 받은 값이 있을 때만 선다', async () => {
    const bare = await renderAtom(<PeriodStepper {...BASE} yearTestID="year" />)
    expect(bare.queryByTestId('year')).toBeNull()
    expect(bare.queryByLabelText('이번 주로 이동')).toBeNull()

    const full = await renderAtom(
      <PeriodStepper
        {...BASE}
        year="2025"
        yearTestID="year"
        jumpBack={{ label: '이번 주로 돌아가기', onPress: () => {} }}
        jumpForward={{ label: '이번 주로 이동', onPress: () => {} }}
      />,
    )
    expect(full.getByTestId('year')).toHaveTextContent('2025')
    expect(full.getByLabelText('이번 주로 돌아가기')).toBeTruthy()
    expect(full.getByLabelText('이번 주로 이동')).toBeTruthy()
  })

  it('이름과 날짜가 같으면 날짜를 한 번만 적는다', async () => {
    const { getAllByText } = await renderAtom(
      <PeriodStepper {...BASE} primary="2026년 3월" secondary="2026년 3월" />,
    )

    expect(getAllByText('2026년 3월')).toHaveLength(1)
  })
})
