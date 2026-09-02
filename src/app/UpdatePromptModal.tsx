// 사용자 동의형 업데이트 모달 — 실행 시(또는 설정에서 수동 확인 시) 새 버전이 있으면 뜬다
// . 상태별 분기 아홉과 문구는 웹판을 그대로 옮겼다.
//
// ══ 이 컴포넌트는 **아직 아무 데도 마운트되지 않는다** ══════════════════════════════════
//
// 그릴 줄은 알지만 **그릴 값을 얻을 방법이 없다.** 벽이 둘이고, 둘 다 이
// 별도 ADR 로 미뤄 둔 OTA 재설계에 걸려 있다.
//
// ① **`LiveUpdatePort` 가 던진다**(`native/adapters/not-implemented.ts`). @capgo → expo-updates 는
//    SDK 교체가 아니라 **매니페스트 프로토콜 자체**가 바뀌는 일이라 어댑터로 덮을 수 없다.
// ② **core 의 스토어를 import 하는 것만으로 죽는다**(실측 2026-08-12). `features/live-update/store.ts`
//  가 **모듈 최상위**에서 `import.meta.env.VITE_LIVE_UPDATE_CHANNEL` 을 읽는데(빌드
//    시점 채널 분리), Metro·jest 에서 `import.meta.env` 는 `undefined` 라 그 자리에서
//    `TypeError: Cannot read properties of undefined` 로 끝난다. `import.meta.glob` 과 **같은 종류의
//    벽**이고(`core-shims.js`), 이쪽은 아직 치환 대상이 아니다. 대체 구현이 곧 "가짜 OTA 스토어"라
//    프로토콜을 정하기 전에 만들면 그 결정을 코드가 몰래 대신 내린다.
//
// 그래서 **스토어를 부르지 않고 값을 프롭으로 받는다.** 타입만은 core 에서 가져오므로
// (`import type` 은 컴파일에서 지워져 모듈이 평가되지 않는다) 상태 아홉과 필드 이름이 두 벌이 되지
// 않고, OTA 가 붙는 날 배선은 `state={useLiveUpdateStore()}` 한 줄이다.
//
// ── RN 으로 옮기며 갈린 것 다섯 ───────────────────────────────────────────────────
//
// ① `useNavigate()` → **`onOpenReleaseNotes` 프롭.** `자세히 보기`가 개발 노트 화면으로 옮기는
//  것은 이고, 그 이동을 아는 것은 이 컴포넌트가 아니라 마운트하는 셸이다.
// ② `space-y-*` → `gap-*` · `<h2>`/`<p>` → `<Text>` · `text-center` 를 각 `Text` 로.
// ③ 버튼 두 종류(`PRIMARY_BTN`·`GHOST_BTN`)가 `Button` atom + **델타 클래스**가 됐다. 웹은 raw
//    `<button>` + 클래스 문자열이었지만 RN 에서는 상자/글자를 어차피 갈라야 해서(step 3), 인라인으로
//  두면 이 없앤 복붙이 그대로 되살아난다. `GHOST_*` 가 네 분기에 공유되는 성질
//  ("줄이면 모달 전체에 함께 적용된다")은 상수로 유지된다.
// ④ `PRIMARY_BTN` 의 `disabled:opacity-50` 은 **뺐다.** 어느 분기도 `disabled` 를 주지 않는 데다,
//    NativeWind 의 `disabled:` 는 CSS 의사 클래스라 `Pressable` 의 `disabled` 프롭과 이어져 있지
//    않다(step 4 가 `PartySizeStepper` 에서 겪은 자리). 남기면 "있는데 안 도는 코드"다.
// ⑤ `transition-transform rotate-180` (`자세히 보기` 화살표) → `rotate-180` 만. NativeWind 의
//    `transition-*` 은 Reanimated 배선을 타는데, 여기서 굴릴 것은 회전 하나뿐이라 step 7 이 정한
//    두 갈래(`View` 스타일 = CSS API / SVG 속성 = `useAnimatedProps`) 중 어느 쪽도 아직 필요 없다.
//    **웹에도 이 트랜지션은 `@keyframes` 가 아니라 CSS 트랜지션이라 7종 목록 밖이다.**
import { useState } from 'react'
import { View } from 'react-native'

import type { LiveUpdateStatus, LiveUpdateStore } from '../features/live-update/store'

import {
  AlertTriangleIcon,
  Badge,
  Button,
  CheckCircle2Icon,
  ChevronDownIcon,
  CloudDownloadIcon,
  InfoIcon,
  MapleSweepSpinner,
  ProgressBar,
  SignalIcon,
  SparklesIcon,
  StoreIcon,
  Text,
} from '../components/atoms'
import { Modal } from '../components/organisms/Modal/Modal'

const MODAL_STATUSES: ReadonlySet<LiveUpdateStatus> = new Set([
  'update-available',
  'confirm-cellular',
  'downloading',
  'ready-to-apply',
  'store-required',
  // 사용자가 시작한 다운로드의 실패만 모달로 알린다. 매니페스트 조회 실패
  // ('check-error')는 자동 확인일 수 있어 여기 넣지 않는다. 설정 상태 행에만 남는다.
  'download-error',
  // 둘 다 사용자가 [지금 적용]을 눌러 시작한 흐름이라 위 분류를 그대로 따른다.
  'applying',
  'apply-error',
  // 적용·재시작이 끝난 직후 1회. 부팅 때 뒤늦게 판정되는 상태는 이것뿐이다.
  'updated',
])

/** 이 모달이 **읽는** 것. core 스토어에서 그대로 뽑아 두 벌이 되지 않게 한다. */
export type UpdatePromptState = Pick<
  LiveUpdateStore,
  | 'status'
  | 'currentVersion'
  | 'availableVersion'
  | 'availableSize'
  | 'availableHighlights'
  | 'minNativeVersion'
  | 'downloadProgress'
  | 'channel'
>

/** 이 모달이 **부르는** 것. 같은 이유로 core 스토어에서 뽑는다. */
export type UpdatePromptActions = Pick<
  LiveUpdateStore,
  'startDownload' | 'confirmCellularDownload' | 'apply' | 'openStore' | 'dismiss'
>

export interface UpdatePromptModalProps {
  state: UpdatePromptState
  actions: UpdatePromptActions
  /**
   * 자세히 보기가 개발 노트 화면(`SettingsReleaseNotes`)으로 옮기는 자리.
   * 웹의 `navigate('/settings/release-notes')` 이고, 닫는 것은 호출부가 함께 한다.
   */
  onOpenReleaseNotes: () => void
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const PRIMARY_BOX = 'w-full items-center'
const PRIMARY_TEXT = 'text-sm'
// 부 동작이 주 동작과 같은 크기(px-5 py-2.5 text-sm)라 비중이 너무 컸다.
// 이 상수를 네 분기가 공유하므로 줄이면 모달 전체에 함께 적용된다. 한 모달 안에서 부 동작
// 크기가 갈리지 않게 하려는 의도다.
const GHOST_BOX = 'w-full items-center px-4 py-1.5'
const GHOST_TEXT = 'text-xs'

type IconTone = 'primary' | 'secondary' | 'third' | 'error'
const TONE_CLASS: Record<IconTone, string> = {
  primary: 'bg-primary-tint',
  secondary: 'bg-secondary-tint',
  third: 'bg-third-tint',
  error: 'bg-error-tint',
}
// 웹은 배경과 글자색을 한 문자열에 담았지만 RN 은 아이콘 색이 상속되지 않아 갈라야 한다
// (`Svg` 의 `color` 프롭으로 내려간다. step 3 의 `cssInterop` 배선).
const TONE_INK_CLASS: Record<IconTone, string> = {
  primary: 'text-primary-ink',
  secondary: 'text-secondary-ink',
  third: 'text-third-ink',
  error: 'text-error-ink',
}

function IconBadge({
  icon: Icon,
  tone,
}: {
  icon: typeof CloudDownloadIcon
  tone: IconTone
}): React.JSX.Element {
  return (
    <View
      className={`mx-auto h-14 w-14 items-center justify-center rounded-full ${TONE_CLASS[tone]}`}
    >
      <Icon className={`h-7 w-7 ${TONE_INK_CLASS[tone]}`} strokeWidth={1.75} aria-hidden />
    </View>
  )
}

function VersionBadge({ version }: { version: string | null }): React.JSX.Element {
  return (
    <Badge variant="outline" className="tabular-nums">v{version}</Badge>
  )
}

/** 배지 한둘을 가로 가운데에 놓는 줄. 웹의 `flex ... justify-center gap-1.5` 자리. */
function BadgeRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View className="flex-row flex-wrap items-center justify-center gap-1.5">{children}</View>
}

// info-tint 정보 콜아웃 — 부가 정보(용량, 최소 앱 버전 등)를 본문 문장과 분리해 보여준다.
function InfoNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-2 rounded-[10px] bg-info-tint px-3.5 py-2.5">
      <InfoIcon className="h-4 w-4 shrink-0 text-info-ink" strokeWidth={2} aria-hidden />
      <Text className="flex-1 text-xs font-medium text-text">{children}</Text>
    </View>
  )
}

// 받기 전 모달의 `자세히 보기`. 원격에서 온 핵심 목록을 **모달 안에서** 펼친다.
// 화면을 옮기지 않는 이유는 모달을 닫아야 하고 돌아왔을 때 다시 띄우는 처리가 필요한데, 정작 그
// 화면(개발 노트)에는 아직 받지 않은 이 버전이 **없기** 때문이다.
function HighlightsDisclosure({ highlights }: { highlights: string[] }): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <View className="gap-2">
      <Button
        variant="text"
        onPress={() => setIsOpen((open) => !open)}
        accessibilityState={{ expanded: isOpen }}
        className={`${GHOST_BOX} flex-row justify-center gap-1`}
        textClassName={GHOST_TEXT}
      >
        자세히 보기
        {/* **회전은 아이콘이 아니라 감싸는 `View` 가 받는다**(실측 2026-08-12). NativeWind 의
            `rotate-180` 은 transform 일곱 항목을 **한 벌로** 내는데(`translateX: 0` ·
            `skewX: 0` …) 그중 `skewX`·`skewY` 가 **숫자 0** 이라, 그 style 이 SVG 로 가면
            `react-native-svg` 가 각도를 문자열로 읽다 `angle.endsWith is not a function` 으로
            **죽는다**. step 3 이 찾은 SVG 함정들과 같은 가족이되 이쪽은 조용하지 않다.

            **접힌 쪽이 빈 문자열이 아니라 `rotate-0` 인 것도 값이 아니라 계약이다**(실측
            2026-08-12 — 이 자리가 실제로 앱을 멈춰 세웠다). transform 이 **첫 렌더에 없다가
            나중에 생기면** NativeWind 는 호스트를 `Animated.View` 로 올려야 하는데 그러면
            리마운트라, 대신 **올리기를 포기하고 개발 경고를 찍는다**. 그 경고가 원인 파악을
            돕겠다고 `originalProps` 를 직렬화하는데(`render-component.js` 의 `stringify`)
            그 프롭에 든 것이 React 엘리먼트라 순환 가드가 **경로 단위**뿐인 그 함수가 파이버
            그래프를 헤매다 **힙을 다 쓴다**(jest 는 OOM 으로 죽고, dev 번들도 같은 코드다).
            두 상태 모두 transform 을 갖고 있으면 첫 렌더에 올라가 이 사슬의 첫 고리가 없다 —
            라이브러리 경고문이 말하는 *"기본 스타일을 두라"* 가 정확히 이것이다. */}
        <View testID="update-highlights-chevron" className={isOpen ? 'rotate-180' : 'rotate-0'}>
          <ChevronDownIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} aria-hidden />
        </View>
      </Button>
      {isOpen && (
        <View testID="update-highlights" className="gap-1.5 rounded-[10px] bg-info-tint px-3.5 py-2.5">
          {highlights.map((line) => (
            <View key={line} className="flex-row gap-2">
              <Text className="text-xs font-medium text-text-muted">·</Text>
              <Text className="min-w-0 flex-1 text-xs font-medium text-text">{line}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function Title({ children }: { children: string }): React.JSX.Element {
  return <Text className="text-center text-base font-semibold text-text">{children}</Text>
}

function Body({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text className="text-center text-sm text-text-muted">{children}</Text>
}

function Note({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text className="text-center text-xs text-text-muted">{children}</Text>
}

export function UpdatePromptModal(props: UpdatePromptModalProps): React.JSX.Element | null {
  const { state, actions } = props
  const { status } = state

  if (!MODAL_STATUSES.has(status)) return null

  // 다운로드·적용이 도는 동안은 되돌릴 수 없거나 되돌리면 안 되는 구간이다.
  const isInProgress = status === 'downloading' || status === 'applying'
  const sizeText = state.availableSize !== null ? formatSize(state.availableSize) : ''

  // 받은 뒤의 `자세히 보기`. 여기서는 펼치지 않고 **전부 갖고 있는 화면으로 보낸다**(결정 1).
  // 닫지 않으면 돌아왔을 때 같은 안내가 그대로 덮여 있다.
  const openReleaseNotes = (): void => {
    actions.dismiss()
    props.onOpenReleaseNotes()
  }

  return (
    // 진행 중에는 배경 탭으로 닫히지 않게 한다(진행 중 취소 방지). 폭은 살짝 좁게(max-w-xs).
    // 입력이 없어 키보드를 띄우지 않으므로 중앙에 그대로 둔다. 다른 모달은 상단 정렬이 기본이다.
    <Modal
      onClose={isInProgress ? () => {} : actions.dismiss}
      testId="update-prompt-overlay"
      align="center"
    >
      <Modal.Card maxWidth="max-w-xs" tight>
        <View className="gap-5">
          {status === 'update-available' && (
            <>
              <IconBadge icon={CloudDownloadIcon} tone="primary" />
              <View className="gap-2">
                <Title>새 업데이트가 있어요</Title>
                <BadgeRow>
                  {state.channel === 'beta' && <Badge variant="primary">beta</Badge>}
                  <VersionBadge version={state.availableVersion} />
                </BadgeRow>
                <Note>다운로드 크기 {sizeText}</Note>
              </View>
              {/*: 없으면 **버튼째 그리지 않는다.** 옛 매니페스트에는 이 필드가 없고
                  그것은 오류가 아니라 안 실려 온 것이라, 액션 없는 비활성 버튼을 두지 않는다. */}
              {state.availableHighlights !== null && (
                <HighlightsDisclosure highlights={state.availableHighlights} />
              )}
              <View className="gap-1">
                <Button
                  variant="primary"
                  onPress={() => void actions.startDownload()}
                  className={PRIMARY_BOX}
                  textClassName={PRIMARY_TEXT}
                >
                  다운로드
                </Button>
                <Button
                  variant="text"
                  onPress={actions.dismiss}
                  className={GHOST_BOX}
                  textClassName={GHOST_TEXT}
                >
                  나중에
                </Button>
              </View>
            </>
          )}

          {status === 'confirm-cellular' && (
            <>
              <IconBadge icon={SignalIcon} tone="secondary" />
              <View className="gap-2">
                <Title>모바일 데이터를 사용해요</Title>
                <Body>Wi-Fi가 아니에요. 데이터로 받으면 요금이 나올 수 있어요.</Body>
                <InfoNote>다운로드 크기 {sizeText}</InfoNote>
              </View>
              <View className="gap-1">
                <Button
                  variant="primary"
                  onPress={() => void actions.confirmCellularDownload()}
                  className={PRIMARY_BOX}
                  textClassName={PRIMARY_TEXT}
                >
                  계속
                </Button>
                <Button
                  variant="text"
                  onPress={actions.dismiss}
                  className={GHOST_BOX}
                  textClassName={GHOST_TEXT}
                >
                  취소
                </Button>
              </View>
            </>
          )}

          {status === 'downloading' && (
            <View className="gap-3">
              <Title>다운로드 중</Title>
              {/*: 결정형 진행률은 예외 없이 h-1.5 프리미티브 하나.
                  `animated` 를 쓰는 곳도 여기뿐이다. 여기만 값이 연속으로 흐른다. */}
              <ProgressBar
                percent={state.downloadProgress}
                animated
                aria={{ now: state.downloadProgress, max: 100 }}
                fillTestId="update-progress-bar"
              />
              <Text className="text-center text-xs font-medium text-text-muted tabular-nums">
                {state.downloadProgress}%
              </Text>
            </View>
          )}

          {/*: 커버가 닫기 뒤로 밀린 구간(최대 5초). 적용은 퍼센트가 나오지 않아
              결정형 진행률을 쓰지 않고(가짜로 채우면 거짓 정보다) 모달 안 대기의 규격대로
              스윕 스피너 + 문구만 둔다. 버튼은 두지 않는다. */}
          {status === 'applying' && (
            <View className="gap-3" accessibilityRole="progressbar" aria-busy>
              <MapleSweepSpinner size={32} className="mx-auto text-primary" />
              <View className="gap-2">
                <Title>적용하고 있어요</Title>
                <Note>잠시 뒤 앱이 다시 시작돼요.</Note>
              </View>
            </View>
          )}

          {status === 'ready-to-apply' && (
            <>
              <IconBadge icon={CheckCircle2Icon} tone="secondary" />
              <View className="gap-2">
                <Title>업데이트 준비 완료</Title>
                <BadgeRow>
                  <VersionBadge version={state.availableVersion} />
                </BadgeRow>
                <Note>지금 적용하려면 앱을 재시작해요.</Note>
              </View>
              <View className="gap-1">
                <Button
                  variant="primary"
                  onPress={() => void actions.apply()}
                  className={PRIMARY_BOX}
                  textClassName={PRIMARY_TEXT}
                >
                  지금 적용 (재시작)
                </Button>
                <Button
                  variant="text"
                  onPress={actions.dismiss}
                  className={GHOST_BOX}
                  textClassName={GHOST_TEXT}
                >
                  나중에
                </Button>
              </View>
            </>
          )}

          {/*: 적용 성공 경로에는 상태 전환 코드가 없으므로 이 안내는
              **재시작 뒤 부팅에서** 뜬다. 여기서만 `자세히 보기`가 화면을 옮긴다. */}
          {status === 'updated' && (
            <>
              <IconBadge icon={SparklesIcon} tone="primary" />
              <View className="gap-2">
                <Title>업데이트를 마쳤어요</Title>
                <BadgeRow>
                  <VersionBadge version={state.currentVersion} />
                </BadgeRow>
                <Note>새 버전으로 다시 시작했어요.</Note>
              </View>
              <View className="gap-1">
                <Button
                  variant="primary"
                  onPress={actions.dismiss}
                  className={PRIMARY_BOX}
                  textClassName={PRIMARY_TEXT}
                >
                  확인
                </Button>
                <Button
                  variant="text"
                  onPress={openReleaseNotes}
                  className={GHOST_BOX}
                  textClassName={GHOST_TEXT}
                >
                  자세히 보기
                </Button>
              </View>
            </>
          )}

          {status === 'store-required' && (
            <>
              <IconBadge icon={StoreIcon} tone="third" />
              <View className="gap-2">
                <Title>스토어 업데이트가 필요해요</Title>
                <BadgeRow>
                  <VersionBadge version={state.availableVersion} />
                </BadgeRow>
                <Body>이 업데이트는 앱 스토어에서 업데이트해야 받을 수 있어요.</Body>
                {state.minNativeVersion !== null && (
                  <InfoNote>
                    최소 앱 버전{' '}
                    <Text className="font-semibold tabular-nums">{state.minNativeVersion}</Text> 이상
                    필요
                  </InfoNote>
                )}
              </View>
              <View className="gap-1">
                <Button
                  variant="primary"
                  onPress={actions.openStore}
                  className={PRIMARY_BOX}
                  textClassName={PRIMARY_TEXT}
                >
                  스토어로 이동
                </Button>
                <Button
                  variant="text"
                  onPress={actions.dismiss}
                  className={GHOST_BOX}
                  textClassName={GHOST_TEXT}
                >
                  나중에
                </Button>
              </View>
            </>
          )}

          {status === 'download-error' && (
            <>
              <IconBadge icon={AlertTriangleIcon} tone="error" />
              <View className="gap-2">
                <Title>업데이트를 받지 못했습니다</Title>
                <Body>네트워크 연결을 확인한 뒤 다시 시도해주세요.</Body>
              </View>
              <View className="gap-1">
                <Button
                  variant="primary"
                  onPress={() => void actions.startDownload()}
                  className={PRIMARY_BOX}
                  textClassName={PRIMARY_TEXT}
                >
                  다시 시도
                </Button>
                <Button
                  variant="text"
                  onPress={actions.dismiss}
                  className={GHOST_BOX}
                  textClassName={GHOST_TEXT}
                >
                  나중에
                </Button>
              </View>
            </>
          )}

          {/*: 적용이 실패·타임아웃해도 화면은 돌아온다. download-error 와 같은
              골격이되 주 동작이 다르다 — 받아둔 번들이 그대로 살아 있어 다시 받지 않고 apply()
              만 다시 부른다(스토어가 downloadedBundleId 를 비우지 않는다). */}
          {status === 'apply-error' && (
            <>
              <IconBadge icon={AlertTriangleIcon} tone="error" />
              <View className="gap-2">
                <Title>업데이트를 적용하지 못했습니다</Title>
                <Body>받아둔 파일은 그대로 있습니다. 다시 받지 않고 적용만 다시 시도합니다.</Body>
              </View>
              <View className="gap-1">
                <Button
                  variant="primary"
                  onPress={() => void actions.apply()}
                  className={PRIMARY_BOX}
                  textClassName={PRIMARY_TEXT}
                >
                  다시 시도
                </Button>
                <Button
                  variant="text"
                  onPress={actions.dismiss}
                  className={GHOST_BOX}
                  textClassName={GHOST_TEXT}
                >
                  나중에
                </Button>
              </View>
            </>
          )}
        </View>
      </Modal.Card>
    </Modal>
  )
}
