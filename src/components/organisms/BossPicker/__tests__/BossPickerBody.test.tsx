// 보스 고르기 본문. 파티 스케줄과 주간 보스 수익 계산기가 함께 쓴다.
import { fireEvent } from '@testing-library/react-native'
import { Text } from 'react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import type { PickerTile } from '../../../../features/party-appointments/boss-picker'
import { BossPickerBody, type BossPickerBodyProps } from '../BossPickerBody'

const 슬라임: PickerTile = { bossKey: 'guardian_angel_slime', difficulty: 'chaos' }
const 카링: PickerTile = { bossKey: 'kaling', difficulty: 'normal' }
const 자쿰: PickerTile = { bossKey: 'zakum', difficulty: 'chaos' }

function props(over: Partial<BossPickerBodyProps> = {}): BossPickerBodyProps {
  return {
    character: <Text>낟낟</Text>,
    groups: [
      { key: 'scheduler', label: '스케줄러', tiles: [슬라임, 카링] },
      { key: 'all', label: '모든 보스', tiles: [자쿰], onlyWithAll: true },
    ],
    isSelected: (tile) => tile.bossKey === 'guardian_angel_slime',
    onPressTile: jest.fn(),
    ...over,
  }
}

describe('BossPickerBody', () => {
  it('첫 줄에 여는 쪽이 준 캐릭터 자리와 모든 보스 토글이 선다', async () => {
    const view = await renderAtom(<BossPickerBody {...props()} />)

    expect(view.getByText('낟낟')).toBeTruthy()
    expect(view.getByLabelText('모든 보스')).toBeTruthy()
  })

  // 이름은 별칭이고 한 줄에 다 적는다. 말줄임으로 자르지 않는다.
  it('타일 이름은 별칭이고 말줄임으로 자르지 않는다', async () => {
    const view = await renderAtom(<BossPickerBody {...props()} />)

    const 이름 = view.getByText('가엔슬')
    expect(이름.props.numberOfLines).toBeUndefined()
  })

  it('고른 타일에만 체크 원이 붙고, 선택됨 글자는 없다', async () => {
    const view = await renderAtom(<BossPickerBody {...props()} />)

    expect(view.getByTestId('boss-picker-check-guardian_angel_slime')).toBeTruthy()
    expect(view.queryByTestId('boss-picker-check-kaling')).toBeNull()
    expect(view.queryByText('선택됨')).toBeNull()
  })

  it('토글을 켜야 모든 보스 묶음이 보인다', async () => {
    const view = await renderAtom(<BossPickerBody {...props()} />)
    expect(view.queryByText('자쿰')).toBeNull()

    await fireEvent.press(view.getByLabelText('모든 보스'))

    expect(view.getByText('자쿰')).toBeTruthy()
  })

  // 계산기는 12개를 고르면 나머지를 고를 수 없다.
  it('잠긴 타일은 흐리고 눌러도 부르지 않는다', async () => {
    const onPressTile = jest.fn()
    const view = await renderAtom(
      <BossPickerBody {...props({ onPressTile, isLocked: (tile) => tile.bossKey === 'kaling' })} />,
    )

    const 잠긴타일 = view.getByLabelText('카링 고르기')
    expect(잠긴타일.props.accessibilityState.disabled).toBe(true)
    expect(flattenStyle(잠긴타일.props.style).opacity as number).toBeLessThan(1)
    await fireEvent.press(잠긴타일)
    expect(onPressTile).not.toHaveBeenCalled()
  })
})
