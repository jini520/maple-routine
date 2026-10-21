/**
 * 드롭 가격 종류의 함수 둘과 저장 자리의 전송.
 *
 * 여기서 막는 사고는 셋이다. **기준 기간보다 앞선 기록이 올라가는 것**, **가격 없는 기록이 지우기로
 * 나가는 것**(기록 안함 · 미입력은 상태를 달아 올린다), 그리고 **전송 실패가 대기 표에 안 남는 것**이다.
 */
import {
  DROP_PRICE_KIND,
  dropPriceHandler,
  dropPricePayloadOf,
  reportDropPrice,
  reportDropRemoved,
  sendsToServer,
} from '../drop-price-sync'
import type { BossDropRecord } from '../../../storage/boss-drops'

jest.mock('../../../storage/boss-drops', () => ({ getBossDropRecordById: jest.fn() }))
jest.mock('../../../storage/server-sync-queue', () => ({ enqueueServerSync: jest.fn() }))
jest.mock('../../../server/drop-price', () => ({
  sendDropPrice: jest.fn(),
  deleteDropPrice: jest.fn(),
}))
jest.mock('../../auth/server-identity', () => ({ serverIdentityHeaders: jest.fn() }))

const { getBossDropRecordById } = jest.requireMock('../../../storage/boss-drops')
const { enqueueServerSync } = jest.requireMock('../../../storage/server-sync-queue')
const { sendDropPrice, deleteDropPrice } = jest.requireMock('../../../server/drop-price')
const { serverIdentityHeaders } = jest.requireMock('../../auth/server-identity')

const HEADERS = { 'x-api-key-hash': 'a'.repeat(64) }
const NOW = new Date('2026-10-16T00:00:00.000Z')
const ID = '33333333-3333-4333-8333-333333333333'

function record(over: Partial<BossDropRecord> = {}): BossDropRecord {
  return {
    dropRecordId: ID,
    ocid: 'ocid-1',
    bossKey: 'lucid',
    boss: '루시드',
    difficulty: 'hard',
    periodKey: '2026-10-15',
    dropIndex: 0,
    category: 'equipment',
    itemKey: 'ring-restraint',
    itemName: '리스트레인트 링',
    boxOriginKey: null,
    boxOrigin: null,
    ringLevel: 4,
    quantity: 1,
    recordedAt: NOW.toISOString(),
    world: '챌린저스2',
    worldKey: 'challengers_2',
    priceState: 'entered',
    priceMeso: 10_000_000_000,
    priceSplitMode: 'even',
    pricePartySize: 1,
    priceShare: null,
    priceMyShare: null,
    saleFeePercent: null,
    splitFeePercent: null,
    saleFeeAuto: null,
    splitFeeAuto: null,
    ...over,
  } as BossDropRecord
}

beforeEach(() => {
  jest.clearAllMocks()
  serverIdentityHeaders.mockResolvedValue(HEADERS)
  sendDropPrice.mockResolvedValue({ outcome: 'sent' })
  deleteDropPrice.mockResolvedValue({ outcome: 'sent' })
})

describe('보내는 기간', () => {
  it('월간 열쇠도 같은 비교로 갈린다', () => {
    // 주간과 월간이 둘 다 `YYYY-MM` 으로 시작해 글자 비교가 성립한다.
    expect(sendsToServer('2026-11')).toBe(true)
    expect(sendsToServer('2026-10')).toBe(false)
    expect(sendsToServer('2025-12')).toBe(false)
  })
})

describe('보낼 값', () => {
  it('입력된 가격은 completed 다', () => {
    expect(dropPricePayloadOf(record())).toEqual({
      dropRecordId: ID,
      itemKey: 'ring-restraint',
      status: 'completed',
      priceMeso: 10_000_000_000,
      periodKey: '2026-10-15',
      worldKey: 'challengers_2',
      ringLevel: 4,
      boss: 'lucid',
      difficulty: 'hard',
    })
  })

  it('분배 인원 · 비율 · 수수료는 안 싣는다', () => {
    // 내 몫을 세는 재료이고 서버가 모으는 것은 시세다.
    const payload = dropPricePayloadOf(
      record({ pricePartySize: 3, priceShare: 4, saleFeePercent: 5, splitFeePercent: 6 }),
    )
    expect(Object.keys(payload ?? {}).sort()).toEqual([
      'boss',
      'difficulty',
      'dropRecordId',
      'itemKey',
      'periodKey',
      'priceMeso',
      'ringLevel',
      'status',
      'worldKey',
    ])
  })

  // 둘 다 기록은 있고 가격만 없다. 지우기로 보내면 올라간 적 없는 기록에 지우기가 나간다.
  it('기록 안함은 skipped, 미입력은 pending 이고 가격은 null 이다', () => {
    expect(dropPricePayloadOf(record({ priceState: 'excluded', priceMeso: null }))).toMatchObject({
      dropRecordId: ID,
      status: 'skipped',
      priceMeso: null,
    })
    expect(dropPricePayloadOf(record({ priceState: null, priceMeso: null }))).toMatchObject({
      status: 'pending',
      priceMeso: null,
    })
  })

  it('아이템 key 가 없으면 못 보낸다. 값이 null 인 유일한 경우다', () => {
    // 서버가 그 칸을 분포의 축으로 쓴다.
    expect(dropPricePayloadOf(record({ itemKey: null }))).toBeNull()
  })

  it('월드를 모르는 기록도 보낸다', () => {
    expect(dropPricePayloadOf(record({ world: null, worldKey: null }))?.worldKey).toBeNull()
  })
})

describe('고리가 쓰는 읽기', () => {
  it('원본이 사라졌으면 null 이고 그것이 지우기 신호다', async () => {
    getBossDropRecordById.mockResolvedValue(null)
    expect(await dropPriceHandler.read('없는-id')).toBeNull()
  })
})

describe('저장 자리의 전송', () => {
  it('기준 기간의 가격을 그 자리에서 보낸다', async () => {
    getBossDropRecordById.mockResolvedValue(record())
    await reportDropPrice(ID, NOW)

    expect(sendDropPrice).toHaveBeenCalledWith(HEADERS, expect.objectContaining({ priceMeso: 10_000_000_000 }))
    expect(enqueueServerSync).not.toHaveBeenCalled()
  })

  it('기준보다 앞선 기록은 보내지도 쌓지도 않는다', async () => {
    getBossDropRecordById.mockResolvedValue(record({ periodKey: '2026-09-10' }))
    await reportDropPrice(ID, NOW)

    expect(sendDropPrice).not.toHaveBeenCalled()
    expect(deleteDropPrice).not.toHaveBeenCalled()
    expect(enqueueServerSync).not.toHaveBeenCalled()
  })

  it('기록 안함은 skipped 로 올린다. 지우기가 아니다', async () => {
    getBossDropRecordById.mockResolvedValue(record({ priceState: 'excluded', priceMeso: null }))
    await reportDropPrice(ID, NOW)

    expect(sendDropPrice).toHaveBeenCalledWith(HEADERS, expect.objectContaining({ status: 'skipped', priceMeso: null }))
    expect(deleteDropPrice).not.toHaveBeenCalled()
  })

  it('미입력도 pending 으로 올린다', async () => {
    getBossDropRecordById.mockResolvedValue(record({ priceState: null, priceMeso: null }))
    await reportDropPrice(ID, NOW)

    expect(sendDropPrice).toHaveBeenCalledWith(HEADERS, expect.objectContaining({ status: 'pending' }))
    expect(deleteDropPrice).not.toHaveBeenCalled()
  })

  it('응답이 안 왔으면 대기 표에 쌓는다', async () => {
    getBossDropRecordById.mockResolvedValue(record())
    sendDropPrice.mockResolvedValue({ outcome: 'no-response' })
    await reportDropPrice(ID, NOW)

    expect(enqueueServerSync).toHaveBeenCalledWith(DROP_PRICE_KIND, ID, NOW.toISOString())
  })

  it('서버가 거절해도 대기 표에 쌓는다. 횟수는 고리가 센다', async () => {
    getBossDropRecordById.mockResolvedValue(record())
    sendDropPrice.mockResolvedValue({ outcome: 'rejected', status: 503 })
    await reportDropPrice(ID, NOW)

    expect(enqueueServerSync).toHaveBeenCalledTimes(1)
  })

  it('그 사이 기록이 사라졌으면 아무것도 안 한다', async () => {
    // 보낼 기간인지 판단할 재료가 없다. 지워진 기록의 거두기는 다른 경로가 소유한다.
    getBossDropRecordById.mockResolvedValue(null)
    await reportDropPrice(ID, NOW)

    expect(sendDropPrice).not.toHaveBeenCalled()
    expect(deleteDropPrice).not.toHaveBeenCalled()
    expect(enqueueServerSync).not.toHaveBeenCalled()
  })

  it('밝힐 수단이 없으면 보내지 않고 쌓아만 둔다', async () => {
    getBossDropRecordById.mockResolvedValue(record())
    serverIdentityHeaders.mockResolvedValue(null)
    await reportDropPrice(ID, NOW)

    expect(sendDropPrice).not.toHaveBeenCalled()
    expect(enqueueServerSync).toHaveBeenCalledTimes(1)
  })
})

// 기기에서 기록이 사라진 자리다. 시트 저장에서 빠진 드롭과 난이도 확정으로 걷힌 드롭이 여기로 온다.
describe('기록이 사라진 자리의 전송', () => {
  it('기준 기간의 기록이면 지우기를 보낸다. 기록을 다시 읽지 않는다', async () => {
    await reportDropRemoved(ID, '2026-10-15', NOW)

    expect(deleteDropPrice).toHaveBeenCalledWith(HEADERS, ID)
    expect(getBossDropRecordById).not.toHaveBeenCalled()
    expect(enqueueServerSync).not.toHaveBeenCalled()
  })

  it('기준보다 앞선 기간이면 보내지도 쌓지도 않는다', async () => {
    await reportDropRemoved(ID, '2026-09-10', NOW)

    expect(deleteDropPrice).not.toHaveBeenCalled()
    expect(enqueueServerSync).not.toHaveBeenCalled()
  })

  it('응답이 안 왔으면 대기 표에 쌓는다. 다음 회차는 원본이 없어 그대로 지우기다', async () => {
    deleteDropPrice.mockResolvedValue({ outcome: 'no-response' })
    await reportDropRemoved(ID, '2026-10-15', NOW)

    expect(enqueueServerSync).toHaveBeenCalledWith(DROP_PRICE_KIND, ID, NOW.toISOString())
  })

  it('밝힐 수단이 없으면 보내지 않고 쌓아만 둔다', async () => {
    serverIdentityHeaders.mockResolvedValue(null)
    await reportDropRemoved(ID, '2026-10-15', NOW)

    expect(deleteDropPrice).not.toHaveBeenCalled()
    expect(enqueueServerSync).toHaveBeenCalledTimes(1)
  })
})
