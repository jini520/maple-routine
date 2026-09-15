/**
 * 월드 마스터 표(`src/data/worlds.json`) 조회. 월드를 key 로 찾는 자리는 전부 이 모듈을 거친다.
 *
 * 기록 · 원장 · 판정은 월드 key 를 들고, 보이는 이름 · 엠블럼 · 챌린저스 여부 · 이벤트 월드 여부는 이 표에서 찾는다.
 * API 이름에서 key 를 얻는 규칙도 여기 하나다(`worldKeyOfApiName`).
 */
import worldsData from '../../data/worlds.json'

export interface WorldEntry {
  key: string
  /** API `world_name` 표기. 보이는 이름이다. */
  name: string
  /** 엠블럼 파일 basename. 챌린저스 넷이 같은 그림을 쓰고, 스페셜은 없다. */
  emblem?: string
  /** 시즌 보스를 보이고 월드 리프를 묻는 월드. 이름 앞부분으로 가리지 않는다. */
  challengers?: boolean
  /** 재화에 가치가 없어 강화 지출에서 빼는 월드. */
  event?: boolean
}

export const WORLDS: readonly WorldEntry[] = worldsData.worlds as WorldEntry[]

/** API 이름을 맞추는 규칙. NFC 로 맞추고 공백을 모두 지운다. 보스 · 컨텐츠 · 강화와 같다. */
function comparableName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '')
}

const worldByKey = new Map(WORLDS.map((world) => [world.key, world]))
const keyByComparableName = new Map(WORLDS.map((world) => [comparableName(world.name), world.key]))

/** 표의 한 줄. 모르는 key 와 key 없음은 `null` 이다. */
export function findWorld(key: string | null | undefined): WorldEntry | null {
  return key == null ? null : (worldByKey.get(key) ?? null)
}

/** API 이름(`world_name`)에서 key. 표에 없으면 `null` 이다. */
export function worldKeyOfApiName(name: string): string | null {
  return keyByComparableName.get(comparableName(name)) ?? null
}

/**
 * 보이는 월드 이름. 표 이름이고, 모르는 key 면 넘긴 이름이다.
 *
 * @example worldNameOf(record.worldKey, record.world ?? '')
 */
export function worldNameOf(key: string | null | undefined, fallbackName: string): string {
  return findWorld(key)?.name ?? fallbackName
}

export function isChallengersWorld(key: string | null | undefined): boolean {
  return findWorld(key)?.challengers === true
}

export function isEventWorld(key: string | null | undefined): boolean {
  return findWorld(key)?.event === true
}
