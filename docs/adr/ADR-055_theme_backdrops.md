# ADR-055 테마 배경 그림

> 🟢 유효
> 옛 번호: ADR-088 결정 3 · 4 · 6 · ADR-089 결정 3 · ADR-105 결정 3 · ADR-106 · ADR-108 · ADR-109 · ADR-133 · ADR-193
> 관련 소스: `src/data/job-themes.json` · `types/theme.ts` · `components/templates/ThemeBackdrop/` · `theme/screen-backdrop-policy.ts` · `navigation/navigation-theme.ts` · `navigation/tab-layer-props.tsx` · `navigation/RootNavigator.tsx` · `lib/assets/asset-lookup.ts` · `src/assets/themes/`

## 배경

테마는 색 토큰([[ADR-054]]) 말고도 화면 전체에 깔리는 배경 그림을 둘 수 있다. 지금 그림이 있는 테마는 혼테일(얼음 동굴)과
검은마법사(보스 맵) 둘이고, 나머지 넷은 그림 없이 `bg` 색만 쓴다.

## 결정

### 결정 1. 배경은 테마 JSON 의 선택 칸이고, 그림이 아니라 값을 고친다

```jsonc
"background": {
  "image": "hontail-background",   // src/assets/themes/<슬러그>.webp 의 슬러그
  "size": "cover",
  "position": "45% bottom",
  "dim": 0.8,
  "fadeTop": "0px"
}
```

"더 어둡게" 는 `dim`, "아래쪽이 보이게" 는 `position` 을 바꾼다. 코드를 고치지 않고 값 한 블록으로 다른 테마에도 붙일 수 있어야 한다.

| 테마 | 그림 | `position` | `dim` |
|---|---|---|---|
| 혼테일 | `hontail-background` | `45% bottom` | 0.8 |
| 검은마법사 | `blackmage-background` | `25% bottom` | 0.55 |

- 값은 화면을 보며 사람이 정해 JSON 에 넣는다. 어느 부분이 보일지는 뷰포트 비율에 따라 달라서 수치로 고를 수 없다.
- `background` 는 색이 아니라서 `--color-*` 변수로 내보내지 않는다.
- 슬러그에 맞는 파일이 없으면 그림만 사라지고 테마는 그대로 쓴다(`getThemeBackgroundUrl` 이 `null`).

### 결정 2. 크기는 `cover` 이고, 위치는 그림의 대칭축을 기준으로 정한다

- 둘 다 `cover` 다. 세로로 긴 폰에서 가로로 긴 그림을 `cover` 로 깔면 가로의 일부만 보인다(종횡비 2.475 그림은 19%).
  `position` 으로는 어느 부분을 보일지만 고른다.
- 혼테일처럼 테두리를 두른 그림은 장면 그림보다 잘렸을 때 손해가 크다. 양쪽 끝이 서로 반대편이라 좁은 폭에 둘 다 담을 수 없다.
  이 대가를 받아들였다.
- `position` 이 늘 `center` 인 것은 아니다. 그림의 대칭축이 한가운데가 아닐 수 있다. `cover` 가 그림을 크게 확대하므로 원본의
  작은 어긋남이 화면에서는 배율만큼 커진다. 새 그림을 붙일 때마다 그림을 좌우로 뒤집어 겹쳐 보고 어긋남이 가장 작은 x 를
  찾아 퍼센트로 적는다. 그림을 다시 자르지 않는다.
- `dim` 과 `position` 은 그림마다 다시 정한다. 혼테일의 `dim` 이 더 높은 것은 위쪽 고드름이 머리의 글자와 겹치기 때문이다.

### 결정 3. 그림 파일은 하늘을 알파로 비우고, 원본을 남기지 않는다

- 그림의 위쪽(하늘)은 투명하게 비운다. 불투명한 그림을 화면 일부에만 깔면 그림 윗변과 `bg` 사이에 가로 띠가 생긴다. 하늘이
  투명하면 뒤의 색이 그대로 비쳐 경계가 생기지 않는다. webp 로 바꿀 때 알파 채널을 유지한다.
- `src/assets/themes/` 에 원본 `.png` 를 두지 않는다. 같은 이름의 `.png` 와 `.webp` 가 같은 슬러그로 충돌하고, 쓰지 않는 원본까지
  번들에 실린다.
- 에셋은 커밋된 목록(`src/assets/generated/themes.ts`)에서 슬러그로 찾는다. 그림을 넣거나 지우면 `npm run assets:gen` 을 돌린다.
  목록에 있는 파일은 어느 테마도 쓰지 않아도 번들에 실리므로, 쓰지 않는 그림은 파일째 지운다. 슬러그는 테마 이름의 영문
  앞머리(`hontail-` · `blackmage-`)로 맞춘다.

### 결정 4. 배경은 앱 전체에 한 장이다. 뒤에 테마 색을 깔고, 같은 색으로 덮는다

- `ThemeBackdrop` 이 `AppShell` 의 첫 자식으로 한 장을 깐다. RN 은 형제 순서가 그리는 순서라 z-index 가 필요 없다.
- 머리에 따로 배경을 칠하지 않는다. 머리도 같은 그림 위에서 함께 스크롤한다. 그래서 `fadeTop` 은 `0px` 이다.
- `cover` 와 위치는 `theme-backdrop-layout.ts` 가 좌표로 계산한다. RN 에는 배경 크기 · 위치 속성이 없다. 그림 크기를 모르면
  그리지 않는다. 크기 없이 그리면 그림이 늘어난다.
- 그림 뒤에 테마 `bg` 를 먼저 깐다. 그림이 투명한 부분이 많은데 뒤가 비어 있으면 어둡게 하는 일을 `dim` 혼자 맡게 되고, 올릴수록
  그림이 회색이 된다.
- 그림 위에 덮는 색도 검정이 아니라 테마의 `bg` 를 `dim` 만큼의 알파로 쓴다. 검정으로 덮으면 어느 테마든 같은 회색이 되지만,
  자기 바탕색으로 덮으면 그 테마의 색조가 남는다. 그래서 `dim` 은 "검게 덮는 양" 이 아니라 "그림을 바탕색 쪽으로 당기는 양" 이다.
- 카드는 불투명하게 둔다. 반투명이면 카드 안 글자의 대비가 그림 위치마다 달라진다.

### 결정 5. 안드로이드에서는 가장 안쪽의 불투명 화면이 배경을 직접 그린다

배경 한 장을 셸에 깔려면 그 위의 내비게이션 화면이 투명해야 한다. 그런데 안드로이드는 화면 전환 중 두 화면이 겹치는 동안
위 화면 너머로 아래 화면의 글자가 비친다(실기기 확인). iOS 에는 이 증상이 없어서 두 플랫폼의 모습을 함께 바꾸지 않는다.

- `SCREENS_CARRY_BACKDROP`(`Platform.OS === 'android'`) 한 값으로 이것을 정한다. 이 값이 참이면 `navigation-theme.ts` 가 화면 배경을
  불투명한 `bg` 로 칠하고, `ScreenBackdrop` 이 화면마다 `ThemeBackdrop` 을 자기 안에 그린다. 두 곳이 같은 값을 읽어야 한다. 한쪽만
  바뀌면 배경이 통째로 사라지거나 글자 겹침이 남는다.
- 배경은 **가장 안쪽의 불투명 화면**이 그린다. 탭 내비게이터 셋은 `TAB_LAYER_PROPS`(`navigation/tab-layer-props.tsx`)의
  `screenLayout` 으로, 루트 스택에 올라오는 하위 화면은 `RootNavigator` 의 `screenLayout` 으로 감싼다. 그 바깥의 `LayerStack` 에는 두지
  않는다. 탭 화면이 자기 배경을 칠하면서 `LayerStack` 이 깐 그림을 덮었고, 그래서 1.0.7 에서 안드로이드만 테마 배경이 사라졌다. 화면을
  칠하는 내비게이터가 늘면 그 내비게이터에서도 배경을 그려야 한다.
- `screenLayout` 이 JSX 를 돌려주므로 상수는 자기 파일에 둔다. 컴포넌트 파일이 다른 값을 함께 내보내면 fast refresh 가 깨진다.
- iOS 에서는 `ScreenBackdrop` 이 자식을 그대로 통과시켜 뷰가 늘지 않는다.
- 대가로 안드로이드에서는 배경이 화면과 함께 밀려 움직인다.
- 배경은 `ScreenScroll` 의 마스크 밖에 둔다. 안에 두면 안전 영역 페이드가 배경에도 적용된다.

### 결정 6. 테스트는 배경이 있는 테마를 데이터에서 고르지 않고 직접 만든다

배경을 가진 테마 수가 바뀌어도 테스트가 아무것도 검사하지 않고 통과하면 안 된다. 그래서 "배경이 있다" 쪽은 테스트가 픽스처로
만들고, 컴포넌트 테스트는 `getThemeDefinition` 을 일부 모킹해 넣는다. "배경이 없다" 쪽은 실제 테마로 검사한다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `components/templates/ThemeBackdrop/__tests__/theme-backdrop-layout.test.ts` | 결정 4: `cover` 배율과 위치 계산, 위치 문자열 해석, 크기를 모를 때 그리지 않는지 본다 |
| `navigation/__tests__/navigation-theme-screens-carry-backdrop.test.tsx` | 결정 5: 플랫폼 값에 따라 화면 배경이 불투명한지와 화면마다 배경을 그리는지가 함께 바뀌는지 본다 |
| `navigation/__tests__/tab-layers-carry-backdrop.test.tsx` | 결정 5: 탭 내비게이터와 루트 스택이 `screenLayout` 으로 배경을 그리는지 본다 |
| `lib/__tests__/theme-backgrounds.spec.ts` | 결정 1: 슬러그를 에셋으로 바꾸고, 없는 슬러그는 `null` 인지 본다 |
| `theme/__tests__/theme-vars.test.ts` | 결정 1: 배경이 색 변수로 내보내지지 않는지 본다 |

## 번호 기록

- ADR-055 (2026-10-19): 옛 ADR-088 · 089 · 105 · 106 · 108 · 109 · 133 · 193 의 배경 결정을 합쳐 처음 작성
