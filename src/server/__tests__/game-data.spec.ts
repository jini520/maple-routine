// 게임 데이터 표 전부를 우리 서버에 묻는 어댑터. `settlement` 와 같은 자리, 같은 규칙이다.
//
// 여기가 지키는 것은 **못 받았으면 표를 안 바꾸는 것**이다. 응답 전체가 아니라 칸마다 본다. 칸 하나가
// 계약을 어기면 그 칸만 null 이고 나머지 칸은 쓴다.
import type { BossCatalog } from '../../types/boss-catalog'
import { GAME_DATA_SECTIONS, type GameDataResponse, type WorldsTable } from '../../types/game-data'
import { fetchGameData, parseGameDataResponse } from '../game-data'

const 보스표: BossCatalog = {
  updatedAt: '2026-10-15T01:00:00.000Z',
  rules: { weeklyBossSelectionLimit: 12, weeklyCrystalSaleLimit: 90, defaultMaxPartySize: 6 },
  bosses: [
    {
      key: 'lotus',
      name: '스우',
      alias: '스우',
      cycle: 'weekly',
      portraitSlug: 'lotus',
      difficulties: [{ difficulty: 'normal', requiredLevel: 190 }],
    },
  ],
}
const 월드표: WorldsTable = {
  updatedAt: '2026-10-16T15:07:54.435Z',
  worlds: [{ key: 'scania', name: '스카니아', emblem: 'scania', challengers: false, event: false }],
}

/** 칸 열넷 중 넘긴 것만 값이고 나머지는 null 인 응답. */
function 칸(received: Partial<GameDataResponse>): GameDataResponse {
  const response = Object.fromEntries(GAME_DATA_SECTIONS.map((section) => [section, null])) as GameDataResponse
  return { ...response, ...received }
}

function ok(body: unknown, etag: string | null = '"e1"'): Response {
  const text = JSON.stringify(body)
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name.toLowerCase() === 'etag' ? etag : null) },
    text: async () => text,
  } as unknown as Response
}

beforeEach(() => {
  jest.restoreAllMocks()
})

it('칸마다 받은 표를 그대로 주고, 응답 원문 · ETag · 바이트 수를 함께 준다. 없는 칸은 null 이다', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok({ bosses: 보스표, worlds: 월드표 }))

  const result = await fetchGameData(null)
  expect(result).toEqual({
    kind: 'ok',
    etag: '"e1"',
    bytes: JSON.stringify({ bosses: 보스표, worlds: 월드표 }).length,
    sections: 칸({ bosses: 보스표, worlds: 월드표 }),
    raw: { bosses: 보스표, worlds: 월드표 },
  })
})

it('ETag 를 If-None-Match 로 보내고, 304 면 바뀐 것이 없다고 준다', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 304 } as Response)

  await expect(fetchGameData('"e1"')).resolves.toEqual({ kind: 'not-modified' })
  expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).headers).toEqual({ 'If-None-Match': '"e1"' })
})

it('네트워크가 실패하면 null', async () => {
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'))

  await expect(fetchGameData(null)).resolves.toBeNull()
})

it('5xx 도 null', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 502 } as Response)

  await expect(fetchGameData(null)).resolves.toBeNull()
})

it('응답이 객체가 아니면 null', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue(ok('표'))

  await expect(fetchGameData(null)).resolves.toBeNull()
})

describe('parseGameDataResponse', () => {
  it('계약을 어긴 칸은 그 칸만 null 이다', () => {
    expect(parseGameDataResponse({ bosses: { ...보스표, bosses: [{ key: 'lotus' }] }, worlds: 월드표 })).toEqual(
      칸({ worlds: 월드표 }),
    )
  })

  // 서버는 선택 칸을 null 로 보낸다. 통과한 값에서는 그 칸이 빠진다.
  it('선택 칸의 null 은 빠진 칸으로 통과한다', () => {
    const 응답 = { ...월드표, worlds: [{ ...월드표.worlds[0], emblem: null }] }

    expect(parseGameDataResponse({ worlds: 응답 })?.worlds).toEqual({
      ...월드표,
      worlds: [{ key: 'scania', name: '스카니아', challengers: false, event: false }],
    })
  })

  // 아직 한 번도 안 넣은 표의 모양이다. 쓸 것이 없으니 들고 있던 표 그대로다.
  it('updatedAt 이 null 인 칸(서버가 아직 비었다)은 null 이다', () => {
    expect(parseGameDataResponse({ worlds: { ...월드표, updatedAt: null } })).toEqual(칸({}))
  })

  it('객체가 아니면 null 하나다', () => {
    expect(parseGameDataResponse('표')).toBeNull()
    expect(parseGameDataResponse(null)).toBeNull()
  })
})
