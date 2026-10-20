# 스플래시

앱을 켜고 첫 화면이 그려지기 전까지 보이는 화면과 앱 아이콘을 다룬다. 스플래시는 OS 가 그리는 1겹과
앱이 그리는 2겹으로 되어 있다. 왜 이렇게 만들었는지는 [[ADR-013]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `app.json` 의 `expo-splash-screen` 블록 | 1겹의 색(라이트 `#FFFFFF` · 다크 `#000000`)과 투명 로고 |
| `assets/splash-icon-none.png` | 1겹에 넣는 완전히 투명한 그림 |
| `assets/splash-icon.png` | 2겹의 로고 |
| `app/BootSplash.tsx` | 2겹. 그려지면 1겹을 내리고, 600ms 뒤에 사라진다 |
| `app/AppShell.tsx` | 2겹을 형제 중 마지막에 두어 맨 위에 그린다 |
| `index.ts` · `boot-splash.ts` | 스플래시 붙들기, 퇴장 페이드 끄기, 8초 실패 안전 타이머 |
| `native/splash-screen.ts` · `native/adapters/rn-splash-screen.ts` | 스플래시를 내리는 포트 함수 `hideSplashScreen()` |
| `app.config.js` 의 `withSplashWindowBackground` | 안드로이드 `AppTheme` 의 창 배경을 1겹과 같은 색으로 |
| `android/app/src/main/res/values/colors.xml` · `values-night/colors.xml` | 1겹 색(`splashscreen_background`). 커밋된 네이티브 파일 |
| `ios/app/Images.xcassets/SplashScreenBackground.colorset` | iOS 의 1겹 색 |
| `scripts/make-app-icons.py` | 그림 한 장으로 앱 아이콘을 만든다 |

## 앱을 켤 때 일어나는 일

| 순서 | 화면 | 일어나는 일 |
|---|---|---|
| 1 | 1겹(흰색 또는 검정) | OS 가 시작 창을 그린다. `index.ts` 가 스플래시를 붙들고 8초 타이머를 건다 |
| 2 | 2겹(주황 + 로고) | `BootSplash` 가 그려지면 `onLayout` 이 1겹을 내린다 |
| 3 | 2겹 | 1겹이 사라진 뒤부터 600ms 를 센다. 1겹이 2초 안에 안 사라져도 세기 시작한다 |
| 4 | 앱 화면 | 2겹이 사라진다 |

부팅 렌더가 오류를 던지면 `ErrorBoundary` 가 스플래시를 내리고, 그것도 안 되면 8초 타이머가 내린다.

## 1겹의 색이나 그림을 바꿀 때

1겹은 `app.json` 이 정하지만, 앱이 실제로 쓰는 값은 커밋된 네이티브 파일(`colors.xml` 두 개와 iOS colorset)
에 있다. 둘을 함께 고쳐야 한다. `expo prebuild` 로 다시 만들 수도 있지만, prebuild 는 `android/` 와 `ios/` 를
통째로 지우고 다시 만들어서 커밋하지 않은 파일과 손으로 고친 설정이 사라진다.

| prebuild 가 지우는 것 | 증상 |
|---|---|
| `android/app/build.gradle` 의 릴리스 서명 블록 | release 가 서명 없이 나온다(`app-release-unsigned.apk`) |
| `android/keystore.properties` | 서명 블록이 남아 있어도 키를 찾지 못한다 |
| `ios/Pods/` | `pod install` 을 다시 돌려야 한다 |

`values/styles.xml` 도 prebuild 가 만드는 파일이다. `AppTheme` 에 넣을 것이 있으면 `app.config.js` 의 config
plugin 으로 넣는다.

`app.json` 과 `app.config.js` 의 해석 결과는 OTA 지문에 들어간다. 1겹을 바꾸면 지문이 바뀌므로, 지금 스토어에
있는 바이너리는 그 뒤에 낸 OTA 를 받지 못한다. 스토어 빌드를 새로 내야 한다.

2겹의 색과 로고 크기는 `BootSplash.tsx` 의 상수다.

## 앱 아이콘

원본은 `assets/pinkbeen_app_icon.png`(1024px) 한 장이다.

```
python3 scripts/make-app-icons.py                         # 핑크빈
python3 scripts/make-app-icons.py assets/belona_app_icon.png  # 다른 그림으로
```

스크립트가 쓰는 파일은 다음과 같다.

- `assets/icon.png` · `assets/adaptive-icon.png`
- `ios/app/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`
- `android/app/src/main/res/mipmap-*/` 의 `ic_launcher` · `ic_launcher_round` · `ic_launcher_foreground`

어댑티브 아이콘 배경색은 스크립트가 바꾸지 않는다. 그림을 바꾸면 `app.json` 의 `adaptiveIcon.backgroundColor`
와 `values/colors.xml` 의 `iconBackground`(지금 `#F0DAD6`)를 그림 가장자리 색으로 직접 맞춘다.
