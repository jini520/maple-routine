// 웹판 열여덟을 옮겼다(`app-capacitor/src/app/__tests__/UpdatePromptModal.test.tsx`). 갈린 것 셋.
//
// · **스토어를 모킹하지 않는다 — 애초에 쓰지 않는다.** RN 판은 값을 프롭으로 받는다(그 이유는
//   `UpdatePromptModal.tsx` 파일 머리: core 의 live-update 스토어는 `import.meta.env` 때문에
//   import 하는 것만으로 죽는다). 그래서 여기 테스트가 웹판보다 오히려 단순하다.
// · `useNavigate` 대신 `onOpenReleaseNotes` 프롭이 불렸는가를 본다.
// · 진행률 바는 클래스가 아니라 **실제 `width` 스타일**을 잰다(RN 에는 클래스 문자열이 안 남는다).
//
// **이 모달이 아직 아무 데도 마운트되지 않는다는 사실은 여기서 검사하지 않는다** —
// `src/__tests__/boot-order.test.tsx` 가 셸 쪽에서 본다.
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderOverlay } from '../../components/__tests__/render-atom'
import {
  UpdatePromptModal,
  type UpdatePromptActions,
  type UpdatePromptState,
} from '../UpdatePromptModal'

function makeActions(): jest.Mocked<UpdatePromptActions> {
  return {
    startDownload: jest.fn(async () => {}),
    confirmCellularDownload: jest.fn(async () => {}),
    apply: jest.fn(async () => {}),
    openStore: jest.fn(),
    dismiss: jest.fn(),
  }
}

const BASE_STATE: UpdatePromptState = {
  status: 'idle',
  currentVersion: '1.0.3',
  availableVersion: '1.0.4',
  availableSize: 2 * 1024 * 1024,
  availableHighlights: null,
  minNativeVersion: null,
  downloadProgress: 0,
  channel: 'production',
}

async function renderModal(
  state: Partial<UpdatePromptState>,
): Promise<{
  view: Awaited<ReturnType<typeof renderOverlay>>
  actions: jest.Mocked<UpdatePromptActions>
  onOpenReleaseNotes: jest.Mock
}> {
  const actions = makeActions()
  const onOpenReleaseNotes = jest.fn()
  const view = await renderOverlay(
    <UpdatePromptModal
      state={{ ...BASE_STATE, ...state }}
      actions={actions}
      onOpenReleaseNotes={onOpenReleaseNotes}
    />,
  )
  return { view, actions, onOpenReleaseNotes }
}

describe('UpdatePromptModal', () => {
  it.each(['idle', 'checking', 'up-to-date', 'unsupported', 'check-error'] as const)(
    '%s 상태에서는 모달을 띄우지 않는다',
    async (status) => {
      // check-error 가 여기 있는 것이 요점이다 — 자동 확인일 수 있어
      // 모달로 알리지 않고 설정 상태 행에만 남긴다.
      const { view } = await renderModal({ status })

      expect(view.queryByTestId('update-prompt-overlay')).toBeNull()
    },
  )

  it('update-available: 버전·용량 표시, [다운로드]→startDownload, [나중에]→dismiss', async () => {
    const { view, actions } = await renderModal({ status: 'update-available' })

    expect(view.getByText('새 업데이트가 있어요')).toBeTruthy()
    expect(view.getByText('v1.0.4')).toBeTruthy()
    expect(view.getByText('다운로드 크기 2.0MB')).toBeTruthy()

    await fireEvent.press(view.getByText('다운로드'))
    expect(actions.startDownload).toHaveBeenCalledTimes(1)

    await fireEvent.press(view.getByText('나중에'))
    expect(actions.dismiss).toHaveBeenCalledTimes(1)
  })

  it('베타 채널이면 "beta" 배지를 보여준다(한글 아님)', async () => {
    const { view } = await renderModal({ status: 'update-available', channel: 'beta' })

    expect(view.getByText('beta')).toBeTruthy()
  })

  it('프로덕션 채널에는 배지가 없다', async () => {
    const { view } = await renderModal({ status: 'update-available' })

    expect(view.queryByText('beta')).toBeNull()
  })

  it('confirm-cellular: 데이터 경고 표시, [계속]→confirmCellularDownload', async () => {
    const { view, actions } = await renderModal({ status: 'confirm-cellular' })

    expect(view.getByText('모바일 데이터를 사용해요')).toBeTruthy()
    expect(view.getByText('다운로드 크기 2.0MB')).toBeTruthy()

    await fireEvent.press(view.getByText('계속'))
    expect(actions.confirmCellularDownload).toHaveBeenCalledTimes(1)
  })

  it('downloading: 진행률 바 너비가 downloadProgress를 따른다', async () => {
    const { view } = await renderModal({ status: 'downloading', downloadProgress: 42 })

    expect(view.getByText('42%')).toBeTruthy()
    expect(flattenStyle(view.getByTestId('update-progress-bar').props.style).width).toBe('42%')
  })

  it('ready-to-apply: [지금 적용 (재시작)]→apply', async () => {
    const { view, actions } = await renderModal({ status: 'ready-to-apply' })

    await fireEvent.press(view.getByText('지금 적용 (재시작)'))

    expect(actions.apply).toHaveBeenCalledTimes(1)
  })

  it('download-error: 실패 문구 + [다시 시도]→startDownload, [나중에]→dismiss', async () => {
    const { view, actions } = await renderModal({ status: 'download-error' })

    expect(view.getByText('업데이트를 받지 못했습니다')).toBeTruthy()

    await fireEvent.press(view.getByText('다시 시도'))
    expect(actions.startDownload).toHaveBeenCalledTimes(1)

    await fireEvent.press(view.getByText('나중에'))
    expect(actions.dismiss).toHaveBeenCalledTimes(1)
  })

  // : 되돌릴 수 없는 구간이라 버튼을 두지 않는다 — dismiss 가
  // downloadedBundleId 를 비우면 재시도할 번들 참조를 잃는다.
  it('applying: 진행 표시만 두고 버튼을 전부 치운다', async () => {
    const { view } = await renderModal({ status: 'applying' })

    expect(view.getByText('적용하고 있어요')).toBeTruthy()
    expect(view.queryByText('나중에')).toBeNull()
    expect(view.queryByText('취소')).toBeNull()
    expect(view.queryByText('다시 시도')).toBeNull()
  })

  it('applying: 배경을 탭해도 닫히지 않는다(진행 중 취소 방지)', async () => {
    const { view, actions } = await renderModal({ status: 'applying' })

    await fireEvent.press(view.getByTestId('update-prompt-overlay'))

    expect(actions.dismiss).not.toHaveBeenCalled()
  })

  it('downloading: 배경을 탭해도 닫히지 않는다', async () => {
    const { view, actions } = await renderModal({ status: 'downloading' })

    await fireEvent.press(view.getByTestId('update-prompt-overlay'))

    expect(actions.dismiss).not.toHaveBeenCalled()
  })

  it('진행 중이 아니면 배경 탭으로 닫힌다', async () => {
    const { view, actions } = await renderModal({ status: 'update-available' })

    await fireEvent.press(view.getByTestId('update-prompt-overlay'))

    expect(actions.dismiss).toHaveBeenCalledTimes(1)
  })

  it('apply-error: [다시 시도]→apply(startDownload 아님), [나중에]→dismiss', async () => {
    const { view, actions } = await renderModal({ status: 'apply-error' })

    expect(view.getByText('업데이트를 적용하지 못했습니다')).toBeTruthy()

    await fireEvent.press(view.getByText('다시 시도'))
    expect(actions.apply).toHaveBeenCalledTimes(1)
    expect(actions.startDownload).not.toHaveBeenCalled()
  })

  it('store-required: 안내 + [스토어로 이동]→openStore', async () => {
    const { view, actions } = await renderModal({
      status: 'store-required',
      minNativeVersion: '1.2.0',
    })

    expect(view.getByText('스토어 업데이트가 필요해요')).toBeTruthy()
    expect(view.getByText('1.2.0')).toBeTruthy()

    await fireEvent.press(view.getByText('스토어로 이동'))
    expect(actions.openStore).toHaveBeenCalledTimes(1)
  })

  describe('update-available: 자세히 보기(핵심 목록) —', () => {
    const highlights = ['보스 카드에서 파티 인원을 고칠 수 있어요', '기능 설명 화면이 생겼어요']

    it('접힌 채로 뜨고, 누르면 핵심 목록이 나열된다', async () => {
      const { view } = await renderModal({
        status: 'update-available',
        availableHighlights: highlights,
      })

      expect(view.queryByTestId('update-highlights')).toBeNull()

      await fireEvent.press(view.getByText('자세히 보기'))

      expect(view.getByTestId('update-highlights')).toBeTruthy()
      for (const line of highlights) expect(view.getByText(line)).toBeTruthy()
    })

    it('다시 누르면 접힌다', async () => {
      const { view } = await renderModal({
        status: 'update-available',
        availableHighlights: highlights,
      })

      await fireEvent.press(view.getByText('자세히 보기'))
      await fireEvent.press(view.getByText('자세히 보기'))

      expect(view.queryByTestId('update-highlights')).toBeNull()
    })

    // 아래 케이스가 지키는 것은 그림이 아니라 **앱이 멈추지 않는 것**이다(실측 2026-08-12).
    // 화살표 래퍼의 transform 이 접힘 상태에 없으면, 펼칠 때 NativeWind 가 호스트를
    // `Animated.View` 로 올려야 하는데 리마운트라 포기하고 개발 경고를 찍고 — 그 경고가
    // `originalProps`(React 엘리먼트)를 직렬화하다 **힙을 다 쓴다**. 근거와 사슬은
    // `UpdatePromptModal.tsx` 의 그 자리 주석. 되돌리면 이 케이스가 실패가 아니라 **OOM** 으로
    // 죽으므로, 그때 여기를 보라고 남긴다.
    it('화살표 래퍼는 접힘·펼침 두 상태 모두 transform 을 갖는다', async () => {
      const { view } = await renderModal({
        status: 'update-available',
        availableHighlights: highlights,
      })

      const collapsed = flattenStyle(view.getByTestId('update-highlights-chevron').props.style)
      expect(collapsed.transform).toBeDefined()

      await fireEvent.press(view.getByText('자세히 보기'))

      const expanded = flattenStyle(view.getByTestId('update-highlights-chevron').props.style)
      expect(expanded.transform).toBeDefined()
      expect(expanded.transform).not.toEqual(collapsed.transform)
    })

    // : 옛 매니페스트에는 이 필드가 없고 그것은 오류가 아니라 안 실려 온
    // 것이라, 액션 없는 비활성 버튼을 두지 않는다.
    it('핵심 목록이 없으면 버튼 자체가 없다', async () => {
      const { view } = await renderModal({
        status: 'update-available',
        availableHighlights: null,
      })

      expect(view.queryByText('자세히 보기')).toBeNull()
    })

    // 결정 7: 받아만 두고 아직 안 도는 번들의 노트는 개발 노트 목록에 **없다**.
    it('ready-to-apply 에는 붙지 않는다', async () => {
      const { view } = await renderModal({
        status: 'ready-to-apply',
        availableHighlights: highlights,
      })

      expect(view.queryByText('자세히 보기')).toBeNull()
    })
  })

  describe('updated: 적용 완료 안내 —', () => {
    it('마쳤다는 사실과 지금 버전을 말하고, [확인]→dismiss', async () => {
      const { view, actions } = await renderModal({ status: 'updated' })

      expect(view.getByText('업데이트를 마쳤어요')).toBeTruthy()
      expect(view.getByText('v1.0.3')).toBeTruthy()

      await fireEvent.press(view.getByText('확인'))
      expect(actions.dismiss).toHaveBeenCalledTimes(1)
    })

    // 받은 뒤에만 화면을 옮긴다 — 이 시점에야 새 버전 노트가 앱 안에 있고, 흐름이 이미 끝나
    // 옮겨도 끊을 것이 없다.
    it('[자세히 보기]는 개발 노트로 이동하고 모달을 닫는다', async () => {
      const { view, actions, onOpenReleaseNotes } = await renderModal({ status: 'updated' })

      await fireEvent.press(view.getByText('자세히 보기'))

      expect(actions.dismiss).toHaveBeenCalledTimes(1)
      expect(onOpenReleaseNotes).toHaveBeenCalledTimes(1)
    })
  })

})
