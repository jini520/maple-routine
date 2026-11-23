/**
 * 받은 서버 줄을 기기 칸으로 바꾸는 함수.
 *
 * 올리기의 바꾸기와 짝이 맞지 않으면 받은 기기가 값을 잘못 적고, 그 값이 다시 올라가 처음 기기까지 바뀐다. 그래서 기기 줄을 올리기로
 * 서버 꼴로 바꾼 뒤 받기로 되돌려 같은 값이 되는지 본다.
 */
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import { pulledRecordOf, type NexonIdResolver } from '../pull-records'
import { pushRecordOf, type RecordOwners } from '../push-records'

const MAPLE = 'maple-1'
const OTHER_MAPLE = 'maple-2'
const OCID = 'ocid-1'
const RECEIVER = 'ocid-2'
const AT = '2026-11-23T00:00:00.000Z'

/** 이 기기가 본 캐릭터와 메이플 ID. 해시로 원문을 찾는다. */
const KNOWN_OCIDS = [OCID, RECEIVER, 'old-ocid']
const KNOWN_MAPLE_IDS = [MAPLE, OTHER_MAPLE]
const resolver: NexonIdResolver = {
  ocidOf: (hash) => KNOWN_OCIDS.find((one) => nexonIdHashHex(one) === hash) ?? null,
  mapleIdOf: (hash) => KNOWN_MAPLE_IDS.find((one) => nexonIdHashHex(one) === hash) ?? null,
  nexonAccountIdOf: (mapleId) => (mapleId === MAPLE ? 'nexon-account-1' : null),
}

const owners: RecordOwners = {
  mapleIdOfOcid: async (ocid) => (ocid === RECEIVER ? OTHER_MAPLE : KNOWN_OCIDS.includes(ocid) ? MAPLE : null),
  mapleIdOfNexonAccount: async (id) => (id === 'nexon-account-1' ? MAPLE : null),
}

/** 서버가 받기에 싣는 꼴. 올린 몸에 동기화 칸을 붙이고, 빼고 올린 빈 칸은 빈 값으로 돌려준다. */
async function serverRowOf(table: string, recordId: string, source: Record<string, unknown>): Promise<Record<string, unknown>> {
  const plan = await pushRecordOf(table, recordId, source, owners)
  if (plan.kind !== 'send') throw new Error(`올리지 않는 기록: ${plan.kind}`)
  return { changeSeq: 7, deletedAt: null, createdAt: AT, updatedAt: AT, ...plan.record.row }
}

const SPLIT = {
  split_type: 'ratio',
  party_size: 2,
  split_share_millipercent: 25000,
  split_fee_percent: 5,
  split_fee_follows_mvp_grade: 0,
}

describe('SQLite 기록은 올리기와 왕복해 같은 값이다', () => {
  const cases: [string, Record<string, unknown>][] = [
    ['characterWorldLeaps', { id: 'leap-1', previous_ocid: 'old-ocid', ocid: OCID }],
    [
      'inventoryItems',
      { id: 'inv-1', account_id: MAPLE, world_id: 'w', item_id: 'i', cashbook_item_type_id: 't', added_quantity: 3, created_at: AT, updated_at: AT },
    ],
    [
      'bossProfitEntries',
      {
        id: 'entry-1',
        ocid: OCID,
        boss_difficulty_id: 'd',
        period_code: 'W202647',
        world_id: 'w',
        crystal_price_meso: 100,
        crystal_received_meso: 40,
        ...SPLIT,
        cleared_date: '2026-11-20',
        clear_recorded_by: 'manual',
        created_at: AT,
        updated_at: AT,
      },
    ],
    [
      'bossDrops',
      {
        id: 'drop-1',
        profit_entry_id: 'entry-1',
        item_id: 'i',
        category: 'equipment',
        price_status: 'entered',
        sale_price_meso: 1000,
        sale_received_meso: 400,
        priced_at: AT,
        sale_fee_percent: 5,
        sale_fee_follows_mvp_grade: 1,
        ...SPLIT,
        created_at: AT,
        updated_at: AT,
      },
    ],
    ['bossSplitSettings', { id: 'split-1', ocid: OCID, boss_difficulty_id: 'd', ...SPLIT, created_at: AT, updated_at: AT }],
    [
      'enhancementTotals',
      {
        id: 'total-1',
        ocid: OCID,
        history_date: '2026-11-20',
        category: 'starforce',
        item_name: '아케인셰이드 투핸드소드',
        attempt_count: 3,
        attempt_cost_meso: 300,
        destroy_defence_cost_meso: 0,
        world_id: 'w',
        superior_cost_meso: 0,
        from_star: 17,
        to_star: 18,
        is_event_world: 0,
        updated_at: AT,
      },
    ],
    ['rememberedLevels', { id: 'level-1', ocid: OCID, type: 'symbol', target_id: 's', level: 11, updated_at: AT }],
    ['mvpGradeHistory', { id: 'mvp-1', account_id: MAPLE, from_date: '2026-11-01', grade_id: 'g', updated_at: AT }],
  ]

  it.each(cases)('%s', async (table, source) => {
    const pulled = pulledRecordOf(table, await serverRowOf(table, source.id as string, source), resolver)

    expect(pulled).toEqual({ table, id: source.id, deleted: false, row: source })
  })

  it('가계부 기록은 딸린 줄 다섯과 함께 왕복한다. 캐릭터 기록은 메이플 ID 칸을 비운다', async () => {
    const source = {
      id: 'cash-1',
      ocid: OCID,
      account_id: null,
      world_id: 'w',
      category_id: 'c',
      date: '2026-11-20',
      memo: '메모',
      recorded_at: AT,
      items: [
        {
          target_type: 'item',
          target_id: 'i',
          item_name: null,
          spend_reward_type_id: null,
          item_type_id: 't',
          quantity: 2,
          from_level: null,
          to_level: null,
          amount_meso: 1000,
          tariff_meso: null,
          sale_fee_percent: 5,
          sale_fee_meso: 50,
          sale_fee_follows_mvp_grade: 1,
          amount_maple_point: null,
          maple_point_per_100m_meso: null,
          meso_market_fee_percent: null,
          amount_cash: null,
          fragment_quantity: null,
          untradable_fragment_quantity: null,
          fragment_price_meso: null,
          includes_hexa_activation: 0,
          uses_stored_fragments: null,
          counts_stored_fragments_as_spend: null,
          inventory_item_id: 'inv-1',
        },
      ],
      hunt_input: {
        character_level: 280,
        missed_mob_quantity: 0,
        uses_wealth_potion: 1,
        uses_union_wealth: 0,
        union_wealth_tier: null,
        fragment_quantity: 3,
        fragment_price_meso: null,
        meso_acquisition_percent: 120,
        typed_meso: null,
      },
      transfer_input: { receiver_ocid: RECEIVER, transfer_meso: 500, fee_percent: 3, fee_follows_mvp_grade: 1 },
      exchange_input: {
        sold_meso: 1,
        sell_maple_point_per_100m_meso: 2,
        bought_meso: null,
        buy_maple_point_per_100m_meso: null,
        meso_market_fee_percent: 3,
      },
      fragment_uses: [
        { fragment_source: 'hunt', ocid: RECEIVER, fragment_quantity: 2 },
        { fragment_source: 'inventory', ocid: null, fragment_quantity: 1 },
      ],
    }
    const server = await serverRowOf('cashbookEntries', 'cash-1', source)

    const pulled = pulledRecordOf('cashbookEntries', server, resolver)

    const { items, hunt_input, transfer_input, exchange_input, fragment_uses, ...head } = source
    expect(pulled).toEqual({
      table: 'cashbookEntries',
      id: 'cash-1',
      deleted: false,
      row: { ...head, updated_at: AT },
      children: { items, huntInput: hunt_input, transferInput: transfer_input, exchangeInput: exchange_input, fragmentUses: fragment_uses },
    })
  })

  it('메이플 ID 기록은 ocid 칸을 비우고 메이플 ID 를 적는다', async () => {
    const pulled = pulledRecordOf(
      'cashbookEntries',
      { id: 'cash-2', mapleId: nexonIdHashHex(MAPLE), ocid: null, categoryId: 'c', date: '2026-11-20', recordedAt: AT, updatedAt: AT, items: [] },
      resolver,
    )

    expect(pulled).toMatchObject({ row: { ocid: null, account_id: MAPLE } })
  })
})

describe('Preferences 기록은 올리기의 원본 꼴로 돌아온다', () => {
  it('약속은 보스와 주별 예외를 차례대로 되돌린다', async () => {
    const item = {
      id: 'appointment-1',
      bosses: [
        { bossDifficultyId: 'd1', ocid: OCID },
        { bossDifficultyId: 'd2', ocid: RECEIVER },
      ],
      time: '21:00',
      durationMinutes: 60,
      alarmMinutesBefore: 10,
      schedule: { type: 'weekly', weekday: 4, fromWeekCode: 'W202640', untilWeekCode: null },
      exceptions: {
        W202647: { date: '2026-11-20', time: '22:00', durationMinutes: 30, alarmMinutesBefore: null, bosses: [{ bossDifficultyId: 'd1', ocid: OCID }] },
      },
      memo: '메모',
    }
    const server = await serverRowOf('partyAppointments', 'appointment-1', item)

    expect(pulledRecordOf('partyAppointments', server, resolver)).toEqual({ table: 'partyAppointments', id: 'appointment-1', deleted: false, item })
  })

  it('한 번만인 약속은 날짜만 들고 메모가 없으면 칸이 없다', async () => {
    const item = {
      id: 'appointment-2',
      bosses: [{ bossDifficultyId: 'd1', ocid: OCID }],
      time: '21:00',
      durationMinutes: 60,
      alarmMinutesBefore: null,
      schedule: { type: 'once', date: '2026-11-21' },
      exceptions: {},
    }
    const server = await serverRowOf('partyAppointments', 'appointment-2', item)

    expect(pulledRecordOf('partyAppointments', server, resolver)).toEqual({ table: 'partyAppointments', id: 'appointment-2', deleted: false, item })
  })

  it('계산기 기록은 캐릭터 차례와 보스 분배를 되돌린다', async () => {
    const item = {
      id: 'calc-1',
      savedAt: AT,
      characters: [
        {
          ocid: OCID,
          bosses: [
            { bossDifficultyId: 'd1', splitType: 'even', partySize: 2, splitShareMillipercent: null, splitFeePercent: null, splitFeeFollowsMvpGrade: true },
          ],
        },
        { ocid: RECEIVER, bosses: [] },
      ],
    }
    const server = await serverRowOf('bossProfitCalculatorRecords', 'calc-1', item)

    expect(pulledRecordOf('bossProfitCalculatorRecords', server, resolver)).toEqual({
      table: 'bossProfitCalculatorRecords',
      id: 'calc-1',
      deleted: false,
      item,
    })
  })

  const preferenceCases: [string, string, Record<string, unknown>, Record<string, unknown>][] = [
    [
      'manualTrackedItems',
      `manualTrackedItems:${OCID}/weekly/c`,
      { ocid: OCID, type: 'weekly', targetId: 'c' },
      { table: 'manualTrackedItems', deleted: false, ocid: OCID, type: 'weekly', targetId: 'c' },
    ],
    [
      'sharedContentProgress',
      `sharedContentProgress:${MAPLE}/w/c`,
      { mapleId: MAPLE, worldId: 'w', contentId: 'c', isRegistered: true, nowCount: 1, maxCount: 7, questState: null, periodCode: 'W202647' },
      {
        table: 'sharedContentProgress',
        deleted: false,
        mapleId: MAPLE,
        worldId: 'w',
        contentId: 'c',
        entry: { isRegistered: true, nowCount: 1, maxCount: 7, questState: null, periodCode: 'W202647' },
      },
    ],
    [
      'mapleIdNames',
      `mapleIdNames:${MAPLE}`,
      { mapleId: MAPLE, name: '본캐' },
      { table: 'mapleIdNames', deleted: false, mapleId: MAPLE, name: '본캐' },
    ],
    [
      'trackedCharacters',
      `trackedCharacters:${OCID}`,
      { ocid: OCID, sortOrder: 2, isRepresentative: true },
      { table: 'trackedCharacters', deleted: false, ocid: OCID, sortOrder: 2, isRepresentative: true },
    ],
    [
      'representativeCharacterMotions',
      `representativeCharacterMotions:${OCID}`,
      { ocid: OCID, actions: ['A00'], emotions: ['E00'], durationMs: 3000, restsBetweenActions: true },
      {
        table: 'representativeCharacterMotions',
        deleted: false,
        ocid: OCID,
        motion: { actions: ['A00'], emotions: ['E00'], durationMs: 3000, restsBetweenActions: true },
      },
    ],
    [
      'bottomBarSubPageOrders',
      'bottomBarSubPageOrders:schedule',
      { groupKey: 'schedule', subPageKeys: ['Boss', 'Content'] },
      { table: 'bottomBarSubPageOrders', groupKey: 'schedule', subPageKeys: ['Boss', 'Content'] },
    ],
  ]

  it.each(preferenceCases)('%s', async (table, recordId, source, expected) => {
    expect(pulledRecordOf(table, await serverRowOf(table, recordId, source), resolver)).toEqual(expected)
  })

  it('설정은 줄에 실린 칸만 값으로 옮긴다', () => {
    const pulled = pulledRecordOf(
      'accountSettings',
      { id: 's', changeSeq: 3, updatedAt: AT, trackingType: 'manual', quickLinkKeys: null, isMvpWeeklyCheckOff: false },
      resolver,
    )

    expect(pulled).toEqual({ table: 'accountSettings', values: { trackingType: 'manual', quickLinkKeys: null, isMvpWeeklyCheckOff: false } })
  })
})

describe('해시의 짝', () => {
  const unknownOcid = 'f'.repeat(64)
  const unknownMaple = 'e'.repeat(64)

  // 지운 캐릭터 · 이 기기에 키가 없는 부계정의 캐릭터다. 금액에 넣으려면 줄은 넣어야 한다.
  it('짝이 없는 ocid 와 메이플 ID 는 `#` 를 붙인 해시로 원문 칸에 적는다', () => {
    const entry = pulledRecordOf(
      'bossSplitSettings',
      { id: 'split-2', mapleId: unknownMaple, ocid: unknownOcid, bossDifficultyId: 'd', splitType: 'even', partySize: 2, splitFeeFollowsMvpGrade: true },
      resolver,
    )
    const names = pulledRecordOf('mapleIdNames', { mapleId: unknownMaple, name: '부캐' }, resolver)

    expect(entry).toMatchObject({ row: { ocid: `#${unknownOcid}` } })
    expect(names).toMatchObject({ mapleId: `#${unknownMaple}` })
  })

  it('`#` 를 붙인 값은 올리기가 `#` 만 떼어 같은 해시로 보낸다', async () => {
    const pulled = pulledRecordOf('mvpGradeHistory', { id: 'mvp-2', mapleId: unknownMaple, fromDate: '2026-11-01', gradeId: 'g' }, resolver)

    const plan = await pushRecordOf('mvpGradeHistory', 'mvp-2', (pulled as { row: Record<string, unknown> }).row, owners)

    expect(plan).toMatchObject({ kind: 'send', record: { row: { mapleId: unknownMaple } } })
  })

  // 추적 목록에 넣으면 부를 키가 없는 캐릭터가 조회 불가로 선다. 서버 값은 그대로 두어 키를 등록하면 나타난다.
  it('추적 캐릭터는 짝이 없으면 넣지 않는다', () => {
    expect(pulledRecordOf('trackedCharacters', { ocid: unknownOcid, mapleId: unknownMaple, sortOrder: 0, isRepresentative: true }, resolver)).toBeNull()
  })

  it('굳은 날은 메이플 ID 의 넥슨 계정 id 에 적고, 짝이 없으면 넣지 않는다', () => {
    expect(
      pulledRecordOf('enhancementSettledDays', { id: 'server-1', mapleId: nexonIdHashHex(MAPLE), apiType: 'cube', historyDate: '2026-11-20', deletedAt: null }, resolver),
    ).toEqual({ table: 'enhancementSettledDays', deleted: false, nexonAccountId: 'nexon-account-1', enhancementType: 'cube', historyDate: '2026-11-20' })
    expect(
      pulledRecordOf('enhancementSettledDays', { mapleId: nexonIdHashHex(OTHER_MAPLE), apiType: 'cube', historyDate: '2026-11-20' }, resolver),
    ).toBeNull()
  })
})

describe('기기가 비울 수 없는 칸', () => {
  it('강화 합계의 빈 슈페리얼 비용은 0 이다', () => {
    const pulled = pulledRecordOf(
      'enhancementTotals',
      { id: 'total-2', ocid: nexonIdHashHex(OCID), historyDate: '2026-11-20', category: 'cube', itemName: 'x', attemptCount: 1, attemptCostMeso: 1, destroyDefenceCostMeso: 0, superiorCostMeso: null, isEventWorld: null },
      resolver,
    )

    expect(pulled).toMatchObject({ row: { superior_cost_meso: 0, is_event_world: null } })
  })

  it('받는 캐릭터나 수수료율이 빈 이전 입력과 판매 칸이 빈 환전 입력은 그 줄만 빼고 기록은 넣는다', () => {
    const pulled = pulledRecordOf(
      'cashbookEntries',
      {
        id: 'cash-3',
        mapleId: nexonIdHashHex(MAPLE),
        ocid: nexonIdHashHex(OCID),
        categoryId: 'c',
        date: '2026-11-20',
        recordedAt: AT,
        updatedAt: AT,
        items: [],
        transferInput: { receiverOcid: null, transferMeso: 1, feePercent: 3, feeFollowsMvpGrade: false },
        exchangeInput: { soldMeso: null, sellMaplePointPer100mMeso: 1, mesoMarketFeePercent: 3 },
        fragmentUses: [],
      },
      resolver,
    )

    expect(pulled).toMatchObject({ id: 'cash-3', children: { transferInput: null, exchangeInput: null } })
  })

  it('공유 진행의 빈 횟수는 0 이다', () => {
    expect(
      pulledRecordOf(
        'sharedContentProgress',
        { mapleId: nexonIdHashHex(MAPLE), worldId: null, contentId: 'c', isRegistered: false, nowCount: null, maxCount: null, questState: 1, periodCode: 'W202647' },
        resolver,
      ),
    ).toMatchObject({ worldId: null, entry: { nowCount: 0, maxCount: 0, questState: 1 } })
  })
})

it('`deletedAt` 이 찬 줄은 지우기다', () => {
  expect(pulledRecordOf('bossDrops', { id: 'drop-2', profitEntryId: 'entry-1', deletedAt: AT }, resolver)).toMatchObject({
    table: 'bossDrops',
    id: 'drop-2',
    deleted: true,
  })
  expect(
    pulledRecordOf('manualTrackedItems', { ocid: nexonIdHashHex(OCID), type: 'boss', targetId: 'd', deletedAt: AT }, resolver),
  ).toMatchObject({ deleted: true, ocid: OCID })
})

it('모르는 표는 넣지 않는다', () => {
  expect(pulledRecordOf('somethingNew', { id: 'x' }, resolver)).toBeNull()
})
