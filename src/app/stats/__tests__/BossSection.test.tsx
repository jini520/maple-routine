import { act, fireEvent, within } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { BossSection } from '../BossSection'

function 결정석(ocid: string, bosses: [string, 'hard' | 'normal' | 'extreme', number][]): unknown {
  return {
    kind: 'bossCrystal',
    ocid,
    characterName: ocid,
    payoutMeso: bosses.reduce((sum, [, , meso]) => sum + meso, 0),
    count: bosses.length,
    bosses: bosses.map(([bossKey, difficulty, payoutMeso]) => ({ bossKey, bossName: bossKey, difficulty, payoutMeso })),
  }
}

const days = {
  '2026-09-24': [결정석('a', [['chosen_seren', 'extreme', 720_000_000], ['lucid', 'hard', 300_000_000]])],
  '2026-09-25': [결정석('b', [['chosen_seren', 'hard', 610_000_000], ['lucid', 'hard', 300_000_000]])],
} as never
const range = { from: '2026-09-24', to: '2026-09-30' }

beforeEach(() => {
  installNoopNativePorts()
})

describe('BossSection', () => {
  it('난이도별은 큰 순서의 타일이고 난이도 배지와 처치 횟수를 적는다', async () => {
    const view = await renderOverlay(<BossSection days={days} range={range} cycle="weekly" />)

    const tiles = view.getAllByTestId(/^stats-boss-tile-/)
    expect(tiles.map((tile) => tile.props.testID)).toEqual([
      'stats-boss-tile-chosen_seren|extreme',
      'stats-boss-tile-chosen_seren|hard',
      'stats-boss-tile-lucid|hard',
    ])
    const lucid = view.getByTestId('stats-boss-tile-lucid|hard')
    expect(within(lucid).getByText('루시드')).toBeTruthy()
    expect(within(lucid).getByText('하드')).toBeTruthy()
    expect(within(lucid).getByText('2회 처치')).toBeTruthy()
    expect(within(lucid).getByText('6억')).toBeTruthy()
    expect(view.getByTestId('stats-boss-headline').props.children).toBe('처치 4회')
  })

  it('보스별은 난이도를 합치고 배지를 안 단다', async () => {
    const view = await renderOverlay(<BossSection days={days} range={range} cycle="weekly" />)

    await act(async () => {
      fireEvent.press(view.getByLabelText('보스별'))
    })

    const seren = view.getByTestId('stats-boss-tile-chosen_seren')
    expect(within(seren).getByText('세렌')).toBeTruthy()
    expect(within(seren).getByText('2회 처치')).toBeTruthy()
    expect(within(seren).getByText('13.3억')).toBeTruthy()
    expect(within(seren).queryByText('하드')).toBeNull()
  })

  it('처치 기록이 없으면 한 줄을 적는다', async () => {
    const view = await renderOverlay(<BossSection days={{} as never} range={range} cycle="weekly" />)

    expect(view.getByText('이 기간에 결정석을 판 보스가 없어요')).toBeTruthy()
  })
})
