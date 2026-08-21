import { useToastStore } from '../store'

beforeEach(() => {
  useToastStore.setState({ toasts: [], queue: [] })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useToastStore', () => {
  it('초기 상태는 비어 있다', () => {
    const { toasts, queue } = useToastStore.getState()
    expect(toasts).toEqual([])
    expect(queue).toEqual([])
  })

  it('showSuccess는 duration 2000ms짜리 success 토스트를 추가한다', () => {
    useToastStore.getState().showSuccess('저장했어요')

    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({ variant: 'success', message: '저장했어요', duration: 2000 })
  })

  it('showInfo는 duration 2500ms짜리 info 토스트를 추가한다', () => {
    useToastStore.getState().showInfo('목록을 불러오지 못했어요')

    expect(useToastStore.getState().toasts[0]).toMatchObject({
      variant: 'info',
      message: '목록을 불러오지 못했어요',
      duration: 2500,
    })
  })

  it('showError는 duration이 null이고 action을 그대로 담는다', () => {
    const onClick = jest.fn()
    useToastStore.getState().showError('저장하지 못했습니다', { label: '다시 시도', onClick })

    expect(useToastStore.getState().toasts[0]).toMatchObject({
      variant: 'error',
      message: '저장하지 못했습니다',
      duration: null,
      action: { label: '다시 시도', onClick },
    })
  })

  it('showError를 action 없이 호출할 수 있다', () => {
    useToastStore.getState().showError('저장하지 못했습니다')

    expect(useToastStore.getState().toasts[0].action).toBeUndefined()
  })

  it('토스트마다 서로 다른 id를 가진다', () => {
    useToastStore.getState().showSuccess('a')
    useToastStore.getState().showSuccess('b')

    const [first, second] = useToastStore.getState().toasts
    expect(first.id).not.toBe(second.id)
  })

  it('최대 3개까지만 toasts에 담기고 4번째부터는 queue에 대기한다', () => {
    useToastStore.getState().showSuccess('1')
    useToastStore.getState().showSuccess('2')
    useToastStore.getState().showSuccess('3')
    useToastStore.getState().showSuccess('4')

    const { toasts, queue } = useToastStore.getState()
    expect(toasts.map((t) => t.message)).toEqual(['1', '2', '3'])
    expect(queue.map((t) => t.message)).toEqual(['4'])
  })

  it('dismiss하면 대기열의 다음 항목이 toasts로 승격된다', () => {
    useToastStore.getState().showSuccess('1')
    useToastStore.getState().showSuccess('2')
    useToastStore.getState().showSuccess('3')
    useToastStore.getState().showSuccess('4')

    const firstId = useToastStore.getState().toasts[0].id
    useToastStore.getState().dismiss(firstId)

    const { toasts, queue } = useToastStore.getState()
    expect(toasts.map((t) => t.message)).toEqual(['2', '3', '4'])
    expect(queue).toHaveLength(0)
  })

  it('보이지 않는(존재하지 않는) id로 dismiss하면 아무 변화가 없다', () => {
    useToastStore.getState().showSuccess('1')

    useToastStore.getState().dismiss('없는-id')

    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('success는 2000ms 후 자동으로 사라진다', () => {
    jest.useFakeTimers()
    useToastStore.getState().showSuccess('저장했어요')

    jest.advanceTimersByTime(1999)
    expect(useToastStore.getState().toasts).toHaveLength(1)

    jest.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('info는 2500ms 후 자동으로 사라진다', () => {
    jest.useFakeTimers()
    useToastStore.getState().showInfo('안내')

    jest.advanceTimersByTime(2500)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('error는 duration이 없어 시간이 지나도 자동으로 사라지지 않는다', () => {
    jest.useFakeTimers()
    useToastStore.getState().showError('실패')

    jest.advanceTimersByTime(60_000)
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('큐에서 승격된 항목도 자기 duration만큼 지나면 자동으로 사라진다', () => {
    jest.useFakeTimers()
    useToastStore.getState().showSuccess('1')
    useToastStore.getState().showSuccess('2')
    useToastStore.getState().showSuccess('3')
    useToastStore.getState().showSuccess('4')

    useToastStore.getState().dismiss(useToastStore.getState().toasts[0].id)
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['2', '3', '4'])

    jest.advanceTimersByTime(2000)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('수동으로 먼저 dismiss한 항목의 예약된 자동 소멸 타이머는 취소된다', () => {
    jest.useFakeTimers()
    useToastStore.getState().showSuccess('1')
    useToastStore.getState().showSuccess('2')
    const firstId = useToastStore.getState().toasts[0].id

    useToastStore.getState().dismiss(firstId)
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['2'])

    // '1'의 취소된 타이머가 뒤늦게 발화해 다른 항목을 잘못 지우지 않는지 확인 — '2'는 자기 타이머로 정상 소멸.
    jest.advanceTimersByTime(2000)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
