// 계정 단위 강화 사용 내역. 네 엔드포인트가 **같은 껍데기**를 쓴다.
//
// 실측(2026-09-06): 정렬은 최신→과거, `count` 는 상한, 커서는 `date` 없이 이어받고, 같은
// 요청 두 번에 커서·id 목록이 같다.
jest.mock('../../http', () => ({ requestJson: jest.fn() }))

import { fetchEnhancementHistory } from '../client'

const { requestJson: requestJsonMock } = jest.requireMock('../../http') as Record<string, jest.Mock>

/** 장비 표 대신 넘기는 매칭 함수. `nexon/` 은 `src/data` 를 모른다. */
const itemKeyOf = (apiName: string): string | null => (apiName === '아케인셰이드 클로' ? 'arcane_umbra_knuckle' : null)

function row(id: string, at: string) {
  return {
    id,
    character_name: '루디',
    date_create: at,
    cube_type: '수상한 큐브',
    target_item: '아케인셰이드 클로',
    item_level: 200,
  }
}

beforeEach(() => {
  requestJsonMock.mockReset()
})

describe('경로와 질의', () => {
  it('종류마다 자기 경로를 부른다', async () => {
    requestJsonMock.mockResolvedValue({ count: 0, next_cursor: null, cube_history: [] })

    await fetchEnhancementHistory('key', 'cube', itemKeyOf, { dateKey: '2026-09-04' })

    expect(requestJsonMock).toHaveBeenCalledWith(
      '/maplestory/v1/history/cube?count=1000&date=2026-09-04',
      'key',
    )
  })

  it('스타포스·잠재도 같은 껍데기다', async () => {
    requestJsonMock.mockResolvedValue({ count: 0, next_cursor: null, starforce_history: [] })

    await fetchEnhancementHistory('key', 'starforce', itemKeyOf, { dateKey: '2026-09-04' })

    expect(requestJsonMock).toHaveBeenCalledWith(
      '/maplestory/v1/history/starforce?count=1000&date=2026-09-04',
      'key',
    )
  })

  // 소울만 경로가 붙임표다. 배열 이름은 밑줄이라 `kind` 를 그대로 경로에 못 넣는다.
  it('소울은 soul-potential 경로를 부르고 soul_potential_history 를 읽는다', async () => {
    requestJsonMock.mockResolvedValue({
      count: 1,
      next_cursor: null,
      soul_potential_history: [{ ...row('a', '2026-09-18T07:02:32+09:00'), soul_potential_grade: '레어' }],
    })

    const page = await fetchEnhancementHistory('key', 'soul_potential', itemKeyOf, { dateKey: '2026-09-18' })

    expect(requestJsonMock).toHaveBeenCalledWith(
      '/maplestory/v1/history/soul-potential?count=1000&date=2026-09-18',
      'key',
    )
    expect(page.rows.map((r) => r.id)).toEqual(['a'])
  })

  // 커서가 날짜 맥락을 든다(실측). 함께 보내면 어느 쪽이 이기는지가 계약에 없다.
  it('커서로 이어받을 때는 날짜를 안 보낸다', async () => {
    requestJsonMock.mockResolvedValue({ count: 0, next_cursor: null, cube_history: [] })

    await fetchEnhancementHistory('key', 'cube', itemKeyOf, { cursor: 'abc' })

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

    const page = await fetchEnhancementHistory('key', 'potential', itemKeyOf, { dateKey: '2026-09-04' })

    expect(page.rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(page.nextCursor).toBe('next')
  })

  // 그 날에 아무것도 안 했으면 배열이 비고 커서가 없다.
  it('빈 날은 빈 쪽이다', async () => {
    requestJsonMock.mockResolvedValue({ count: 0, next_cursor: null, cube_history: [] })

    const page = await fetchEnhancementHistory('key', 'cube', itemKeyOf, { dateKey: '2026-09-04' })

    expect(page).toEqual({ rows: [], nextCursor: null })
  })

  // **줄 원본을 그대로 든다.** 비용 표가 오면 여기서 계산한다. 어제 이전은 다시 못 받는다.
  it('줄 원본을 버리지 않는다', async () => {
    const raw = row('a', '2026-09-04T07:02:32+09:00')
    requestJsonMock.mockResolvedValue({ count: 1, next_cursor: null, cube_history: [raw] })

    const page = await fetchEnhancementHistory('key', 'cube', itemKeyOf, { dateKey: '2026-09-04' })

    expect(page.rows[0].payload).toEqual(raw)
  })

  it('KST 날짜를 뽑아 싣는다. 가계부 칸이 이 값으로 선다', async () => {
    requestJsonMock.mockResolvedValue({
      count: 1,
      next_cursor: null,
      cube_history: [row('a', '2026-09-04T07:02:32.597+09:00')],
    })

    const page = await fetchEnhancementHistory('key', 'cube', itemKeyOf, { dateKey: '2026-09-04' })

    expect(page.rows[0]).toMatchObject({ dateKey: '2026-09-04', characterName: '루디' })
  })

  // 배열이 없거나 모양이 다르면 **빈 쪽**이다. 던지면 그 날짜가 영영 안 채워진다.
  it('모양이 다르면 빈 쪽으로 접는다', async () => {
    requestJsonMock.mockResolvedValue({ count: 0 })

    const page = await fetchEnhancementHistory('key', 'cube', itemKeyOf, { dateKey: '2026-09-04' })

    expect(page).toEqual({ rows: [], nextCursor: null })
  })
})

// 스타포스 응답에는 `item_level` 이 없다(1년치 3,220건 실측). 그 자리를 0 으로 채우면
// **모름이 값으로 둔갑**해 레벨 0 짜리 장비가 생긴다.
it('스타포스처럼 레벨이 없는 응답은 null 로 든다', async () => {
  requestJsonMock.mockResolvedValue({
    count: 1,
    next_cursor: null,
    starforce_history: [
      {
        id: 'a',
        character_name: '루디',
        date_create: '2026-09-04T07:00:55+09:00',
        target_item: '아케인셰이드 클로',
        before_starforce_count: 17,
        after_starforce_count: 18,
      },
    ],
  })

  const page = await fetchEnhancementHistory('key', 'starforce', itemKeyOf, { dateKey: '2026-09-04' })

  expect(page.rows[0]).toMatchObject({ targetItem: '아케인셰이드 클로', itemLevel: null })
})

// 큐브·잠재가 주는 레벨이 곧 표다. 그 표를 스타포스가 **읽을 때** 쓴다.
it('큐브 응답의 레벨을 그대로 싣는다. 이것이 표의 재료다', async () => {
  requestJsonMock.mockResolvedValue({
    count: 1,
    next_cursor: null,
    cube_history: [row('a', '2026-09-04T07:04:33+09:00')],
  })

  const page = await fetchEnhancementHistory('key', 'cube', itemKeyOf, { dateKey: '2026-09-04' })

  expect(page.rows[0]).toMatchObject({ targetItem: '아케인셰이드 클로', itemLevel: 200 })
})

// 장비 key 는 응답을 받는 자리에서 한 번 얻는다. 원문 이름은 화면이 보이도록 그대로 든다.
it('넘긴 매칭 함수로 장비 key 를 얻고 원문 이름을 지킨다', async () => {
  requestJsonMock.mockResolvedValue({
    count: 2,
    next_cursor: null,
    cube_history: [row('a', '2026-09-04T07:04:33+09:00'), { ...row('b', '2026-09-04T07:04:30+09:00'), target_item: '골드 히어로즈 엠블렘' }],
  })

  const page = await fetchEnhancementHistory('key', 'cube', itemKeyOf, { dateKey: '2026-09-04' })

  expect(page.rows.map((r) => [r.itemKey, r.targetItem])).toEqual([
    ['arcane_umbra_knuckle', '아케인셰이드 클로'],
    [null, '골드 히어로즈 엠블렘'],
  ])
})
