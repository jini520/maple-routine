// 월드 마스터 표가 스스로 모순되지 않는가.
import { WORLD_EMBLEM_ASSETS } from '../../assets/generated/worlds'
import worldsData from '../worlds.json'

interface Row {
  key: string
  name: string
  emblem?: string
  challengers?: boolean
  event?: boolean
}

const rows = worldsData.worlds as Row[]
const comparable = (name: string) => name.normalize('NFC').replace(/\s+/g, '')

it('key 는 snake_case 이고 겹치지 않는다', () => {
  expect(rows.filter((row) => !/^[a-z][a-z0-9_]*$/.test(row.key))).toEqual([])
  expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
})

// 응답을 받는 자리가 NFC 뒤 공백을 지운 이름으로 key 를 찾는다. 그 형태에서 겹치면 한 월드가 다른 월드를 덮는다.
it('이름은 NFC 뒤 공백을 지워도 겹치지 않는다', () => {
  expect(new Set(rows.map((row) => comparable(row.name))).size).toBe(rows.length)
})

// 오타 한 글자면 그 월드만 조용히 엠블럼을 잃는다.
it('엠블럼 basename 은 모두 에셋에 있다', () => {
  expect(rows.filter((row) => row.emblem !== undefined && WORLD_EMBLEM_ASSETS[row.emblem] === undefined)).toEqual([])
})

it('이벤트 월드는 엠블럼이 없고 챌린저스가 아니다', () => {
  expect(rows.filter((row) => row.event === true).map((row) => [row.key, row.emblem, row.challengers])).toEqual([
    ['special', undefined, undefined],
  ])
})
