jest.mock('../../../features/game-data/sync', () => ({
  __esModule: true,
  retryGameData: jest.fn(async () => {}),
  confirmGameData: jest.fn(),
}))

import { fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { confirmGameData, retryGameData, type GameDataStatus } from '../../../features/game-data/sync'
import { GameDataLock } from '../GameDataLock'

const status = (phase: GameDataStatus['phase'], progress: Partial<GameDataStatus['progress']> = {}): GameDataStatus => ({
  phase,
  progress: { dataBytes: null, imageBytes: 0, imageTotal: 0, ...progress },
})

describe('GameDataLock', () => {
  beforeEach(() => jest.clearAllMocks())

  it('받기 전에는 두 데이터의 크기와 합계를 보이고 확인을 부른다', async () => {
    const view = await renderOverlay(
      <GameDataLock status={status('confirm', { dataBytes: 359_044, imageTotal: 5_105_760 })} />,
    )

    expect(view.getByText('추가 리소스 다운로드')).toBeTruthy()
    expect(view.getByText('0.4MB')).toBeTruthy()
    expect(view.getByText('5.1MB')).toBeTruthy()
    expect(view.getByText('모두 5.5MB')).toBeTruthy()
    fireEvent.press(view.getByText('확인'))
    expect(confirmGameData).toHaveBeenCalledTimes(1)
  })

  it('게임 데이터를 받기 전이라 크기를 모르면 확인을 누를 수 없다', async () => {
    const view = await renderOverlay(<GameDataLock status={status('confirm')} />)

    expect(view.queryByText(/모두/)).toBeNull()
    fireEvent.press(view.getByText('확인'))
    expect(confirmGameData).not.toHaveBeenCalled()
  })

  it('게임 데이터를 받는 동안은 그 줄만 돌고 이미지 데이터는 대기다', async () => {
    const view = await renderOverlay(<GameDataLock status={status('downloading')} />)

    expect(view.getByText('게임 데이터를 받고 있어요')).toBeTruthy()
    expect(view.getByTestId('game-data-step-data-run')).toBeTruthy()
    expect(view.getByTestId('game-data-step-images-wait')).toBeTruthy()
  })

  it('이미지를 받는 동안 두 데이터를 합친 MB 와 퍼센트를 보인다', async () => {
    const view = await renderOverlay(
      <GameDataLock status={status('downloading', { dataBytes: 359_044, imageBytes: 1_900_000, imageTotal: 5_105_760 })} />,
    )

    expect(view.getByTestId('game-data-step-data-done')).toBeTruthy()
    expect(view.getByText('0.4MB')).toBeTruthy()
    expect(view.getByText('1.9 / 5.1MB')).toBeTruthy()
    expect(view.getByText('2.3 / 5.5MB')).toBeTruthy()
    expect(view.getByText('41%')).toBeTruthy()
  })

  it('받을 이미지가 없으면 이미지 데이터 줄도 끝난 것이다', async () => {
    const view = await renderOverlay(<GameDataLock status={status('downloading', { dataBytes: 359_044 })} />)

    expect(view.getByTestId('game-data-step-images-done')).toBeTruthy()
  })

  it('실패하면 같은 자리에 실패 상태를 그리고 다시 시도를 부른다', async () => {
    const view = await renderOverlay(<GameDataLock status={status('failed')} />)

    expect(view.getByText('게임 데이터를 받지 못했습니다')).toBeTruthy()
    fireEvent.press(view.getByText('다시 시도'))
    expect(retryGameData).toHaveBeenCalledTimes(1)
  })
})
