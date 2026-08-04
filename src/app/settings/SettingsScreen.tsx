import { useEffect, useState } from 'react'
import packageJson from '../../../package.json'
import { useSettingsStore } from '../../features/settings/store'
import { useThemeStore } from '../../features/theme/store'
import { useLiveUpdateStore } from '../../features/live-update/store'
import { useTrackingModeStore } from '../../features/tracking-mode/store'
import { TRACKING_MODE_LABELS } from '../../features/tracking-mode/copy'
import { SettingsRow } from './SettingsRow'
import { AppUpdateSection } from './AppUpdateSection'
import { ThemeSwatchDots } from './ThemeSwatchDots'
import { AccountModal } from './AccountModal'
import { ThemeModal } from './ThemeModal'
import { TrackingModeModal } from './TrackingModeModal'
import { DisconnectConfirm } from './DisconnectConfirm'
import { CacheDataSection } from './CacheDataSection'
import { Card } from '../../components/Card/Card'

type OpenModal = 'account' | 'theme' | 'trackingMode' | null

export function SettingsScreen(): React.JSX.Element {
  const { disconnect } = useSettingsStore()
  const { theme } = useThemeStore()
  const { mode: trackingMode } = useTrackingModeStore()
  const { currentVersion, loadCurrentVersion } = useLiveUpdateStore()

  const [openModal, setOpenModal] = useState<OpenModal>(null)
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  // 하단 "앱 버전"은 빌드 시점에 고정된 package.json 값이 아니라 지금 실제로 실행 중인 OTA
  // 번들 버전을 보여줘야 한다 — 그래야 OTA로 업데이트했을 때 이 숫자도 실제로 올라간다.
  // AppUpdateSection도 같은 스토어를 구독해 로드하지만, 이 화면 스스로도 독립적으로 값을
  // 채워야 다른 컴포넌트의 부수효과에 의존하지 않는다.
  useEffect(() => {
    void loadCurrentVersion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayedVersion = currentVersion ?? packageJson.version

  async function handleDisconnectConfirm(): Promise<void> {
    setIsDisconnecting(true)
    await disconnect()
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold text-text">설정</h1>

      <Card className="px-6 divide-y divide-border">
        <SettingsRow label="계정 변경" onClick={() => setOpenModal('account')} />
        <SettingsRow
          label="스케줄 관리 방법"
          onClick={() => setOpenModal('trackingMode')}
          rightContent={
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted">
              {TRACKING_MODE_LABELS[trackingMode]}
            </span>
          }
        />
        <SettingsRow
          label="테마"
          onClick={() => setOpenModal('theme')}
          rightContent={
            <span className="flex items-center gap-2">
              <ThemeSwatchDots theme={theme} />
              <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted">
                {theme}
              </span>
            </span>
          }
        />
        <SettingsRow
          label="연결 해제"
          onClick={() => setIsDisconnectOpen(true)}
          danger
          showChevron={false}
        />
      </Card>

      <CacheDataSection />

      <AppUpdateSection />

      {openModal === 'account' && <AccountModal onClose={() => setOpenModal(null)} />}
      {openModal === 'trackingMode' && <TrackingModeModal onClose={() => setOpenModal(null)} />}
      {openModal === 'theme' && <ThemeModal onClose={() => setOpenModal(null)} />}

      <DisconnectConfirm
        isOpen={isDisconnectOpen}
        isDisconnecting={isDisconnecting}
        onConfirm={() => {
          void handleDisconnectConfirm()
        }}
        onCancel={() => setIsDisconnectOpen(false)}
      />

      {/* 이용약관 제6조④가 요구하는 출처 표기 — 문구를 의역하지 않고 원문 그대로 노출한다 */}
      <div className="space-y-1 pt-4 text-center">
        {/*
          Play 사용자 데이터 정책은 스토어 등록정보와 앱 안 양쪽에 개인정보 처리방침 링크를
          요구한다 — 콘솔에 URL을 넣는 것만으로는 충족되지 않는다(docs/foundation/release.md).
          아래 세 줄은 읽고 끝나는 고지 문구지만 이것은 눌러야 하는 것이라 맨 위에 둔다.
          색도 한 단계 밝혀(text-text-muted) 밑줄과 함께 링크임을 표시한다 —
          나머지와 같은 text-text-disabled 로 두면 누를 수 있는 것으로 보이지 않는다.
          본문은 앱에 사본을 두지 않고 PRIVACY.md 를 렌더링한 사이트로 보낸다(법적 문서를 두 벌로 만들지 않는다).
        */}
        <p className="text-xs">
          <a
            href="https://mapleroutine.store/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted underline"
          >
            개인정보 처리방침
          </a>
        </p>
        <p className="text-xs text-text-disabled">v{displayedVersion}</p>
        <p className="text-xs text-text-disabled">© {new Date().getFullYear()} 메이플 루틴</p>
        <p className="text-xs text-text-disabled">Data based on NEXON Open API</p>
        {/*
          비제휴 고지는 약관이 요구하는 것이 아니라 동종 서비스(maple.gg·chuchu.gg·maplescouter)의
          공통 관행이다 — 출처 표기만 있으면 넥슨 공식 서비스로 오인될 여지가 남는다. 문구도 그 3사와
          같은 영문 형태로 맞춘다(maple.gg "Maple.GG is not associated with NEXON Korea").
        */}
        <p className="text-xs text-text-disabled">
          Maple Routine is not associated with NEXON Korea
        </p>
      </div>
    </div>
  )
}
