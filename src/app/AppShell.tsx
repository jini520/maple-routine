import { useEffect } from 'react'

import { useDropEffectStore } from '../features/drop-effect/store'
import { useQuickLinksStore } from '../features/quick-links/store'
import { startKeyboardHeightRecorder } from '../features/input-card/keyboard-height'
import { loadMesoUnits } from '../features/input-card/meso-unit'
import { useNoticeStore } from '../features/notice/store'
import { requestNotificationReconcile } from '../features/local-notifications/run'
import { fillLegacyAccountIds } from '../features/auth/legacy-account-ids'
import { dropEmptyMvpGradeRows } from '../features/mvp-grade/empty-rows'
import { kickServerSync } from '../features/server-sync/kick'
import { useAppEntryStore } from '../features/app-entry/store'
import { useAuthStore } from '../features/auth/store'
import { useLiveUpdateStore } from '../features/live-update/store'
import { useThemeStore } from '../features/theme/store'
import { useTextSizeStore } from '../features/text-size/store'
import { useTrackingModeStore } from '../features/tracking-mode/store'
import { showPendingCacheClearNotice } from '../features/settings/cache-data'

import { ToastStack } from '../components/organisms/Toast/ToastStack'
import { AppNavigation } from '../navigation/AppNavigation'
import { BootSplash } from './BootSplash'
import { UpdatePromptModal } from './UpdatePromptModal'
import { GameDataLock } from './game-data/GameDataLock'
import { refreshGameData, useGameDataStatus } from '../features/game-data/sync'
import { ThemeBackdrop } from '../components/templates/ThemeBackdrop/ThemeBackdrop'
import { ApiKeyNoticeModal } from './auth/ApiKeyNoticeModal'
import { MvpGradeHost } from './mvp-grade/MvpGradeHost'
import { TaskHost } from './resumable-task/TaskHost'
import { prehydrateTabStores } from './prehydrate'
import { recordFirstLaunch } from '../features/app-review/request'
import { useKeyboardVisible } from '../hooks/useKeyboardVisible'
import { useReturnToForeground } from '../hooks/useReturnToForeground'

/**
 * 앱 셸. 웹 `AppShell`(573줄)의 짝. 화면이 아니라 **부팅 순서**가 이 파일의 실질이다.
 *
 * 여기에는 **이 파일에 남은 것과 그 순서**만
 * 적는다.
 *
 * ## 순서
 *
 * 1. **포트 주입**. 이 파일 밖이다(`index.ts` → `boot.ts`, 1단계). 아래 어느 것보다 먼저다.
 * 2. **스플래시 붙들기**. 이것도 이 파일 밖이다(`index.ts` → `boot-splash.ts`). 전역 스코프여야
 *    한다(`expo-splash-screen` 이 명시).
 * 3. **게임 데이터 잠금**. 테마 · 글자 크기 복원과 OTA 모달을 뺀 나머지는 게임 데이터가 준비된 뒤에 마운트한다
 *    (`ReadyShell`). 빈 표를 읽은 이펙트가 엉뚱한 일을 하지 않게 하기 위해서다. 알림 예약 맞추기가 빈 컨텐츠 표를 읽으면
 *    예약을 전부 지운다. 준비 전에는 `GameDataLock` 이 선다.
 * 3-1. **저장소 복원 다섯**(인증·진입 단계·테마·트래킹 모드·드롭 연출). 서로 독립이라 순서가 없다. 각자
 *    각자 자기 이펙트를 갖는다. 하나가 던져도 나머지가 돈다.
 * 4. **광고 SDK 초기화**. 실패해도 던지지 않아 부팅을 막지 않는다.
 * 5. **탭 스토어 선하이드레이션**. 앱이 열린 뒤에만.
 * 6. **스플래시 내리기**. 이 파일이 아니다. `BootSplash` 가 자기가 그려졌을 때 내린다. 시계로
 *    내리면 화면에 무엇이 그려졌는지 모르는 채로 걷게 되고, 그 사이가 빈다.
 *
 * ## 7. **OTA 부팅 확인**. 이 파일이 아니다
 *
 * `boot.ts` 의 `loadGameData()` 가 게임 데이터 사본을 읽은 뒤 `checkOnBoot()` 를 부른다. 처음 실행인지와
 * 잠근 채인지는 사본을 읽어야 알기 때문이다. 잠근 채면 게임 데이터 받기가 그 확인을 기다린다. 이 파일은 잠금
 * 화면 위에 업데이트 모달(`LockedUpdatePrompt`)을 두고, 처음 실행에서 OTA 를 적용하는 동안 `BootSplash` 를
 * 붙든다.
 *
 * `notifyLiveUpdateReady()` 는 **부르지 않는다.** 가 이 자리를 고른 이유
 * (*"렌더가 던지는 번들이 SUCCESS 로 찍혀 영구히 박히면 안 된다"*)는 여전히 유효하지만,
 * `expo-updates` 에는 그 신호를 받는 JS API 가 없고 네이티브가 직접 관찰해 되돌린다
 * (`rn-live-update.ts` 의 `notifyAppReady` 주석. 전수 확인). 즉 **자동 롤백은 있고, 그것을
 * 선언하는 주체가 우리 코드에서 런타임으로 옮겨 갔다.**
 *
 * ## `ErrorBoundary` 는 이 파일이 아니라 `App.tsx` 가 두른다
 *
 * 셸이 렌더 중에 던지면 그 자신은 커밋되지 않아야 하고, 그러려면 경계가
 * **바깥**이어야 한다. 다만 RN 에서는 그 바깥이 프로바이더보다 **안**이다(그쪽 근거는 `App.tsx`).
 */
function ReadyShell(): React.JSX.Element {
  const stage = useAppEntryStore((state) => state.stage)
  const resolveEntryStage = useAppEntryStore((state) => state.resolveFromStorage)
  const restoreAuth = useAuthStore((state) => state.restoreFromStorage)
  const restoreTrackingMode = useTrackingModeStore((state) => state.restoreFromStorage)
  const restoreDropEffect = useDropEffectStore((state) => state.restoreFromStorage)
  const restoreQuickLinks = useQuickLinksStore((state) => state.restoreFromStorage)
  const restoreNotice = useNoticeStore((state) => state.restore)
  const resubscribeNotice = useNoticeStore((state) => state.resubscribe)
  const isKeyboardVisible = useKeyboardVisible()

  const isReady = stage === 'ready'

  // 복원을 한 이펙트에 모으지 않는다. 스토어마다 독립이고, 합치면 앞의 하나가
  // 던졌을 때 뒤가 통째로 안 돈다. deps 를 비운 것은 "마운트당 한 번"이 계약이라서다
  // (세터는 zustand 가 참조를 고정하지만, 그 사실에 기대지 않는다).
  //
  // 인증과 진입 단계가 각각 저장소를 읽는다. 둘 다 apiKey 를 보지만 묻는 것이 달라서
  // (로그인했는가 · 어느 화면이 서는가) 한쪽이 다른 쪽에서 파생되지 않는다.
  useEffect(() => {
    void restoreAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void resolveEntryStage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void restoreTrackingMode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void restoreDropEffect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void restoreQuickLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 입력 카드가 숫자 판을 쓸지 이 기기의 실제 키보드 높이로 정한다. 저장된 값을 읽고 키보드가 뜰 때마다 갱신한다.
  useEffect(() => {
    let remove: (() => void) | null = null
    let unmounted = false
    void startKeyboardHeightRecorder().then((off) => {
      if (unmounted) off()
      else remove = off
    })
    return () => {
      unmounted = true
      remove?.()
    }
  }, [])

  // 금액 칸마다 고른 단위. 카드가 열릴 때 동기로 읽으므로 미리 채운다.
  useEffect(() => {
    void loadMesoUnits()
  }, [])

  // 구독 스위치가 저장된 값을 그리고, **복원이 끝난 뒤** 켜 둔 토픽을 다시 구독한다. 토픽 구독은
  // FCM 등록 토큰에 묶여 토큰이 바뀌면 사라지는데, 앱은 구독 목록을 FCM 에 물을 수 없다. 켜짐인
  // 것만 보내므로 끈 토픽을 부팅이 덮지 않는다.
  useEffect(() => {
    void restoreNotice().then(() => resubscribeNotice())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 돌아올 때도 같다. OS 설정에서 알림 권한을 켜고 돌아오면 그때 구독이 맞춰진다.
  useReturnToForeground(resubscribeNotice)

  // 로컬 알림 예약을 맞춘다. iOS 는 가까운 64개만 들고 알림이 울려도 앱을 깨우지 않아, 켤 때마다 다시 채운다.
  useEffect(() => {
    void requestNotificationReconcile()
  }, [])
  useReturnToForeground(requestNotificationReconcile)

  // 여기서 광고 SDK 초기화와 첫 광고 사전 로드를 불렀다. 전면광고를 걷으며 지웠다. 표시만 막고
  // 사전 로드를 남기면 매 실행 **뜨지 않을 광고** 를 요청해
  // 임프레션 없는 요청으로 쌓인다. **인라인 광고를 붙일 때 SDK 초기화를 부를 자리가 여기다**
  // (`rnAdsPort.initialize()` 는 어댑터에 그대로 있다).

  // 탭 스토어를 스플래시가 떠 있는 동안 미리 하이드레이션해, 첫 탭 진입이
  // 저장소 읽기를 사용자가 보는 앞에서 치르지 않게 한다. **앱이 열린 뒤에만 돈다**.
  // `syncSchedules` 는 API 키·계정이 없으면 던지므로, 로그인·캐릭터 설정 중에 돌리면 스토어가
  // error 로 시작하고 토스트까지 울린다.
  //
  // **동적 import 를 그대로 뒀고**, 그 한 줄은 `./prehydrate` 안에 있다. 왜 그대로 두는지와 왜
  // 셸 밖으로 뺐는지는 그 파일에 적혀 있다(요약: 시점을 안 바꾸려고 유지, 셸 안에 두면 jest 에서
  // 마운트가 죽어 아래 게이트를 붙들 수 없다).
  useEffect(() => {
    if (!isReady) return
    void prehydrateTabStores()
  }, [isReady])

  // 서버로 못 보낸 것을 다시 보낸다. **첫 화면을 막지 않는다** - `void` 로 띄우고 결과를 안
  // 기다린다. 평소에 대기 표가 비어 있어 조회 한 번으로 끝난다.
  //
  // `isReady` 를 기다리는 것은 밝힐 수단이 그때 서기 때문이다. 키도 로그인도 없는 단계에서 돌면
  // 신원이 `null` 이라 한 회차가 통째로 헛돈다.
  useEffect(() => {
    if (!isReady) return
    void kickServerSync()
  }, [isReady])

  // 계정 칸이 생기기 전의 행을 메인 넥슨 계정으로 채운다. 계정이 서는 `isReady` 뒤에 돈다.
  useEffect(() => {
    if (!isReady) return
    void fillLegacyAccountIds()
  }, [isReady])

  // 옛 판이 남긴 MVP 등급 빈 줄을 지운다. 지우면 자동 수수료 다시 계산이 돌아 작업 진행을 띄울 수 있는 `isReady` 뒤에 돈다.
  // 실패해도 빈 줄은 읽을 때 건너뛰므로 다음 부팅에 다시 돌면 된다.
  useEffect(() => {
    if (!isReady) return
    dropEmptyMvpGradeRows().catch(() => {})
  }, [isReady])

  // 지난 실행의 데이터 삭제가 실패했으면 알린다. 삭제 뒤 앱을 다시 띄우므로 그 자리에서는 못 알렸다.
  useEffect(() => {
    void showPendingCacheClearNotice()
  }, [])

  return (
    <>
      <AppNavigation />
      {/* MVP 등급을 묻는 모달. 키 안내 모달보다 앞이라 둘이 겹치면 키 안내가 위에 선다. */}
      <MvpGradeHost />
      {/* 이어서 하는 작업의 진행률 · 재진행 확인. 등급 모달이 닫힌 뒤 도는 작업이 그 위에 선다. */}
      <TaskHost />
      {/* 저장된 키가 무효화되거나 호출 한도를 넘기면
          원래 화면 위에 닫을 수 없는 안내 모달이 덮이고, "확인"을 눌러야 키 입력 화면으로
          이동한다. 내비게이터 **밖**이라 어느 화면에서 감지되든 뜬다(웹에서 라우트 밖이던 자리). */}
      <ApiKeyNoticeModal />
      {/* 토스트는 자기가 놓인 자리에 절대 배치로 그린다. 여기가 `ThemeProvider` 의 화면 채움
          View 직속이라 탭바 위에 뜬다. */}
      <ToastStack hasTabBar={isReady && !isKeyboardVisible} />
    </>
  )
}

/**
 * 잠금 화면 위의 업데이트 모달. 잠긴 동안에도 OTA 를 받아 적용할 수 있어야 잠금이 안 풀리는 결함을 고칠 수 있다.
 *
 * 완료 안내는 여기서 그리지 않는다. `자세히 보기` 가 갈 화면이 잠금이 풀린 뒤에야 서고, 풀리면 `AppNavigation` 의 모달이 그린다.
 */
function LockedUpdatePrompt(): React.JSX.Element | null {
  const state = useLiveUpdateStore()
  return <UpdatePromptModal state={{ ...state, justUpdated: false }} actions={state} onOpenReleaseNotes={() => {}} />
}

/** 백그라운드에서 돌아올 때 서버 값이 바뀌었는지 묻는다. 잠겨 있으면 아무것도 안 한다. */
function refreshOnReturn(): void {
  void refreshGameData()
}

export function AppShell(): React.JSX.Element {
  const restoreTheme = useThemeStore((state) => state.restoreFromStorage)
  const restoreTextSize = useTextSizeStore((state) => state.restoreFromStorage)
  const gameData = useGameDataStatus()
  const holdingSplash = useLiveUpdateStore((state) => state.holdingSplash)

  // 잠금 화면도 테마로 그리므로 게임 데이터를 기다리지 않는다.
  useEffect(() => {
    void restoreTheme()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void restoreTextSize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 리뷰 요청의 첫 실행 3일은 이 바이너리를 처음 켠 날부터 센다.
  useEffect(() => {
    void recordFirstLaunch()
  }, [])

  useReturnToForeground(refreshOnReturn)

  return (
    <>
      {/* 테마 벽지. **첫 자식이어야 한다.** RN 은 형제 순서가 곧 그리는 순서다.
          배경을 선언하지 않은
          테마에서는 아무것도 그리지 않는다. */}
      <ThemeBackdrop />
      {gameData.phase === 'ready' ? (
        <ReadyShell />
      ) : (
        <>
          <GameDataLock status={gameData} />
          <LockedUpdatePrompt />
        </>
      )}
      {/* 스플래시의 두 번째 겹. **형제 중 마지막이라 맨 위에 그려진다.** 이 층이 그려졌다는
          사실이 네이티브 스플래시를 내리는 신호라, 순서가 뒤집히면 그 사이가 빈다. */}
      <BootSplash holding={holdingSplash} />
    </>
  )
}
