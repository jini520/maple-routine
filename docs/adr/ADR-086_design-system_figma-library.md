# ADR-086 Figma 디자인 시스템 파일

> 🟢 유효
> 관련 소스: `src/data/job-themes.json` · `typography.cjs` · `tailwind-v4-axes.cjs` · `src/theme/theme-vars.ts` · `components/atoms/`

## 배경

공용 부품은 `components/` 아래 네 계층에 70개가 넘는다. `foundation/design-system.md` 의 부품
목록은 글이라 모양을 볼 수 없고, 부품을 확인하려면 그 부품을 쓰는 화면을 앱에서 찾아 열어야 한다.
그래서 부품과 토큰을 한눈에 보는 곳으로 Figma 파일 하나를 둔다.

Figma 파일: `https://www.figma.com/design/oq5yRBOIb81394vTeLMqrP/maple-routine`

## 결정

### 결정 1. 코드가 원본이고 Figma 는 사본이다

토큰과 부품의 값은 코드에 있는 것이 맞다. Figma 와 코드가 다르면 Figma 를 코드에 맞춘다. Figma 에서
시안을 그려도 되지만, 그 시안은 코드에 반영된 뒤에 확정된다.

원본을 둘로 두면 둘 중 어느 것이 맞는지 매번 따져야 하고, 앱에 실제로 보이는 것은 코드뿐이다.

### 결정 2. Figma 에는 Claude 가 Figma MCP 로 그린다

Figma 공식 MCP 서버의 `use_figma` 로 코드를 읽고 변수와 컴포넌트를 만든다. RN 앱은 웹 화면이 아니라
화면을 캡처해 가져오는 `generate_figma_design` 은 쓸 수 없다. 그래서 Figma 의 부품은 코드를 읽고
다시 그린 것이다. 블러와 애니메이션은 옮기지 않는다.

부품이나 토큰을 바꾼 작업에서는 Figma 의 같은 부품도 다시 맞춘다.

### 결정 3. 색 토큰은 테마 하나를 변수 모드 하나로 옮긴다

`job-themes.json` 의 테마마다 `Color` 컬렉션의 모드를 하나씩 만들고, 색 토큰을 모드마다 그 테마의
값으로 채운다. 테마끼리 공유하는 팔레트가 없어서 원시값 컬렉션을 따로 두지 않는다.

변수 이름은 코드의 토큰 이름(`primary` · `textMuted` 등)을 쓰고, 코드 문법에는 NativeWind 가 쓰는 CSS
변수(`var(--color-primary)`)를 적는다. 그래야 Figma 에서 고른 변수를 그대로 `className` 으로 찾을 수
있다.

`theme-vars.ts` 가 계산하는 파생 토큰(`control-thumb` · `panel-border` 등)은 그 토큰을 쓰는 부품을
옮길 때 함께 옮긴다.

### 결정 4. Claude 는 Noto Sans KR 로 그리고, 사람이 글꼴 변수를 Pretendard 로 바꾼다

앱이 심은 글꼴은 Pretendard 다. 그런데 `use_figma` 스크립트는 Figma 서버에서 돌아서, 사람의 맥에
설치한 글꼴을 불러오지 못한다. 파일에 Pretendard 텍스트가 있어도 서버는 그 글꼴이 없다고
답했다(2026-10-23 실측). 그래서 Claude 는 Google Fonts 에 있는 Noto Sans KR 로 그린다. Pretendard 의
한글은 Noto Sans KR 와 같은 Source Han Sans 를 바탕으로 해서 한글 모양이 거의 같다.

글꼴을 한 곳에서 바꾸도록 텍스트 스타일의 글꼴 이름과 굵기 이름을 `Font` 컬렉션의 문자열 변수에
묶는다. Noto Sans KR 에는 SemiBold 가 없어서 `semibold` 는 Bold 로 그린다. 사람이 `family` 와
`semibold` 변수만 바꾸면 모든 텍스트가 Pretendard 로 바뀐다. 바꾼 뒤에는 Claude 가 그 텍스트를 고칠
수 없다. 서버가 Pretendard 를 불러오지 못하기 때문이다.

글꼴이 바뀌어도 모양이 깨지지 않도록 다음을 지킨다.

- 텍스트 상자는 폭을 고정하지 않고 내용에 맞춘다. 부품도 오토 레이아웃으로 짜서 글자 폭을 따라간다.
- 줄 높이는 `typography.cjs` 의 픽셀 값으로 고정한다. 글꼴마다 기본 줄 높이가 달라 높이가 바뀌기 때문이다.
- 모든 글자는 텍스트 스타일에 연결한다. 노드에서 글꼴을 직접 덮어쓰면 변수를 바꿔도 따라가지 않는다.

텍스트 스타일은 `typography.cjs` 의 `fontSize` 와 `fontWeight` 넷을 곱한 것이고, 이름은
`sm/semibold` 처럼 `className` 의 두 클래스와 같다. 난이도 배지의 자간(`tracking-[.03em]`)은
`chip-sm/bold-tracked` · `chip-xs/bold-tracked` 스타일로 둔다. 노드에서 자간을 덮어쓰면 스타일
연결이 끊어지기 때문이다. 간격과 radius 는 `tailwind-v4-axes.cjs` 의 값을 숫자 변수로 옮긴다.

### 결정 5. 첫 범위는 토큰과 atoms 다

토큰 전부와 `components/atoms/` 의 부품을 변형까지 옮긴다. molecules 와 organisms 는 atoms 의 결과를
보고 방식을 다듬은 뒤에 옮긴다.

## 번호 기록

- ADR-086 (2026-10-23): Figma 디자인 시스템 파일을 두고 코드를 원본으로 삼는다. 토큰과 atoms 를 옮겼다
