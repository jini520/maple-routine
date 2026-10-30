import type { ScheduleSnapshot } from '../../schedule-sync/use-schedule-queries'
import { buildRoundView } from '../round-view'

function snapshot(input: {
  outcomes?: ScheduleSnapshot['round'] extends infer R ? (R extends { outcomes: infer O } ? O : never) : never
  stranded?: { ocid: string }[]
  names?: Record<string, string>
  basics?: Record<string, string>
}): ScheduleSnapshot {
  const schedules = new Map(
    Object.entries(input.names ?? {}).map(([ocid, name]) => [
      ocid,
      { state: { characterName: name } as never, syncedAt: '2026-10-30T05:00:00.000Z' },
    ]),
  )
  const basics = new Map(
    Object.entries(input.basics ?? {}).map(([ocid, name]) => [
      ocid,
      { profile: { name, level: 280, imageUrl: '', accessFlag: true }, cachedAt: '2026-10-30T05:00:00.000Z' },
    ]),
  )
  return {
    ocids: [...schedules.keys()],
    schedules,
    basics,
    round: {
      fetchedAt: '2026-10-30T05:00:00.000Z',
      receivedAt: null,
      ocids: [...schedules.keys()],
      outcomes: input.outcomes ?? {},
      stranded: (input.stranded ?? []).map((one) => ({ ...one, characterName: null, reason: 'missing' })) as never,
    },
  }
}

it('캐시로 채운 캐릭터는 실패 종류로 배지를 가르고, 이름은 토스트가 센다', () => {
  const view = buildRoundView(
    snapshot({
      names: { a: '루디', b: '보니', c: '지내우시' },
      outcomes: {
        a: { isStale: true, syncedAt: null, error: { kind: 'characterUnavailable' } },
        b: { isStale: true, syncedAt: null, error: { kind: 'network' } },
        c: { isStale: false, syncedAt: '2026-10-30T05:00:00.000Z', error: null },
      },
    }),
  )

  expect(view.characterIssues).toEqual({ a: 'unavailable', b: 'failed' })
  expect(view.staleCharacterNames).toEqual(['루디', '보니'])
})

// 점검은 화면 맨 위의 배너가 알린다. 인원 수 토스트까지 띄우면 같은 일을 두 번 말한다.
it('점검으로 실패한 캐릭터는 배지는 달되 토스트 이름에는 안 든다', () => {
  const view = buildRoundView(
    snapshot({
      names: { a: '루디' },
      outcomes: { a: { isStale: true, syncedAt: null, error: { kind: 'gameMaintenance' } } },
    }),
  )

  expect(view.characterIssues).toEqual({ a: 'failed' })
  expect(view.staleCharacterNames).toEqual([])
})

it('동기화가 한 번도 답하지 않은 캐릭터는 조회 불가다', () => {
  const view = buildRoundView(snapshot({ stranded: [{ ocid: 'z' }] }))

  expect(view.characterIssues).toEqual({ z: 'unavailable' })
})

// 스케줄 캐시가 없는 캐릭터도 `character/basic` 이 있으면 이름을 안다. 둘 다 없으면 이름 없이 세지 않는다.
it('이름은 스케줄 캐시, 없으면 기본 정보에서 읽고, 둘 다 없으면 안 센다', () => {
  const view = buildRoundView(
    snapshot({
      basics: { a: '기본정보이름' },
      outcomes: {
        a: { isStale: true, syncedAt: null, error: { kind: 'network' } },
        b: { isStale: true, syncedAt: null, error: { kind: 'network' } },
      },
    }),
  )

  expect(view.staleCharacterNames).toEqual(['기본정보이름'])
  expect(view.characterIssues).toEqual({ a: 'failed', b: 'failed' })
})

it('회차가 아직 없으면 비어 있다', () => {
  const view = buildRoundView({ ocids: [], schedules: new Map(), basics: new Map(), round: undefined })

  expect(view).toEqual({ characterIssues: {}, staleCharacterNames: [] })
})
