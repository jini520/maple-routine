# Figma

Figma 파일을 고치거나 Figma 에 시안을 그릴 때 이 문서를 따른다. 왜 이렇게 정했는지는 [[ADR-086]] 에 있다.

코드가 원본이고 Figma 는 사본이다. Figma 와 코드가 다르면 Figma 를 코드에 맞춘다. Figma 에서 그린 시안은 코드에 들어간 뒤에 확정된다.

## 파일

| 파일 | 담는 것 |
|---|---|
| [`maple-routine`](https://www.figma.com/design/oq5yRBOIb81394vTeLMqrP/maple-routine) | 디자인 시스템과 시안 |
| `maple-dpm`(`rNOtv7t7itFeM2XeL3fgsN`) | 스토어 이미지와 홍보 사이트. 내보내는 법은 `docs/features/site.md` 에 있다 |
| `maple-routine 아이템 시세 카드 일러스트`(`AVHMhYmLYJSRCvXKIQET0q`) | 그림 후보 |

## 페이지

`maple-routine` 의 페이지다.

| 페이지 | 담는 것 |
|---|---|
| `Foundations` | 색 변수(테마 여섯이 모드) · 텍스트 스타일 · 모서리 · 간격 · 아이콘. 아이콘 묶음 `Icon set` 이 `atoms/Icon` 의 사본이다 |
| `App/Atoms` · `App/Molecules` · `App/Organisms` · `App/Templates` | 앱 부품. 코드의 `components/` 계층과 같다 |
| `Web/…` | 웹 부품. 웹 코드가 생기면 같은 방식으로 나눈다 |
| `시안` | 기능마다 섹션 하나 |

## 이름

- 부품 이름, 변형 속성의 이름과 값은 코드 이름을 그대로 쓴다. `Button` 의 `variant=soft` · `size=sm` 이다.
- 부품 설명의 첫 줄은 코드 경로다(`components/atoms/Button`).
- 텍스트 스타일은 `mobile/sm/semibold` · `web/…` 처럼 플랫폼 묶음 뒤에 그 플랫폼 코드의 클래스를 쓴다. 글자는 모두 텍스트 스타일에 연결하고,
  노드에서 글꼴 · 크기 · 자간을 직접 덮어쓰지 않는다.
- 부품 코드가 크기 · 두께 말고 자간이나 줄 높이까지 바꾼 조합도 텍스트 스타일로 둔다(`mobile/chip-sm/bold-tracked` · `mobile/2xl/bold-tight` ·
  `mobile/9/normal-leading-3`). 노드에서 덮어쓰면 스타일 연결이 끊기기 때문이다. 이름 뒤쪽은 그 클래스(`tracking-[.03em]` · `tracking-[-.03em]` ·
  `leading-3`)를 줄인 말이다.
- `theme-vars.ts` 가 계산하는 파생 색(`cardBody` · `cardInset` · `control*` · `settlement*`)도 `Color` 컬렉션에 테마마다 값을 넣어 둔다. 어두운
  테마의 시트 · 팝오버 안에서 `bg` · `surface` 를 한 단계 밝히는 것은 변수로 두지 않고 그 부품의 설명에 적는다.
- 플랫폼마다 따로 두는 값(글자 · 간격 · 레이아웃 크기 · 부품 크기 단계)은 `mobile/` · `web/` 묶음으로 나누고, 함께 쓰는 값(아이콘 · 글꼴 · 모서리)은
  하나만 둔다. `Color`(직업 테마 여섯)는 앱 부품만 쓴다. 웹은 앱 테마를 쓰지 않고 라이트 · 다크만 둔다([[ADR-086]] 결정 6).

## 글꼴

Figma 의 글꼴은 Noto Sans KR 이고 Pretendard 로 바꾸지 않는다. Figma 서버가 Pretendard 를 불러오지 못해, 바꾸면 Claude 가 글자가 든 노드를
고칠 수 없다. `semibold` 는 Bold 로 그린다. 한글 모양은 Pretendard 와 거의 같고 영문 · 숫자 폭이 조금 다르므로, 말줄임 · 줄바꿈 같은 글자
폭 판단은 앱이나 웹 화면에서 한다.

## 시안

- 시안은 그 화면의 페이지(`App/<화면>` · `Web/<화면>`) 안에 섹션을 두고 부품 인스턴스로 그린다. 따로 둔 `시안` 페이지는 더 쓰지 않는다([[ADR-086]] 결정 8). 부품을 떼어 내(detach) 고치지 않는다. 떼어 내면 부품이 바뀌어도 따라가지
  않는다. 없는 부품이 필요하면 그 부품의 디자인부터 정한다(`design-system.md` 의 `디자인 작업 전에`).
- 앱 시안은 테마 여섯을, 웹 시안은 라이트 · 다크를 나란히 놓는다. 앱은 같은 틀을 여섯 번 놓고 틀마다 `Color` 컬렉션의 모드를 테마 하나로 고른다. 배경 그림이 있는 테마(혼테일 ·
  검은마법사)는 `src/assets/themes/` 의 그림을 깐다.
- 낮은 화면을 다루는 시안이면 갤럭시 Z 폴드8 외부 화면 · 아이폰 듀오 외부 화면 · 아이폰 SE 2 크기의 틀을 함께 그린다(`design-system.md`
  의 `시안`).
- 움직임이나 실제 웹 동작을 봐야 하는 시안만 아티팩트로 만든다.
- 사용자가 고르면 고른 안을 남기고 그 노드 링크를 ADR 에 적는다. 고르지 않은 안은 지운다.

## 코드와 맞추기

부품(`src/components/`)이나 토큰(`src/data/job-themes.json` · `typography.cjs` · `tailwind-v4-axes.cjs`)의 코드를 바꾸면 같은 작업에서
Figma 의 같은 부품도 맞춘다. 맞추지 않으면 정책 테스트가 실패한다.

1. 코드를 고친다.
2. Figma 의 그 부품을 읽고 코드에 맞춰 고친다. 사람이 Figma 에서 고친 것이 있을 수 있어서, 고치기 전에 그 노드를 읽는다.
3. 기록 파일에 그 부품의 해시와 노드 id 를 적는다(스크립트로).
4. 정책 테스트를 돌린다.

- 테스트는 Figma 를 직접 읽지 못한다. 기록을 고치는 것이 `Figma 를 맞췄다` 는 확인이다. Figma 를 고치지 않고 기록만 고치지 않는다.
- 주석만 고친 것은 해시가 그대로라 Figma 작업이 필요 없다.
- 새 부품을 만들면 Figma 에도 그리고 기록에 더한다. 부품을 지우면 Figma 에서도 지우고 기록에서 뺀다.
- 앱 부품 82 와 토큰은 모두 옮겼다(#1215). 기록에 아직 안 옮긴 항목(`pending`)이 있으면 테스트가 실패한다.

### 기록 파일과 스크립트

| 파일 | 하는 일 |
|---|---|
| `scripts/figma-record.json` | 항목마다 Figma 노드 id 와 맞춘 때의 소스 해시 |
| `scripts/figma-record.mjs` | 해시를 계산하고 기록을 고치는 스크립트 |
| `scripts/__tests__/figma-record.test.mjs` | 정책 테스트. 부품 폴더와 기록 항목이 일대일인지, 맞춘 항목의 해시가 지금 소스와 같은지 본다 |

- 항목은 부품 폴더마다 하나(`atoms/Button`)이고, 토큰 세 파일은 `Foundations` 한 항목이다. 노드 id 는 그 부품의 컴포넌트 세트(변형이 없으면 컴포넌트)이고,
  `Foundations` 는 페이지, `atoms/Icon` 은 `Icon set` 틀이다.
- 해시는 폴더 안의 `.ts` · `.tsx`(`__tests__` 와 `*.test.*` 제외)를 파일 경로 순서로 읽고, 주석과 공백을 걷은 토큰으로 계산한다.
  글자 안의 공백(`className` 등)은 그대로 둔다. 화면에 보이는 값이기 때문이다. `job-themes.json` 은 값만 본다.
- 기록 파일을 `src/components/` 에 두지 않는다. 그 바로 아래에는 계층 디렉터리만 둔다(`layer-dependencies.test.ts`). 해시를 계산하는
  함수를 스크립트와 테스트가 함께 써야 해서 셋을 `scripts/` 에 모았다.

저장소 루트에서 돌린다.

```bash
node scripts/figma-record.mjs record atoms/Button 123:45
```

Figma 의 그 부품(컴포넌트 세트나 컴포넌트)을 맞춘 뒤 노드 id 와 함께 적는다. 지금 소스의 해시가 들어간다. 새 부품도 Figma 에 그린 뒤 이것으로 더한다.

```bash
node scripts/figma-record.mjs remove molecules/OldPart
```

지운 부품을 기록에서 뺀다. Figma 에서도 지운 뒤에 돌린다.

```bash
node scripts/figma-record.mjs status
```

항목 수와, 빠진 · 남은 · 안 옮긴 · 해시가 어긋난 항목을 알린다.

## Claude 가 Figma MCP 로 할 수 없는 것

| 일 | 대신 |
|---|---|
| Pretendard 로 그리기 | Noto Sans KR 로 그린다 |
| 라이브러리 게시 | 사람이 Figma 화면에서 한다. 시안을 같은 파일에 두므로 지금은 필요 없다 |
| 이름 붙은 버전 저장 | 어느 코드에 맞췄는지는 기록 파일이 말한다 |
| 블러 · 애니메이션 옮기기 | 정지한 모양만 그린다. 움직임은 아티팩트로 본다 |
