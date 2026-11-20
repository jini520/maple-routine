// 화면의 포커스를 기기 DB 쿼리의 구독으로 내린다. 하단바 탭 화면은 안 보여도 마운트된 채라, 구독을 끊지 않으면 다른 탭에서
// 기록을 쓸 때마다 다시 읽는다(#1026).
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, render } from '@testing-library/react-native'
import { Text } from 'react-native'

import { useQuerySubscribed } from '../../features/query/subscription'
import { 초점가짜 } from '../../hooks/__tests__/screen-focus-fake'
import { ScreenQuerySubscription } from '../ScreenQuerySubscription'

const queryFn = jest.fn(async () => 'v')

function Reader(): React.JSX.Element {
  const subscribed = useQuerySubscribed()
  const { data } = useQuery({ queryKey: ['ledger-days', 'a', 'b'], queryFn, staleTime: Number.POSITIVE_INFINITY, subscribed })
  return (
    <>
      <Text>{subscribed ? '구독' : '끊김'}</Text>
      <Text>{data ?? '읽기 전'}</Text>
    </>
  )
}

/** 앱의 클라이언트처럼 캐시를 버리지 않는 클라이언트. 기본값인 5분짜리 캐시 정리 타이머가 남으면 jest 프로세스가 끝나지 않는다. */
function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } })
}

describe('ScreenQuerySubscription', () => {
  it('화면이 안 보이는 동안은 무효화돼도 다시 읽지 않고, 다시 보일 때 한 번 읽는다', async () => {
    const client = newClient()
    const 화면 = 초점가짜(true)
    const view = await render(
      <QueryClientProvider client={client}>
        <ScreenQuerySubscription navigation={화면.navigation as never}>
          <Reader />
        </ScreenQuerySubscription>
      </QueryClientProvider>,
    )
    await act(async () => {})
    expect(view.getByText('구독')).toBeTruthy()
    queryFn.mockClear()

    await 화면.보내기('blur')
    expect(view.getByText('끊김')).toBeTruthy()
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['ledger-days'] })
    })
    expect(queryFn).not.toHaveBeenCalled()

    await 화면.보내기('focus')
    await act(async () => {})
    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  // 모달 · 공급자처럼 화면 밖에서 읽는 쿼리는 늘 구독한다.
  it('감싸개 밖에서는 늘 구독한다', async () => {
    const client = newClient()
    const view = await render(
      <QueryClientProvider client={client}>
        <Reader />
      </QueryClientProvider>,
    )

    expect(view.getByText('구독')).toBeTruthy()
    expect(await view.findByText('v')).toBeTruthy()
  })
})
