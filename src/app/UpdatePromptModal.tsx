/**
 * 사용자 동의형 업데이트 모달. 새 버전이 있으면 받을지 묻고 적용까지 미는 화면.
 *
 * 상태별 분기 아홉과 문구를 갖는다. 관찰용 카드(`AppUpdateSection`)와 갈리는 것은 이쪽이 **받고
 * 적용하는 동의 플로우**를 든다는 점이다.
 *
 * @see docs/features/live-update.md 업데이트 정책
 */
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
import { NoticeModal } from '../components/organisms/NoticeModal/NoticeModal'

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
   * 닫는 것은 호출부가 함께 한다.
   */
  onOpenReleaseNotes: () => void
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// 아래 `HighlightsDisclosure` 의 `자세히 보기` 만 쓴다. 부 동작 버튼(`나중에`·`취소`)은
// `NoticeModal` 이 그리고 **같은 값을 갖는다**. 한 모달 안에서 두 고스트 버튼의 크기가 갈리면
// 안 되므로 한쪽을 고칠 때 다른 쪽도 함께 본다.
const GHOST_BOX = 'w-full items-center px-4 py-1.5'
const GHOST_TEXT = 'text-xs'

function VersionBadge({ version }: { version: string | null }): React.JSX.Element {
  return (
    <Badge variant="outline" className="tabular-nums">v{version}</Badge>
  )
}

/** 배지 한둘을 가로 가운데에 놓는 줄. */
function BadgeRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View className="flex-row flex-wrap items-center justify-center gap-1.5">{children}</View>
}

// info-tint 정보 콜아웃. 부가 정보(용량, 최소 앱 버전 등)를 본문 문장과 분리해 보여준다.
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
        {/* **회전은 아이콘이 아니라 감싸는 `View` 가 받는다**. NativeWind 의
            `rotate-180` 은 transform 일곱 항목을 **한 벌로** 내는데(`translateX: 0` ·
            `skewX: 0` …) 그중 `skewX`·`skewY` 가 **숫자 0** 이라, 그 style 이 SVG 로 가면
            `react-native-svg` 가 각도를 문자열로 읽다 `angle.endsWith is not a function` 으로
            **죽는다**. 다른 SVG 함정들과 같은 가족이되 이쪽은 조용하지 않다.

            접힌 쪽이 빈 문자열이 아니라 `rotate-0` 인 것도 값이 아니라 계약이다.
            transform 이 첫 렌더에 없다가 나중에 생기면 NativeWind 는 호스트를 `Animated.View` 로
            올려야 하는데 그러면 리마운트라, 대신 올리기를 포기하고 개발 경고를 찍는다. 그 경고가
            원인 파악을 돕겠다고 `originalProps` 를 직렬화하는데, 그 프롭에 든 것이 React
            엘리먼트라 순환 가드가 경로 단위뿐인 그 함수가 파이버 그래프를 헤매다 힙을 다 쓴다
            (jest 는 OOM 으로 죽고 dev 번들도 같은 코드다).
            두 상태 모두 transform 을 갖고 있으면 첫 렌더에 올라가 이 사슬의 첫 고리가 없다.
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

/** 진행 상태 둘이 쓰는 제목. `NoticeModal` 의 제목과 **같은 값이어야 한다**. */
function Title({ children }: { children: string }): React.JSX.Element {
  return (
    <Text className="text-center text-base font-semibold leading-snug text-text">{children}</Text>
  )
}

function Note({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text className="text-center text-xs text-text-muted">{children}</Text>
}

export function UpdatePromptModal(props: UpdatePromptModalProps): React.JSX.Element | null {
  const { state, actions } = props
  const { status } = state

  if (!MODAL_STATUSES.has(status)) return null

  const sizeText = state.availableSize !== null ? formatSize(state.availableSize) : ''

  // 받은 뒤의 `자세히 보기`. 여기서는 펼치지 않고 전부 갖고 있는 화면으로 보낸다. 닫지 않으면
  // 돌아왔을 때 같은 안내가 그대로 덮여 있다.
  const openReleaseNotes = (): void => {
    actions.dismiss()
    props.onOpenReleaseNotes()
  }

  /**
   * 일곱 상태가 쓰는 공통값. `나중에` 는 이 모달의 기본 부 동작이다. 상태마다 주 동작만 갈리고
   * 물러나는 길은 같다. `confirm-cellular` 와 `updated` 만 이것을 덮는다.
   */
  const 물러나기 = { label: '나중에', onPress: actions.dismiss }
  const 공통 = { onClose: actions.dismiss, testId: 'update-prompt-overlay' } as const

  // ── 진행 상태 둘. **배지도 버튼도 없어 알림 틀이 아니다.**
  //
  // 되돌릴 수 없거나 되돌리면 안 되는 구간이라 배경 탭으로도 안 닫힌다. 제목 아래 묶는 폭도
  // 12(`gap-3`)로 다르다. 진행률·스피너가 글이 아니라 그림이라 글자끼리의 8 보다 숨이 필요하다.
  if (status === 'downloading') {
    return (
      <Modal onClose={() => {}} testId="update-prompt-overlay" align="center">
        <Modal.Card maxWidth="max-w-xs" tight>
          <View className="gap-3">
            <Title>다운로드 중</Title>
            {/* 결정형 진행률은 예외 없이 h-1.5 프리미티브 하나.
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
        </Modal.Card>
      </Modal>
    )
  }

  // 커버가 닫기 뒤로 밀린 구간(최대 5초). 적용은 퍼센트가 나오지 않아 결정형 진행률을 쓰지 않고
  // (가짜로 채우면 거짓 정보다) 모달 안 대기의 규격대로 스윕 스피너 + 문구만 둔다.
  if (status === 'applying') {
    return (
      <Modal onClose={() => {}} testId="update-prompt-overlay" align="center">
        <Modal.Card maxWidth="max-w-xs" tight>
          <View className="gap-3" accessibilityRole="progressbar" aria-busy>
            <MapleSweepSpinner size={32} className="mx-auto text-primary" />
            <View className="gap-2">
              <Title>적용하고 있어요</Title>
              <Note>잠시 뒤 앱이 다시 시작돼요.</Note>
            </View>
          </View>
        </Modal.Card>
      </Modal>
    )
  }

  // ── 나머지 일곱. 배지 · 제목 · 내용 · 설명 · 옵션 · 버튼 둘로 나뉜다.

  if (status === 'update-available') {
    return (
      <NoticeModal
        {...공통}
        icon={CloudDownloadIcon}
        tone="primary"
        title="새 업데이트가 있어요"
        content={
          <BadgeRow>
            {state.channel === 'beta' && <Badge variant="primary">beta</Badge>}
            <VersionBadge version={state.availableVersion} />
          </BadgeRow>
        }
        description={`다운로드 크기 ${sizeText}`}
        // 없으면 **버튼째 그리지 않는다.** 옛 매니페스트에는 이 필드가 없고 그것은 오류가 아니라
        // 안 실려 온 것이라, 액션 없는 비활성 버튼을 두지 않는다.
        option={
          state.availableHighlights !== null ? (
            <HighlightsDisclosure highlights={state.availableHighlights} />
          ) : undefined
        }
        action={{ label: '다운로드', onPress: () => void actions.startDownload() }}
        secondaryAction={물러나기}
      />
    )
  }

  if (status === 'confirm-cellular') {
    return (
      <NoticeModal
        {...공통}
        icon={SignalIcon}
        tone="secondary"
        title="모바일 데이터를 사용해요"
        description="Wi-Fi가 아니에요. 데이터로 받으면 요금이 나올 수 있어요."
        option={<InfoNote>다운로드 크기 {sizeText}</InfoNote>}
        action={{ label: '계속', onPress: () => void actions.confirmCellularDownload() }}
        // 여기서만 `취소` 다. 아직 아무것도 안 받았고 무르는 것이 곧 안 받는 것이다.
        secondaryAction={{ label: '취소', onPress: actions.dismiss }}
      />
    )
  }

  if (status === 'ready-to-apply') {
    return (
      <NoticeModal
        {...공통}
        icon={CheckCircle2Icon}
        tone="secondary"
        title="업데이트 준비 완료"
        content={
          <BadgeRow>
            <VersionBadge version={state.availableVersion} />
          </BadgeRow>
        }
        description="지금 적용하려면 앱을 재시작해요."
        action={{ label: '지금 적용 (재시작)', onPress: () => void actions.apply() }}
        secondaryAction={물러나기}
      />
    )
  }

  // 적용 성공 경로에는 상태 전환 코드가 없으므로 이 안내는 **재시작 뒤 부팅에서** 뜬다.
  // 여기서만 `자세히 보기` 가 화면을 옮긴다.
  if (status === 'updated') {
    return (
      <NoticeModal
        {...공통}
        icon={SparklesIcon}
        tone="primary"
        title="업데이트를 마쳤어요"
        content={
          <BadgeRow>
            <VersionBadge version={state.currentVersion} />
          </BadgeRow>
        }
        description="새 버전으로 다시 시작했어요."
        action={{ label: '확인', onPress: actions.dismiss }}
        secondaryAction={{ label: '자세히 보기', onPress: openReleaseNotes }}
      />
    )
  }

  if (status === 'store-required') {
    return (
      <NoticeModal
        {...공통}
        icon={StoreIcon}
        tone="third"
        title="스토어 업데이트가 필요해요"
        content={
          <BadgeRow>
            <VersionBadge version={state.availableVersion} />
          </BadgeRow>
        }
        description="이 업데이트는 앱 스토어에서 업데이트해야 받을 수 있어요."
        option={
          state.minNativeVersion !== null ? (
            <InfoNote>
              최소 앱 버전{' '}
              <Text className="font-semibold tabular-nums">{state.minNativeVersion}</Text> 이상 필요
            </InfoNote>
          ) : undefined
        }
        action={{ label: '스토어로 이동', onPress: actions.openStore }}
        secondaryAction={물러나기}
      />
    )
  }

  if (status === 'download-error') {
    return (
      <NoticeModal
        {...공통}
        icon={AlertTriangleIcon}
        tone="error"
        title="업데이트를 받지 못했습니다"
        description="네트워크 연결을 확인한 뒤 다시 시도해주세요."
        action={{ label: '다시 시도', onPress: () => void actions.startDownload() }}
        secondaryAction={물러나기}
      />
    )
  }

  // 적용이 실패·타임아웃해도 화면은 돌아온다. `download-error` 와 같은 골격이되 주 동작이 다르다.
  // 받아둔 번들이 그대로 살아 있어 다시 받지 않고 `apply()` 만 다시 부른다(스토어가
  // `downloadedBundleId` 를 비우지 않는다).
  return (
    <NoticeModal
      {...공통}
      icon={AlertTriangleIcon}
      tone="error"
      title="업데이트를 적용하지 못했습니다"
      description="받아둔 파일은 그대로 있습니다. 다시 받지 않고 적용만 다시 시도합니다."
      action={{ label: '다시 시도', onPress: () => void actions.apply() }}
      secondaryAction={물러나기}
    />
  )
}
