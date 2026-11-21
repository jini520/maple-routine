// 월드 마스터 표 조회. 기록 · 원장 · 판정은 월드 key 를 들고 이름 · 엠블럼 · 챌린저스 여부는 여기서 찾는다.
import { worldEmblemUrl } from '../../assets/asset-lookup'
import { findWorld, isInWorldPeriod, parseWorlds, worldKeyOfApiName, worldNameOf } from '../worlds'

const world = (over: Record<string, unknown> = {}) => ({
  id: 'w-special',
  key: 'special',
  name: '스페셜',
  isChallengers: false,
  isEvent: true,
  ...over,
})
const period = (validFrom: string, validUntil: string) => ({ worldId: 'w-special', validFrom, validUntil })

// 이벤트 · 챌린저스 월드는 닫혔다가 같은 이름으로 다시 열린다. 그래서 기간이 여러 줄이다.
describe('월드 기간', () => {
  it('한 월드의 기간 여러 줄을 받고, 기간이 없는 월드도 받는다', () => {
    const worldOpenPeriods = [period('2025-11-20', '2025-12-19'), period('2026-11-19', '2026-12-17')]
    const table = parseWorlds({
      updatedAt: null,
      worlds: [world(), world({ id: 'w-scania', key: 'scania', name: '스카니아', isEvent: false })],
      worldOpenPeriods,
    })

    expect(table?.worldOpenPeriods).toEqual(worldOpenPeriods)
  })

  // 계약을 어긴 값은 줄이 아니라 표 전체를 버린다. 반쯤 맞는 기간으로 판정하면 지출이 조용히 샌다.
  it.each([
    ['날짜 글자가 아니다', [period('2025-11-20T10:00', '2025-12-19')]],
    ['끝이 시작보다 뒤가 아니다', [period('2025-12-19', '2025-12-19')]],
    ['이 칸에 없는 월드를 가리킨다', [{ ...period('2025-11-20', '2025-12-19'), worldId: 'nope' }]],
    ['배열이 아니다', period('2025-11-20', '2025-12-19')],
  ])('%s 면 표 전체가 null 이다', (_, worldOpenPeriods) => {
    expect(parseWorlds({ updatedAt: null, worlds: [world()], worldOpenPeriods })).toBeNull()
  })

  // validUntil 은 닫힌 다음 날이다. 보스 기간과 같다. 스페셜은 12-18 03시에 닫혀 그 날 기록이 있다.
  it('시작 날은 들고 끝 날은 뺀다', () => {
    expect(isInWorldPeriod('special', '2025-11-19')).toBe(false)
    expect(isInWorldPeriod('special', '2025-11-20')).toBe(true)
    expect(isInWorldPeriod('special_2', '2025-12-18')).toBe(true)
    expect(isInWorldPeriod('special_2', '2025-12-19')).toBe(false)
  })

  it('기간이 없는 월드와 모르는 key 는 어느 날도 기간 밖이다', () => {
    expect(isInWorldPeriod('elysium', '2025-11-25')).toBe(false)
    expect(isInWorldPeriod('nope', '2025-11-25')).toBe(false)
  })
})

describe('API 이름에서 key 를 찾는다', () => {
  // 넥슨 표기는 ㅐ 다. ㅔ 로 적으면 핼리오스 캐릭터 전부가 월드 key 를 못 얻는다.
  it('핼리오스는 넥슨 표기로 찾는다', () => {
    expect(worldKeyOfApiName('핼리오스')).toBe('helios')
    expect(worldKeyOfApiName('헬리오스')).toBeNull()
  })

  // 규칙은 보스 · 컨텐츠 · 강화와 같다.
  it('NFC 뒤 공백을 지우고 완전 일치로 맞춘다', () => {
    expect(worldKeyOfApiName('챌린저스 2')).toBe('challengers_2')
    expect(worldKeyOfApiName('엘리시움'.normalize('NFD'))).toBe('elysium')
  })

  // 앞부분이 같다고 챌린저스가 아니다. 새 챌린저스 월드는 표부터 고친다.
  it('표에 없는 이름은 null 이다', () => {
    expect(worldKeyOfApiName('챌린저스5')).toBeNull()
    expect(worldKeyOfApiName('리부트')).toBeNull()
  })
})

describe('key 로 찾는다', () => {
  it('보이는 이름은 표 이름이고 모르는 key 면 넘긴 이름이다', () => {
    expect(worldNameOf('challengers_2', '옛 이름')).toBe('챌린저스2')
    expect(worldNameOf('nope', '어딘가')).toBe('어딘가')
    expect(worldNameOf(null, '어딘가')).toBe('어딘가')
    expect(findWorld(undefined)).toBeNull()
  })
})

describe('worldEmblemUrl', () => {
  it('엠블럼이 있는 월드는 그림을 찾는다', () => {
    expect(worldEmblemUrl('elysium')).toBeTruthy()
    expect(worldEmblemUrl('scania')).toBeTruthy()
  })

  it('챌린저스 넷은 같은 그림이다', () => {
    const base = worldEmblemUrl('challengers')
    expect(base).toBeTruthy()
    expect(worldEmblemUrl('challengers_2')).toBe(base)
    expect(worldEmblemUrl('challengers_4')).toBe(base)
  })

  it('엠블럼이 없는 월드와 모르는 key 는 null 이다', () => {
    expect(worldEmblemUrl('special')).toBeNull()
    expect(worldEmblemUrl('nope')).toBeNull()
    expect(worldEmblemUrl(null)).toBeNull()
  })
})
