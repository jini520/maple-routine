// **진짜 `@gorhom/bottom-sheet` 을 세우는 것은 여기뿐이다.** 옆 파일(`BottomSheet.test.tsx`)이 값을
// 보는 대신 라이브러리를 목으로 세우므로, 여기서는 반대로 **배선이 성립하는지만** 본다.
//
// 이 파일이 지키는 것 둘.
//   ① 라이브러리를 import 하는 것만으로 죽지 않는다. reanimated 4 가 `react-native-worklets` 의
//      `.native.*` 변형을 물어 jest 에서 즉시 터지던 것을 `jest.resolver.js` 가 막는다.
//   ② `BottomSheet.tsx` `배선 전제`가 실제 전제다. `GestureHandlerRootView` +
//      `BottomSheetModalProvider` 아래에서만 선다. 그 둘을 빼면
//      `'BottomSheetModalInternalContext' cannot be null!` 로 죽는다.
//
// **시트 내용은 여기서 안 본다.** 라이브러리는 마운트 다음 프레임에 `present` 로 내용을 세운다. jest 는
// `@gorhom/bottom-sheet` 를 변환하지 않아서(`jest.config.js` 의 `transformIgnorePatterns`) 그 스크롤
// 핸들러가 worklet 이 아니다. 내용이 서는 순간 Reanimated 가 `Passed handlers that are not worklets` 를
// 던진다. 그래서 테스트는 그 프레임 전에 시트를 내리고, 값 계약은 옆 파일이 본다. 실제로 열리는 모습은
// 실기기 확인 몫이다.
import { Text } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'

import { renderOverlay } from '../../../__tests__/render-atom'
import { BottomSheet } from '../BottomSheet'

describe('BottomSheet: 배선', () => {
  it('앱 셸이 세울 프로바이더 아래에서 예외 없이 마운트된다', async () => {
    const { toJSON, unmount } = await renderOverlay(
      <GestureHandlerRootView>
        <BottomSheetModalProvider>
          <BottomSheet onClose={() => {}} label="드롭 아이템 기록">
            <Text>시트 내용</Text>
          </BottomSheet>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>,
    )

    expect(toJSON()).not.toBeNull()
    // 다음 프레임의 `present` 전에 내린다. 남겨 두면 그 갱신이 테스트가 끝난 뒤 `act` 밖에서 일어난다.
    await unmount()
  })
})
