// **진짜 `@gorhom/bottom-sheet` 을 세우는 유일한 자리.** 옆 파일(`BottomSheet.test.tsx`)이 값을
// 보는 대신 라이브러리를 목으로 세우므로, 여기서는 반대로 **배선이 성립하는지만** 본다.
//
// 이 파일이 지키는 것 둘.
//   ① 라이브러리를 import 하는 것만으로 죽지 않는다 — reanimated 4 가 `react-native-worklets` 의
//      `.native.*` 변형을 물어 jest 에서 즉시 터지던 것을 `jest.resolver.js` 가 막는다.
//   ② `BottomSheet.tsx` 「배선 전제」가 실제 전제다 — `GestureHandlerRootView` +
//      `BottomSheetModalProvider` 아래에서만 선다. 그 둘을 빼면
//      `'BottomSheetModalInternalContext' cannot be null!` 로 죽는다(실측).
//
// **시트 내용은 여기서 안 보인다.** 진짜 라이브러리는 레이아웃 측정과 UI 스레드 애니메이션 위에
// 서 있어 jest 에서 콘텐츠가 마운트되지 않는다(`waitFor` 1초로도 안 나온다, 실측) — 그래서 값
// 계약은 옆 파일이 본다. 실제로 열리는 모습은 실기기 확인 몫이다.
import { Text } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'

import { renderOverlay } from '../../../__tests__/render-atom'
import { BottomSheet } from '../BottomSheet'

describe('BottomSheet — 배선', () => {
  it('앱 셸이 세울 프로바이더 아래에서 예외 없이 마운트된다', async () => {
    const { toJSON } = await renderOverlay(
      <GestureHandlerRootView>
        <BottomSheetModalProvider>
          <BottomSheet onClose={() => {}}>
            <Text>시트 내용</Text>
          </BottomSheet>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>,
    )

    expect(toJSON()).not.toBeNull()
  })
})
