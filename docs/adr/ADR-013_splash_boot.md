# ADR-013 스플래시와 앱 아이콘

> 🟢 유효
> 옛 번호: ADR-025 · ADR-117 결정 3 · 4 · ADR-138 · ADR-216
> 관련 소스: `app.json` 의 `expo-splash-screen` · `app.config.js` · `index.ts` · `boot-splash.ts` · `app/BootSplash.tsx` · `native/splash-screen.ts` · `native/adapters/rn-splash-screen.ts` · `scripts/make-app-icons.py`

## 배경

앱을 켜면 JS 번들을 읽고 첫 화면을 그리기까지 시간이 조금 걸린다. 그 사이에 빈 화면이나 테마를
복원하기 전의 화면이 보이지 않도록 스플래시로 가린다.

스플래시에는 애니메이션을 넣을 계획이다. 그런데 OS 가 그리는 시작 화면에는 애니메이션을 넣기
어렵다. 안드로이드 12 이상은 애니메이션 아이콘을 받지만 길이가 1초로 제한되고,
`expo-splash-screen` 플러그인이 그 항목을 PNG 로 고정해 넣는다. iOS 의 LaunchScreen 은 정지
이미지만 보여 준다. 그래서 스플래시를 OS 가 그리는 화면과 앱이 그리는 화면, 두 겹으로 나눴다.

## 결정

### 결정 1. 스플래시는 두 겹이다

| | 그리는 쪽 | 정하는 곳 |
|---|---|---|
| 1겹 | OS 의 시작 창 | `app.json` 의 `expo-splash-screen` 블록 |
| 2겹 | 앱(`BootSplash`) | `app/BootSplash.tsx`. `AppShell` 이 앱 화면 위에 그린다 |

1겹은 앱 프로세스가 뜨기 전에 그려지므로 없앨 수 없다. 애니메이션을 넣을 수 있는 곳은 2겹뿐이다.

### 결정 2. 1겹은 로고 없이 시스템 테마 색만 칠한다

라이트에서는 `#FFFFFF`, 다크에서는 `#000000` 이다(`backgroundColor` · `dark.backgroundColor`).
로고는 사용자가 정해 넣지 않았다. 로고가 나타나는 순간을 2겹 애니메이션의 시작으로 쓰기 위해서다.

플러그인이 아이콘 항목을 `@drawable/splashscreen_logo` 로 고정해 넣기 때문에 항목 자체는 지울 수 없다.
그래서 `image` 에 완전히 투명한 그림(`assets/splash-icon-none.png`)을 넣어 비워 둔다.

다크에서 1겹이 검정이라, MIUI·HyperOS 의 다크 모드가 밝은 스플래시 색을 강제로 어둡게 바꾸는 문제도
생기지 않는다. 어둡게 바꿀 밝은 색이 없고, 브랜드 주황은 RN 뷰인 2겹에만 있기 때문이다. 다만 MIUI
실기기로는 아직 확인하지 않았다.

### 결정 3. 2겹은 주황 바탕 가운데에 로고를 둔다

바탕은 `#F58B0F`, 로고는 `assets/splash-icon.png` 를 폭 200 으로 그린다. 1겹과 2겹의 색이 다르므로
흰색(또는 검정) 빈 화면에서 브랜드 화면으로 넘어가는 순간이 눈에 보인다. 일부러 그렇게 했다.

### 결정 4. 1겹은 2겹이 그려진 뒤에 내린다

`BootSplash` 의 `onLayout` 이 `hideSplashScreen()` 을 부른다. 시간을 재서 내리면 그 순간 아래에 무엇이
그려져 있는지 알 수 없다. 2겹이 그려진 것을 확인하고 내리면, 1겹이 걷히는 순간 아래는 이미 칠해져
있어서 빈 화면이 끼어들 수 없다.

`onLayout` 은 회전이나 키보드 때문에 여러 번 올 수 있다. 스플래시는 한 번만 내리면 되므로 ref 로 두 번째
호출을 막는다. 상태값으로 막으면 같은 틱에 두 번 올 때 둘 다 통과한다.

`AppShell` 은 시간이 지나도 스플래시를 내리지 않는다.

### 결정 5. 2겹은 1겹이 사라진 뒤부터 600ms 동안 보인다

`BOOT_SPLASH_HOLD_MS` 는 `hideSplashScreen()` 이 끝난 뒤부터 센다. 부른 시점부터 세면 그 시간의 일부가
1겹에 가려진 채로 지나간다. 1겹은 OS 가 언제 걷을지 알 수 없지만 2겹은 앱이 정한다. 그래서 스플래시가 보이는
최소 시간은 2겹으로 보장한다.

1겹이 사라지기를 기다리는 시간에는 2초 상한(`BOOT_SPLASH_HANDOFF_CAP_MS`)을 둔다. 상한이 없으면
`hideSplashScreen()` 이 끝나지 않을 때 2겹이 걷히지 않아 앱이 주황 화면에서 멈춘다. 결정 8 의 실패 안전
타이머도 같은 함수를 기다리므로 대신 걷어 주지 못한다.

2겹은 터치를 막는다. 2겹이 덮고 있는 동안 아래 화면은 아직 준비 중이라, 탭이 아래로 새어 나가면 보이지
않는 버튼이 눌린다. 위의 상한이 있어서 터치가 막힌 채로 멈추지는 않는다.

### 결정 6. 안드로이드에서 1겹이 사라질 때의 페이드를 끈다

`holdSplashUntilAppReady()` 가 `SplashScreen.setOptions({ duration: 0, fade: false })` 를 부른다.
안드로이드는 1겹을 내릴 때 400ms 동안 투명도 페이드를 건다. 그런데 `hideAsync()` 는 요청이 접수되면 바로
끝나므로, 그 400ms 동안 2겹은 이미 그려진 채 1겹에 가려져 있다. 페이드를 끄면 그 시간이 사라진다.

iOS 는 처음부터 페이드가 꺼져 있지만, 켜질 때를 대비해 같은 값을 준다. 이 설정은 붙들기(결정 7)
뒤에 해야 한다. 붙들지 않은 스플래시는 이미 사라져서 설정할 대상이 없다.

### 결정 7. 스플래시를 붙드는 호출은 진입점의 전역 스코프에서 한다

`index.ts` 는 다음 순서로 부른다.

```
installPorts() → loadGameData() → holdSplashUntilAppReady() → registerRootComponent(App)
```

`preventAutoHideAsync()` 를 컴포넌트나 훅 안에서 부르면 이미 스플래시가 내려간 뒤일 수 있다.
`expo-splash-screen` 문서도 전역 스코프에서 부르라고 한다. 포트 주입보다는 뒤여야 한다. 결정 8 의 타이머가
`SplashScreenPort` 를 거치기 때문이다.

붙들기가 실패하면 그 오류는 무시한다. 실패해도 스플래시가 일찍 사라질 뿐인데, 여기서 오류를 던지면 앱이
아예 뜨지 않는다.

### 결정 8. React 트리 밖에 8초 실패 안전 타이머를 둔다

부팅 렌더가 오류를 던지면 2겹이 그려지지 않으므로 1겹을 내리는 코드가 실행되지 않는다. 트리 안에 타이머를 두면
언마운트할 때 함께 취소되므로, 트리가 죽어도 살아 있는 진입점에 둔다. `SPLASH_FAILSAFE_MS`(8초)가 지나면
`hideSplashScreen()` 을 부른다.

이미 내려간 스플래시에 `hideAsync()` 를 다시 불러도 아무 일이 없으므로, 타이머에 따로 조건을 걸지 않는다.
이 타이머는 번들은 실행됐는데 React 가 끝내 마운트되지 않는 경우만 구할 수 있다. 번들 실행
자체가 실패하면 타이머도 돌지 않는다.

### 결정 9. 스플래시를 내리는 코드는 `hideSplashScreen()` 하나다

`SplashScreen.hideAsync()` 를 직접 부르지 않고, 모두 포트 함수 `hideSplashScreen()` 을 거친다. 지금 이
함수를 부르는 곳은 넷이다.

| 부르는 곳 | 언제 |
|---|---|
| `BootSplash` | 2겹이 그려졌을 때(결정 4) |
| `boot-splash.ts` | 8초 실패 안전 타이머(결정 8) |
| `ErrorBoundary` | 오류 화면을 띄울 때 |
| `features/live-update/store.ts` | OTA 적용이 실패해 화면을 되돌릴 때 |

`showSplashScreen()` 은 아무 일도 하지 않는다(`rnSplashScreenPort.show()`). `expo-splash-screen` 에는 스플래시를
다시 띄우는 API 가 없다. `preventAutoHideAsync()` 로 흉내 내면 이미 내려간 스플래시에는 효과가 없어서,
화면은 그대로인데 부른 쪽은 화면을 가렸다고 믿게 된다. OTA 적용(`native/live-update.ts`)과 캐시 삭제
(`features/settings/cache-data.ts`)가 아직 이 함수를 부르지만 화면에는 변화가 없다.

### 결정 10. 안드로이드는 1겹이 걷힌 아래를 1겹과 같은 색으로 칠한다

`app.config.js` 의 `withSplashWindowBackground` 가 `AppTheme` 의 `android:windowBackground` 를
`@color/splashscreen_background` 로 정한다. 1겹과 같은 색이라 라이트에서는 흰색, 다크에서는 검정이다.

안드로이드는 시작 창을 앱에 넘기는 데 제한 시간이 있고, 앱이 그 안에 받지 못하면 시스템이 시작 창을
걷어 버린다. 그때 창 배경을 정해 두지 않으면 검정이 드러난다. 정상적인 경우는 결정 4 의 순서로
충분하고, 이 설정은 느린 기기에서 시스템이 먼저 걷었을 때를 위한 것이다.

`values/styles.xml` 은 `expo prebuild` 가 만드는 파일이라 손으로 고치면 다음 prebuild 때 지워진다. 그래서
config plugin 으로 넣었다.

### 결정 11. 앱 아이콘은 그림 한 장에서 스크립트로 만든다

원본은 `assets/pinkbeen_app_icon.png`(1024px) 한 장이다. 후보 셋 중에서 사용자가 골랐다.
`python3 scripts/make-app-icons.py` 가 이 그림으로 `assets/icon.png` · `assets/adaptive-icon.png`, iOS 1024
아이콘, 안드로이드 `mipmap-*` 의 정사각 · 원형 · 어댑티브 전경 아이콘을 만든다. 원본 경로를 인자로 넘기면
다른 그림으로도 만들 수 있다.

이 스크립트는 `expo prebuild` 를 쓰지 않고 네이티브 폴더에 직접 쓴다. prebuild 는 손으로 쓴 안드로이드
파일과 릴리스 서명 설정까지 지우기 때문이다.

어댑티브 아이콘 전경은 108dp 캔버스 가운데에 그림을 66.7% 크기로 놓는다. 런처가 실제로 보여 주는 부분은
가운데 72dp 이고, 이렇게 놓으면 그림이 그 부분을 꼭 맞게 채운다. 배경색(`app.json` 의
`adaptiveIcon.backgroundColor` 와 `values/colors.xml` 의 `iconBackground`, 지금은 `#F0DAD6`)은 그림
가장자리에서 뽑은 색이라, 그림을 바꾸면 손으로 함께 맞춘다.

나머지 두 후보(`belona_app_icon.png` · `malefic_star_app_icon.png`)는 `assets/` 에 그림만 있고 빌드에는
들어가지 않는다. 사용자가 아이콘을 골라 바꾸는 기능은 넣지 않기로 했다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `app/__tests__/BootSplash.test.tsx` | 결정 4: 그려지기 전에는 내리지 않는지, `onLayout` 이 오면 내리는지, 레이아웃이 다시 와도 한 번만 내리는지 본다 |
| | 결정 5: 1겹이 사라진 뒤 600ms 가 지나야 걷히는지, 넘겨받기 전에는 시간이 흘러도 걷히지 않는지, 1겹이 아직 안 사라졌으면 시간을 세지 않는지, 1겹이 끝내 안 사라져도 상한이 지나면 걷히는지 본다 |
| `__tests__/boot-splash.test.ts` | 결정 6: 페이드를 끄는지, 붙든 뒤에 설정하는지 본다 |
| | 결정 8: 부팅 렌더가 오지 않으면 8초 뒤 타이머가 내리는지 본다 |
| `native/adapters/__tests__/rn-splash-screen.test.ts` | 결정 9: `hide()` 가 `hideAsync()` 로 이어지는지, `show()` 가 스플래시 API 를 하나도 건드리지 않는지 본다 |
| `__tests__/boot-order.test.tsx` | 결정 1 · 4: 2겹이 셸의 트리에 있는지, 셸이 시간이 흘러도 스플래시를 내리지 않는지 본다 |
| | 결정 7: 진입점이 `installPorts()` → `holdSplashUntilAppReady()` → `registerRootComponent` 순서로 부르는지 본다 |

## 번호 기록

- ADR-013 (2026-10-19): 옛 ADR-025 · 117 결정 3 · 4 · 138 · 216 을 합쳐 처음 작성
