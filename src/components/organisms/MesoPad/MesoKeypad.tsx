/**
 * 3열 키 그리드 — `DropPricePad` 에서 꺼냈다.
 *
 * 꺼낸 이유는 **쓰는 자리가 셋이 됐기 때문**이다(드롭 판매가 · 지출의 직접 입력 · 수입). 복사하면
 * 같은 키패드가 여러 벌이 되어 어느 것이 진짜인가 가 사라진다.
 *
 * 간격은 **자식 패딩 + 부모 음수 마진**이다 — 퍼센트 폭과 `gap` 을 섞으면 3열의 마지막 칸이 밀려
 * 2열이 된다(전체 폭 − 간격 합을 퍼센트로 표현할 수 없다).
 */
import { Pressable, View } from 'react-native'

import { MESO_KEYS, type MesoKey } from './meso-pad'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { Text } from '../../atoms'

export function MesoKeypad(props: { onKey: (key: MesoKey) => void }): React.JSX.Element {
  return (
    <View className="-mx-px flex-row flex-wrap px-3 pt-3">
      {MESO_KEYS.map((key) => (
        <View key={key} className="w-1/3 p-px">
          <Pressable
            role="button"
            onPress={() => props.onKey(key)}
            aria-label={key === 'del' ? '한 자리 지우기' : key}
            className="h-13 w-full items-center justify-center rounded-[15px] active:bg-surface-2"
          >
            <Text
              className={
                key === 'del' || key === '00'
                  ? 'text-lg font-medium text-text-muted'
                  : 'text-23 font-medium tracking-[-.015em] text-text'
              }
              style={TABULAR_NUMS}
            >
              {key === 'del' ? '⌫' : key}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}
