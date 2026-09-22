// 수익·지출 탭의 첫 수집은 보스 기록을 수십 건, 처치 날짜를 백 건 넘게 적는다. 판을 구독하는 가격 입력 버튼은
// 하단바 위 포털(`BottomBarOverlay`) 안이라, 다시 그려질 때마다 포털이 effect 안에서 호스트로 갱신을 보낸다.
// 쓰기마다 판 알림이 나가면 그 갱신이 쉬지 않고 이어져 React 가 `Maximum update depth exceeded` 를 낸다.
// 저장 계층 · 판 구독 · 포털은 실제 것이고, 버튼만 판을 구독하는 최소 컴포넌트로 세운다.
import { useEffect, useSyncExternalStore } from 'react'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { PortalProvider } from '@gorhom/portal'

import { BottomBarOverlay, BottomBarOverlayHost } from '../../../components/organisms/BottomBar/BottomBarOverlay'
import { setBossProfitDefeatedOn } from '../../../storage/boss-profit'
import { batchRecordWrites } from '../../../storage/record-revision-batch'
import { bossRecordsStamp, subscribeBossRecordsStamp } from '../period-cache'

jest.mock('../../../storage/sqlite/db', () => ({
  getBossProfitDb: async () => ({ run: async () => ({ changes: { changes: 1 } }), query: async () => ({ values: [] }) }),
}))

/** 버튼이 다시 그려져 커밋된 횟수 */
const committed = jest.fn()

function PriceButton(): React.JSX.Element {
  const stamp = useSyncExternalStore(subscribeBossRecordsStamp, bossRecordsStamp)
  useEffect(() => {
    committed()
  })
  return (
    <BottomBarOverlay>
      <Text>{stamp}</Text>
    </BottomBarOverlay>
  )
}

async function writeDates(count: number): Promise<void> {
  for (let index = 0; index < count; index++) {
    await setBossProfitDefeatedOn(
      { ocid: 'ocid-1', bossKey: `boss-${index}`, difficulty: 'hard', periodKey: '2026-09-17' },
      '2026-09-18',
    )
  }
}

/** 쓰기를 act 밖에서 돌린다. act 는 갱신을 한데 모아 실제 앱의 이어지는 커밋을 못 만든다. */
async function burst(write: () => Promise<void>): Promise<string[]> {
  const errors: string[] = []
  const spy = jest.spyOn(console, 'error').mockImplementation((message: unknown) => {
    errors.push(String(message))
  })
  const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  await render(
    <PortalProvider>
      <PriceButton />
      <BottomBarOverlayHost />
    </PortalProvider>,
  )
  committed.mockClear()
  environment.IS_REACT_ACT_ENVIRONMENT = false
  try {
    await write().catch((error: unknown) => errors.push(String(error)))
    await new Promise((resolve) => setTimeout(resolve, 50))
  } finally {
    environment.IS_REACT_ACT_ENVIRONMENT = true
    spy.mockRestore()
  }
  return errors.filter((message) => message.includes('Maximum update depth'))
}

it('묶지 않으면 쓰기마다 버튼이 다시 그려지고 React 가 경고를 낸다', async () => {
  const warnings = await burst(() => writeDates(150))

  expect(warnings.length).toBeGreaterThan(0)
})

it('쓰기를 묶으면 버튼은 끝날 때 한 번 다시 그려지고 경고가 없다', async () => {
  const warnings = await burst(() => batchRecordWrites(() => writeDates(150)))

  expect(warnings).toEqual([])
  expect(committed).toHaveBeenCalledTimes(1)
})
