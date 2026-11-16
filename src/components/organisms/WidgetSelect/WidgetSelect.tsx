/**
 * 위젯 제목 줄 오른쪽의 드롭다운 버튼. 고른 보기의 이름과 ▾ 를 `card-inset` 칸(반경 8)에 담는다.
 *
 * 누르면 버튼 바로 아래에, 버튼 오른쪽 끝에 맞춰 보기 목록이 뜬다. 목록은 `SelectField` 의 목록이고 폭은 가장 긴 보기에 맞춘다.
 * 버튼은 고른 이름만큼만 넓어서, 버튼 폭으로 열면 더 긴 이름이 잘린다.
 *
 * @example
 * <WidgetSelect label="공유 컨텐츠 메이플 ID" testID="shared-maple-id-select" options={options} selected={id} onSelect={select} />
 */
import { Pressable } from 'react-native'

import { Text } from '../../atoms'
import { SelectChevron, SelectField } from '../SelectField/SelectField'

export interface WidgetSelectProps {
  /** 읽어 주는 이름 */
  label: string
  options: ReadonlyArray<{ value: string; label: string }>
  selected: string
  onSelect: (value: string) => void
  /** 트리거와 목록을 집는 이름의 뿌리 */
  testID: string
  /**
   * 참이면 칸을 카드 색으로 칠한다. 칸 색 `card-inset` 은 화면 바탕과 같아 카드 밖 화면 바탕에 두면 칸이 사라진다.
   * MASPI 목록의 월드 고르개처럼 카드 밖에 둘 때 쓴다
   */
  onPage?: boolean
}

export function WidgetSelect(props: WidgetSelectProps): React.JSX.Element {
  const selectedLabel = props.options.find((option) => option.value === props.selected)?.label ?? ''
  return (
    <SelectField
      label={props.label}
      options={props.options}
      selected={props.selected}
      onSelect={(value) => {
        if (value !== null) props.onSelect(value)
      }}
      testID={props.testID}
      listAlign="end"
      listFitsContent
      boxClassName={`min-w-0 shrink rounded-lg ${props.onPage === true ? 'bg-surface' : 'bg-card-inset'}`}
      renderTrigger={(open, isOpen) => (
        <Pressable
          role="button"
          aria-label={props.label}
          aria-expanded={isOpen}
          onPress={open}
          className="flex-row items-center gap-0.5 py-1 pl-2 pr-1.5 active:opacity-60"
        >
          <Text numberOfLines={1} className="shrink text-xs font-semibold text-text">
            {selectedLabel}
          </Text>
          <SelectChevron open={isOpen} />
        </Pressable>
      )}
    />
  )
}
