import { getAppReviewRecord, setAppReviewRecord, type AppReviewRecord } from '../../storage/app-review'
import { requestStoreReview } from '../../native/store-review'

const DAY_MS = 24 * 60 * 60 * 1000

/** Apple 예제의 값. Apple 도 임의의 수라고 적었다. */
const MIN_SAVES = 4
/** 써 본 뒤에 평가하게 하는 기간 */
const FIRST_LAUNCH_WAIT_MS = 3 * DAY_MS
/** iOS 는 365일에 세 번까지 띄우고, Play 는 한 달 안에 다시 부르면 안 뜰 수 있다 */
const REQUEST_INTERVAL_MS = 90 * DAY_MS
/** 저장 직후 시트가 닫히는 화면을 막지 않는 대기 */
const AFTER_SAVE_DELAY_MS = 2_000

let pendingTimer: ReturnType<typeof setTimeout> | null = null
let holds = 0
/** 대기가 끝났는데 연출이 서 있어 미룬 요청 */
let deferred = false
/** 기록 칸을 읽고 다시 쓰는 일을 한 줄로 세운다. 저장 둘이 겹치면 한 번이 사라진다. */
let queue: Promise<void> = Promise.resolve()

function shouldRequest(record: AppReviewRecord, now: Date): boolean {
  if (record.saveCount < MIN_SAVES) return false
  if (now.getTime() - Date.parse(record.firstLaunchAt) < FIRST_LAUNCH_WAIT_MS) return false
  if (record.lastRequestedAt === null) return true
  return now.getTime() - Date.parse(record.lastRequestedAt) >= REQUEST_INTERVAL_MS
}

function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch(() => undefined)
  return queue
}

/**
 * 첫 실행일 기록. 이미 있으면 그대로 둔다. 앱이 켜질 때 `AppShell` 이 부른다.
 *
 * 설치 날짜는 앱이 알 수 없어서, 이 기능이 들어간 바이너리를 처음 켠 날부터 3일을 센다.
 */
export function recordFirstLaunch(now: Date = new Date()): Promise<void> {
  return enqueue(async () => {
    if ((await getAppReviewRecord()) !== null) return
    await setAppReviewRecord({ firstLaunchAt: now.toISOString(), saveCount: 0, lastRequestedAt: null })
  })
}

/**
 * 핵심 저장 한 번의 셈. 드롭 기록 · 가계부 기록 · 보스 직접 완료가 저장에 성공한 뒤 부른다.
 *
 * 기다리지 않고 실패를 삼킨다. 리뷰 요청이 실패해도 저장은 성공한 것이다.
 */
export function countCoreSave(): void {
  void enqueue(async () => {
    const now = new Date()
    const record = (await getAppReviewRecord()) ?? {
      firstLaunchAt: now.toISOString(),
      saveCount: 0,
      lastRequestedAt: null,
    }
    const next = { ...record, saveCount: record.saveCount + 1 }
    await setAppReviewRecord(next)
    if (shouldRequest(next, now)) scheduleRequest()
  })
}

/**
 * 리뷰 요청 미루기. 고가 드롭 연출이 서 있는 동안 잡는다.
 *
 * @returns 풀기 함수. 풀린 뒤 2초를 다시 기다려 미룬 요청을 낸다.
 */
export function holdReviewRequest(): () => void {
  holds += 1
  let released = false
  return () => {
    if (released) return
    released = true
    holds -= 1
    if (holds === 0 && deferred) {
      deferred = false
      scheduleRequest()
    }
  }
}

function scheduleRequest(): void {
  if (pendingTimer !== null || deferred) return
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    if (holds > 0) {
      deferred = true
      return
    }
    void enqueue(fireRequest)
  }, AFTER_SAVE_DELAY_MS)
}

/** 요청한 날을 먼저 적는다. 팝업이 떴는지는 알 수 없고, 못 적은 채 부르면 다음 저장마다 다시 묻는다. */
async function fireRequest(): Promise<void> {
  const now = new Date()
  const record = await getAppReviewRecord()
  if (record === null || !shouldRequest(record, now)) return
  await setAppReviewRecord({ ...record, lastRequestedAt: now.toISOString() })
  await requestStoreReview()
}

/** 테스트 전용. 모듈에 남은 대기와 미루기를 비운다. */
export function __resetAppReviewForTest(): void {
  if (pendingTimer !== null) clearTimeout(pendingTimer)
  pendingTimer = null
  holds = 0
  deferred = false
  queue = Promise.resolve()
}
