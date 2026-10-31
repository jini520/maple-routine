/**
 * 데이터 삭제 확인. **지울 그룹을 고르는 화면**이다.
 *
 * **범위 자체는 이 파일에 없다**. 화면은 그룹마다 고른 여부만 넘기고, 어떤 키와 어떤 테이블이 지워지는지는
 * `storage/cache-data.ts` 가 혼자 정한다. 칸의 문구는 그 범위와 맞아야 한다. 어긋나면 사용자가 잘못된 정보 위에서
 * 되돌릴 수 없는 삭제를 승인한다.
 *
 * **처음에는 아무것도 고르지 않는다.** 지우는 것이 되살릴 수 없거나 다시 받는 데 호출이 몰리는 기록이라, 열고 바로
 * 누른 한 번에 무엇도 지워지지 않아야 한다.
 *
 * **큰 버튼이 취소다.** 되돌릴 수 없는 동작이라 안전한 기본값은 무르는 쪽이다. 삭제는 아래 위험 색 글자 버튼이다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'

import type { CacheDataCounts, CacheDataGroupId, CacheDataSelection } from '../../storage/cache-data'

import { CheckBox, Text, TrashIcon } from '../../components/atoms'
import { INSET_ROW_CLASS } from '../../components/molecules/InsetRow/InsetRow'
import { NoticeModal } from '../../components/organisms/NoticeModal/NoticeModal'
import { TABULAR_NUMS } from '../../constants/style/text-styles'

export interface CacheClearConfirmProps {
  isOpen: boolean
  isClearing: boolean
  /** 그룹마다 지울 건수. 조회 전이면 null. 숫자 자리에 `-` 를 둔다. */
  counts: CacheDataCounts | null
  onConfirm: (selection: CacheDataSelection) => void
  onCancel: () => void
}

const NONE_SELECTED: CacheDataSelection = { manual: false, boss: false, cashbook: false, enhancement: false, cache: false }

function n(value: number | undefined): string {
  return value === undefined ? '-' : value.toLocaleString()
}

/** 칸 하나의 문구. 사용자가 정한 문구라 고칠 때는 사용자 확인을 받는다. */
function groupsOf(counts: CacheDataCounts | null): {
  id: CacheDataGroupId
  label: string
  count?: string
  detail: string
}[] {
  const c = counts ?? undefined
  return [
    { id: 'manual', label: '수동 선택 항목', count: `${n(c?.manualCharacters)}캐릭터`, detail: '추적 항목·분배 설정·자동 입력 등' },
    // 건수를 설명 줄에 쓰므로 오른쪽에 다시 적지 않는다.
    {
      id: 'boss',
      label: '보스 처치·드롭 아이템 기록',
      detail: `보스 처치 ${n(c?.bossClears)}건·드롭 아이템 ${n(c?.bossDrops)}건 포함`,
    },
    { id: 'cashbook', label: '가계부', count: `${n(c?.cashbookEntries)}건`, detail: '직접 작성한 수입·지출 기록' },
    { id: 'enhancement', label: '강화', count: `${n(c?.enhancementDays)}일치`, detail: '큐브·스타포스·잠재능력 재설정 비용' },
    { id: 'cache', label: '캐시', count: `${n(c?.cacheEntries)}건`, detail: '스케줄·캐릭터 정보·공지 등 조회 결과' },
  ]
}

export function CacheClearConfirm(props: CacheClearConfirmProps): React.JSX.Element | null {
  // 닫았다 다시 열면 아무것도 고르지 않은 상태로 되돌린다. 지난번 선택이 남으면 열고 바로 누른 한 번에 그 그룹이
  // 지워진다. 닫힌 동안에도 마운트된 채 null 만 돌려주므로, prop 변화에 맞춰 렌더 중에 상태를 고친다.
  const [selection, setSelection] = useState<CacheDataSelection>(NONE_SELECTED)
  const [wasOpen, setWasOpen] = useState(props.isOpen)
  if (props.isOpen !== wasOpen) {
    setWasOpen(props.isOpen)
    if (props.isOpen) setSelection(NONE_SELECTED)
  }

  if (!props.isOpen) return null

  const hasSelection = Object.values(selection).some(Boolean)

  return (
    <NoticeModal
      icon={TrashIcon}
      tone="error"
      title="데이터를 삭제할까요?"
      content={
        <View className="gap-1.5">
          {groupsOf(props.counts).map((group) => {
            const isSelected = selection[group.id]
            return (
              <Pressable
                key={group.id}
                // 다중 선택이라 역할이 button 이 아니라 checkbox 다.
                role="checkbox"
                aria-checked={isSelected}
                aria-label={group.label}
                disabled={props.isClearing}
                onPress={() => {
                  setSelection((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                }}
                className={`flex-row items-start gap-2.5 ${INSET_ROW_CLASS}${props.isClearing ? ' opacity-50' : ''}`}
              >
                <View className="mt-px">
                  <CheckBox checked={isSelected} />
                </View>
                <View className="min-w-0 flex-1 gap-0.5">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="text-13 font-semibold text-text">{group.label}</Text>
                    {group.count !== undefined && (
                      <Text style={TABULAR_NUMS} className="shrink-0 text-xs font-semibold text-text">
                        {group.count}
                      </Text>
                    )}
                  </View>
                  <Text className="text-xs text-text-muted">{group.detail}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      }
      // 칸마다 경고를 달면 모달이 길어져서 버튼 위 한 줄로 모았다.
      option={
        <Text className="text-xs text-error-ink">
          직접 입력한 데이터는 복구할 수 없고 보스 처치 기록은 2주, 강화 기록은 18개월까지 재조회 할 수 있습니다.
        </Text>
      }
      action={{ label: '취소', onPress: props.onCancel, disabled: props.isClearing }}
      secondaryAction={{
        label: '삭제',
        onPress: () => props.onConfirm(selection),
        danger: true,
        busy: props.isClearing,
        disabled: props.isClearing || !hasSelection,
      }}
      onClose={props.onCancel}
      testId="cache-clear-confirm-overlay"
    />
  )
}
