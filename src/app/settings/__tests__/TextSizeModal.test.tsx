// 글자 크기 모달이 지키는 것. **고르면 그 자리에서 미리보기 글이 새 크기로 바뀐다.**
//
// 스토어를 목으로 덮지 않는다. 고른 단계가 저장 · 배수 · atom 을 거쳐 미리보기 글의 크기까지 닿는지가
// 이 화면의 계약이라, 중간을 끊으면 그 배선을 못 본다.
import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderOverlay } from '../../../components/__tests__/render-atom'
import { useTextSizeStore } from '../../../features/text-size/store'
import { TEXT_SIZE_LABELS, TEXT_SIZES } from '../../../lib/text-size'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { __resetTextScaleForTest } from '../../../theme/text-scale'
import { TEXT_SIZE_PREVIEW, TextSizeModal } from '../TextSizeModal'

beforeEach(() => {
  installFakePreferences()
  __resetTextScaleForTest()
  useTextSizeStore.setState({ size: 'default' })
})

it('네 단계를 모두 고를 수 있다', async () => {
  const view = await renderOverlay(<TextSizeModal onClose={jest.fn()} />)

  for (const size of TEXT_SIZES) expect(view.getByText(TEXT_SIZE_LABELS[size])).toBeTruthy()
})

it('고르면 닫지 않고 미리보기 글이 바로 새 크기로 그려진다', async () => {
  const onClose = jest.fn()
  const view = await renderOverlay(<TextSizeModal onClose={onClose} />)
  const before = flattenStyle(view.getByText(TEXT_SIZE_PREVIEW).props.style).fontSize as number

  await act(async () => {
    fireEvent.press(view.getByText(TEXT_SIZE_LABELS.xlarge))
  })

  expect(flattenStyle(view.getByText(TEXT_SIZE_PREVIEW).props.style).fontSize).toBeCloseTo(before * 1.2)
  expect(useTextSizeStore.getState().size).toBe('xlarge')
  expect(onClose).not.toHaveBeenCalled()
})
