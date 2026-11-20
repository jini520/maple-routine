/**
 * 강화 줄의 이름을 그날 그 이름이었던 캐릭터(ocid)에 붙인다. 강화 응답은 그때의 이름만 주기 때문이다. 지금 이름으로 맞추면
 * 이름을 바꾸기 전 날짜의 줄이나, 다른 캐릭터가 쓰던 이름의 줄을 잘못 붙인다.
 *
 * 차례는 넷이고, 앞에서 찾으면 뒤로 가지 않는다.
 *
 * 1. 앱이 직접 본 기간. 그 이름으로 본 기간 안의 날이면 넥슨을 부르지 않는다.
 * 2. 그날 이름. 그 계정의 캐릭터마다 `character/basic` 에 날짜를 넣어 그날 이름을 받는다. 그 이름을 쓴 적이 있는 캐릭터부터 묻고,
 *    그 캐릭터들은 차례 3 · 4 까지 먼저 본다. 그 날짜나 그 뒤에 값이 없던 캐릭터는 맨 뒤에 묻는다.
 * 3. 이름을 바꾼 날. 그날 이름과 다르면 전날 · 다음 날 이름과도 견준다. `date` 가 그날 어느 시각 기준인지 몰라서다.
 * 4. 리프 전 기간. 그날 값이 없는데 만든 날이 앞이면 리프 전이다. 처음 값이 온 날의 이름이 같으면 붙인다.
 *
 * 넷 다 아니면 붙이지 않는다. 넥슨을 부르다 실패했으면 다시 받을 실패라 따로 알린다.
 */
import { shiftDateKey } from '../../lib/calendar'
import { sightedOwnerOf } from '../../lib/enhancement/sighted-owner'
import { worldKeyOfApiName } from '../../lib/world/worlds'
import { fetchCharacterBasicOn } from '../../nexon/character/client'
import type { EnhancementOwnerSighting } from '../../storage/character-accounts'
import {
  datedNameKey,
  getDatedNames,
  getNoValueThroughDates,
  getOcidsNamed,
  saveDatedName,
  type DatedName,
} from '../../storage/character-dated-names'
import { getCharacterFirstDays, saveCharacterFirstDay, type CharacterFirstDay } from '../../storage/character-first-days'
import type { MapleAccount, MapleCharacter } from '../../types'
import type { NexonCredential } from '../../types/auth'

/** 줄을 붙인 캐릭터. */
export interface LineOwner {
  ocid: string
  /** 그 캐릭터의 메이플 ID */
  accountId: string
  /** 그 캐릭터의 월드 이름 원문. 모르면 `null` */
  worldName: string | null
  /** 그 캐릭터의 월드 key. 모르면 `null` */
  worldKey: string | null
  /** 리프 전 기간의 줄. 리프 전 월드의 줄을 리프 뒤의 ocid 에 붙인 것이라 이 줄의 월드는 그 ocid 의 월드가 아니다 */
  preLeap: boolean
  /** 리프 전 줄이면 그 ocid 에 처음 값이 온 날. 리프 전 월드를 이 날 앞의 스타포스 줄에서 찾는다 */
  leapDate: string | null
}

/** 붙인 캐릭터, 붙일 곳이 없음(`none`), 넥슨을 부르다 실패해 다음 회차에 다시 볼 것(`retry`). */
export type OwnerResult = LineOwner | 'none' | 'retry'

export type OwnerOf = (name: string, dateKey: string) => Promise<OwnerResult>

export interface OwnerContext {
  /** 그 넥슨 계정의 자격. 그날 이름도 이 자격으로 부른다 */
  credential: NexonCredential
  nexonAccountId: string
  /** 그 계정의 `character/list`. 못 받았으면 `null` 이고, 차례 2 ~ 4 를 할 수 없다 */
  accounts: readonly MapleAccount[] | null
  sightings: readonly EnhancementOwnerSighting[]
  /** KST `YYYY-MM-DD`. 이 날의 이름은 목록의 지금 이름이다. 날짜를 넣어 오늘을 부를 수 없다 */
  todayDateKey: string
  now: Date
}

/** 그날 이름을 한 번에 묻는 수. 넥슨 로그인 계정은 이 호출이 모든 로그인 사용자가 나눠 쓰는 번들 개발자 키로 간다. */
const DATED_CALL_LIMIT = 2

interface Candidate {
  character: MapleCharacter
  accountId: string
}

type Dated = DatedName | 'failed'

/** 한 회차 · 한 넥슨 계정의 판정기. 같은 이름 · 날짜와 같은 ocid · 날짜는 한 번만 본다. */
export function createOwnerResolver(context: OwnerContext): OwnerOf {
  const candidates: Candidate[] | null =
    context.accounts?.flatMap((account) => account.characters.map((character) => ({ character, accountId: account.accountId }))) ??
    null
  const listed = new Map((candidates ?? []).map((candidate) => [candidate.character.ocid, candidate]))
  const yesterday = shiftDateKey(context.todayDateKey, -1)

  const dated = new Map<string, Promise<Dated>>()
  const firstDays = new Map<string, Promise<CharacterFirstDay | null | 'failed'>>()
  const results = new Map<string, Promise<OwnerResult>>()
  const limit = createLimiter(DATED_CALL_LIMIT)
  /** 같은 이름의 찾기를 날짜마다 차례로 잇는 끝. 앞 날짜에서 찾은 캐릭터를 뒤 날짜가 먼저 묻게 한다. */
  const nameTails = new Map<string, Promise<unknown>>()
  /** 이번 회차에 그 이름으로 붙인 캐릭터. */
  const foundOcids = new Map<string, string>()
  /** 적어 둔 그날 이름에 그 이름이 있는 캐릭터. 이름마다 한 번 읽는다. */
  const namedOcids = new Map<string, Promise<ReadonlySet<string>>>()
  /** 캐릭터마다 값이 없던 것을 아는 가장 늦은 날. 그 날과 그 앞은 값이 없을 것이라 맨 뒤에 묻는다. */
  const noValueThrough = new Map<string, string>()
  let noValueSeeded: Promise<void> | null = null

  function markNoValue(ocid: string, dateKey: string): void {
    if ((noValueThrough.get(ocid) ?? '') < dateKey) noValueThrough.set(ocid, dateKey)
  }

  /** 적어 둔 값 없는 날과 처음 값이 온 날로 `noValueThrough` 를 채운다. 못 읽으면 비운 채로 둔다. 차례만 바뀐다. */
  function seedNoValue(): Promise<void> {
    noValueSeeded ??= (async () => {
      const ocids = [...listed.keys()]
      const [through, first] = await Promise.all([
        getNoValueThroughDates(ocids).catch(() => new Map<string, string>()),
        getCharacterFirstDays(ocids).catch(() => new Map<string, CharacterFirstDay>()),
      ])
      for (const [ocid, dateKey] of through) markNoValue(ocid, dateKey)
      for (const [ocid, day] of first) markNoValue(ocid, shiftDateKey(day.firstDate, -1))
    })()
    return noValueSeeded
  }

  function namedOf(name: string): Promise<ReadonlySet<string>> {
    let pending = namedOcids.get(name)
    if (pending === undefined) {
      pending = getOcidsNamed(name)
        .then((ocids) => new Set(ocids))
        .catch(() => new Set<string>())
      namedOcids.set(name, pending)
    }
    return pending
  }

  /** 그 ocid 의 그날 값. 오늘 뒤는 목록의 지금 이름이다. 적어 둔 값이 있으면 부르지 않는다. */
  function datedOf(ocid: string, dateKey: string): Promise<Dated> {
    if (dateKey >= context.todayDateKey) {
      const candidate = listed.get(ocid)
      return Promise.resolve({ name: candidate?.character.name ?? null, worldName: candidate?.character.world ?? null })
    }
    const key = datedNameKey(ocid, dateKey)
    let pending = dated.get(key)
    if (pending === undefined) {
      pending = loadDated(ocid, dateKey)
      dated.set(key, pending)
    }
    return pending
  }

  async function loadDated(ocid: string, dateKey: string): Promise<Dated> {
    const stored = (await getDatedNames([ocid], [dateKey]).catch(() => new Map<string, DatedName>())).get(
      datedNameKey(ocid, dateKey),
    )
    if (stored !== undefined) return stored
    try {
      const fetched = await limit(() => fetchCharacterBasicOn(context.credential, ocid, dateKey))
      const value: DatedName = { name: fetched.name, worldName: fetched.worldName }
      if (value.name === null) markNoValue(ocid, dateKey)
      await saveDatedName(ocid, dateKey, value, context.now).catch(() => undefined)
      if (fetched.createdDate !== null) createdDates.set(ocid, fetched.createdDate)
      return value
    } catch {
      return 'failed'
    }
  }

  /** 응답이 함께 준 만든 날. 처음 값이 온 날을 찾을 때 다시 묻지 않는다. */
  const createdDates = new Map<string, string>()

  /** 그 ocid 의 만든 날과 처음 값이 온 날. 만든 날이 그 날짜보다 뒤면 리프 전일 수 없어 찾지 않고 `null` 이다. */
  function firstDayOf(ocid: string, dateKey: string): Promise<CharacterFirstDay | null | 'failed'> {
    let pending = firstDays.get(ocid)
    if (pending === undefined) {
      pending = loadFirstDay(ocid)
      firstDays.set(ocid, pending)
    }
    return pending.then((found) => (found === null || found === 'failed' || found.createdDate <= dateKey ? found : null))
  }

  async function loadFirstDay(ocid: string): Promise<CharacterFirstDay | null | 'failed'> {
    const stored = (await getCharacterFirstDays([ocid]).catch(() => new Map<string, CharacterFirstDay>())).get(ocid)
    if (stored !== undefined) return stored

    // 만든 날은 값이 있는 날의 응답이 준다. 어제는 값이 있는 날이다. 적어 둔 그날 이름에는 만든 날이 없어 다시 부른다.
    let createdDate = createdDates.get(ocid) ?? null
    if (createdDate === null) {
      try {
        const latest = await limit(() => fetchCharacterBasicOn(context.credential, ocid, yesterday))
        if (latest.name === null) return null
        createdDate = latest.createdDate
      } catch {
        return 'failed'
      }
    }
    if (createdDate === null) return null

    // 값이 없는 날(low)과 있는 날(high) 사이를 좁혀 처음 값이 온 날을 찾는다.
    let low = createdDate
    let high = yesterday
    const first = await datedOf(ocid, low)
    if (first === 'failed') return 'failed'
    if (first.name === null) {
      while (daysBetween(low, high) > 1) {
        const middle = shiftDateKey(low, Math.floor(daysBetween(low, high) / 2))
        const value = await datedOf(ocid, middle)
        if (value === 'failed') return 'failed'
        if (value.name === null) low = middle
        else high = middle
      }
    } else {
      high = low
    }
    const firstValue = await datedOf(ocid, high)
    if (firstValue === 'failed') return 'failed'
    if (firstValue.name === null) return null
    const found: CharacterFirstDay = { createdDate, firstDate: high, firstName: firstValue.name }
    await saveCharacterFirstDay(ocid, found, context.now).catch(() => undefined)
    return found
  }

  /** 그 ocid 의 월드. 목록에 있으면 목록의 월드이고, 없으면 소속 기록에 적힌 월드다. 리프 전 줄은 그 ocid 의 월드가 아니다. */
  function ownerOf(ocid: string, accountId: string, leapDate: string | null = null): LineOwner {
    if (leapDate !== null) return { ocid, accountId, worldName: null, worldKey: null, preLeap: true, leapDate }
    const candidate = listed.get(ocid)
    if (candidate !== undefined) {
      const { world, worldKey } = candidate.character
      return { ocid, accountId, worldName: world, worldKey: worldKey ?? worldKeyOfApiName(world), preLeap: false, leapDate: null }
    }
    const worldKey = context.sightings.find((sighting) => sighting.ocid === ocid && sighting.worldKey !== null)?.worldKey ?? null
    return { ocid, accountId, worldName: null, worldKey, preLeap: false, leapDate: null }
  }

  async function resolve(name: string, dateKey: string): Promise<OwnerResult> {
    // 응답 이름이 빈 글자인 줄은 붙일 곳이 없다. 캐릭터마다 그날 이름을 묻지 않는다.
    if (name === '') return 'none'
    const sighted = sightedOwnerOf(context.sightings, name, dateKey, context.nexonAccountId)
    if (sighted !== null) return ownerOf(sighted.ocid, sighted.accountId)
    if (candidates === null) return 'retry'

    // 그 이름을 쓴 적이 있는 캐릭터부터 차례 2 ~ 4 를 다 보고, 나머지로 간다. 이름은 한때 한 캐릭터만 쓰므로 붙는 캐릭터는 같고
    // 부르는 수만 준다. 리프 전 줄은 지금 이름이 같은 캐릭터에 차례 4 로 붙어, 나머지를 다 물은 뒤에야 가면 하루마다 캐릭터 수만큼 부른다.
    await seedNoValue()
    const named = await namedOf(name)
    const knownNames = (ocid: string) => context.sightings.filter((sighting) => sighting.ocid === ocid).map((sighting) => sighting.name)
    const preferred = (candidate: Candidate): boolean => {
      const { ocid } = candidate.character
      return foundOcids.get(name) === ocid || named.has(ocid) || candidate.character.name === name || knownNames(ocid).includes(name)
    }
    const first = candidates
      .filter(preferred)
      .sort((left, right) => Number(foundOcids.get(name) === right.character.ocid) - Number(foundOcids.get(name) === left.character.ocid))
    // 값이 없던 날 뒤의 캐릭터는 건너뛰지 않고 미룬다. 넥슨 데이터가 하루 비는 날이 있으면 건너뛴 캐릭터의 줄을 버리고 그 날을 굳힌다.
    const others = candidates.filter((candidate) => !preferred(candidate))
    const noValue = (candidate: Candidate) => (noValueThrough.get(candidate.character.ocid) ?? '') >= dateKey
    const rest = [...others.filter((candidate) => !noValue(candidate)), ...others.filter(noValue)]

    let failed = false
    for (const group of [first, rest]) {
      const found = await searchGroup(group, name, dateKey)
      if (found.failed) failed = true
      if (found.owner !== null) {
        if (!found.owner.preLeap) foundOcids.set(name, found.owner.ocid)
        return found.owner
      }
    }
    return failed ? 'retry' : 'none'
  }

  /** 캐릭터 무리 안에서 차례 2 · 3 · 4 를 본다. */
  async function searchGroup(
    group: readonly Candidate[],
    name: string,
    dateKey: string,
  ): Promise<{ owner: LineOwner | null; failed: boolean }> {
    let failed = false
    const onDate = new Map<string, DatedName>()
    for (const candidate of group) {
      const value = await datedOf(candidate.character.ocid, dateKey)
      if (value === 'failed') {
        failed = true
        continue
      }
      onDate.set(candidate.character.ocid, value)
      if (value.name === name) return { owner: ownerOf(candidate.character.ocid, candidate.accountId), failed }
    }

    for (const candidate of group) {
      if (onDate.get(candidate.character.ocid)?.name == null) continue
      for (const neighbor of [shiftDateKey(dateKey, -1), shiftDateKey(dateKey, 1)]) {
        const value = await datedOf(candidate.character.ocid, neighbor)
        if (value === 'failed') failed = true
        else if (value.name === name) return { owner: ownerOf(candidate.character.ocid, candidate.accountId), failed }
      }
    }

    for (const candidate of group) {
      const value = onDate.get(candidate.character.ocid)
      if (value === undefined || value.name !== null) continue
      const day = await firstDayOf(candidate.character.ocid, dateKey)
      if (day === 'failed') failed = true
      else if (day !== null && dateKey < day.firstDate && day.firstName === name) {
        return { owner: ownerOf(candidate.character.ocid, candidate.accountId, day.firstDate), failed }
      }
    }
    return { owner: null, failed }
  }

  return (name, dateKey) => {
    const key = `${name}|${dateKey}`
    let pending = results.get(key)
    if (pending === undefined) {
      const run = (): Promise<OwnerResult> => resolve(name, dateKey)
      pending = (nameTails.get(name) ?? Promise.resolve()).then(run, run)
      nameTails.set(name, pending.catch(() => undefined))
      results.set(key, pending)
    }
    return pending
  }
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** 한 번에 `size` 개까지만 돌린다. */
function createLimiter(size: number): <T>(task: () => Promise<T>) => Promise<T> {
  let running = 0
  const waiting: (() => void)[] = []
  return async (task) => {
    if (running >= size) await new Promise<void>((resolve) => waiting.push(resolve))
    running += 1
    try {
      return await task()
    } finally {
      running -= 1
      waiting.shift()?.()
    }
  }
}
