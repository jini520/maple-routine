import { registerRootComponent } from 'expo'
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging'

import App from './App'
import { installPorts } from './src/boot'
import { receiveNotice } from './src/features/notice/receive'
import { holdSplashUntilAppReady } from './src/boot-splash'

// 포트 주입은 **저장소·네이티브를 건드리는 어떤 코드보다 먼저** 와야 한다 — 웹 쪽
// `main.tsx` 가 세터를 파일 맨 위에 둔 것과 같은 이유다. 주입 전 접근은 조용히 넘어가지 않고 던지므로,
// 순서가 틀리면 무음 실패가 아니라 에러로 드러난다.
//
// `App` 모듈 자체는 import 로 이미 평가됐지만 포트를 만지는 것은 **렌더 시점**이고, 그 렌더는
// registerRootComponent 이 등록만 한 뒤 번들 평가가 끝나야 온다. 그래도 호출을 등록 앞에 두어
// "렌더보다 먼저"가 코드 순서로 읽히게 한다.
installPorts()

// 스플래시를 **첫 렌더까지 붙들고**, 그 렌더가 끝내 오지 않으면 8초 뒤 트리 밖에서 내린다
// ( — 근거는 `boot-splash.ts`). 포트 주입 **뒤**여야 한다:
// 실패 안전 타이머가 `SplashScreenPort` 를 거친다.
holdSplashUntilAppReady()

// **이 등록은 위치가 요건이다.** 모듈 최상위에 있어야 OS 가 죽은 앱을 깨울 때 핸들러를 찾는다.
// 나중에 더할 수 없다 - 그때는 OS 가 이 앱에 그런 진입점이 있다는 것을 모른다. 그래서 스토어에
// 나가는 바이너리에 자리부터 박아 두고, 무엇을 할지는 JS 가 나중에 채운다.
//
// 몸통은 받은 것을 기기에 쌓는 일 하나다. 화면은 안 민다. 사용자가 앱을 안 보고 있다.
//
// **지금은 거의 안 불린다.** 공지가 `notification` 페이로드로 오고 그런 메시지는 OS 가 직접
// 그리며 JS 를 안 깨우기 때문이다. 그래도 등록해 두는 이유는 자리가 네이티브 요건이라 나중에
// 못 더하기 때문이고, data-only 를 섞어 보내기 시작하면 그날부터 이 몸통이 일한다.
setBackgroundMessageHandler(getMessaging(), async (message) => {
  const data: Record<string, string> = {}
  for (const [key, value] of Object.entries(message.data ?? {})) {
    if (typeof value === 'string') data[key] = value
  }
  await receiveNotice(data).catch(() => undefined)
})

// registerRootComponent 이 AppRegistry.registerComponent('main', () => App) 를 대신한다.
registerRootComponent(App)
