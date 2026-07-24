import { useState } from 'react'
import { useOnboardingStore } from '../../features/onboarding/store'
import { MapleSpinner } from '../../components/MapleSpinner/MapleSpinner'
import { MapleWaveProgress } from '../../components/MapleWaveProgress/MapleWaveProgress'
import { ApiKeyForm } from './ApiKeyForm'
import { AccountSelectionList } from './AccountSelectionList'
import { ContentCharacterStep } from './ContentCharacterStep'
import { TrackingModeStep } from './TrackingModeStep'
import { formatOnboardingError } from './error-message'

export function OnboardingScreen(): React.JSX.Element {
  const {
    status,
    accounts,
    error,
    prefetchProgress,
    submitApiKey,
    selectAccount,
    selectTrackingMode,
    submitContentCharacters,
  } = useOnboardingStore()
  // 컨텐츠 캐릭터 저장(setTrackedCharacterOcids)이 끝나 다음 상태로 전이하기 전까지의 짧은
  // 구간 동안 CTA를 스피너로 바꿔 중복 클릭을 막는다 — 전용 status가 없어 로컬 상태로 다룬다.
  const [isSubmittingContent, setIsSubmittingContent] = useState(false)

  async function handleSubmitContentCharacters(ocids: string[]): Promise<void> {
    setIsSubmittingContent(true)
    try {
      await submitContentCharacters(ocids)
    } finally {
      setIsSubmittingContent(false)
    }
  }

  switch (status) {
    case 'awaitingApiKey':
      return (
        <div className="flex justify-center px-4 pt-8 pb-4">
          <ApiKeyForm isSubmitting={false} onSubmit={submitApiKey} />
        </div>
      )

    // 검증(캐릭터 목록 조회)은 보통 1초 미만이라 별도 로딩 문구를 띄우지 않고, 입력 폼을
    // 그대로 유지한 채 제출 버튼만 로딩 스피너로 바꾼다 ([[UI_GUIDE]] "온보딩 API 키 검증 중").
    case 'verifyingApiKey':
      return (
        <div className="flex justify-center px-4 pt-8 pb-4">
          <ApiKeyForm isSubmitting={true} onSubmit={submitApiKey} />
        </div>
      )

    // ADR-016: 계정 확정 직후 전체 캐릭터의 정보·일정을 예열하는 동안 보여주는 진행률 화면.
    case 'prefetching': {
      const percent =
        prefetchProgress !== null && prefetchProgress.total > 0
          ? Math.round((prefetchProgress.completed / prefetchProgress.total) * 100)
          : 0
      return (
        <div className="flex min-h-[calc(100dvh-var(--sa-top)-var(--sa-bottom))] items-center justify-center px-4">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-text-muted">
              캐릭터 정보를 준비하고 있어요
              {prefetchProgress !== null ? ` (${prefetchProgress.completed}/${prefetchProgress.total})` : ''}
            </p>
            <MapleWaveProgress percent={percent} />
          </div>
        </div>
      )
    }

    case 'selectingAccount':
      return (
        <div className="flex justify-center px-4 pt-8 pb-4">
          <AccountSelectionList
            accounts={accounts}
            isSubmitting={false}
            errorMessage={null}
            onSelect={selectAccount}
          />
        </div>
      )

    // ADR-035 결정 13: 예열 후 자동/수동 트래킹 모드를 고르는 단계.
    case 'selectingTrackingMode':
      return (
        <div className="flex justify-center px-4 pt-8 pb-4">
          <TrackingModeStep onSubmit={selectTrackingMode} />
        </div>
      )

    // ADR-035 결정 13: 컨텐츠 추적 캐릭터를 1명 이상 고르는 단계.
    case 'selectingContentCharacters':
      return (
        <div className="flex justify-center px-4 pt-8 pb-4">
          <ContentCharacterStep
            isSubmitting={isSubmittingContent}
            onSubmit={handleSubmitContentCharacters}
          />
        </div>
      )

    // ADR-035 결정 15: 수동 모드 시드가 끝날 때까지 스피너를 보여준다(진행률 숫자 없음 —
    // 템플릿 기본값으로 먼저 그리지 않고 최종 값이 확정될 때까지 로딩만 유지).
    case 'seedingTracking':
      return (
        <div className="flex min-h-[calc(100dvh-var(--sa-top)-var(--sa-bottom))] items-center justify-center px-4">
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-text-muted">체크리스트를 준비하고 있어요</p>
            <MapleSpinner size={32} className="text-primary" />
          </div>
        </div>
      )

    case 'completed':
      return <p className="text-sm text-text-muted">연동이 완료됐습니다.</p>

    case 'error':
      if (accounts.length === 0) {
        return (
          <div className="flex justify-center px-4 pt-8 pb-4">
            <ApiKeyForm isSubmitting={false} onSubmit={submitApiKey} />
          </div>
        )
      }
      return (
        <div className="flex justify-center px-4 pt-8 pb-4">
          <AccountSelectionList
            accounts={accounts}
            isSubmitting={false}
            errorMessage={error !== null ? formatOnboardingError(error) : null}
            onSelect={selectAccount}
          />
        </div>
      )
  }
}
