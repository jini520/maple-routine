/**
 * 캐시 데이터 삭제 확인. **범위를 고르는 화면**이다.
 *
 * 그룹 문구는 `storage/cache-data.ts` 의 실제 삭제 범위와 같아야 한다. 어긋나면 사용자가 잘못된
 * 정보 위에서 되돌릴 수 없는 삭제를 승인한다.
 * **범위 자체는 이 파일에 없다**. 화면은 `CacheDataSelection` 두 불리언을 넘길 뿐이고, 어떤 키와
 * 어떤 테이블이 지워지는지는 core 의 `storage/cache-data.ts` 가 혼자 정한다(CLAUDE.md CRITICAL).
 * 그 파일이 범위를 정한다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { formatBytes } from '../../lib/format-bytes'
import type { CacheDataGroupId, CacheDataSelection } from '../../storage/cache-data'

import { Button, CheckIcon, Text } from '../../components/atoms'
import { Modal } from '../../components/organisms/Modal/Modal'
import { TABULAR_NUMS } from '../../constants/style/text-styles'

export interface CacheClearConfirmProps {
  isOpen: boolean
  isClearing: boolean
  /** 그룹별 용량. 조회 전이면 null. 용량 없이 그룹만 보여준다. */
  sizes: Record<CacheDataGroupId, number> | null
  onConfirm: (selection: CacheDataSelection) => void
  onCancel: () => void
}

const ALL_SELECTED: CacheDataSelection = { general: true, records: true }

const GROUPS: { id: CacheDataGroupId; label: string; detail: string; warning?: string }[] = [
  {
    id: 'general',
    label: '일반 데이터',
    detail: '캐릭터 정보 · 수동 선택 항목 · 파티 보스 설정 등',
  },
  {
    id: 'records',
    label: '수익·지출 기록',
    detail: '보스 처치·드롭 · 손으로 적은 수입·지출',
    // **경고의 근거가 둘로 갈린다**. 보스 기록은 **API 가 2주치만 준다** 인데
    // 손입력 수입·지출은 **API 가 애초에 없다**. 더 강한 쪽을 앞에 둔다.
    warning:
      '손으로 적은 수입·지출은 되살릴 방법이 없고, 보스 기록은 NEXON Open API가 최근 2주치만 제공합니다.',
  },
]

export function CacheClearConfirm(props: CacheClearConfirmProps): React.JSX.Element | null {
  // 닫았다 다시 열면 기본값(전체 선택)으로 되돌린다. 지난번에 해제해둔 체크가 남아 있으면
  // "열고 바로 삭제"가 사람마다 다른 범위를 지우게 된다. 이 컴포넌트는 닫힌
  // 동안에도 마운트된 채 null만 반환하므로, prop 변화에 맞춰 렌더 중에 상태를 조정하는 React
  // 공식 패턴을 쓴다(effect로 setState하면 여분의 렌더가 한 번 더 돈다).
  const [selection, setSelection] = useState<CacheDataSelection>(ALL_SELECTED)
  const [wasOpen, setWasOpen] = useState(props.isOpen)
  if (props.isOpen !== wasOpen) {
    setWasOpen(props.isOpen)
    if (props.isOpen) setSelection(ALL_SELECTED)
  }

  if (!props.isOpen) return null

  const sizes = props.sizes
  const selectedBytes =
    sizes === null
      ? null
      : GROUPS.reduce((sum, group) => (selection[group.id] ? sum + sizes[group.id] : sum), 0)
  const hasSelection = GROUPS.some((group) => selection[group.id])
  const isConfirmDisabled = props.isClearing || !hasSelection

  return (
    <Modal onClose={props.onCancel} testId="cache-clear-confirm-overlay" align="center">
      <Modal.Card>
        <View className="gap-4">
          <View className="gap-1">
            <Text className="text-base font-bold text-text">캐시 데이터 삭제</Text>
            <Text className="text-sm text-text-muted">지울 데이터를 선택하세요.</Text>
          </View>

          <View className="border-t border-border">
            {GROUPS.map((group) => {
              const isSelected = selection[group.id]
              return (
                <Pressable
                  key={group.id}
                  // 다중 선택이라 역할이 button 이 아니라 checkbox 다. 이 화면에서 `aria-selected`
                  // 로 안 갈아탄 자리가 여기뿐이고, 그것이 옳다.
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={group.label}
                  disabled={props.isClearing}
                  onPress={() => {
                    setSelection((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                  }}
                  className={`w-full flex-row items-start gap-3 border-b border-border py-3${
                    props.isClearing ? ' opacity-50' : ''
                  }`}
                >
                  <View
                    aria-hidden
                    className={
                      isSelected
                        ? 'mt-0.5 h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-primary'
                        : 'mt-0.5 h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-border'
                    }
                  >
                    {isSelected && (
                      <CheckIcon className="h-[13px] w-[13px] text-on-primary" strokeWidth={3} />
                    )}
                  </View>

                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-sm font-semibold text-text">{group.label}</Text>
                      {/* 조회 전에도 같은 자리·같은 타이포로 자리표시를 둬야
                          값이 들어올 때 행 레이아웃이 점프하지 않는다. */}
                      <Text
                        style={TABULAR_NUMS}
                        className="shrink-0 text-sm text-text-muted"
                      >
                        {sizes !== null ? formatBytes(sizes[group.id]) : '- KB'}
                      </Text>
                    </View>
                    <Text className="mt-1 text-xs leading-relaxed text-text-muted">
                      {group.detail}
                    </Text>
                    {group.warning !== undefined && (
                      <Text className="mt-1 text-xs leading-relaxed text-error-ink">
                        {group.warning}
                      </Text>
                    )}
                  </View>
                </Pressable>
              )
            })}
          </View>

          <View className="flex-row justify-end gap-2">
            <Button
              variant="text"
              disabled={props.isClearing}
              onPress={props.onCancel}
              className={props.isClearing ? 'opacity-50' : undefined}
            >
              취소
            </Button>
            <Button
              variant="danger"
              disabled={isConfirmDisabled}
              busy={props.isClearing}
              onPress={() => props.onConfirm(selection)}
              className={`flex-row items-center justify-center${
                isConfirmDisabled ? ' opacity-50' : ''
              }`}
            >
              {/* 대기 중에도 이 라벨이 자리를 지켜 버튼 폭이 안 줄고, 스크린리더는 그대로 읽는다
                  . 최대 10초(CLEAR_TIMEOUT_MS) 걸리고 되돌릴 수 없는
                  버튼이라 그 둘이 특히 중요하다. */}
              {selectedBytes !== null ? `삭제 (${formatBytes(selectedBytes)})` : '삭제'}
            </Button>
          </View>
        </View>
      </Modal.Card>
    </Modal>
  )
}
