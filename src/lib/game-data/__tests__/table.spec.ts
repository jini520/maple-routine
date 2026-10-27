import { createTable, derive } from '../table'

describe('createTable', () => {
  it('표를 바꾸고 구독자에게 알린다', () => {
    const table = createTable({ rows: [1] })
    const listener = jest.fn()
    table.subscribe(listener)
    const next = { rows: [2] }

    table.set(next)

    expect(table.get()).toBe(next)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('같은 객체를 다시 넣으면 알리지 않는다', () => {
    const table = createTable({ rows: [1] })
    const listener = jest.fn()
    table.subscribe(listener)

    table.set(table.get())

    expect(listener).not.toHaveBeenCalled()
  })

  it('구독을 풀면 더 알리지 않는다', () => {
    const table = createTable({ rows: [1] })
    const listener = jest.fn()
    table.subscribe(listener)()

    table.set({ rows: [2] })

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('derive', () => {
  it('첫 읽기에서 만들고 표가 그대로면 같은 값을 돌려준다', () => {
    const table = createTable({ rows: [3, 1, 2] })
    const build = jest.fn((value: { rows: number[] }) => [...value.rows].sort())
    const sorted = derive(table, build)

    expect(sorted()).toEqual([1, 2, 3])
    expect(sorted()).toBe(sorted())
    expect(build).toHaveBeenCalledTimes(1)
  })

  it('표가 바뀐 뒤 첫 읽기에서 다시 만든다', () => {
    const table = createTable({ rows: [3, 1, 2] })
    const build = jest.fn((value: { rows: number[] }) => [...value.rows].sort())
    const sorted = derive(table, build)
    sorted()

    table.set({ rows: [9, 8] })

    expect(sorted()).toEqual([8, 9])
    expect(build).toHaveBeenCalledTimes(2)
  })
})
