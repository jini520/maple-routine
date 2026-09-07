import { screen } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { DataFreshness } from '../DataFreshness'

describe('갱신 시각 한 줄', () => {
  it('시각을 그린다', async () => {
    await renderAtom(<DataFreshness fetchedAt={new Date(2026, 8, 8, 14, 3, 22).toISOString()} />)

    expect(screen.getByText('14:03:22 기준')).toBeTruthy()
  })

  // 빈 줄을 두면 제목 아래가 이유 없이 벌어진다.
  it('받은 적이 없으면 아무것도 안 그린다', async () => {
    await renderAtom(<DataFreshness fetchedAt={null} />)

    expect(screen.queryByTestId('data-freshness')).toBeNull()
  })

  it('못 읽는 값도 안 그린다', async () => {
    await renderAtom(<DataFreshness fetchedAt="시각이 아니다" />)

    expect(screen.queryByTestId('data-freshness')).toBeNull()
  })
})
