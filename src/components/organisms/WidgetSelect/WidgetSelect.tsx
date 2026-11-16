/**
 * 위젯 제목 줄 오른쪽의 드롭다운 버튼. 고른 보기의 그림 · 이름과 ▾ 를 `card-inset` 칸(반경 8)에 담는다.
 *
 * 누르면 버튼 바로 아래에, 버튼 오른쪽 끝에 맞춰 보기 목록이 뜬다. 목록은 `SelectField` 의 목록이고 폭은 가장 긴 보기에 맞춘다.
 * 버튼은 고른 이름만큼만 넓어서, 버튼 폭으로 열면 더 긴 이름이 잘린다.
 *
 * @example
 * <WidgetSelect label="공유 컨텐츠 메이플 ID" testID="shared-maple-id-select" options={options} selected={id} onSelect={select} />
 */
import { Image, Pressable, View } from 'react-native'

import type { ImageAssetRef } from '../../../types/image-asset'
import { Text } from '../../atoms'
import { SelectChevron, SelectField } from '../SelectField/SelectField'

/** 보기 그림의 크기. 닫힌 칸과 목록 줄이 같고, 가계부 캐릭터 드롭다운의 월드 엠블럼과 같다 */
const ICON_SIZE = 16

export interface WidgetSelectOption {
  value: string
  label: string
  /** 이름 앞에 서는 그림. MASPI 월드 고르개의 월드 엠블럼이다. 없으면 이름만 선다 */
  icon?: ImageAssetRef | null
}

/** 그림과 이름 한 줄. 닫힌 칸과 목록 줄의 모양이 갈리면 고른 것과 고를 것이 다른 종류로 보인다 */
function OptionLine(props: { option: WidgetSelectOption | undefined; iconTestID: string; textClassName: string }): React.JSX.Element {
  const icon = props.option?.icon
  return (
    <View className="min-w-0 shrink flex-row items-center gap-1">
      {icon != null && (
        <Image testID={props.iconTestID} source={icon} resizeMode="contain" style={{ width: ICON_SIZE, height: ICON_SIZE }} />
      )}
      <Text numberOfLines={1} className={`shrink ${props.textClassName}`}>
        {props.option?.label ?? ''}
      </Text>
    </View>
  )
}

export interface WidgetSelectProps {
  /** 읽어 주는 이름 */
  label: string
  options: readonly WidgetSelectOption[]
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
  const selected = props.options.find((option) => option.value === props.selected)
  const hasIcon = props.options.some((option) => option.icon != null)
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
      renderOption={
        hasIcon
          ? (option, isSelected) => (
              <OptionLine
                option={props.options.find((each) => each.value === option.value)}
                iconTestID={`${props.testID}-option-${option.value ?? ''}-icon`}
                textClassName={`text-sm font-semibold ${isSelected ? 'text-primary-ink' : 'text-text'}`}
              />
            )
          : undefined
      }
      boxClassName={`min-w-0 shrink rounded-lg ${props.onPage === true ? 'bg-surface' : 'bg-card-inset'}`}
      renderTrigger={(open, isOpen) => (
        <Pressable
          role="button"
          aria-label={props.label}
          aria-expanded={isOpen}
          onPress={open}
          className="flex-row items-center gap-0.5 py-1 pl-2 pr-1.5 active:opacity-60"
        >
          <OptionLine option={selected} iconTestID={`${props.testID}-icon`} textClassName="text-xs font-semibold text-text" />
          <SelectChevron open={isOpen} />
        </Pressable>
      )}
    />
  )
}
