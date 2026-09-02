// 웹판(128줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 셋
// ① **스토어를 목하지 않는다 — 값을 프롭으로 받는다.** core 의 `live-update/store` 는 값으로
//  import 하는 것만으로 죽어(`import.meta.env`) 목을 걸 자리조차 없다(
//    `AppUpdateSection.tsx` 파일 머리). 그래서 웹 테스트의 「마운트 시 현재 버전을 불러온다」는
//    **옮길 계약이 아니다** — 그 호출이 바로 던지는 포트라 컴포넌트에서 사라졌다.
// ② `getByRole('button', { name })` → 글자에서 위로 올라가 잡는다.
// ③ `toBeDisabled()` → `accessibilityState.disabled`.
//
// **표시 상태 열넷을 하나도 빼지 않고 훑는다** — 그 표가 이
// 정한 계약이고, OTA 가 붙는 날 배선은 한 줄이다. 지금 도달 가능한 것이 `unsupported` 하나뿐인
// 것과 문구가 살아 있는 것은 다른 이야기다.
import { act, fireEvent } from '@testing-library/react-native'

import type { LiveUpdateStatus } from '../../../features/live-update/store'

import { renderAtom, type AtomElement } from '../../../components/__tests__/render-atom'
import {
  AppUpdateSection,
  type AppUpdateSectionState,
} from '../AppUpdateSection'

type Rendered = Awaited<ReturnType<typeof renderAtom>>

const FALLBACK_VERSION = '9.9.9'

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function buttonOf(view: Rendered, label: string): AtomElement {
  let node: AtomElement | null = view.getByText(label)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${label}`)
  return node
}

function state(overrides: Partial<AppUpdateSectionState> = {}): AppUpdateSectionState {
  return {
    currentVersion: '1.0.3',
    status: 'idle',
    availableVersion: null,
    downloadProgress: 0,
    channel: 'production',
    ...overrides,
  }
}

function render(
  overrides: Partial<AppUpdateSectionState> = {},
  check = jest.fn(async () => {}),
): Promise<Rendered> {
  return renderAtom(
    <AppUpdateSection
      state={state(overrides)}
      actions={{ check }}
      fallbackVersion={FALLBACK_VERSION}
    />,
  )
}

describe('AppUpdateSection', () => {
  it('현재 번들 버전을 표시한다', async () => {
    const view = await render()

    expect(view.getByText('현재 버전')).toBeTruthy()
    expect(view.getByText('1.0.3')).toBeTruthy()
  })

  // 웹은 `currentVersion === null` 일 때 `package.json` 을 직접 읽었다. RN 에서는 그 폴백 경로만
  // 남아 호출부가 값을 넘긴다(`SettingsAboutScreen`) — 값을 지어내지 않고 분기 하나로 좁힌 것이다.
  it('currentVersion 이 없으면 fallbackVersion 을 쓴다', async () => {
    const view = await render({ currentVersion: null, status: 'unsupported' })

    expect(view.getByText(FALLBACK_VERSION)).toBeTruthy()
  })

  // : 이 카드가 놓이는 화면의 제목이 이미 「앱 정보」다.
  it('섹션 제목을 스스로 그리지 않는다', async () => {
    const view = await render()

    expect(view.queryByText('앱 업데이트')).toBeNull()
  })

  it('베타 채널이면 "beta" 배지를 보여준다(한글 아님)', async () => {
    const view = await render({ channel: 'beta' })

    expect(view.getByText('beta')).toBeTruthy()
    expect(view.queryByText('베타')).toBeNull()
  })

  it('"업데이트 확인"을 누르면 check가 호출된다', async () => {
    const check = jest.fn(async () => {})
    const view = await render({}, check)

    await press(buttonOf(view, '업데이트 확인'))

    expect(check).toHaveBeenCalledTimes(1)
  })

  // : `현재 버전` 바로 아래 행이라 주어가 생략되면 무엇이 최신인지가 문장에 없다.
  it('최신이면 "최신 버전입니다"를 표시한다', async () => {
    const view = await render({ status: 'up-to-date' })

    expect(view.getByText('최신 버전입니다')).toBeTruthy()
  })

  it('새 버전이 있으면 상태에 버전을 표시한다', async () => {
    const view = await render({ status: 'update-available', availableVersion: '1.0.4' })

    expect(view.getByText('새 버전 v1.0.4 있음')).toBeTruthy()
  })

  it('다운로드 중에는 진행률을 표시하고 버튼이 비활성화된다', async () => {
    const view = await render({ status: 'downloading', downloadProgress: 42 })

    expect(view.getByText('다운로드 중 42%')).toBeTruthy()
    expect(buttonOf(view, '업데이트 확인').props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true,
    })
  })

  // : 네트워크 왕복이라 disabled 만으로는 진행 중인지 멈춘 건지 구분되지 않는다.
  // 정정 3 이 그 신호를 라벨에서 스피너로 옮겼다 — 라벨은 가려진 채 자리를 지킨다.
  it('확인 중에는 버튼이 대기 상태가 되고 라벨은 자리를 지킨다', async () => {
    const view = await render({ status: 'checking' })

    expect(view.getByText('확인하고 있어요')).toBeTruthy()
    expect(buttonOf(view, '업데이트 확인').props.accessibilityState).toMatchObject({ busy: true })
  })

  // : 말줄임표는 '...'(마침표 3개)로 통일하고 한 글자 '…' 는 쓰지 않는다.
  it.each([
    'idle',
    'checking',
    'up-to-date',
    'update-available',
    'store-required',
    'confirm-cellular',
    'downloading',
    'ready-to-apply',
    'applying',
    'updated',
    'check-error',
    'download-error',
    'apply-error',
    'unsupported',
  ] as LiveUpdateStatus[])('%s 상태 문구에 … 1글자 말줄임표를 쓰지 않는다', async (status) => {
    const view = await render({ status, availableVersion: '1.0.4' })

    expect(view.queryAllByText(/…/)).toHaveLength(0)
  })

  // 지금 이 앱에서 **실제로 도달하는 유일한 상태**다 — 그 사실이 이 카드의
  // 모양을 정한다.
  it('지원되지 않는 플랫폼이면 안내 문구를 보여주고 확인 버튼을 감춘다', async () => {
    const view = await render({ status: 'unsupported', currentVersion: null })

    expect(view.getByText('이 플랫폼에서는 지원되지 않습니다')).toBeTruthy()
    expect(view.queryByText('업데이트 확인')).toBeNull()
    expect(view.queryByText('확인 중')).toBeNull()
  })
})
