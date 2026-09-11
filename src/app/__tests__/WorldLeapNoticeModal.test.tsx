// 월드 리프 안내 모달. 갈린 것 셋이고 그 셋이 이 파일의 실질이다.
//
// 스토어를 모킹하지 않고 `setState` 로 몬다(이 패키지의 관례). 실물 리듀서를 쓰므로 `notice` 가
// 실제로 그 값을 가질 수 있는지까지 함께 검사된다. 저장소를 만지는 `confirm` 과 스케줄러
// 스토어의 `saveTrackedOcids` 만 갈아 끼운다.
import { fireEvent } from '@testing-library/react-native'

import { useWorldLeapStore } from '../../features/character-manage/world-leap-store'
import { useContentSchedulerStore } from '../../features/content-scheduler/store'
import type { WorldLeapNotice } from '../../features/character-manage/world-leap'

import { renderOverlay } from '../../components/__tests__/render-atom'
import { WorldLeapNoticeModal } from '../WorldLeapNoticeModal'

const 옛것 = { ocid: 'old', name: '지내우시', world: '챌린저스2', jobClass: '레테', level: 285 }

const 짚음: WorldLeapNotice = {
  kind: 'confirmed',
  from: 옛것,
  to: { ocid: 'new', name: '지내우시', world: '엘리시움', jobClass: '레테', level: 285 },
}

const 모름: WorldLeapNotice = { kind: 'unknown', from: 옛것 }

/** 옮겨간 캐릭터를 이미 관리 중이다. 목적지는 아는데 바꿀 일이 없다. */
const 이미관리중: WorldLeapNotice = { ...짚음, kind: 'alreadyTracked' }

let confirm: jest.Mock
let dismiss: jest.Mock
let saveTrackedOcids: jest.Mock
let onOpenCharacterManage: jest.Mock

beforeEach(() => {
  confirm = jest.fn(async () => ['new'])
  dismiss = jest.fn()
  saveTrackedOcids = jest.fn(async () => {})
  onOpenCharacterManage = jest.fn()
  useWorldLeapStore.setState({ notice: null, confirm, dismiss })
  useContentSchedulerStore.setState({ saveTrackedOcids })
})

const 그리기 = () =>
  renderOverlay(<WorldLeapNoticeModal onOpenCharacterManage={onOpenCharacterManage} />)

it('들고 있는 것이 없으면 아무것도 그리지 않는다', async () => {
  const { queryByTestId } = await 그리기()

  expect(queryByTestId('world-leap-notice-overlay')).toBeNull()
})

describe('목적지를 짚었을 때', () => {
  beforeEach(() => {
    useWorldLeapStore.setState({ notice: 짚음 })
  })

  it('옛 이름으로 묻고 두 월드를 나란히 그린다', async () => {
    const { getByText } = await 그리기()

    expect(getByText('지내우시 님이 월드를 옮긴 것 같아요')).toBeTruthy()
    expect(getByText('챌린저스2')).toBeTruthy()
    expect(getByText('엘리시움')).toBeTruthy()
  })

  it('변경을 누르면 갈아끼우고 그 목록을 스케줄러에 흘린다', async () => {
    const { getByText } = await 그리기()

    fireEvent.press(getByText('변경'))
    await Promise.resolve()

    expect(confirm).toHaveBeenCalled()
    expect(saveTrackedOcids).toHaveBeenCalledWith(['new'])
  })
})

// 사용자가 리프 뒤에 새 캐릭터를 직접 추가한 경우. 새 것은 이미 목록에 있으므로 할 일은
// 조회할 수 없는 옛 것을 빼는 하나다.
describe('옮겨간 캐릭터를 이미 관리 중일 때', () => {
  beforeEach(() => {
    useWorldLeapStore.setState({ notice: 이미관리중 })
  })

  it('목적지를 아는 대로 그린다', async () => {
    const { getByText, queryByText } = await 그리기()

    expect(getByText('챌린저스2')).toBeTruthy()
    expect(getByText('엘리시움')).toBeTruthy()
    expect(queryByText('?')).toBeNull()
  })

  it('목록에서 빼기 를 누르면 빼고 그 목록을 스케줄러에 흘린다', async () => {
    const { getByText, queryByText } = await 그리기()

    expect(queryByText('변경')).toBeNull()
    fireEvent.press(getByText('목록에서 빼기'))
    await Promise.resolve()

    expect(confirm).toHaveBeenCalled()
    expect(saveTrackedOcids).toHaveBeenCalledWith(['new'])
    expect(onOpenCharacterManage).not.toHaveBeenCalled()
  })
})

// 닉네임을 바꾸고 리프하면 앱이 두 ocid 를 못 잇는다. 옮겼다는 사실만 알고 어디로 갔는지는
// 모르므로, 바꿀 대상이 없어 `변경` 이 설 수 없다.
describe('목적지를 모를 때', () => {
  beforeEach(() => {
    useWorldLeapStore.setState({ notice: 모름 })
  })

  it('아는 이름으로 묻고 목적지를 물음표로 비운다', async () => {
    const { getByText, queryByText } = await 그리기()

    expect(getByText('지내우시 님이 월드를 옮긴 것 같아요')).toBeTruthy()
    expect(getByText('챌린저스2')).toBeTruthy()
    expect(getByText('?')).toBeTruthy()
    expect(queryByText('엘리시움')).toBeNull()
  })

  it('변경 대신 캐릭터 관리로 보낸다', async () => {
    const { getByText, queryByText } = await 그리기()

    expect(queryByText('변경')).toBeNull()
    fireEvent.press(getByText('캐릭터 관리로 이동'))

    expect(onOpenCharacterManage).toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
  })

  // 안 닫으면 방금 보낸 그 화면을 이 모달이 그대로 덮는다. 거절 목록에 넣는 것도 같은 이유다.
  // 그 화면에 닿는 순간 로스터가 돌아 같은 판정이 곧바로 다시 선다.
  it('보내면서 닫는다', async () => {
    const { getByText } = await 그리기()

    fireEvent.press(getByText('캐릭터 관리로 이동'))

    expect(dismiss).toHaveBeenCalled()
  })
})

it('나중에 는 어느 쪽이든 닫기만 한다', async () => {
  useWorldLeapStore.setState({ notice: 모름 })
  const { getByText } = await 그리기()

  fireEvent.press(getByText('나중에'))

  expect(dismiss).toHaveBeenCalled()
  expect(onOpenCharacterManage).not.toHaveBeenCalled()
})
