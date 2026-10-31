/**
 * 시트 드롭다운의 값 한 줄. 닫힌 줄과 목록 줄이 이 부품 하나로 선다.
 *
 * 둘의 모양이 갈리면 지금 고른 것과 고를 수 있는 것이 다른 종류로 보인다. 그래서 아이콘 크기 · 글자 크기 ·
 * 간격을 한 곳에 둔다.
 */
import { Image, View } from 'react-native'

import { Text } from '../../components/atoms'
import { TABULAR_NUMS } from '../../constants/style/text-styles'
import type { ImageAssetRef } from '../../types/image-asset'

/** 값 하나에 붙는 것. 드롭다운마다 호출부가 값에서 찾아 준다. */
export interface SelectDecor {
  icon: ImageAssetRef | null
  iconSize: number
  /** 이름 앞의 `Lv.n`. 모르면 안 선다. */
  level?: number | null
  /** 목록 줄 오른쪽 끝에만 서는 글자. 닫힌 줄에는 아래에 같은 값의 줄이 따로 있어 적지 않는다. */
  listNote?: string | null
}

/**
 * 아이콘 · 레벨 · 이름을 한 줄로 세운다. 닫힌 줄은 오른쪽, 목록 줄은 왼쪽에 놓인다.
 *
 * @param tone `value` 는 닫힌 줄, `option` 은 고르지 않은 목록 줄, `selected` 는 고른 목록 줄, `muted` 는 자리표시자와 `선택 안함`
 */
export function SelectValue(props: {
  label: string
  decor: SelectDecor | null
  tone: 'value' | 'option' | 'selected' | 'muted'
  /** 아이콘 · 레벨에 `-icon` · `-level` 을 붙여 쓰는 뿌리. */
  testID?: string
  /** 이름 글자의 testID. 목록 줄은 줄 자체가 뿌리 id 를 들어 이름에는 안 준다. */
  nameTestID?: string
}): React.JSX.Element {
  const { decor } = props
  const ink =
    props.tone === 'selected'
      ? 'font-semibold text-primary-ink'
      : props.tone === 'muted'
        ? 'text-text-disabled'
        : props.tone === 'option'
          ? 'text-text'
          : 'font-semibold text-text'
  const sub = props.tone === 'selected' ? 'text-primary-ink' : 'text-text-muted'
  return (
    <View className="min-w-0 shrink flex-row items-center justify-end gap-1.5">
      {decor?.icon != null && (
        <Image
          testID={props.testID === undefined ? undefined : `${props.testID}-icon`}
          source={decor.icon}
          resizeMode="contain"
          style={{ width: decor.iconSize, height: decor.iconSize }}
        />
      )}
      {decor?.level != null && (
        <Text
          testID={props.testID === undefined ? undefined : `${props.testID}-level`}
          className={`text-11 ${sub}`}
          style={TABULAR_NUMS}
        >
          {`Lv.${decor.level}`}
        </Text>
      )}
      <Text testID={props.nameTestID} numberOfLines={1} className={`shrink text-sm ${ink}`}>
        {props.label}
      </Text>
    </View>
  )
}
