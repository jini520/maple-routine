/**
 * 대기 줄의 원본을 올리기의 한 건으로 바꾸는 함수.
 *
 * 서버는 칸이 틀린 건을 코드 없이 거절하고 앱은 다섯 번 뒤 버린다. 그래서 칸 이름 · 해시 · 참 거짓 하나가 어긋나도 기록이 조용히
 * 올라가지 않는다. 서버 `sync.dto.ts` 의 칸과 같은지를 표마다 본다.
 */
import { nexonIdHashHex } from '../../../lib/crypto/nexon-id-hash'
import { preferenceRecordIdOf } from '../../../storage/server-sync-queue'
import { pushRecordOf, type RecordOwners } from '../push-records'

const h = nexonIdHashHex

const OWNERS: RecordOwners = {
  mapleIdOfOcid: async (ocid) => ({ 'ocid-1': 'maple-1', 'ocid-2': 'maple-2' })[ocid] ?? null,
  mapleIdOfNexonAccount: async (account) => (account === 'account-1' ? 'maple-1' : null),
}

const SPLIT = {
  split_type: 'ratio',
  party_size: 3,
  split_share_millipercent: 50000,
  split_fee_percent: null,
  split_fee_follows_mvp_grade: 1,
}

describe('SQLite 기록', () => {
  it('수익 건은 캐릭터를 해시로 싣고, 보스 줄과 기기만 쓰는 칸은 싣지 않으며 빈 칸은 뺀다', async () => {
    const plan = await pushRecordOf(
      'bossProfitEntries',
      'entry-1',
      {
        id: 'entry-1',
        ocid: 'ocid-1',
        boss_difficulty_id: 'difficulty-1',
        period_code: 'W202647',
        world_id: null,
        crystal_price_meso: 1000,
        crystal_received_meso: 900,
        ...SPLIT,
        cleared_date: '2026-11-20',
        clear_recorded_by: 'manual',
        over_crystal_sale_limit: 1,
        created_at: 't',
        updated_at: 't',
      },
      OWNERS,
    )

    expect(plan).toEqual({
      kind: 'send',
      record: {
        table: 'bossProfitEntries',
        action: 'upsert',
        row: {
          id: 'entry-1',
          mapleId: h('maple-1'),
          ocid: h('ocid-1'),
          bossDifficultyId: 'difficulty-1',
          periodCode: 'W202647',
          crystalPriceMeso: 1000,
          crystalReceivedMeso: 900,
          splitType: 'ratio',
          partySize: 3,
          splitShareMillipercent: 50000,
          splitFeeFollowsMvpGrade: true,
          clearedDate: '2026-11-20',
          clearRecordedBy: 'manual',
        },
      },
    })
  })

  it('드롭은 주인을 싣지 않고 거래 시각을 ISO 로 싣는다', async () => {
    const plan = await pushRecordOf(
      'bossDrops',
      'drop-1',
      {
        id: 'drop-1',
        profit_entry_id: 'entry-1',
        item_id: 'item-1',
        category: 'equipment',
        price_status: 'entered',
        sale_price_meso: 100,
        sale_received_meso: 90,
        priced_at: '2026-11-20T10:00:00.000Z',
        sale_fee_percent: 5,
        sale_fee_follows_mvp_grade: 0,
        split_type: 'even',
        party_size: 2,
        split_share_millipercent: null,
        split_fee_percent: 3,
        split_fee_follows_mvp_grade: 0,
      },
      OWNERS,
    )

    expect(plan).toEqual({
      kind: 'send',
      record: {
        table: 'bossDrops',
        action: 'upsert',
        row: {
          id: 'drop-1',
          profitEntryId: 'entry-1',
          itemId: 'item-1',
          category: 'equipment',
          priceStatus: 'entered',
          salePriceMeso: 100,
          saleReceivedMeso: 90,
          pricedAt: '2026-11-20T10:00:00.000Z',
          saleFeePercent: 5,
          saleFeeFollowsMvpGrade: false,
          splitType: 'even',
          partySize: 2,
          splitFeePercent: 3,
          splitFeeFollowsMvpGrade: false,
        },
      },
    })
  })

  it('가계부 기록은 딸린 줄을 넣어 싣고, 받는 캐릭터의 메이플 ID 를 따로 찾는다', async () => {
    const plan = await pushRecordOf(
      'cashbookEntries',
      'cash-1',
      {
        id: 'cash-1',
        ocid: 'ocid-1',
        account_id: null,
        world_id: 'world-1',
        category_id: 'category-1',
        date: '2026-11-20',
        memo: null,
        recorded_at: '2026-11-20T10:00:00.000Z',
        items: [{ id: 'item-1', entry_id: 'cash-1', item_name: '물건', amount_meso: -100, sale_fee_follows_mvp_grade: 1, uses_stored_fragments: 0 }],
        hunt_input: null,
        transfer_input: { id: 't', entry_id: 'cash-1', receiver_ocid: 'ocid-2', transfer_meso: 100, fee_percent: 3, fee_follows_mvp_grade: 1 },
        exchange_input: null,
        fragment_uses: [{ id: 'u', entry_id: 'cash-1', fragment_source: 'inventory', ocid: null, fragment_quantity: 2 }],
      },
      OWNERS,
    )

    expect(plan).toEqual({
      kind: 'send',
      record: {
        table: 'cashbookEntries',
        action: 'upsert',
        row: {
          id: 'cash-1',
          mapleId: h('maple-1'),
          ocid: h('ocid-1'),
          worldId: 'world-1',
          categoryId: 'category-1',
          date: '2026-11-20',
          recordedAt: '2026-11-20T10:00:00.000Z',
          items: [{ itemName: '물건', amountMeso: -100, saleFeeFollowsMvpGrade: true, usesStoredFragments: false }],
          transferInput: {
            receiverMapleId: h('maple-2'),
            receiverOcid: h('ocid-2'),
            transferMeso: 100,
            feePercent: 3,
            feeFollowsMvpGrade: true,
          },
          fragmentUses: [{ fragmentSource: 'inventory', fragmentQuantity: 2 }],
        },
      },
    })
  })

  // 기기의 메이플 ID 기록은 `account_id` 에 메이플 ID 를 든다.
  it('메이플 ID 기록은 기록의 메이플 ID 를 싣고 ocid 는 싣지 않는다', async () => {
    const plan = await pushRecordOf(
      'cashbookEntries',
      'cash-1',
      {
        id: 'cash-1',
        ocid: null,
        account_id: 'maple-3',
        world_id: null,
        category_id: 'category-1',
        date: '2026-11-20',
        memo: '메모',
        recorded_at: '2026-11-20T10:00:00.000Z',
        items: [{ id: 'item-1', entry_id: 'cash-1', item_name: '물건', amount_meso: 1 }],
        hunt_input: null,
        transfer_input: null,
        exchange_input: null,
        fragment_uses: [],
      },
      OWNERS,
    )

    expect(plan).toMatchObject({ kind: 'send', record: { row: { mapleId: h('maple-3'), memo: '메모', fragmentUses: [] } } })
    expect((plan as { record: { row: Record<string, unknown> } }).record.row).not.toHaveProperty('ocid')
  })

  // 메이플 ID 를 모르면 서버가 주인을 찾지 못한다. 그 캐릭터가 목록에 나타나면 보낸다.
  it('캐릭터나 받는 캐릭터의 메이플 ID 를 모르면 보내지 않고 둔다', async () => {
    await expect(
      pushRecordOf('rememberedLevels', 'level-1', { id: 'level-1', ocid: 'ocid-모름', type: 'symbol', target_id: 's', level: 3 }, OWNERS),
    ).resolves.toEqual({ kind: 'hold' })
    await expect(
      pushRecordOf(
        'cashbookEntries',
        'cash-1',
        {
          id: 'cash-1',
          ocid: 'ocid-1',
          account_id: null,
          world_id: null,
          category_id: 'c',
          date: '2026-11-20',
          memo: null,
          recorded_at: '2026-11-20T10:00:00.000Z',
          items: [],
          hunt_input: null,
          transfer_input: { receiver_ocid: 'ocid-모름', transfer_meso: 1, fee_percent: 3, fee_follows_mvp_grade: 1 },
          exchange_input: null,
          fragment_uses: [],
        },
        OWNERS,
      ),
    ).resolves.toEqual({ kind: 'hold' })
  })

  // 받기가 짝이 없는 해시 앞에 `#` 를 붙여 원문 칸에 적는다. 다시 해시하면 서버가 다른 캐릭터로 본다.
  it('`#` 로 시작하는 ocid · 메이플 ID 는 다시 해시하지 않고 `#` 만 뗀다', async () => {
    const plan = await pushRecordOf(
      'inventoryItems',
      'inv-1',
      { id: 'inv-1', account_id: `#${h('maple-9')}`, world_id: 'w', item_id: 'i', cashbook_item_type_id: 't', added_quantity: 2 },
      OWNERS,
    )

    expect(plan).toEqual({
      kind: 'send',
      record: {
        table: 'inventoryItems',
        action: 'upsert',
        row: { id: 'inv-1', mapleId: h('maple-9'), worldId: 'w', itemId: 'i', cashbookItemTypeId: 't', addedQuantity: 2 },
      },
    })
  })

  it('강화 합계 · MVP 등급 · 월드 리프를 서버 칸으로 싣는다', async () => {
    await expect(
      pushRecordOf(
        'enhancementTotals',
        'total-1',
        {
          id: 'total-1',
          ocid: 'ocid-1',
          history_date: '2026-11-20',
          category: 'starforce',
          item_name: '장비',
          attempt_count: 3,
          attempt_cost_meso: 100,
          destroy_defence_cost_meso: 0,
          world_id: null,
          superior_cost_meso: 0,
          from_star: 10,
          to_star: 12,
          is_event_world: 0,
          updated_at: 't',
        },
        OWNERS,
      ),
    ).resolves.toEqual({
      kind: 'send',
      record: {
        table: 'enhancementTotals',
        action: 'upsert',
        row: {
          id: 'total-1',
          mapleId: h('maple-1'),
          ocid: h('ocid-1'),
          historyDate: '2026-11-20',
          category: 'starforce',
          itemName: '장비',
          attemptCount: 3,
          attemptCostMeso: 100,
          destroyDefenceCostMeso: 0,
          superiorCostMeso: 0,
          fromStar: 10,
          toStar: 12,
          isEventWorld: false,
        },
      },
    })
    await expect(
      pushRecordOf('mvpGradeHistory', 'mvp-1', { id: 'mvp-1', account_id: 'maple-1', from_date: '2026-11-01', grade_id: 'g' }, OWNERS),
    ).resolves.toMatchObject({ record: { row: { id: 'mvp-1', mapleId: h('maple-1'), fromDate: '2026-11-01', gradeId: 'g' } } })
    await expect(
      pushRecordOf('characterWorldLeaps', 'leap-1', { id: 'leap-1', previous_ocid: 'ocid-old', ocid: 'ocid-1' }, OWNERS),
    ).resolves.toMatchObject({
      record: { row: { id: 'leap-1', mapleId: h('maple-1'), previousOcid: h('ocid-old'), ocid: h('ocid-1') } },
    })
  })

  // 서버는 굳은 날을 그 메이플 ID 가 달린 넥슨 계정에 적는다. 기기의 넥슨 계정 id 는 서버에 없는 값이다.
  it('굳은 날은 넥슨 계정에서 본 메이플 ID 로 싣고, 원본이 없으면 대기 줄만 지운다', async () => {
    await expect(
      pushRecordOf(
        'enhancementSettledDays',
        'check-1',
        { id: 'check-1', nexon_account_id: 'account-1', enhancement_type: 'cube', history_date: '2026-11-20', settled: 1 },
        OWNERS,
      ),
    ).resolves.toEqual({
      kind: 'send',
      record: {
        table: 'enhancementSettledDays',
        action: 'upsert',
        row: { mapleId: h('maple-1'), apiType: 'cube', historyDate: '2026-11-20' },
      },
    })
    await expect(pushRecordOf('enhancementSettledDays', 'check-1', null, OWNERS)).resolves.toEqual({ kind: 'drop' })
  })

  it('원본이 없으면 기록 id 로 지우기를 싣는다', async () => {
    await expect(pushRecordOf('bossDrops', 'drop-1', null, OWNERS)).resolves.toEqual({
      kind: 'send',
      record: { table: 'bossDrops', action: 'delete', row: { id: 'drop-1' } },
    })
  })

  it('모르는 표의 줄은 대기 줄만 지운다', async () => {
    await expect(pushRecordOf('drop-price', 'r-1', null, OWNERS)).resolves.toEqual({ kind: 'drop' })
  })
})

describe('Preferences 기록', () => {
  it('id 가 없는 항목은 원본이 없으면 유일 기준의 값으로 지우기를 싣고, 계정 공유의 빈 월드는 뺀다', async () => {
    const recordId = preferenceRecordIdOf('manualTrackedItems', ['ocid-1', 'weekly', 'content-1'])
    await expect(pushRecordOf('manualTrackedItems', recordId, null, OWNERS)).resolves.toEqual({
      kind: 'send',
      record: {
        table: 'manualTrackedItems',
        action: 'delete',
        row: { mapleId: h('maple-1'), ocid: h('ocid-1'), type: 'weekly', targetId: 'content-1' },
      },
    })
    await expect(
      pushRecordOf(
        'sharedContentProgress',
        preferenceRecordIdOf('sharedContentProgress', ['maple-1', '', 'content-1']),
        null,
        OWNERS,
      ),
    ).resolves.toEqual({
      kind: 'send',
      record: { table: 'sharedContentProgress', action: 'delete', row: { mapleId: h('maple-1'), contentId: 'content-1' } },
    })
  })

  it('공유 진행 · 메이플 ID 이름 · 추적 캐릭터 · 동작을 서버 칸으로 싣는다', async () => {
    await expect(
      pushRecordOf(
        'sharedContentProgress',
        preferenceRecordIdOf('sharedContentProgress', ['maple-1', 'world-1', 'content-1']),
        {
          mapleId: 'maple-1',
          worldId: 'world-1',
          contentId: 'content-1',
          isRegistered: true,
          nowCount: 1,
          maxCount: 2,
          questState: null,
          periodCode: 'D20261120',
        },
        OWNERS,
      ),
    ).resolves.toMatchObject({
      record: {
        action: 'upsert',
        row: { mapleId: h('maple-1'), worldId: 'world-1', contentId: 'content-1', isRegistered: true, nowCount: 1, maxCount: 2, periodCode: 'D20261120' },
      },
    })
    await expect(
      pushRecordOf('mapleIdNames', preferenceRecordIdOf('mapleIdNames', ['maple-1']), { mapleId: 'maple-1', name: '본캐' }, OWNERS),
    ).resolves.toMatchObject({ record: { row: { mapleId: h('maple-1'), name: '본캐' } } })
    await expect(
      pushRecordOf(
        'trackedCharacters',
        preferenceRecordIdOf('trackedCharacters', ['ocid-2']),
        { ocid: 'ocid-2', sortOrder: 1, isRepresentative: false },
        OWNERS,
      ),
    ).resolves.toMatchObject({ record: { row: { mapleId: h('maple-2'), ocid: h('ocid-2'), sortOrder: 1, isRepresentative: false } } })
    await expect(
      pushRecordOf(
        'representativeCharacterMotions',
        preferenceRecordIdOf('representativeCharacterMotions', ['ocid-1']),
        { ocid: 'ocid-1', actions: ['A00'], emotions: [], durationMs: 3000, restsBetweenActions: true },
        OWNERS,
      ),
    ).resolves.toMatchObject({
      record: { row: { mapleId: h('maple-1'), ocid: h('ocid-1'), actions: ['A00'], emotions: [], durationMs: 3000, restsBetweenActions: true } },
    })
  })

  // 서버는 실은 칸만 고친다. 빈 값을 빼면 지운 설정이 서버에 남는다.
  it('설정은 바뀐 칸 하나를 빈 값이어도 싣고, 하위 페이지 차례는 원본이 없으면 대기 줄만 지운다', async () => {
    await expect(
      pushRecordOf(
        'accountSettings',
        preferenceRecordIdOf('accountSettings', ['mvpLastCheckedWeekCode']),
        { column: 'mvpLastCheckedWeekCode', value: null },
        OWNERS,
      ),
    ).resolves.toEqual({
      kind: 'send',
      record: { table: 'accountSettings', action: 'upsert', row: { mvpLastCheckedWeekCode: null } },
    })
    await expect(
      pushRecordOf(
        'bottomBarSubPageOrders',
        preferenceRecordIdOf('bottomBarSubPageOrders', ['schedule']),
        { groupKey: 'schedule', subPageKeys: ['Boss'] },
        OWNERS,
      ),
    ).resolves.toEqual({
      kind: 'send',
      record: { table: 'bottomBarSubPageOrders', action: 'upsert', row: { groupKey: 'schedule', subPageKeys: ['Boss'] } },
    })
    await expect(
      pushRecordOf('bottomBarSubPageOrders', preferenceRecordIdOf('bottomBarSubPageOrders', ['schedule']), null, OWNERS),
    ).resolves.toEqual({ kind: 'drop' })
  })

  it('약속은 보스 · 예외에 차례와 캐릭터의 메이플 ID 를 싣고, 계산기 기록은 캐릭터에 차례를 싣는다', async () => {
    await expect(
      pushRecordOf(
        'partyAppointments',
        'appointment-1',
        {
          id: 'appointment-1',
          bosses: [{ bossDifficultyId: 'd-1', ocid: 'ocid-1' }],
          time: '21:00',
          durationMinutes: 60,
          alarmMinutesBefore: null,
          schedule: { type: 'weekly', weekday: 4, fromWeekCode: 'W202647', untilWeekCode: null },
          exceptions: {
            W202648: { date: '2026-11-27', time: '22:00', durationMinutes: 30, bosses: [{ bossDifficultyId: 'd-2', ocid: 'ocid-2' }], alarmMinutesBefore: 10 },
          },
        },
        OWNERS,
      ),
    ).resolves.toEqual({
      kind: 'send',
      record: {
        table: 'partyAppointments',
        action: 'upsert',
        row: {
          id: 'appointment-1',
          time: '21:00',
          durationMinutes: 60,
          scheduleType: 'weekly',
          weekday: 4,
          fromWeekCode: 'W202647',
          bosses: [{ sortOrder: 0, bossDifficultyId: 'd-1', mapleId: h('maple-1'), ocid: h('ocid-1') }],
          exceptions: [
            {
              weekCode: 'W202648',
              date: '2026-11-27',
              time: '22:00',
              durationMinutes: 30,
              alarmMinutesBefore: 10,
              bosses: [{ sortOrder: 0, bossDifficultyId: 'd-2', mapleId: h('maple-2'), ocid: h('ocid-2') }],
            },
          ],
        },
      },
    })
    await expect(
      pushRecordOf(
        'bossProfitCalculatorRecords',
        'calc-1',
        {
          id: 'calc-1',
          savedAt: '2026-11-20T10:00:00.000Z',
          characters: [
            {
              ocid: 'ocid-2',
              bosses: [
                {
                  bossDifficultyId: 'd-1',
                  splitType: 'even',
                  partySize: 2,
                  splitShareMillipercent: null,
                  splitFeePercent: null,
                  splitFeeFollowsMvpGrade: true,
                },
              ],
            },
          ],
        },
        OWNERS,
      ),
    ).resolves.toEqual({
      kind: 'send',
      record: {
        table: 'bossProfitCalculatorRecords',
        action: 'upsert',
        row: {
          id: 'calc-1',
          savedAt: '2026-11-20T10:00:00.000Z',
          characters: [
            {
              sortOrder: 0,
              mapleId: h('maple-2'),
              ocid: h('ocid-2'),
              bosses: [{ bossDifficultyId: 'd-1', splitType: 'even', partySize: 2, splitFeeFollowsMvpGrade: true }],
            },
          ],
        },
      },
    })
  })
})
