import { parseRecomputeRequests, recomputeDatesOf, type RecomputeRequest } from '../recompute'

const request = (over: Partial<RecomputeRequest> = {}): RecomputeRequest => ({
  id: 'pulse-2026-09',
  from: '2026-09-16',
  to: '2026-09-20',
  kinds: ['cube', 'starforce', 'potential', 'soul_potential'],
  ...over,
})

describe('요청 읽기', () => {
  it('종류를 빼면 넷 다다', () => {
    expect(parseRecomputeRequests('[{"id":"a","from":"2026-09-16","to":"2026-09-20"}]')).toEqual([
      { id: 'a', from: '2026-09-16', to: '2026-09-20', kinds: ['cube', 'starforce', 'potential', 'soul_potential'] },
    ])
  })

  // 고장 난 요청 하나가 회차를 막으면 안 된다. 멀쩡한 요청은 그대로 돈다.
  it('틀린 요청만 버린다', () => {
    const raw = JSON.stringify([
      { id: 'ok', from: '2026-09-16', to: '2026-09-20', kinds: ['cube'] },
      { from: '2026-09-16', to: '2026-09-20' },
      { id: 'date', from: '2026-9-16', to: '2026-09-20' },
      { id: 'order', from: '2026-09-20', to: '2026-09-16' },
      { id: 'kind', from: '2026-09-16', to: '2026-09-20', kinds: ['flame'] },
      'x',
    ])

    expect(parseRecomputeRequests(raw).map((one) => one.id)).toEqual(['ok'])
  })

  it('값이 없거나 JSON 배열이 아니면 요청이 없다', () => {
    expect(parseRecomputeRequests(undefined)).toEqual([])
    expect(parseRecomputeRequests('')).toEqual([])
    expect(parseRecomputeRequests('{{')).toEqual([])
    expect(parseRecomputeRequests('{"id":"a"}')).toEqual([])
  })
})

describe('이번 회차에 받을 날', () => {
  it('하한 앞과 오늘 뒤를 잘라 앞에서부터 고른다', () => {
    expect(recomputeDatesOf(request({ from: '2026-09-10', to: '2026-09-30' }), null, '2026-09-15', '2026-09-17', null)).toEqual({
      dates: ['2026-09-15', '2026-09-16', '2026-09-17'],
      last: true,
    })
  })

  // 앞 회차가 받은 날은 다시 받지 않는다.
  it('진행이 있으면 그 다음 날부터다', () => {
    expect(recomputeDatesOf(request(), '2026-09-18', '2026-09-01', '2026-10-26', null)).toEqual({
      dates: ['2026-09-19', '2026-09-20'],
      last: true,
    })
  })

  // 로그인 계정은 서버 스트림을 거쳐 받는다. 한 번에 다 받으면 모든 사용자가 같은 날 서버에 몰린다.
  it('한도가 있으면 그만큼만 고르고 끝이 아니다', () => {
    expect(recomputeDatesOf(request({ to: '2026-09-30' }), null, '2026-09-01', '2026-10-26', 7)).toEqual({
      dates: ['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22'],
      last: false,
    })
  })

  it('기간이 통째로 하한 앞이면 받을 날 없이 끝이다', () => {
    expect(recomputeDatesOf(request(), null, '2026-10-01', '2026-10-26', null)).toEqual({ dates: [], last: true })
  })
})
