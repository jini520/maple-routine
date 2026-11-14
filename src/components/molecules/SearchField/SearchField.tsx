/**
 * 목록을 좁히는 입력 칸. 돋보기와 한 줄 입력이 선 `card-inset` 칸이고, 치는 대로 부르는 쪽이 목록을 좁힌다.
 * 시트의 칸 카드 안 칸과 같은 높이 · 바탕이라 같은 카드에 섞여 선다.
 *
 * @example
 * <SearchField value={query} onChange={setQuery} placeholder="아이템 검색" testID="trade-history-search" />
 */
import { View } from 'react-native'

import { SearchIcon, TextInput } from '../../atoms'

export interface SearchFieldProps {
  value: string
  onChange: (next: string) => void
  /** 자리표시자이자 읽어 주는 이름 */
  placeholder: string
  testID?: string
}

export function SearchField(props: SearchFieldProps): React.JSX.Element {
  return (
    <View className="min-h-11 flex-row items-center gap-2 rounded-[10px] bg-card-inset px-3 py-2">
      <SearchIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
      <TextInput
        testID={props.testID}
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        className="h-5 flex-1 py-0 text-sm text-text"
      />
    </View>
  )
}
