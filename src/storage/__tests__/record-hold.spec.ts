/// <reference types="node" />
/**
 * 기기 변환이 끝나기 전에 Preferences 에 든 기록을 읽고 쓰는 저장소가 기다리는지. 앱을 켜면 화면보다 먼저 도는 배경 갱신이 이
 * 저장소를 부르고, 옛 모양을 새 코드로 읽어 다시 적으면 읽지 못한 항목이 사라진다.
 */
import { getBarOrder } from '../bar-order'
import { getBossProfitCalculatorRecords } from '../boss-profit-calculator-records'
import { getFigureMotions } from '../figure-motions'
import { getManualTrackedContent } from '../manual-tracked-content'
import { getMvpLastCheckedWeek } from '../mvp-grade-prefs'
import { getPartyAppointments, setPartyAppointments } from '../party-appointments'
import { getQuickLinks } from '../quick-links'
import { holdRecordsUntil } from '../record-hold'
import { getAccountSharedProgress } from '../shared-progress-cache'
import { getStatsCumulativeStart } from '../stats-cumulative-start'
import { getTrackingMode } from '../tracking-mode'
import { installFakePreferences } from './fake-preferences'

/** 끝나지 않은 일이 한 바퀴 돌 시간. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

/** 약속이 풀렸는지 본다. */
function watch(promise: Promise<unknown>): () => boolean {
  let done = false
  void promise.then(() => {
    done = true
  })
  return () => done
}

let release: () => void = () => {}

beforeEach(() => {
  installFakePreferences()
  holdRecordsUntil(
    new Promise<void>((resolve) => {
      release = resolve
    }),
  )
})

afterEach(() => {
  release()
  holdRecordsUntil(Promise.resolve())
})

it('변환한 키를 읽고 쓰는 저장소는 변환이 끝날 때까지 기다리고, 끝나면 풀린다', async () => {
  const calls = [
    getTrackingMode(),
    getManualTrackedContent('ocid-1'),
    getAccountSharedProgress('maple-a'),
    getPartyAppointments(),
    setPartyAppointments([]),
    getBossProfitCalculatorRecords(),
    getQuickLinks(),
    getFigureMotions(),
    getStatsCumulativeStart(),
    getMvpLastCheckedWeek(),
  ].map(watch)
  await settle()

  expect(calls.filter((done) => done())).toHaveLength(0)

  release()
  await settle()

  expect(calls.filter((done) => !done())).toHaveLength(0)
})

// 셸이 변환보다 먼저 하단바 순서를 읽어 바를 그린다. 기다리게 하면 변환이 끝난 뒤 첫 화면에 바가 기본 순서로 잠깐 보인다.
it('하단바 순서는 기다리지 않고 옛 칸 이름과 새 칸 이름을 다 읽는다', async () => {
  const prefs = installFakePreferences()
  const order = { groups: ['today', 'content'], subs: { content: ['Content', 'Boss'] } }
  await prefs.set('barOrder', JSON.stringify(order))

  await expect(getBarOrder()).resolves.toEqual(order)

  await prefs.set('barOrder', JSON.stringify({ groupKeys: order.groups, subPageKeys: order.subs }))

  await expect(getBarOrder()).resolves.toEqual(order)
})
