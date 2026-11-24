import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View } from 'react-native'

/**
 * 화면 하나를 아래 화면 위에 띄운 네이티브 스택. 화면 테스트용 껍데기.
 *
 * 화면이 `usePreventRemove` 처럼 내비게이터 안에서만 도는 훅을 쓰면 이것으로 감싼다. 뒤로 가기가 이 화면을 빼고 아래 화면
 * (`below-screen`)을 드러내므로, 나가는 이동을 막았는지와 이었는지를 실제 스택으로 본다.
 *
 * @example
 * await renderOverlay(<ScreenStack screen={ContentManageScreen} />)
 */
const Stack = createNativeStackNavigator()

function Below(): React.JSX.Element {
  return <View testID="below-screen" />
}

export function ScreenStack(props: { screen: () => React.JSX.Element }): React.JSX.Element {
  return (
    <NavigationContainer initialState={{ index: 1, routes: [{ name: 'Below' }, { name: 'Screen' }] }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Below" component={Below} />
        <Stack.Screen name="Screen" component={props.screen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
