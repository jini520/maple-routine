# ADR-063 화면 틀 · 헤더 · 안전영역 · 글자

> 🟢 유효
> 옛 번호: ADR-099 · ADR-100 · ADR-120 결정 16 · 19 · ADR-131 · ADR-134 · ADR-135 · ADR-136 · ADR-139 · ADR-152 · ADR-196 · ADR-225 · ADR-232 · ADR-233 · ADR-322
> 관련 소스: `components/templates/{ScreenScroll,PageHeader,EntryScroll}/` · `components/atoms/{Text,TextInput}/` · `lib/safe-area.ts` · `lib/image-aspect.ts` · `theme/ThemeProvider.tsx` · `typography.cjs`

## 배경

화면 열여섯 곳 이상이 같은 틀을 쓴다. 스크롤 영역, 헤더, 상단과 하단의 안전영역, 글자 크기를
화면마다 따로 정하면 탭을 오갈 때 제목 위치가 달라지고, 한 화면에서 고친 문제가 다른 화면에 그대로
남는다. 그리고 RN 은 웹에서 브라우저가 대신 해 주던 일(문서 스크롤, `body` 배경, 이미지 비율,
글자 줄 높이)을 해 주지 않는다. 그래서 그 일을 틀 부품 몇 개가 맡고, 화면은 그 부품을 쓰기만 한다.

## 결정

### 결정 1. 스크롤은 화면이 갖고, 화면에 고정되는 영역은 두지 않는다

탭 화면과 하위 페이지는 `ScreenScroll` 안에 그린다. 헤더도 스크롤 뷰의 첫 자식이라 목록과 함께 올라간다.
위에 겹겹이 붙는 고정 영역이 없으니, 그 경계를 덮을 페이드나 높이를 재는 코드도 필요 없다.
`src/__tests__/sticky-policy.test.ts` 가 `stickyHeaderIndices` · `position: 'sticky'` · `stickyTop` 이
소스에 들어오지 않는지 본다.

화면 아래의 액션 바는 예외다. 입력 화면의 저장 버튼처럼 빼면 조작이 끊기는 것은 스크롤 뷰 밖에
절대 위치로 둔다(`EntryScroll` 의 `footer`). 앱 진입 전 화면(로그인 · 캐릭터 설정 · MVP 등급)은 탭바가
없어 하단 규칙이 달라서 `EntryScroll` 을 쓴다.

`ScreenScroll` 은 배경을 칠하지 않는다. 불투명하게 칠하면 테마 배경 이미지를 가린다. 끝에서 튕기는
동작(`bounces`)도 끄지 않는다.

### 결정 2. 상단 안전영역은 헤더가 자기 패딩으로 차지한다

`PageHeader` 는 `paddingTop` 에 상단 안전영역 값을 그대로 쓰고 여백을 더하지 않는다. 헤더가 자기 배경을
칠하지 않고 고정되지도 않으므로, 웹에서 불투명한 헤더 안에 두던 16px 여백은 필요 없다.

헤더가 없는 화면(설정 계열)은 `ScreenScroll` 이 스크롤 상자 자체를 안전영역만큼 내린다. 콘텐츠
패딩으로 내리면 글자는 내려가도 스크롤 인디케이터는 노치까지 올라가기 때문이다.

### 결정 3. 화면이 쓰는 안전영역 값은 `lib/safe-area.ts` 에서 받고, 안드로이드에만 하한이 있다

| | 값 | 이유 |
|---|---|---|
| 위 | iOS 는 인셋 그대로, 안드로이드는 `max(인셋, 48)` | 안드로이드 상태바(31dp 쯤)가 헤더에 쓰기엔 얇다. iOS(59)는 바꾸지 않는다 |
| 아래 | iOS 는 인셋 그대로, 안드로이드는 `max(인셋, 34)` | iOS 홈 인디케이터와 같은 값이다. 3버튼 내비(48)에는 아무것도 더하지 않는다 |

하한은 더하는 값이 아니라 바닥이다. 인셋이 이미 하한보다 큰 기기에는 아무것도 바꾸지 않는다.

화면은 `useSafeAreaInsets()` 를 직접 읽지 않고 `useTopSafeAreaPx()` · `useBottomSafeAreaPx()` 를 쓴다.
헤더 패딩, 상단 페이드, 하단바 높이, 콘텐츠 끝 여백이 모두 같은 값을 봐야 제목 윗변과 페이드 끝선이
한 선에 맞고, 마지막 카드가 하단바 뒤로 들어가지 않는다. `src/__tests__/{top,bottom}-safe-area-policy.test.ts`
가 이것을 검사한다. 상태바와 내비게이션 바를 가리지만 않으면 되는 오버레이(시트 · 드롭다운)는 인셋을
그대로 쓴다. 거기에 하한을 적용하면 내용만 좁아진다.

### 결정 4. 콘텐츠는 안전영역에서 알파 마스크로 투명해진다

스크롤하면 콘텐츠가 상태바 밑과 하단바 뒤로 지나간다. 그곳을 배경색 띠로 덮지 않고, 콘텐츠의 알파를
깎아 투명하게 만든다. 띠로 덮으면 배경 이미지가 있는 테마에서 가만히 있어도 띠가 보인다. 알파를
깎으면 뒤의 배경이 그대로 남고, 스크롤이 0 일 때는 화면이 한 픽셀도 바뀌지 않는다.

- `ScreenScroll` 이 스크롤 상자를 `@react-native-masked-view/masked-view` 로 감싼다. RN 에는 CSS
  `mask-image` 가 없고 `mixBlendMode` 에 `destination-out` 도 없어서 알파를 깎을 방법이 이것뿐이다.
- 곡선은 `smoothstep²`(`(3t²−2t³)²`)이고 정지점 아홉 개로 그린다. 양 끝 기울기가 0 이라 페이드가
  시작되고 끝나는 선이 보이지 않는다.
- 길이는 콘텐츠가 실제로 크롬과 겹치는 곳에만 둔다(`resolveSafeAreaFade`).

| | 길이 | 0 이 되는 경우 |
|---|---|---|
| 위 | 상단 안전영역 | 헤더가 없는 화면. 상자가 이미 내려가 있다 |
| 아래 | `하단 안전영역 − 스크롤 상자가 비운 몫` + 탭 화면이면 하단바 몫의 절반 | 안드로이드 하위 페이지. 상자가 이미 내비게이션 바 위에서 끝난다 |

하단바 몫의 절반만 올리는 것은 캡슐 한가운데에서 알파가 0 이 되게 하기 위해서다. 전부 올리면 목록의
마지막 카드 두 장쯤이 늘 흐릿하고, 안전영역까지만 두면 콘텐츠가 선명한 채로 캡슐 밑에 들어간다.
이 값은 하단바 높이에서 계산한다. 숫자를 따로 적으면 하단바가 바뀔 때 어긋난다.

두 길이가 모두 0 이면 마스크를 걸지 않는다. 마스킹은 화면 밖 합성이라 비용이 든다.

안드로이드 마스크 구현은 `patches/` 의 패치를 루트 `postinstall`(`patch-package`)이 적용해서 쓴다.
원래 구현은 마스크를 `getChildAt(0)` 으로 찾는데, 하위 페이지에서 뒤로 가면 자식이 먼저 빠져서 마스크를
못 알아보고 전환 내내 화면이 검게 그려진다. 패치는 마스크를 참조로 갖고 있다가 `drawChild` 에서 그리지
않는다. jest 는 이 결함을 볼 수 없어 `src/__tests__/mask-policy.test.ts` 가 패치 파일과 `postinstall` 을
확인한다.

### 결정 5. 하단 인셋은 지나가도 되는 몫과 안 되는 몫으로 나눈다

| 화면 | 스크롤 상자를 올리는 양 | 콘텐츠 끝에 남기는 여백 |
|---|---|---|
| 탭 화면 | 0 | 하단 안전영역 + 하단바 몫 |
| 하위 페이지(iOS) | 0 | 하단 안전영역 |
| 하위 페이지(안드로이드) | 인셋 | 하단 안전영역 − 인셋 |

홈 인디케이터나 제스처 핸들 위로는 콘텐츠가 지나가도 되지만, 안드로이드 3버튼 내비게이션 위로 지나가면
버튼 사이로 글자가 비친다. RN 은 둘을 구분하지 못하고 인셋 하나만 주므로, 안드로이드는 인셋을 전부
막는 쪽을 고른다. 그래서 제스처 내비게이션 기기에서는 바닥에 배경색 띠가 남는다. 여백을 스크롤 상자가
아니라 콘텐츠에 넣는 것은 스크롤할 수 있는 높이가 늘어야 끝의 여백이 되기 때문이다. 판정은
`ScreenScroll/bottom-inset.ts` 한 곳에 있고 결정 4 의 하단 페이드도 이 값을 받아 쓴다.

### 결정 6. 헤더에는 제목 줄과 다른 페이지로 가는 것만 둔다

헤더에 담는 것은 셋이다.

1. 제목
2. 갱신 시각 줄([[ADR-061]])
3. 다른 페이지로 가는 것(뒤로 · 페이지 이동 링크)

이 화면에서 무엇을 볼지 고르는 요소는 헤더가 아니라 콘텐츠의 첫 자식으로 둔다. 캐릭터 레일 · 기간 이동 ·
로딩 카드 · 가뭄 요약이 그렇다. 나누는 기준은 누르면 이 화면을 떠나는지다. 그래서 보스 수익의
`아이템 가격` 같은 링크는 같은 줄에 있어도 헤더에 남는다.

주기 · 필터 탭(`TabSegment`)은 예외로, 제목 영역 오른쪽의 `trailing` 에 둔다([[ADR-060]]). 콘텐츠 첫
줄에 두면 화면마다 위치가 달랐고, 제목 줄 안에 넣으면 높이가 32 로 딱 맞아 헤더 위에 붙어 보였다.

- 제목 줄은 모든 화면이 `PageHeaderTitleRow` 로 그린다. 최소 높이 `min-h-8` 만 정하고 고정 높이는 주지
  않는다. 안에 들어가는 것이 화면마다 달라도 높이가 4px 씩 어긋나지 않게 하면서, 더 큰 것이 들어와도 잘리지
  않게 하기 위해서다.
- 갱신 시각 줄은 `PageHeaderTitleRow` 가 제목 바로 아래에 언제나 그린다. 값이 없는 화면도 줄의 높이는
  남긴다. 그래서 모든 화면의 헤더 높이가 같고, 탭을 오갈 때 제목이 뛰지 않는다. 제목 줄과 갱신 시각 줄
  사이에는 간격을 주지 않는다. `min-h-8` 이 이미 여백을 남겨서, 더 벌리면 시각이 제목에 딸린 글씨로
  읽히지 않는다.

`src/__tests__/page-header-title-row-policy.test.ts` 가 제목을 그리는 화면이 모두 `PageHeaderTitleRow` 를
쓰는지, 화면이 `DataFreshness` 를 직접 그리지 않는지, `<PageHeader>` 안에 콘텐츠 요소가 없는지 본다.

### 결정 7. 헤더와 콘텐츠 사이, 콘텐츠 블록 사이의 간격은 `gap-2` 하나다

`PageHeader` 는 아래 여백을 갖지 않는다. 간격은 `ScreenScroll` 의 `contentContainerClassName="gap-2"`
(8px) 하나로 준다. 헤더가 자기 몫을 더하면 헤더 셸을 쓰지 않는 화면과 간격이 달라진다. 이 값은
NativeWind 가 `contentContainerStyle` 로 컴파일하므로 렌더 트리의 자식 뷰에서는 보이지 않는다.

### 결정 8. 앱 루트가 자기 바탕을 칠한다

`ThemeProvider` 의 View 가 테마의 `bg` 를 `style` 값으로 칠한다. 칠하지 않으면 iOS 가 하위 페이지를
밀어 넣으며 화면 모서리를 둥글게 깎을 때, 두 화면 사이 틈으로 RN 루트 뷰의 흰색이 보인다. 웹에서는
`body` 가 칠해져 있어 없던 문제다.

- `app.json` 의 `backgroundColor` 는 정적이라 테마 여섯을 다 맞출 수 없다. `expo-system-ui` 는 새 네이티브
  의존성이 필요하다. JS 의 조상 View 하나로 같은 결과가 나온다.
- 색을 `bg-bg` 클래스가 아니라 값으로 주는 것은 이 View 가 테마 변수(`vars()`)를 정의하는 노드라서다.
  같은 노드에서 변수를 정의하고 읽지 않는다.
- 배경 이미지(`ThemeBackdrop`)는 이 View 의 자식이라 위에 그려지므로 가려지지 않는다.

### 결정 9. `Image` 는 너비와 높이를 둘 다 지정한다

RN `Image` 는 스타일을 `[고유 픽셀 크기, 기본, 우리 style]` 순서로 쌓는다. 그래서 한 축만 적으면 나머지
축에 그림의 고유 픽셀 크기가 남고, 두 축이 정해지면 `aspectRatio` 도 무시된다. 실제로 월드 아이콘 좌우에
빈 공간이 생기고 보스 초상이 세로로 늘어났다. 웹에서는 preflight 의 `img { height: auto }` 가 대신 처리해
주던 일이다.

그래서 남는 축을 명시적인 `undefined` 로 지우고 `aspectRatio` 를 함께 준다. RN 은 `undefined` 를 앞의 값을
지우는 값으로 읽어서, 그 축은 auto 가 되고 `aspectRatio` 가 채운다. 이 계산은 `lib/image-aspect.ts` 의
`naturalAspectStyle` 한 곳에 둔다. 고유 크기를 모르는 소스에는 준 축만 돌려준다. 크롭이 있는 그림은
`lib/image-crop.ts` 의 `imageCropStyle` 이 같은 방법으로 두 축을 모두 지정한다.

jest 프리셋은 `Image` 를 목으로 바꿔서 이 쌓임을 재현하지 않는다. 그래서 테스트는 값이 아니라 두 축의
키가 스타일에 있는지(`'height' in style`)를 본다.

### 결정 10. 글꼴은 Pretendard 이고, 글자 크기 단계는 `typography.cjs` 한 표가 정한다

글꼴을 지정하지 않으면 두 플랫폼이 각자 시스템 글꼴을 써서 같은 크기의 글자도 줄 높이가 2~4px 씩
달랐다. 그래서 Pretendard 를 앱에 넣고 `Text` 와 `TextInput` 이 `APP_FONT_FAMILY` 를 쓴다.

| | 파일 | `fontFamily` |
|---|---|---|
| iOS | `PretendardVariable.ttf` 하나 | `Pretendard Variable` |
| 안드로이드 | 정적 파일 넷(400 · 500 · 600 · 700) | `Pretendard` |

iOS 는 글꼴 안의 Family 이름으로 찾아서 정적 파일을 쓰면 굵기 매칭에 실패하고 시스템 글꼴로 떨어진다.
안드로이드는 `expo-font` 가 `fontVariationSettings` 를 넣지 못해 가변 파일을 쓰면 굵기가 모두 400 이
된다. 그래서 플랫폼마다 파일을 다르게 넣는다. 안드로이드는 `includeFontPadding` 도 끈다. 켜 두면 줄
높이를 정해도 안드로이드만 상자가 커진다.

굵기는 `bold`(700)까지만 쓴다. 안드로이드가 800 에서 글자를 잰 폭보다 넓게 그려 마지막 음절이 잘렸다.

`typography.cjs` 는 Tailwind 기본 글자 크기 단계를 확장하지 않고 통째로 교체한다. 크기마다 줄 높이를 함께
적는다. 줄 높이가 없는 크기는 RN 이 플랫폼 글꼴 메트릭으로 줄 상자를 잡아 두 플랫폼이 다시 달라진다.
배지는 한 줄 라벨이라 본문 줄 높이를 쓰면 헐렁해서 `chip`(12/14) · `chip-sm`(10/14) · `chip-xs`(9/11)
단계를 따로 둔다. 값은 `rem` 이 아니라 px 로 적는다.

`src/__tests__/typography-policy.test.ts` 가 표에 없는 `text-*` · `font-*`, 임의 크기 `text-[Npx]`, 줄
높이가 빠진 항목을 잡는다. 표에 없는 이름은 에러 없이 사라지기 때문이다.

### 결정 11. 시스템 글자 크기는 `[1.0, 1.235]` 안에서만 따른다

시스템 글자 크기를 그대로 따르면 작게 설정한 기기에서는 12px 글자가 10px 가까이로 줄고, 크게 설정한
기기에서는 높이가 82 로 고정된 today 위젯 칸을 글자가 넘친다.

- 하한 1.0: 작게 보는 것은 접근성 요구가 아니라 취향이라 설계 크기 아래로는 줄이지 않는다.
- 상한 1.235: iOS 글자 크기 표의 XXL 칸이다. 그 다음 칸(1.353)부터는 글자가 위젯 칸을 넘친다.
  접근성 큰 글자(1.786~)를 켠 사용자도 이 앱에서는 1.235 까지만 받는다.

RN 에는 하한 프롭이 없어서 `allowFontScaling = fontScale >= 1`, `maxFontSizeMultiplier = 1.235` 두 줄로
만든다. 1 미만이면 스케일링을 끄므로 정확히 1.0 이 된다. 하한을 1.0 이 아닌 값으로 바꾸면 이 방법을 쓸
수 없다.

이 두 프롭은 글자를 그리는 모든 곳에 붙어야 하므로 `components/atoms/Text` 와 `TextInput` 두 atom 만
`react-native` 의 `Text` · `TextInput` 을 가져온다. 다른 곳의 직접 import 는 ESLint `no-restricted-imports`
와 `src/__tests__/font-scaling-policy.test.ts` 가 막는다. 하나라도 빠지면 그곳만 조용히 OS 배수를
그대로 받기 때문이다.

높이가 고정된 칸 안의 글자는 `<Text fixed>` 로 배수를 아예 끈다. today 위젯, 하단바 라벨, 캐릭터 초상의
이니셜, `Badge` 의 `mini` 가 그렇다. 부품이 놓이는 곳에 따라 달라지는 경우는 [[ADR-060]] 에 있다.

### 결정 12. 안드로이드는 `enablePreparedTextLayout` 을 켠다

안드로이드에서 `지난 달` 이 `지난` 으로, `주간` 이 `주` 로 잘려 보였다. RN 이 글자를 잴 때 만든 레이아웃을
버리고 그릴 때 `TextView` 가 줄바꿈을 다시 계산하는데, 두 번째 계산이 1px 더 필요하면 마지막 음절이 다음
줄로 넘어가 한 줄 높이 상자에 가려진다. 이 플래그를 켜면 잰 레이아웃을 그대로 그려서 두 번째 계산이
없어진다. `PreparedTextFlags.kt` 가 이 플래그만 켜고, `MainApplication` 이 `loadReactNative` 뒤에
`dangerouslyForceOverride` 로 건다.

그래서 라벨 폭을 값으로 고정하지 않는다. 플래그를 끄면 잘림이 다시 생기므로, 그때는 폭 고정도 함께
되살려야 한다. 이 경로에서는 네이티브 글자 선택이 되지 않는데, 앱은 `<Text selectable>` 을 쓰지 않는다.
네이티브 변경이라 OTA 로는 바꿀 수 없다.

### 결정 13. 앱은 한국어 전용으로 선언한다

지원 언어를 선언하지 않으면 두 OS 가 개발 언어인 영어로 정해져, 입력 칸을 길게 눌렀을 때 나오는 시스템
메뉴가 `Copy` · `Paste` 로 뜬다. 안드로이드는 `res/xml/locales_config.xml` 에 `ko` 를 적고 매니페스트의
`android:localeConfig` 로 가리킨다. iOS 는 `CFBundleDevelopmentRegion` 과 `CFBundleLocalizations` 를 `ko`
로 둔다. 매니페스트의 그 한 줄은 `expo prebuild` 가 다시 쓰면 사라지므로 손으로 다시 넣어야 한다.

### 결정 14. `react-native-reanimated` 는 4.5.5 이고 `expo install` 이 되돌리지 않게 막는다

4.5.1 은 애니메이션으로 바뀐 스타일 값이 React 에 넘어가기 전에 시간 기준으로 지워 버리는 결함이 있었다.
JS 스레드가 잠깐 막히면 값이 사라지고, 다음 React 커밋에서 뷰가 정적 스타일만으로 돌아간다. 그래서
안드로이드에서 세그먼트 선택 상자가 폭 0 으로 사라지고, 캐릭터 관리 격자의 칸이 엉뚱한 위치로 갔다.
4.5.3 부터 React 가 값을 받은 뒤에만 지우도록 고쳐졌고, 같은 수정이 들어간 4.5.5 를 쓴다.

Expo 는 reanimated 를 4.5.1 로 고정하므로 `package.json` 의 `expo.install.exclude` 에 적어 둔다. 적지 않으면
`expo install --fix` 가 결함이 있는 버전으로 되돌린다. 칸을 다시 마운트하는 우회책은 쓰지 않는다. 빈도만
줄 뿐 값이 지워지는 원인은 그대로 남기 때문이다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `src/__tests__/sticky-policy.test.ts` | 결정 1: 고정 영역을 만드는 속성이 소스에 들어오지 않는지 본다 |
| `components/templates/ScreenScroll/__tests__/ScreenScroll.test.tsx` | 결정 1 · 2 · 4 · 7: 헤더가 스크롤 뷰의 자식인지, 배경을 칠하지 않고 튕김을 끄지 않는지, 헤더가 없을 때만 상자를 내리는지, 콘텐츠 간격이 `gap-2` 인지, 마스크가 스크롤 뷰를 감싸고 알파만 전달하는지, 겹칠 것이 없으면 마스크를 걸지 않는지, 하단 인셋이 들어가는 곳을 본다 |
| `components/templates/PageHeader/__tests__/PageHeader.test.tsx` | 결정 2 · 7: 상단 안전영역만큼만 패딩을 주는지, 배경을 칠하지 않는지, 아래 여백이 없는지 본다 |
| `lib/__tests__/top-safe-area.test.ts` · `bottom-safe-area.test.ts` | 결정 3: 안드로이드에서만 하한을 쓰고, 인셋이 더 크면 그대로 두는지, 결과가 인셋보다 작아지지 않는지 본다 |
| `src/__tests__/top-safe-area-policy.test.ts` · `bottom-safe-area-policy.test.ts` | 결정 3: 화면이 `insets.top` · `insets.bottom` 을 직접 읽지 않는지, `ScreenScroll` 은 인셋과 하한을 둘 다 보는지 본다 |
| `components/templates/ScreenScroll/__tests__/safe-area-fade.test.ts` | 결정 4: 위아래 페이드 길이가 화면 종류마다 맞는지, 하단바 몫이 바뀌면 따라가는지, 곡선의 끝점 · 단조 증가 · 한가운데 0.25 · 정지점 오차 2% 이내를 본다 |
| `src/__tests__/mask-policy.test.ts` | 결정 4: 마스크 패치와 `postinstall` 이 있고, 마스크 안의 터치를 막는 대체 라이브러리를 쓰지 않는지 본다 |
| `components/templates/ScreenScroll/__tests__/bottom-inset.test.ts` | 결정 5: 탭 화면과 두 플랫폼 하위 페이지에서 상자와 콘텐츠 여백이 맞게 나뉘는지 본다 |
| `src/__tests__/page-header-title-row-policy.test.ts` | 결정 6: 제목 줄을 모두 `PageHeaderTitleRow` 로 그리는지, 헤더 안에 콘텐츠 요소가 없는지 본다 |
| `components/templates/PageHeader/__tests__/PageHeaderTitleRow.test.tsx` | 결정 6: 최소 높이만 주는지, 갱신 시각 줄을 제목 아래에 언제나 그리는지, 제목 영역에 간격이 없는지, `trailing` 을 주면 제목 쪽이 남는 폭을 차지하는지 본다 |
| `lib/__tests__/image-aspect.test.ts` · `image-crop.test.ts` | 결정 9: 한 축을 주면 다른 축이 `undefined` 와 비율로 채워지는지, 고유 크기를 모르면 준 축만 돌려주는지, 크롭이 두 축을 모두 지정하는지 본다 |
| `src/__tests__/typography-policy.test.ts` | 결정 10: 글자 크기 · 굵기 이름이 모두 표에 있고 임의 크기를 쓰지 않으며 표의 모든 크기가 줄 높이를 갖는지 본다 |
| `components/atoms/Text/__tests__/font-scaling.test.ts` · `Text.test.tsx` · `TextInput/__tests__/TextInput.test.tsx` | 결정 11: 1 미만이면 스케일링을 끄고, 구간 안은 그대로, 위는 1.235 로 자르는지, `fixed` 는 언제나 1.0 인지, `className` 이 그대로 풀리는지 본다 |
| `src/__tests__/font-scaling-policy.test.ts` | 결정 11: `Text` · `TextInput` 을 직접 가져오는 곳이 atom 뿐인지, 고정 칸의 `<Text>` 가 모두 `fixed` 를 다는지 본다 |

## 번호 기록

- ADR-063 (2026-10-19): 옛 ADR-099 · 100 · 131 · 134 · 135 · 136 · 139 · 152 · 196 · 225 · 232 · 233 · 322 와 옛 ADR-120 결정 16 · 19 를 합쳐 처음 작성
