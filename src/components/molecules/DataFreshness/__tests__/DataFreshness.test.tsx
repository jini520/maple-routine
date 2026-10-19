import { screen } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { DataFreshness } from '../DataFreshness'

describe('갱신 시각 한 줄', () => {
  // **자리는 지킨다.** 값이 들어오는 순간 줄이 생기면 헤더가 16 만큼 내려앉고 화면 전체가 밀린다.
  it('받은 적이 없으면 글자만 빈다', async () => {
    await renderAtom(<DataFreshness fetchedAt={null} />)

    expect(screen.getByTestId('data-freshness')).toHaveTextContent('')
  })

  // 그 높이는 `PageHeader` 가 이 줄을 안 그리는 화면에서 비우는 값과 같아야 한다.
  it('줄 높이를 못박는다', async () => {
    await renderAtom(<DataFreshness fetchedAt={null} />)

    expect(screen.getByTestId('data-freshness').props.style).toEqual(
      expect.objectContaining({ lineHeight: 16 }),
    )
  })
})
