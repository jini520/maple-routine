// 화면 머리글 아래의 안내 띠. 결산 중 · 넥슨 점검 중 · 직접 완료 열림 셋이 같은 모양으로 서고, 다른 것은 색과 문구뿐이다.
import { act, fireEvent, render } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { ClockIcon } from '../../../atoms'
import { InfoStrip, type InfoStripProps } from '../InfoStrip'

function 띠(overrides: Partial<InfoStripProps> = {}): ReturnType<typeof render> {
  return renderAtom(
    <InfoStrip
      testID="strip"
      tone="settlement"
      icon={ClockIcon}
      title="넥슨이 결산 중입니다."
      detail="결산이 끝나면 어제 기록이 들어옵니다."
      infoLabel="결산이 무엇인지 보기"
      onPressInfo={() => {}}
      closeLabel="결산 안내 닫기"
      onClose={() => {}}
      {...overrides}
    />,
  )
}

describe('모양', () => {
  // 한 문단으로 흘리면 폭에 따라 접히는 자리가 달라져 문장 가운데가 끊긴다.
  it('첫 줄과 둘째 줄을 각자의 글자로 그린다', async () => {
    const view = await 띠()

    expect(view.getByText('넥슨이 결산 중입니다.')).toBeTruthy()
    expect(view.getByText('결산이 끝나면 어제 기록이 들어옵니다.')).toBeTruthy()
  })

  it.each(['settlement', 'primary'] as const)('%s 색 묶음도 본문과 닫기를 같이 그린다', async (tone) => {
    const view = await 띠({ tone })

    expect(view.getByRole('button', { name: '결산이 무엇인지 보기' })).toBeTruthy()
    expect(view.getByRole('button', { name: '결산 안내 닫기' })).toBeTruthy()
  })
})

describe('누르는 자리', () => {
  it('본문을 누르면 안내를 열고, 닫기를 누르면 닫기만 한다', async () => {
    const onPressInfo = jest.fn()
    const onClose = jest.fn()
    const view = await 띠({ onPressInfo, onClose })

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '결산 안내 닫기' }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPressInfo).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.press(view.getByRole('button', { name: '결산이 무엇인지 보기' }))
    })
    expect(onPressInfo).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // 묶음에 FAQ 문항이 없으면 띠는 서되 열 시트가 없다.
  it('안내가 없으면 본문이 눌리지 않는다', async () => {
    const onPressInfo = jest.fn()
    const view = await 띠({ onPressInfo, infoDisabled: true })

    const body = view.getByRole('button', { name: '결산이 무엇인지 보기' })
    await act(async () => {
      fireEvent.press(body)
    })
    expect(onPressInfo).not.toHaveBeenCalled()
    expect(body.props.accessibilityState?.disabled).toBe(true)
  })

  // 닫기 아이콘은 16 이다. 누르는 영역이 권장 타깃 44 에 못 미치면 띠를 닫으려다 안내가 열린다.
  it('닫기의 누르는 영역이 44 이상이다', async () => {
    const view = await 띠()

    const hitSlop = view.getByRole('button', { name: '결산 안내 닫기' }).props.hitSlop as number
    expect(16 + hitSlop * 2).toBeGreaterThanOrEqual(44)
  })
})
