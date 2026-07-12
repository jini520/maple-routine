import { Modal } from '../../components/Modal/Modal'
import { useThemeStore } from '../../features/theme/store'
import { ThemeSelector } from './ThemeSelector'
import type { ThemeName } from '../../types/theme'

export interface ThemeModalProps {
  onClose: () => void
}

export function ThemeModal(props: ThemeModalProps): React.JSX.Element {
  const { theme, selectTheme } = useThemeStore()

  function handleSelect(next: ThemeName): void {
    selectTheme(next)
    props.onClose()
  }

  return (
    <Modal onClose={props.onClose} testId="theme-modal-overlay">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-text">테마</h2>
        <p className="text-sm text-text-muted">원하는 테마를 선택해주세요.</p>
      </div>
      <ThemeSelector theme={theme} onSelect={handleSelect} />
    </Modal>
  )
}
