/**
 * 끄는 동안 자리가 바뀌는 순간의 촉각.
 *
 * 그 순간은 **UI 스레드 콜백**(`onOrderChange`)이라 손가락으로 만들 수 없고, RNTL 14 는 합성
 * 컴포넌트의 프롭에 닿는 질의를 없앴다. 그래서 이 파일만 정렬 라이브러리를 세워 두고 격자가
 * 무엇을 넘겼는지 본다. 나머지 거동(누르기·해제·스크린리더 순서 바꾸기)은
 * `app/settings/__tests__/SettingsCharactersScreen.test.tsx` 가 진짜 라이브러리로 붙든다.
 */
import { act, render } from '@testing-library/react-native'
import { useAnimatedRef } from 'react-native-reanimated'
import type { ScrollView } from 'react-native'

import { __resetNativePortsForTest, setHapticsPort } from '../../../../native/ports'
import { CharacterLayerGrid } from '../CharacterLayerGrid'

interface GridProps {
  onOrderChange: () => void
  onDragEnd: (params: { indexToKey: string[] }) => void
}

let 격자프롭: GridProps | null = null

jest.mock('react-native-sortables', () => ({
  __esModule: true,
  default: {
    Grid: (props: GridProps) => {
      격자프롭 = props
      return null
    },
    Handle: () => null,
  },
}))

const tap = jest.fn(async () => undefined)
const select = jest.fn(async () => undefined)

function Harness(): React.JSX.Element {
  const scrollableRef = useAnimatedRef<ScrollView>()

  return (
    <CharacterLayerGrid
      views={[]}
      candidates={[]}
      representativeOcid={null}
      scrollableRef={scrollableRef}
      separator={null}
      onOrderChange={jest.fn()}
      onAdd={jest.fn()}
      onRemove={jest.fn()}
      onSelectRepresentative={jest.fn()}
    />
  )
}

beforeEach(() => {
  격자프롭 = null
  tap.mockClear()
  select.mockClear()
  setHapticsPort({ tap, select })
})

afterEach(__resetNativePortsForTest)

describe('순서를 끄는 동안의 촉각', () => {
  it('자리가 바뀔 때마다 선택 촉각이 난다', async () => {
    await render(<Harness />)

    // `runOnJS` 는 UI 스레드에서 JS 로 건너뛰므로 한 박자 뒤에 닿는다.
    await act(async () => {
      격자프롭?.onOrderChange()
    })

    expect(select).toHaveBeenCalledTimes(1)
    expect(tap).not.toHaveBeenCalled()
  })

  // 마지막 자리 바꿈에서 이미 울렸다. 놓을 때 또 울리면 한 번의 이동에 두 번 난다.
  it('손을 뗄 때는 안 난다', async () => {
    await render(<Harness />)

    await act(async () => {
      격자프롭?.onDragEnd({ indexToKey: [] })
    })

    expect(select).not.toHaveBeenCalled()
    expect(tap).not.toHaveBeenCalled()
  })
})
