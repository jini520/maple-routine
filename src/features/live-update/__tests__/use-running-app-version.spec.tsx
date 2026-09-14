// 화면이 보이는 앱 버전. 부팅 때 스토어가 채운 도는 번들의 버전이고, 비었을 때만 package.json 이다.
// package.json 을 바로 읽던 화면은 스토어 바이너리가 app.json 만 올리면 옛 버전을 보였다.
import { act, renderHook } from '@testing-library/react-native'

import packageJson from '../../../../package.json'
import { useLiveUpdateStore } from '../store'
import { useRunningAppVersion } from '../use-running-app-version'

afterEach(() => {
  useLiveUpdateStore.setState({ currentVersion: null })
})

it('스토어가 든 도는 번들의 버전이다', async () => {
  useLiveUpdateStore.setState({ currentVersion: '9.9.9' })

  const { result } = await renderHook(() => useRunningAppVersion())

  expect(result.current).toBe('9.9.9')
})

it('스토어가 비었으면 package.json 버전이다', async () => {
  const { result } = await renderHook(() => useRunningAppVersion())

  expect(result.current).toBe(packageJson.version)
})

it('스토어가 나중에 채워지면 따라 바뀐다', async () => {
  const { result } = await renderHook(() => useRunningAppVersion())

  await act(async () => {
    useLiveUpdateStore.setState({ currentVersion: '9.9.9' })
  })

  expect(result.current).toBe('9.9.9')
})
