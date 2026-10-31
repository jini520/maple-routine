import { dehydrate, hydrate } from '@tanstack/react-query'

import { queryClient } from '../../query/client'
import { queryKeys } from '../../query/keys'
import { shouldPersistQuery } from '../../query/persist'
import { readEventWorldNames, saveEventWorldNames } from '../event-world-names'

/** 저장기가 하는 일. JSON 으로 쓰고 다음 실행에 올린다. */
function restartApp(): void {
  const state = dehydrate(queryClient, { shouldDehydrateQuery: shouldPersistQuery })
  const stored = JSON.parse(JSON.stringify(state)) as typeof state
  queryClient.clear()
  hydrate(queryClient, stored)
}

beforeEach(() => {
  queryClient.clear()
})

// 앞은 아직 못 받았다는 뜻이고 뒤는 스페셜 캐릭터가 없는 계정이다.
it('안 받은 것과 빈 집합을 가른다', () => {
  expect(readEventWorldNames()).toBeNull()

  saveEventWorldNames(new Set())
  expect(readEventWorldNames()).toEqual(new Set())
})

// `Set` 을 그대로 넣으면 JSON 에서 `{}` 가 되어 이름이 사라진다.
it('저장했다가 다시 올려도 이름이 남는다', () => {
  saveEventWorldNames(new Set(['머리맨들맨둘']))

  restartApp()

  expect(readEventWorldNames()).toEqual(new Set(['머리맨들맨둘']))
})

it('빈 집합도 다시 올린 뒤 빈 집합이다', () => {
  saveEventWorldNames(new Set())

  restartApp()

  expect(readEventWorldNames()).toEqual(new Set())
})

it('배열이 아닌 값은 없는 것으로 본다', () => {
  queryClient.setQueryData(queryKeys.eventWorldNames(), { a: 1 })

  expect(readEventWorldNames()).toBeNull()
})
