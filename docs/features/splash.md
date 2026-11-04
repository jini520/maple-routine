# 스플래시

앱을 켜고 첫 화면이 그려지기 전까지 보이는 화면과 앱 아이콘을 다룬다. 스플래시는 OS 가 그리는 1겹과
앱이 그리는 2겹으로 되어 있다. 왜 이렇게 만들었는지는 [[ADR-013]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `app.json` 의 `expo-splash-screen` 블록 | 1겹의 색(라이트 `#B9CDF4` · 다크 `#0B1022`, 2겹 하늘 색과 같다)과 투명 로고 |
| `assets/splash-icon-none.png` | 1겹에 넣는 완전히 투명한 그림 |
| `app/BootSplash.tsx` | 2겹. 그려지면 1겹을 내리고, 1겹이 사라진 뒤 등장이 끝나면 사라진다 |
| `app/splash/layout.ts` | 화면 크기와 상단 인셋으로 그림 · 잎과 이름 묶음 · 눈 조각의 자리를 계산 |
| `app/splash/animations.ts` | 묶음 페이드 인 · 글자 하나씩 뛰기 · 눈 내림의 Reanimated CSS 애니메이션 값 |
| `app/splash/colors.ts` | 2겹의 하늘 · 땅 · 글자 색. 일러스트에서 뽑은 값이라 테마 토큰이 아니다. 1겹 색은 여기 `sky` 와 맞춘다 |
| `app/splash/leaf.ts` | 모서리를 둥글린 단풍잎 경로. 스플래시와 로그인 화면 머리가 쓴다 |
| `app/splash/wordmark.ts` | `메이플 루틴` 글자의 SVG 패스. `scripts/make-splash-wordmark.py` 가 메이플스토리 서체 Light 에서 만든다. 스플래시와 로그인 화면 머리가 쓴다 |
| `features/theme/system-theme.ts` | OS 밝기로 고르는 기본 테마. 2겹은 이것으로 라이트 · 다크를 가르고 잎 색(`primary`)을 가져온다 |
| `assets/splash/body.png` · `snow-0.png` ~ `snow-6.png` | 겨울 축제 일러스트 본체와 떼어낸 눈 조각 일곱 |
| `app/AppShell.tsx` | 2겹을 형제 중 마지막에 두어 맨 위에 그린다 |
| `index.ts` · `boot-splash.ts` | 스플래시 붙들기, 퇴장 페이드 끄기, 8초 실패 안전 타이머 |
| `native/splash-screen.ts` · `native/adapters/rn-splash-screen.ts` | 스플래시를 내리는 포트 함수 `hideSplashScreen()` |
| `app.config.js` 의 `withSplashWindowBackground` | 안드로이드 `AppTheme` 의 창 배경을 1겹과 같은 색으로 |
| `android/app/src/main/res/values/colors.xml` · `values-night/colors.xml` | 1겹 색(`splashscreen_background`). 커밋된 네이티브 파일 |
| `ios/app/Images.xcassets/SplashScreenBackground.colorset` · `SplashScreenLogo.imageset` · `ios/app/SplashScreen.storyboard` | iOS 의 1겹 색(라이트 · 다크 appearance)과 투명 로고 |
| `scripts/make-app-icons.py` | 그림 한 장으로 앱 아이콘을 만든다 |

## 앱을 켤 때 일어나는 일

| 순서 | 화면 | 일어나는 일 |
|---|---|---|
| 1 | 1겹(2겹의 하늘 색, 그림 없음) | OS 가 시작 창을 그린다. `index.ts` 가 스플래시를 붙들고 8초 타이머를 건다 |
| 2 | 2겹(하늘 그라디언트 + 일러스트 + 내리는 눈) | `BootSplash` 가 그려지면 `onLayout` 이 1겹을 내린다. 잎과 이름은 아직 투명하다 |
| 3 | 2겹 | 1겹이 사라지면 잎과 이름이 나타나고 글자가 하나씩 뛴다(1.62초). 1겹이 2초 안에 안 사라져도 시작한다 |
| 4 | 앱 화면 | 등장이 끝난 뒤(`BOOT_SPLASH_HOLD_MS`, 1.7초) 2겹이 사라진다 |

부팅 렌더가 오류를 던지면 `ErrorBoundary` 가 스플래시를 내리고, 그것도 안 되면 8초 타이머가 내린다.

## 1겹의 색이나 그림을 바꿀 때

1겹은 `app.json` 이 정하지만, 앱이 실제로 쓰는 값은 커밋된 네이티브 파일(`colors.xml` 두 개와 iOS colorset ·
로고 imageset · storyboard 의 대체값)에 있다. 둘을 함께 고쳐야 한다. 2026-11-02 까지 iOS 쪽만 옛 주황 · 로고로
남아 있었던 것이 그 예다. 1겹 색은 `app/splash/colors.ts` 의 `sky` 와 같아야 하고, `app/splash/__tests__/colors.test.ts`
가 네 곳을 그 값과 비교한다. `expo prebuild` 로 다시 만들 수도 있지만, prebuild 는 `android/` 와 `ios/` 를
통째로 지우고 다시 만들어서 커밋하지 않은 파일과 손으로 고친 설정이 사라진다.

| prebuild 가 지우는 것 | 증상 |
|---|---|
| `android/app/build.gradle` 의 릴리스 서명 블록 | release 가 서명 없이 나온다(`app-release-unsigned.apk`) |
| `android/keystore.properties` | 서명 블록이 남아 있어도 키를 찾지 못한다 |
| `ios/Pods/` | `pod install` 을 다시 돌려야 한다 |

`values/styles.xml` 도 prebuild 가 만드는 파일이다. `AppTheme` 에 넣을 것이 있으면 `app.config.js` 의 config
plugin 으로 넣는다.

`app.json` 과 `app.config.js` 의 해석 결과는 OTA 지문에 들어간다. 1겹을 바꾸면 지문이 바뀌므로, 지금 스토어에
있는 바이너리는 그 뒤에 낸 OTA 를 받지 못한다. 스토어 빌드를 새로 내야 한다. 2겹만 바꾸면 OTA 로 나간다.

실기기에 새로 깔았는데 1겹이 옛 것으로 보이면 iOS 의 시작 화면 캐시다. iOS 는 시작 화면을 한 번 그려 앱 컨테이너
`Library/SplashBoard/Snapshots/` 에 스냅샷으로 두고, `CFBundleVersion` 이 같으면 다시 깔아도 재부팅해도 다시 그리지
않는다. 빌드 번호를 올려 깔면 다시 그린다. 2026-11-02 에 빌드 16 위에 빌드 16 을 두 번 덮고 재부팅까지 했는데도
주황 1겹이 남았고, 빌드 17 로 깔자 바로 바뀌었다.

## 2겹의 그림을 바꿀 때

그림과 자리의 규칙은 [[ADR-013]] 결정 12 ~ 18 에 있다.

- 일러스트와 눈 조각은 `assets/splash/` 의 PNG 다. 본체 크기를 바꾸면 `app/splash/layout.ts` 의 `BODY_PX` 와
  `SNOW_FLAKES` 의 조각 크기를 함께 맞춘다.
- 이름 글자를 바꾸려면 메이플스토리 서체 TTF 를 받아 `uv run --with fonttools python scripts/make-splash-wordmark.py "<TTF 경로>"`
  를 돌린다. TTF 는 저장소에 없다. https://maplestory.nexon.com/Media/Font 에서 받는다.
- 등장 길이를 바꾸면 `BOOT_SPLASH_HOLD_MS` 가 `entranceEndMs()` 를 따라 같이 바뀐다.
- 바탕과 글자 색은 `app/splash/colors.ts` 다. 하늘 색 `sky` 를 바꾸면 1겹 네 곳도 같이 바꾼다.

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
