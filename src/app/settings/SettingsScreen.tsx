import { useState } from 'react'
import packageJson from '../../../package.json'
import { useSettingsStore } from '../../features/settings/store'
import { useThemeStore } from '../../features/theme/store'
import { SettingsRow } from './SettingsRow'
import { AppUpdateSection } from './AppUpdateSection'
import { ThemeSwatchDots } from './ThemeSwatchDots'
import { ApiKeyModal } from './ApiKeyModal'
import { AccountModal } from './AccountModal'
import { ThemeModal } from './ThemeModal'
import { DisconnectConfirm } from './DisconnectConfirm'

type OpenModal = 'apiKey' | 'account' | 'theme' | null

export function SettingsScreen(): React.JSX.Element {
  const { disconnect } = useSettingsStore()
  const { theme } = useThemeStore()

  const [openModal, setOpenModal] = useState<OpenModal>(null)
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  async function handleDisconnectConfirm(): Promise<void> {
    setIsDisconnecting(true)
    await disconnect()
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold text-text">설정</h1>

      <div className="rounded-[14px] bg-surface border border-border px-6 divide-y divide-border">
        <SettingsRow label="API 키 재입력" onClick={() => setOpenModal('apiKey')} />
        <SettingsRow label="계정 변경" onClick={() => setOpenModal('account')} />
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
      </div>

      <AppUpdateSection />

      {openModal === 'apiKey' && <ApiKeyModal onClose={() => setOpenModal(null)} />}
      {openModal === 'account' && <AccountModal onClose={() => setOpenModal(null)} />}
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
        <p className="text-xs text-text-disabled">v{packageJson.version}</p>
        <p className="text-xs text-text-disabled">© {new Date().getFullYear()} 메이플 루틴</p>
        <p className="text-xs text-text-disabled">Data based on NEXON Open API</p>
      </div>
    </div>
  )
}
