// 계정 단위 강화 사용 내역. 세 엔드포인트가 **같은 껍데기**를 쓴다.
//
// 실측(2026-09-06): 정렬은 최신→과거, `count` 는 상한, 커서는 `date` 없이 이어받고, 같은
// 요청 두 번에 커서·id 목록이 같다.
jest.mock('../../http', () => ({ requestJson: jest.fn() }))

import { fetchEnhancementHistory } from '../client'

const { requestJson: requestJsonMock } = jest.requireMock('../../http') as Record<string, jest.Mock>

function row(id: string, at: string) {
  return { id, character_name: '루디', date_create: at, cube_type: '수상한 큐브' }
}

beforeEach(() => {
  requestJsonMock.mockReset()
})

describe('경로와 질의', () => {
  it('종류마다 자기 경로를 부른다', async () => {
    requestJsonMock.mockResolvedValue({ count: 0, next_cursor: null, cube_history: [] })

    await fetchEnhancementHistory('key', 'cube', { dateKey: '2026-09-04' })

    expect(requestJsonMock).toHaveBeenCalledWith(
      '/maplestory/v1/history/cube?count=1000&date=2026-09-04',
      'key',
    )
  })

  it('스타포스·잠재도 같은 껍데기다', async () => {
    requestJsonMock.mockResolvedValue({ count: 0, next_cursor: null, starforce_history: [] })

    await fetchEnhancementHistory('key', 'starforce', { dateKey: '2026-09-04' })

    expect(requestJsonMock).toHaveBeenCalledWith(
      '/maplestory/v1/history/starforce?count=1000&date=2026-09-04',
      'key',
    )
  })

  // 커서가 날짜 맥락을 든다(실측). 함께 보내면 어느 쪽이 이기는지가 계약에 없다.
  it('커서로 이어받을 때는 날짜를 안 보낸다', async () => {
    requestJsonMock.mockResolvedValue({ count: 0, next_cursor: null, cube_history: [] })

    await fetchEnhancementHistory('key', 'cube', { cursor: 'abc' })

    expect(requestJsonMock).toHaveBeenCalledWith(
      '/maplestory/v1/history/cube?count=1000&cursor=abc',
      'key',
    )
  })
})

describe('응답 정규화', () => {
  it('종류별로 다른 배열 이름을 하나로 접는다', async () => {
    requestJsonMock.mockResolvedValue({
      count: 2,
      next_cursor: 'next',
      potential_history: [row('a', '2026-09-04T07:02:32+09:00'), row('b', '2026-09-04T07:02:30+09:00')],
    })

    const page = await fetchEnhancementHistory('key', 'potential', { dateKey: '2026-09-04' })

    expect(page.rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(page.nextCursor).toBe('next')
  })

  // 그 날에 아무것도 안 했으면 배열이 비고 커서가 없다.
  it('빈 날은 빈 쪽이다', async () => {
    requestJsonMock.mockResolvedValue({ count: 0, next_cursor: null, cube_history: [] })

    const page = await fetchEnhancementHistory('key', 'cube', { dateKey: '2026-09-04' })

    expect(page).toEqual({ rows: [], nextCursor: null })
  })

  // **줄 원본을 그대로 든다.** 비용 표가 오면 여기서 계산한다. 어제 이전은 다시 못 받는다.
  it('줄 원본을 버리지 않는다', async () => {
    const raw = row('a', '2026-09-04T07:02:32+09:00')
    requestJsonMock.mockResolvedValue({ count: 1, next_cursor: null, cube_history: [raw] })

    const page = await fetchEnhancementHistory('key', 'cube', { dateKey: '2026-09-04' })

    expect(page.rows[0].payload).toEqual(raw)
  })

  it('KST 날짜를 뽑아 싣는다. 가계부 칸이 이 값으로 선다', async () => {
    requestJsonMock.mockResolvedValue({
      count: 1,
      next_cursor: null,
      cube_history: [row('a', '2026-09-04T07:02:32.597+09:00')],
    })

    const page = await fetchEnhancementHistory('key', 'cube', { dateKey: '2026-09-04' })

    expect(page.rows[0]).toMatchObject({ dateKey: '2026-09-04', characterName: '루디' })
  })

  // 배열이 없거나 모양이 다르면 **빈 쪽**이다. 던지면 그 날짜가 영영 안 채워진다.
  it('모양이 다르면 빈 쪽으로 접는다', async () => {
    requestJsonMock.mockResolvedValue({ count: 0 })

    const page = await fetchEnhancementHistory('key', 'cube', { dateKey: '2026-09-04' })

    expect(page).toEqual({ rows: [], nextCursor: null })
  })
})
