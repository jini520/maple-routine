import { HOUR_VALUES, hoursFrom, minuteValues, snapMinute } from '../time-wheel-values'

it('시는 0 부터 23 까지다', () => {
  expect(HOUR_VALUES).toHaveLength(24)
  expect(HOUR_VALUES[0]).toBe(0)
  expect(HOUR_VALUES[23]).toBe(23)
})

it('분은 단위마다 0 부터 선다', () => {
  expect(minuteValues(5)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
  expect(minuteValues(30)).toEqual([0, 30])
})

it('단위에 안 맞는 분은 가장 가까운 칸으로 맞춘다', () => {
  expect(snapMinute(23, 5)).toBe(25)
  expect(snapMinute(22, 5)).toBe(20)
  expect(snapMinute(40, 30)).toBe(30)
})

it('59 분은 다음 시로 넘기지 않고 그 시의 마지막 칸에 머문다', () => {
  expect(snapMinute(59, 5)).toBe(55)
  expect(snapMinute(50, 30)).toBe(30)
})

it('시작 시부터 세우면 23 다음이 00 이다', () => {
  expect(hoursFrom(23).slice(0, 3)).toEqual([23, 0, 1])
  expect(hoursFrom(20).slice(0, 5)).toEqual([20, 21, 22, 23, 0])
  expect(hoursFrom(0)).toEqual(HOUR_VALUES)
})
