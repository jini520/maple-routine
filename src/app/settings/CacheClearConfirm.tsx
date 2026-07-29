import { Check } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../components/Modal/Modal'
import { formatBytes } from '../../lib/format-bytes'
import type { CacheDataGroupId, CacheDataSelection } from '../../storage/cache-data'

// 공용 Modal을 쓴다 — 직접 오버레이를 그리면 호출부의 space-y-* margin에 fixed inset-0 높이가
// 깎여 하단 제스처 영역만 딤이 빠진다(38c6ed7과 동일 기전, 실기기 확인). Modal은 body로 포털 렌더링.
export interface CacheClearConfirmProps {
  isOpen: boolean
  isClearing: boolean
  /** 그룹별 용량. 조회 전이면 null — 용량 없이 그룹만 보여준다. */
  sizes: Record<CacheDataGroupId, number> | null
  onConfirm: (selection: CacheDataSelection) => void
  onCancel: () => void
}

const ALL_SELECTED: CacheDataSelection = { general: true, bossRecords: true }

// 그룹 문구는 storage/cache-data.ts의 실제 삭제 범위와 같아야 한다 — 어긋나면 사용자가 잘못된
// 정보 위에서 되돌릴 수 없는 삭제를 승인한다(ADR-052 결정 3의 원칙을 그룹 단위로 이어받음).
const GROUPS: { id: CacheDataGroupId; label: string; detail: string; warning?: string }[] = [
  {
    id: 'general',
    label: '일반 데이터',
    detail: '캐릭터 정보 · 수동 선택 항목 · 파티 보스 설정 등',
  },
  {
    id: 'bossRecords',
    label: '보스 수익·드롭 기록',
    detail: '처치 기록 · 수익 · 드롭 아이템 정보 등',
    warning: 'NEXON Open API가 최근 2주 데이터만 제공해 삭제 후 복구할 수 없습니다.',
  },
]

export function CacheClearConfirm(props: CacheClearConfirmProps): React.JSX.Element | null {
  // 닫았다 다시 열면 기본값(전체 선택)으로 되돌린다 — 지난번에 해제해둔 체크가 남아 있으면
  // "열고 바로 삭제"가 사람마다 다른 범위를 지우게 된다(ADR-058 결정 6). 이 컴포넌트는 닫힌
  // 동안에도 마운트된 채 null만 반환하므로, prop 변화에 맞춰 렌더 중에 상태를 조정하는 React
  // 공식 패턴을 쓴다(effect로 setState하면 여분의 렌더가 한 번 더 돈다).
  const [selection, setSelection] = useState<CacheDataSelection>(ALL_SELECTED)
  const [wasOpen, setWasOpen] = useState(props.isOpen)
  if (props.isOpen !== wasOpen) {
    setWasOpen(props.isOpen)
    if (props.isOpen) setSelection(ALL_SELECTED)
  }

  if (!props.isOpen) return null

  const selectedBytes = props.sizes
    ? GROUPS.reduce((sum, group) => (selection[group.id] ? sum + props.sizes![group.id] : sum), 0)
    : null
  const hasSelection = GROUPS.some((group) => selection[group.id])

  return (
    <Modal onClose={props.onCancel} testId="cache-clear-confirm-overlay" align="center">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-text">캐시 데이터 삭제</h2>
          <p className="text-sm text-text-muted">지울 데이터를 선택하세요.</p>
        </div>

        <div className="border-t border-border">
          {GROUPS.map((group) => {
            const isSelected = selection[group.id]
            return (
              <button
                key={group.id}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                disabled={props.isClearing}
                onClick={() =>
                  setSelection((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                }
                className="flex w-full items-start gap-3 border-b border-border py-3 text-left disabled:opacity-50"
              >
                <span
                  aria-hidden="true"
                  className={
                    isSelected
                      ? 'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-primary'
                      : 'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-border'
                  }
                >
                  {isSelected && <Check size={13} strokeWidth={3} className="text-bg" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-text">{group.label}</span>
                    {props.sizes !== null && (
                      <span className="shrink-0 text-sm text-text-muted">
                        {formatBytes(props.sizes[group.id])}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-text-muted">{group.detail}</span>
                  {group.warning !== undefined && (
                    <span className="mt-1 block text-xs leading-relaxed text-error">{group.warning}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={props.isClearing}
            onClick={props.onCancel}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={props.isClearing || !hasSelection}
            onClick={() => props.onConfirm(selection)}
            className="rounded-full border border-error px-5 py-2.5 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-50"
          >
            {props.isClearing
              ? '삭제 중...'
              : selectedBytes !== null
                ? `삭제 (${formatBytes(selectedBytes)})`
                : '삭제'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
