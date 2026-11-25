import { parseRecomputeRequests } from '../recompute-requests'

describe('요청 읽기', () => {
  it('종류를 빼면 넷 다다', () => {
    expect(parseRecomputeRequests('[{"id":"a","from":"2026-09-16","to":"2026-09-20"}]')).toEqual([
      {
        id: 'a',
        from: '2026-09-16',
        to: '2026-09-20',
        kinds: ['cube', 'starforce', 'potential', 'soul_potential'],
        superiorOnly: false,
      },
    ])
  })

  it('superiorOnly 를 읽는다. 빼면 그 날을 통째로 갈아 끼운다', () => {
    const raw = JSON.stringify([
      { id: 's', from: '2026-09-16', to: '2026-09-20', kinds: ['starforce'], superiorOnly: true },
      { id: 'a', from: '2026-09-16', to: '2026-09-20' },
    ])

    expect(parseRecomputeRequests(raw).map((one) => [one.id, one.superiorOnly])).toEqual([
      ['s', true],
      ['a', false],
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
      { id: 'superior', from: '2026-09-16', to: '2026-09-20', superiorOnly: 'yes' },
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
