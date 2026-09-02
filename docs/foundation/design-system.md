# 디자인 시스템 (Design System)

> **범위**: 디자인 원칙·안티패턴·기본 색 팔레트·시맨틱 색·기본 컴포넌트(카드/버튼/입력)·여러 화면이 공유하는 UI 컴포넌트·공유 레이아웃 패턴·타이포·아이콘. 테마별 토큰 표·런타임 전환은 [features/theme.md](../features/theme.md), 기능 전용 컴포넌트는 각 `features/*.md`.
> **관련 소스**: `components/`(아토믹 4계층: atoms/molecules/organisms/templates) · `src/theme/theme-vars.ts`·`global.css`·`tailwind.config.js` · `navigation/` · `lib/assets/asset-lookup`.
> **관련 ADR**: [[ADR-009]] [[ADR-015]] ADR-016 [[ADR-018]] [[ADR-064]] ADR-072 ADR-073 [[ADR-074]] [[ADR-152]]. **관련 문서**: [features/theme.md](../features/theme.md).

## 디자인 원칙
1. **캐주얼하고 친근한 게임 컴패니언 톤**. 정색한 업무 대시보드가 아니라 매일 캐릭터 챙기는 가벼운 도구. 라이트 테마가 기본.
2. 컴포넌트 성격별로 라운딩을 다르게 줘 캐주얼함을 표현(전부 rounded-2xl 통일 금지). 카드 중간(14px), Primary 버튼·배지 캡슐형(pill), 인풋 각진(10px).
3. 정보 밀도 높은 리스트/카드 UI.

## AI 슬롭 안티패턴: 하지 마라
| 금지 | 이유 |
|---|---|
| `backdrop-filter: blur()` (glass morphism) | AI 템플릿의 가장 흔한 징후. **예외 하나**. RN 하단바는 iOS 26 의 ‘Liquid Glass’ 재질(`expo-glass-effect`)을 쓴다([[ADR-132]] 정정 13). 금지가 겨눈 것은 *CSS 로 흉내 낸* 반투명 판이고, 그쪽은 **플랫폼이 제공하는 재질**이라 다른 물건이다 |
| gradient-text | AI SaaS 랜딩 1번 특징 |
| "Powered by AI" 배지 | 장식, 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = 슬롭 |
| 보라/인디고 브랜드 색 | "AI=보라" 클리셰 |
| 모든 카드 동일 rounded-2xl | 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | 모든 AI 랜딩에 있는 장식 |

## 색상: 기본 팔레트
테마 시스템(아래 [features/theme.md](../features/theme.md)) 도입 전/미선택 시의 폴백 값. 배경·보더·텍스트 모두 순수 무채색 대신 오렌지 쪽으로 살짝 기운 웜뉴트럴.

**배경**. 라이트(기본): 페이지 `#FFF9F4`, 카드 `#FFFFFF`, 보더 `#F0DFD1`, 보더(연함) `#F7EDE3`. 다크(보조): 페이지 `#0a0a0a`, 카드 `#141414`, 보더 `#262626`.
**텍스트**. 라이트: 주 `#2B1B10`, 본문 `#5B4636`, 보조 `#8A7362`, 비활성 `#B7A490`. 다크: `text-white`/`neutral-300`/`neutral-400`/`neutral-500`.

**Primary(강조)**: 채움 `#FF7033`(hover `#E6652E`, active `#C75728`). 텍스트/아이콘: 라이트 배경 `#C2410C`, 다크 배경 `#FF7033`. Subtle 배경 라이트 `#FFE9DB`/다크 `#FF7033/15`. Border 라이트 `#FFC9A8`/다크 `#FF7033/40`.

> **채움 위 전경색을 고정하지 않는다** ([[ADR-064]] 결정 1). 이 절의 옛 규칙("채움으로 쓸 때 텍스트는 짙은 `#2B1206`")과 코드에 굳어 있던 `text-white`·`text-bg` 는 모두 **"primary는 충분히 어둡다"를 전제**한 것이라 폐기했다. 밝은 파스텔 primary 테마도 어두운 primary 테마도 성립해야 하므로, 채움 위 전경은 항상 `on-primary`·`on-secondary`·`on-third`·`on-error` 토큰을 쓴다. 마찬가지로 accent 계열 텍스트·아이콘은 `*-ink`, 옅은 배경은 `*-tint` 다. 이름 규칙과 대비 요구는 [features/theme.md](../features/theme.md).

**데이터/시맨틱 색** (라이트 배경은 텍스트용 짙은 버전 + 배지 배경용 옅은 버전):
| 용도 | 텍스트(라이트) | 배지 배경(라이트) | 다크 배경용 |
|---|---|---|---|
| 긍정/성공 | `#15803D` | `#DCFCE7` | `#22c55e` |
| 부정/에러 | `#B91C1C` | `#FEE2E2` | `#ef4444` |
| 중립/기본 | `#78716C` | — | `#525252` |

Primary는 브랜드 강조 전용: 성공/에러 상태 표시에는 쓰지 않는다(의미 혼동 방지). 실제 컴포넌트 에러 텍스트는 이 표가 아니라 테마 `error` 토큰([features/theme.md](../features/theme.md))을 쓴다.

**값의 증감: `rise`/`fall`** ([[ADR-087]] 결정 5): 위 표의 "긍정/부정"과 **다른 축**이다. 늘어난 것이 좋은 일이고 줄어든 것이 나쁜 일이라는 뜻이 아니라 방향만 말한다. 주식 신호 관례를 따라 **상승 빨강 · 하락 파랑**이고, `error`(빨강)와 색상은 가깝지만 한 화면에서 인접하지 않는다(실패는 토스트·`ErrorState`, 증감은 값 옆 칩).
```
riseTint/riseInk · fallTint/fallInk: 테마 토큰(고정 hex 아님)
휴 고정(rise 26 · fall 262) + mode 램프 + 표면 15% 혼합 틴트: error·info 와 같은 파생 방식
```
**고정 hex 를 쓰지 않는 이유**: 테마는 직업별로 만들어지고 라이트·다크가 섞여 있어, 한 쌍으로는 어느 한쪽에서 반드시 죽는다(라이트용 진한 빨강은 `#0B0B0B` 배경에서 안 읽히고, 다크용 밝은 파랑은 `#FFFFFF` 카드 위에서 뜬다). **방향이 없는 상태("같음")에는 신호색을 쓰지 않는다**. 빨강도 파랑도 거짓이므로 `primary` 계열(테마 색)로 둔다. 현재 사용처는 보스 수익 증감 칩 하나([features/boss-profit.md](../features/boss-profit.md)).

## 기본 컴포넌트
**카드**
```
라이트: rounded-[14px] bg-white border border-[#F0DFD1] shadow-[0_1px_2px_rgba(43,27,16,0.04),0_4px_12px_rgba(255,112,51,0.06)] p-6
다크:   rounded-[14px] bg-[#141414] border border-neutral-800 p-6
```
그림자는 검정이 아니라 텍스트·Primary색을 옅게 섞은 웜톤, 애니메이션 없는 정적 elevation.

**버튼**
```
Primary(테마 공통): rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-hover px-5 py-2.5
Outline:            rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text hover:bg-primary-tint
Text(라이트): text-[#8A7362] hover:text-[#5B4636]   Text(다크): text-neutral-500 hover:text-neutral-300
```
`Outline` 은 **주 CTA 옆/아래에 서는 부 동작**용이다(2026-08-08, 온보딩 API 키 화면의 "API 키 발급 방법 보기"가 첫 사용처: [features/onboarding.md](../features/onboarding.md)). `danger` 와 같은 테두리 pill 형태이되 색이 중립(`border`/`text`)이라 파괴적 동작과 헷갈리지 않고, hover 는 새 색을 만들지 않고 `primary-tint` 를 쓴다(선택 카드 hover 와 같은 값). 
**RN 에서 이 규정은 두 벌로 갈린다**([[ADR-198]] 결정 2). 상자 클래스는 `BUTTON_VARIANT_CLASS`, 글자 클래스는 `BUTTON_VARIANT_TEXT_CLASS` 이고 둘 다 `components/atoms/Button/variants.ts` 에 있다(결정 3). RN 은 글자 스타일이 상자에서 자식 `Text` 로 상속되지 않아서, 한 벌로 두면 라벨이 색도 굵기도 없이 그려진다. 에러는 안 난다.

호출부가 알아야 할 것도 그래서 갈린다.

- **글자 유틸(`text-*`·`font-*`)은 `className` 이 아니라 `textClassName` 으로 준다.** 상자에 주면 무시되고, 그때도 에러가 없다.
- **폭·정렬·간격은 호출부가 준다.** 변형은 색·테두리·여백·글자만 정한다([[ADR-198]] 결정 1). 라운딩만 예외로 atom 이 못박아 디자인 원칙 2 를 지킨다.
- **`hover:` 는 없다.** 네이티브에서 NativeWind 가 그 클래스를 조용히 버린다. 눌림 피드백은 `active:` 라는 다른 축이다([[ADR-198]] 결정 4).
- **외부 URL 로 나가는 버튼은 `role="link"` 를 준다.** 웹의 `<a>` 자리다. 겉모습만 빌리려고 변형 표를 직접 가져다 쓰지 않는다.

**입력 필드**
```
라이트: rounded-[10px] bg-white border border-[#F0DFD1] px-4 py-3 text-[#2B1B10]
다크:   rounded-[10px] bg-neutral-900 border border-neutral-800 px-4 py-3
```

## 공유 컴포넌트 (여러 기능이 함께 씀)

### 모달 (`components/Modal`): 2026-07-13
`CharacterTrackingPicker`/`DisconnectConfirm` 에서 반복되던 오버레이(`fixed inset-0 flex items-center justify-center bg-scrim`, 안쪽 카드 `onClick` `stopPropagation`)를 공용화. 스크림은 `bg-bg/70` 이 아니라 전용 `scrim` 토큰이다([[ADR-064]] 결정 6). 배경색을 반투명하게 깐 것은 밝은 테마에서 스크림이 약해진다. 기본은 카드(`rounded-[14px] border border-border bg-surface p-6`)를 제공하되, `card={false}` 면 위치 고정 래퍼만 남기고 카드 스타일 생략(자식이 자체 카드를 둘 때 카드-안-카드 방지). 설정의 계정 변경 모달·계정 선택 목록이 `card={false}` 로 재사용.

**스크림 위 패널의 바깥 테두리는 라이트 테마에서 배경보다 어둡게 눌러 가라앉힌다** (ADR-122, 2026-08-10). 테두리가 하는 일이 모드마다 반대이기 때문이다. 라이트는 배경 vs 표면 대비가 **18.8~19.7** 이라 가장자리가 이미 압도적이고 테두리는 **링**으로만 읽히는 반면, 다크는 **1.07~1.18** 이라 **테두리가 유일한 경계**다.
```
:root[data-mode='light'] .panel-on-scrim,
:root[data-mode='light'] .panel-on-scrim-parent > * {
  border-color: color-mix(in srgb, var(--color-border) 40%, var(--color-text));
}
```
- **방향이 핵심이다. 표면이 아니라 텍스트 쪽으로 민다.** 라이트 테마에서 모달 뒤는 검정이 아니라 **중간 회색**이다(스크림을 페이지 `bg` 위에 합성하면 머쉬맘 `#757269` · 렌 `#787373` · 엔버 `#796E73`). 원래 테두리는 그보다 **밝아서**, 표면 쪽으로 밀면 배경에서 더 멀어져 **밝은 링**이 된다(색거리 143 → 196). 텍스트 쪽으로 민다. 55% 면 배경과 거의 같은 색(거리 15~24)이고, 확정값 **40%** 는 배경보다 조금 더 어두워 링이 아니라 **가라앉은 가장자리**로 읽힌다.
- **클래스가 둘이다**: `.panel-on-scrim` 은 **테두리를 가진 패널 자신**(`Modal.Card`·자체 오버레이 패널), `.panel-on-scrim-parent` 는 **직계 자식이 패널**일 때(`Modal.Panel`). 합치면 `Modal.Card` **안쪽** 요소(테마 타일 보더 등)까지 바뀌는데 그것들은 표면 위라 대상이 아니다.
- 새 컴포넌트를 스크림 위에 올릴 때 **둘 중 맞는 것을 붙일 것.** 모드 신호는 `data-mode`(테마 스토어가 세운다). 테마 **이름**으로 분기하지 말 것([[ADR-064]] 결정 8).

### 진행률 링 (`components/atoms/ProgressRing`): [[ADR-204]] 정정 2 (2026-09-02)

원형 진행률은 **전부 이 아톰이 채운다**. `atoms/ProgressBar` 의 원형 짝이다.

```
<ProgressRing size stroke direction={'cw'|'ccw'} track fill progress={…} />
  progress={{ kind: 'continuous', ratio }}                 결정석 소진량
  progress={{ kind: 'segments', cleared, total, gap }}     보스 처치 칸 링
```

- **색을 프롭으로 받는다.** 링 색은 `className` 으로 못 준다. `react-native-svg` 의 도형이
  `cssInterop` 에 없고 등록해도 한 `<Svg>` 안에서 한 색만 통한다. 그래서 이 아톰은 테마를 안 읽는다.
- **`fill="none"` 을 도형마다 직접 적는다.** 이 아톰에서 `fill` 프롭은 찬 자리의 **색**이라 SVG 의
  `fill` 속성과 이름이 겹친다. 한 객체에 담아 펼치면 색이 그것을 덮어 `<Circle>` 이 `fill` 없이
  나가고, SVG 기본값이 검정이라 **링 안이 까맣게 칠해진다**.
- **채운 값이 0 이면 호를 아예 안 그린다.** `strokeLinecap="round"` 가 길이 0 인 호에 점 하나를 찍어
  아직 아무것도 안 했다는 것이 조금 했다로 보인다.
- 반원 둘로 가르는 링은 여기 없다. 그것만 `Path` 로 그리고 곡선 글자와 같은 중심을 읽어
  `organisms/CharacterPortrait/PortraitRing` 에 남는다.

### 캐릭터 초상화 (`components/organisms/CharacterPortrait`): [[ADR-204]] 정정 1 (2026-09-02)

얼굴 원 + 그 둘레의 링. **규격이 둘이고 프롭이 갈래마다 다르다**(판별 유니온).

```
<CharacterPortrait variant="rail"    ocid level rings isSelected onPress />   68×70
  얼굴 40 · 링 r26 · 아래 곡선 글자 한 줄 · 눌러서 캐릭터를 고른다

<CharacterPortrait variant="compact" clears={{cleared,total,label}} />        40×40
  얼굴 32 · 처치 한도만큼 쪼갠 칸 링 · 글자 없음
```

- **갈래를 프롭 한 벌로 합치지 말 것.** 치수 · 링 모양 · 글자 유무 · 누를 수 있는지가 전부 짝지어
  움직인다. 합치면 `compact` + 곡선 글자 같은 못 쓰는 조합이 타입에 남는다.
- **`compact` 의 40 은 못 바꾼다.** 보스 수익 아코디언 헤더가 12 + 40 + 12 = 64px 이고, 그 높이를
  지키려고 패딩을 줄인 것이 [[ADR-054]] 정정 6 이다.
- 링 세 가지는 `PortraitRing.tsx` 에 다 있다. 칸 링만 **자기 `<Svg>` 를 갖는다**. 좌표계를 통째로
  돌려 12시부터 반시계로 채우는데([[ADR-059]] 정정 2) 그 회전이 같은 `<Svg>` 안의 곡선 글자까지
  돌린다.
- **치수를 컴포넌트에 적지 말 것.** 두 규격의 치수는 `portrait-metrics.ts` 의 `PORTRAIT_RAIL` ·
  `PORTRAIT_COMPACT` 에 있다([[ADR-204]] 정정 3). `compact` 의 슬롯 40 은 얼굴 상자이면서 링이 서는
  테두리라 **두 파일이 같은 값을 읽는다**. 한쪽에 클래스로(`h-10 w-10`) 적어 두면 문법이 달라 검색으로도
  안 묶이고, 한쪽만 고쳤을 때 링이 얼굴을 파고든다.
- 디렉터리 안에서 **파스칼은 컴포넌트, 케밥은 표와 계산**이다. `CharacterPortrait` · `PortraitRing` ·
  `PortraitCaption` / `portrait-metrics` · `portrait-arc`.

### 캐릭터 아바타 (`components/molecules/CharacterAvatar`): [[ADR-204]] (2026-09-02)

캐릭터 얼굴을 원으로 그리는 자리는 **전부 이 부품을 쓴다**. 지금 아홉이다(캐릭터 행 · 계정 선택 ·
today 위젯 셋 · 초상화 두 규격 · 추적 그리드 · 드롭 시세 머리).

```
<CharacterAvatar imageUrl={…} name={…} size={36} className="shrink-0" fallback={…} />
  원        overflow-hidden rounded-full · 지름은 size
  그림      lib/face-crop 의 표로 300×300 전신 룩에서 얼굴만 확대
  폴백      그림이 없을 때 원 안에 그릴 것 (안 주면 빈 원)
```

- **손으로 다시 그리지 말 것.** 크롭 표를 `lib/face-crop` 으로 모은 뒤에도 사설 복사본이 셋 남았고
  그중 하나는 [[ADR-144]] 가 버린 값이었다. 원을 그리는 일까지 부품이 들어야 베낄 것이 안 남는다.
- **원에 배경색이 없다**([[ADR-188]] 결정 1). 넥슨 캐릭터 이미지가 투명 배경이라 회색이 그림 뒤로
  비친다. 바탕이 필요하면 폴백이 자기 몫으로 든다.
- **폴백은 부품이 안 고른다**([[ADR-204]] 결정 2). 지금 세 모양이 살아 있고 그중 둘은 각각
  [[ADR-144]](주황 원 + 흰 `?`)와 [[ADR-188]] 결정 1(레일의 머리글자)이 정한 것이다. 글자가 호출부에
  남아 [[ADR-152]] 결정 5 의 `fixed` 계약도 자리마다 그대로다.

### 바텀 시트 (`components/organisms/BottomSheet`): [[ADR-179]] (2026-08-29)

**시트는 다크에서 자기 표면을 한 칸 올린다.** 몸통이 `bg` 였을 때 스크림 깔린 배경과의 대비가
**1.03~1.05** 였다. 시트가 ‘자기가 덮고 있는 페이지와 같은 토큰’ 이라서다. 다크의 `bg` 는 이미
L 0.13~0.15 라 **스크림을 완전 불투명 검정으로 만들어도 1.07 이 천장**이고, 그래서 고칠 곳은
스크림이 아니라 시트다(라이트는 같은 코드가 4.18~4.29 로 멀쩡하다. 거기는 L 0.95→0.55 로
0.40 을 내려갈 수 있다).

```
시트 서브트리에 vars() 로 재선언 (definition.mode === 'dark' 일 때만, OKLCH L +0.09)
  --color-bg  --color-surface  --color-surface-2  --color-track      ← 넷을 함께
껍데기  rounded-t-[20px] bg-<올린 bg>    ← 테두리 없음
핸들    h-1 w-9 bg-border-strong (시트 첫 자식, 절대 배치)
```

- **넷을 함께 올리는 것이 핵심이다.** 몸통만 올리면 시트 안 `bg-surface` 타일이 몸통과 **같은
  색**이 되고(1.00), 몸통을 더 올리면 이번엔 타일이 몸통보다 **어두워진다**. 계열째 올려야
  안쪽의 위아래 관계가 그대로 남는다. 그래서 **시트 안 코드는 한 줄도 안 고친다**(`bg-bg`·
  `bg-surface`·`bg-surface-2` 가 전부 그대로 살아 새 기준을 따른다).
- 한 칸은 **OKLCH L +0.09**. `.media-scope` 가 `surface → surface-2` 를 벌릴 때 쓰는 폭과 **같은
  수**다. 새 눈금을 만들지 않는다.
- **위 테두리 1px 을 안 그린다**([[ADR-039]] 결정 2 의 `border-t border-border` 폐기). 그 선은 면이
  경계를 못 만들던 시절의 대타였고, 몸통이 밝아진 지금은 뜬 줄 하나로 남는다.
- **분기는 `definition.mode`**. 테마 **이름**으로 가르지 말 것([[ADR-064]] 결정 8).
- `backgroundStyle` 은 우리 서브트리 **밖**(라이브러리 소유)이라 변수가 안 닿는다. 같은 계산의
  `bg` 를 **값으로** 넘긴다.
- 대비는 1.19~1.25 로 오르지만 **수치보다 ΔL(0.133~0.139)이 눈에 가깝다**. 새까만 근처에서 WCAG
  비는 분모의 `+0.05` 항이 지배해 눌린다([[ADR-064]] 가 대비를 ‘관문이 아니라 참고 수치’로 둔 자리).

### 파티 인원 모달: `PartySizeModal`, [[ADR-121]] (2026-08-10)
보스 스케줄러 카드를 탭하면 열린다. 난이도 + 파티 인원을 함께 다룬다. 정책은 [../features/boss-scheduler.md](../features/boss-scheduler.md) '파티 인원 모달'.

```
패널   Modal.Panel maxWidth="max-w-2xs"(288) · align="center"
       (center 는 키보드를 안 띄우는 모달만: Modal 기본은 'top')
껍데기 rounded-[14px] border border-border bg-surface overflow-hidden   ← 일러스트가 모서리를 넘는다
히어로 media-scope · h-22(88) · bg-surface(= media-surface)
       일러스트 absolute inset-0, 카드와 같은 필터·불투명도(saturate(.85) brightness(.8) / .65)
       마스크 linear-gradient(90deg,#000 0%,#000 42%,transparent 82%)  ← 카드는 38/76, 모달이 넓어 끝점만 뒤로
       베일   media-surface → transparent 세로 그라디언트(0% → 62%)
       닫기   우상단 32px 원, bg-surface/60 + text-text (스코프 안이라 media 토큰), aria-label="닫기"
       텍스트 키커 10px text-text-muted / 이름 text-xl font-extrabold text-text, 둘 다 ILLUSTRATION_TEXT_SHADOW_STYLE
경계   본문에 border-t border-border   ← media-scope **바깥**
본문   p-[18px] · 필드 간격 18
난이도 라벨 + 난이도 배지 세그먼트(미선택 = 같은 뱃지 + opacity-40)
파티   라벨 행: Users 14 + "파티 인원"(text-xs font-bold tracking-[.06em] text-text-muted)
              + Badge tone="primary" 로 `n / max` (tabular-nums)
       스테퍼: 전폭 h-10(40) rounded-full border-border bg-surface p-1
              버튼 32(아이콘 16, 채움 없음, 비활성 opacity-40) · 값 19px extrabold · 단위 "인" 12px
              가운데 min-w-[66px] + tabular-nums  ← 1↔6 에서 −/+ 가 안 움직인다
```

- **폭 288 은 하한이다.** 4난이도 보스(칼로스·카링·최초의 대적자)의 칩 한 줄이 약 225px 라 본문 폭 252 에 여유 27px 로 들어간다. `max-w-3xs`(256)는 본문 220 이라 접히고, 접히면 그 필드만 세로로 자라 **보스마다 모달 높이가 달라진다**. 288 은 **모든 기기에서 폭이 같다**는 성질도 갖는다. `max-w-sm`(384)은 오버레이 `px-4` 에 먼저 걸려 390 기기 358 / 360 기기 328 로 갈렸다.
- **히어로 경계선은 `media-scope` 바깥이다.** 다크 테마는 `media-surface ≈ surface` 이고 **검은마법사는 값이 완전히 동일**(`#1C1319`)이라 이 선이 유일한 경계다. 라이트 테마에선 어차피 대비가 17:1 이라 무해하다.
- **−/+ 버튼에 채움을 두지 않는다.** `surface-2` 는 표면과 대비 **1.14~1.30**(6테마 실측)이라 어느 테마에서도 원이 안 보인다. 경계는 pill 의 `border-border` 가 그린다.
- **라벨은 `text-text-muted`.** `text-disabled` 는 6테마에서 3.10~4.22 로 4.5:1 미달이다.
- **상한 표시는 `Badge tone="primary"`**. 주간 `n/12` 배지와 같은 컴포넌트다(신규 스타일 금지).
- **일러스트 없는 보스**(`portraitSlug: null`)는 히어로를 비운다. 단색 + 이름. 폴백 디자인 없음.

- **CSS 를 RN 으로 옮긴 값** (`components/molecules/FadedIllustration`). 웹이 쓰던 CSS 와 RN 값이
  같은지는 **옮길 때 한 번 확인했고, 그 결과가 이 표다.** 웹 소스는 [[ADR-155]] 로 없어져 더 갈릴
  원본이 없으므로 대조용 CSS 사본을 코드에 두지 않는다. 값을 바꾸려면 이 표와 부품을 함께 고친다.

  | 웹 CSS | RN |
  |---|---|
  | `filter: saturate(.85) brightness(.8)` | `filter: [{ saturate: 0.85 }, { brightness: 0.8 }]` |
  | `opacity: .65` | `opacity: 0.65` |
  | `mask-image: linear-gradient(90deg,#000 0%,#000 38%,transparent 76%)` (카드) | 표면색 그라디언트를 **뒤집어** 얹는다. `locations [0, .38, .76, 1]` · `alphas [0, 0, 1, 1]` |
  | 같은 마스크의 히어로판 (`42% / 82%`) | `locations [0, .42, .82, 1]` |
  | `text-shadow: 0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6)` | 그림자를 **하나만** 쓴다(RN `Text` 는 `textShadow*` 세 프롭이라 겹칠 수 없다). `constants/style/text-styles.ts` |

  RN 에는 `mask-image` 가 없다. 대신 **카드 표면색을 마스크의 반대 알파로 덧칠**하면 같은 색이
  나온다(근사가 아니라 식이 일치한다 — 근거는 부품 주석). 마지막 정지점 `1` 은 웹에 없는데,
  `expo-linear-gradient` 가 정지점 **사이만** 보간해서 안 적으면 끝점 뒤가 안 덮이기 때문이다.

**스테퍼 `size` 변형** ([[ADR-121]]). 같은 레시피(보더 pill + `Users` + −/값/+)에 크기만 둘이다.
```
compact  pill 28 · 버튼 24 · 아이콘 14 · 값 14 · 안쪽 Users 14   보스 관리 페이지 행(우상단)
default  pill 40 · 버튼 32 · 아이콘 16 · 값 19 · 단위 "인" 12    파티 인원 모달(전폭)
```
- `compact` 는 **기존 관리 페이지 행의 값 그대로**다(이번에 크기를 바꾸지 않았다).
- `default` 는 단위 "인"을 함께 그리고 **`Users` 를 스테퍼 안에 두지 않는다**. 모달은 라벨 줄에 `Users` 가 이미 서 있어 한 화면에 두 번 나오면 중복이다. 값 슬롯은 `min-w-[66px]` + `tabular-nums` 라 1↔6 을 오가도 −/+ 가 제자리다.
- 두 크기 모두 버튼이 권장 타깃 44px 보다 작으므로 **히트 영역을 패딩으로 넓힌다**(시각 크기는 유지).

### 캐릭터 카드 그리드(다중 선택): `CharacterTrackingPicker`, [[ADR-015]]

> **이 모양은 떠났다**([[ADR-144]], 2026-08-16). 3열 그리드 모달이 **두 층의 페이지**가 됐다. 아래 그리드 서술은 기록이다. 두 층 다 **가로 행 카드**(얼굴 + 1줄 ‘[월드 엠블럼] 이름’ + 2줄 ‘Lv.294 아크메이지(썬, 콜)’)이고 갈리는 것은 좌우 슬롯뿐이다. 위(계정을 넘는 ‘선택됨’)는 왼쪽에 **가로 3줄 끌기 핸들**, 오른쪽에 `★`(대표)·`✕`, 아래(계정 하나의 후보)는 오른쪽에 `＋` 하나. **직업이 카드에 선다**. [[ADR-015]] 결정 2의 ‘직업 미표시’는 3열 칸이 좁다는 근거였고, 행 카드에는 그 제약이 없다([[ADR-144]] 결정 2). **선택이 ‘별 토글’이 아니라 ‘카드 이동’** 이라 후보 카드에는 별이 없다. 아래 명세는 **웹뷰 앱**의 것이고, 살아남는 것은 얼굴 크롭 기법([[ADR-015]])·엠블럼 규칙·레벨 내림차순 정렬이다.

"캐릭터 관리" 피커. 컨텐츠/보스 스케줄러가 동일 컴포넌트 공유. **3열 그리드**, 카드 자체가 토글 버튼(체크박스 없음, `aria-pressed`).
```
카드: rounded-[14px] border, 선택 시 border-primary bg-primary-tint, 미선택 시 border-border hover:bg-primary-tint
아바타 프레임: 56px 원형 overflow-hidden, 확대된 <img> 절대 위치로 얼굴 크롭 (max-w-none 필수: preflight img{max-width:100%}가 확대를 눌러버림)
즐겨찾기: lucide Star, top-1.5 right-1.5. 미선택 text-text-muted 아웃라인 / 선택 fill-primary text-primary
텍스트: 이름 text-xs font-semibold text-text + 서버 엠블럼(h-3.5), 레벨 text-xs text-text-muted (직업 미표시)
```
정렬: **즐겨찾기(선택) 먼저, 그다음 나머지**, 각 그룹 내부 레벨 내림차순: 즐겨찾기 토글 시 즉시 재배치. `character/basic` 실패 캐릭터는 "?" 플레이스홀더 + 이름·레벨 유지(선택 가능). 단 [[ADR-053]] 이후 이 폴백은 **캐시가 있는 캐릭터에만** 적용된다(캐시도 없고 조회도 실패한 캐릭터는 `access_flag` 를 확인할 길이 없어 목록에 아예 넣지 않는다). 서버 엠블럼은 `lib/assets/asset-lookup`(데이터 `world-emblems.json`) 재사용, world 없거나 미매핑이면 생략. 모달 헤더(제목+설명 `mb-4 space-y-1`), **이 모달은 오버레이 클릭으로 닫히지 않음**(닫기/저장 버튼만, 자체 오버레이라 이 모달에만 적용).

**모달 높이와 스크롤포트 (ADR-107, 2026-08-06)**: 카드 높이의 상한은 **안전영역을 뺀 화면**이고, 스크롤포트는 그리드가 아니라 **쓰는 쪽**이 갖는다([[ADR-099]] 가 화면 스크롤에 세운 규칙과 같다. 인디케이터는 콘텐츠가 아니라 스크롤포트 위에 그려지므로, 스크롤포트가 카드 `p-6` 안쪽이면 인디케이터도 24px 안쪽에 뜬다).
```
오버레이: fixed inset-0 z-50 flex items-center justify-center bg-scrim
          px-4 pt-[calc(1rem+var(--sa-top))] pb-[calc(1rem+var(--sa-bottom))]   ← 안전영역 + 1rem 여백
카드:     flex max-h-full w-full max-w-sm flex-col p-6   (헤더·푸터 shrink-0: 줄어드는 것은 본문뿐)
스크롤포트(모달):   -mr-6 min-h-0 overflow-y-auto pr-6   ← 음수 마진이 카드 테두리까지 넓혀 인디케이터를 끝에 붙이고,
                                                          같은 크기 패딩이 콘텐츠 여백을 되돌린다
스크롤포트(온보딩): max-h-[70vh] overflow-y-auto        ← 페이지라 상한이 스스로 필요하다
```
스탈 배너는 스크롤포트 **밖**에 둔다(목록을 굴려도 "최신이 아님"은 계속 보인다). `CharacterTrackingGrid` 자신은 상한도 스크롤도 갖지 않는다.

**로딩/빈/실패 상태 ([[ADR-053]], 구현 완료 2026-07-29)**: 그리드에 항목이 없을 때 세 경우를 구분해 그린다(빈 상태로 위장 금지, [error-resilience.md](./error-resilience.md) 원칙 1·2). 항목이 하나라도 있으면 조회 중이어도 기존대로 그리드만 그린다(ADR-016 캐시 우선 표시를 스피너로 가리지 않는다). 어느 상태인지는 `getCharacterPickerRoster` Promise의 resolve/reject로 호출부가 판정해 필수 props `isLoading`·`loadFailed` 로 내려준다(정책 원문 [../features/content-scheduler.md](../features/content-scheduler.md)).
```
공통 자리: flex min-h-[120px] items-center justify-center (그리드 자리 중앙)
조회 중:   MapleSweepSpinner size={32} text-primary, 래퍼에 role="status" aria-busy="true" aria-label="캐릭터 목록을 불러오는 중"
           (모달·페이지 안이라 셸 승계 카드는 씌우지 않는다. 위 "로딩 표현" 참고, [[ADR-061]])
조회 실패: 공용 ErrorState (아래 "실패 상태" 절, [[ADR-062]])
항목 0건: text-sm text-text-muted "표시할 캐릭터가 없어요"
```
**본문 자리 높이는 카드 3줄로 못 박는다**. `ROSTER_BODY_MIN_H`(`min-h-[385px]`, `CharacterTrackingGrid`에서 export). 실측 385px = 카드 123px × 3 + `gap-2` 8px × 2. 슬롯은 `flex flex-col`이고 중앙 정렬 분기(스피너·실패·빈 상태)는 `flex-1`로 그 높이를 채운다(그리드는 위쪽 정렬). **모달에서는 이 최소 높이를 클램프한다**. `min-h-[min(385px,calc(100dvh-var(--sa-top)-var(--sa-bottom)-15rem))]`. CSS 에서 `min-height` 는 `max-height` 를 이기므로 385px 를 그대로 두면 위 카드 상한이 짧은 기기에서 무효가 된다(ADR-107 결정 2: 클램프는 385px 가 애초에 안 들어가는 기기에서만 발동한다). 온보딩은 페이지라 클램프 없이 `ROSTER_BODY_MIN_H` 그대로다. 이 고정이 없으면 상태마다 높이가 달라 아래 CTA(온보딩 "계속하기", 모달 "닫기·저장")가 위아래로 움직이고, 실패 상태의 액션 버튼이 CTA에 붙어 보인다(사용자 보고 2026-07-30). [[ADR-054]] 정정 4에서 라벨행을 `h-6`으로 명시 고정한 것과 같은 처방이다.
실패는 원인(`loadError: ScheduleSyncError | null`)을 받아 원인별 문구·액션을 그린다. 자세한 것은 아래 "실패 상태" 절([[ADR-062]]). **보여줄 항목이 있는 채로 실패하면** 목록을 지우지 않고 그 위에 스탈 배너를 얹는다. 온보딩 캐릭터 선택 단계(`ContentCharacterStep`)는 같은 분기를 페이지에서 직접 그리며 액션만 다르다(온보딩 중에는 설정 화면이 없다, [onboarding.md](../features/onboarding.md)).

### 빈 상태 (`components/EmptyState`): [[ADR-060]], 구현 완료 2026-07-29
"비어있음"을 표시하는 11곳이 이 컴포넌트 하나를 쓴다. `size` 두 변형만 다르고 구조는 동일: **원형 배지(컨텍스트 아이콘) + 제목 + 설명 + CTA**, 중앙 정렬.
```
공통:   flex flex-col items-center text-center, 배지 rounded-full bg-primary-tint, 아이콘 text-primary-ink strokeWidth 1.75
page:   배지 84px / 아이콘 40px / 제목 text-base / 설명 text-sm max-w-[220px] / CTA px-5 py-2.5 text-sm / gap-4
inline: 배지 56px / 아이콘 28px / 제목 text-sm  / 설명 text-xs max-w-[240px] / CTA px-4 py-2 text-xs / gap-3
        + 박스 rounded-[14px] border border-border bg-surface px-4 py-8 (page 는 자체 박스 없음. 화면이 감싼다)
CTA:    rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-hover (Primary 버튼 재사용, 새 스타일 금지)
```
- **배지 안 마크는 자리에 따라 둘로 갈린다**([[ADR-060]] 결정 2): **목록 빈 상태(inline)는 화면별 컨텍스트 아이콘**. 컨텐츠 `ListChecks` · 보스 `Swords` · 필터 `SlidersHorizontal` · 수익 `ProfitIcon`(커스텀, [[ADR-066]]) · 드롭 `PackageOpen`. 목록 자리는 "무엇이 비었는지"를 알려야 하기 때문. **캐릭터 미선택(page)은 브랜드 마크(단풍잎, `icon="leaf"`)**. 화면 전체를 차지하는 자리라 앱의 얼굴 역할을 겸한다(사용자 결정).
- **문구 규칙**: 제목은 *무엇이* 비었는지(`추적할 일간 컨텐츠가 없습니다` / `등록된 주간 보스가 없습니다`). 탭·모드별로 문구를 나눈다(일간/주간, 주간/월간, 수동/자동이 같은 문구를 공유하지 않는다). 설명은 다음 행동 한 줄. CTA 라벨은 목적지 이름 그대로(`컨텐츠 관리`·`보스 관리`).
- **CTA는 문구가 지시하는 곳으로 실제 이동시킨다**. 수동 모드 컨텐츠 `/content/manage`, 수동 모드 보스 `/boss/manage`, 필터 결과 없음은 필터 초기화. **갈 곳이 없으면 CTA를 만들지 않는다**: 자동 모드("게임에서 등록해주세요")는 목적지가 앱 밖이고, 보스 수익 "아직 처치한 보스가 없습니다"는 앱 안에 할 일이 없다. 억지 목적지 금지.
- **"조회 불가"에는 이 컴포넌트를 쓰지 않는다**. 아래 `UnavailableNotice` 참고([error-resilience.md](./error-resilience.md) 원칙 2).
- 배지(둥근 배경 박스)는 아래 "아이콘" 절의 *배경 없이 단독* 규칙에 대한 **명시적 예외**다. 빈 상태 배지는 아이콘이 아니라 **일러스트 자리**로 취급한다.

### 로딩 표현 (`molecules/LoadingState`, `atoms/Spinner`): [[ADR-061]], 구현 완료 2026-07-30
"기다리는 중"을 표시하는 모든 자리가 지키는 규칙. 세 상태(**조회 중 / 확정된 빈 상태 / 확인 불가·실패**)는 항상 서로 구분 가능해야 한다([error-resilience.md](./error-resilience.md) 원칙 2). 그래서 로딩은 빈 상태의 어법(점선 박스·배지+CTA)을 쓰지 않는다.

**스피너는 2종, 크기로 갈린다.**
```
버튼 내부(16px)      MapleSpinner        단풍잎 외곽선 둘레의 70% 구간이 도는 comet
그 밖(24·32px)       MapleSweepSpinner   흐린 잎 위로 밝은 띠가 아래→위로 훑고 지나간다
```
스윕이 16px에서 안 읽히고(띠가 잎보다 커져 바탕만 남아 비활성처럼 보인다) 트레일 링이 32px를 못 채우기 때문: 두 크기 대역의 요구가 반대라 한 시안으로 덮이지 않는다. 스피너 색은 `text-primary`, 대기 문구는 `text-sm text-text-muted`.

**RN 의 스윕 띠는 `userSpaceOnUse` 마스크이고 램프가 띠와 함께 움직인다** ([[ADR-061]] 정정 1, 2026-08-18). `maskContentUnits="objectBoundingBox"` 는 **쓰지 말 것**. `react-native-svg`(15.15.4)가 그 속성을 렌더 시 안 읽어(안드로이드 `RenderableView.java` · iOS `RNSVGRenderable.mm` 둘 다 `maskUnits` 만 본다) 마스크 내용이 user space 로 그려진다. `<Rect width={1} height={1}>` 이 **1×1 픽셀**이 되어 마스크가 투명해지고 `DST_IN` 이 띠를 통째로 지운다. 실기기에서 **띠가 한 번도 보인 적이 없었다**(두 플랫폼 다). 웹은 그라디언트를 `fill` 에 직접 걸어 브라우저가 그 단위를 지원하므로 같은 함정이 없다.
```
마스크 범위    maskUnits="userSpaceOnUse" + 띠와 같은 x/width, y 는 bandY 를 따라간다
마스크 내용    <AnimatedRect>가 같은 bandY 를 본다. 램프가 띠에 딸려 간다
움직이는 값    shared value 하나에서 둘 다 파생 (어긋날 자리가 없다)
```
**로스터 대기 두 자리에는 문구를 둔다** ([[ADR-061]] 정정 2). 온보딩 캐릭터 목록 · 캐릭터 관리 피커. 예전엔 `aria-label` 만 뒀는데(배정표 2·4) 그 결정의 전제가 ‘띠가 움직인다’ 였고, 콜드 캐시에서는 `character/basic` 을 캐릭터 수만큼 부르느라 대기가 길어 마크만으로는 무엇을 기다리는지 전달되지 않는다. **카드 껍데기는 여전히 안 씌운다**(아래 ‘셸 승계 카드’의 범위 밖).

**셸 승계 카드 (`components/LoadingState`)**. 콜드 스타트와 영역 부분 로딩이 공유한다. 로딩이 끝나면 그 자리를 채울 카드와 **같은 껍데기**라 결과가 들어와도 배경이 바뀌지 않는다(스켈레톤 없이 "자리를 미리 잡는" 효용을 얻는 지점).
```
공통:   rounded-[14px] border border-border bg-surface p-6
        + flex flex-col items-center justify-center gap-3 text-center
        + 래퍼에 role="status" aria-busy="true"
page:   스피너 32px, min-h-[132px]. 스케줄러 3화면 콜드 스타트, 컨텐츠·보스 관리 화면 최초 진입
inline: 스피너 24px:             보스 수익 과거 기간 백필
```
- **목록·카드가 들어올 자리에만 쓴다.** 모달 안(캐릭터 관리 피커)이나 화면 전체 대기(온보딩 시드·예열)는 이미 자기 껍데기가 있거나 뒤에 카드가 오지 않으므로 카드를 씌우지 않고 **스피너 + 문구만** 둔다.
- **캐시가 남아 있으면 쓰지 않는다**. 재검증(SWR) 중에는 기존 내용을 그대로 보여준다(ADR-016). 이 카드는 "보여줄 것이 하나도 없을 때"만.

**버튼 내부 대기**. `<Button busy={isBusy}>확인</Button>` 하나로 끝난다([[ADR-061]] 정정 3). 라벨이 `opacity-0` 으로 가려지고 그 자리에 `MapleSpinner size={16}` 이 겹쳐 그려진다. **호출부가 스피너를 직접 넣지 않는다.**

- **라벨을 지우지 않고 가리는 이유가 둘이다.** 대기 전 폭이 그대로 남아 버튼이 안 줄어들고, 스크린리더는 라벨을 그대로 읽는다.
- **스피너 색은 `Button` 이 정한다.** variant 의 라벨 색과 같은 토큰이고 호출부가 못 어긴다. 손으로 주던 시절 여섯 곳 전부 색을 안 줘서 검정으로 떨어져 있었다.
- `aria-busy` 는 `busy` 가 켠다. `disabled` 는 호출부 몫이다 — 대기 중에 못 누르게 하는 것은 버튼 모양이 아니라 화면의 판단이다.

**문구 규칙**. 말줄임표가 붙는 `~중...`은 **새로고침 옆 `조회 중...` 한 곳**에만 남는다(그 자리는 "마지막 동기화 3분 전" 시각 표시를 잠시 대체하는 라벨이라 짧아야 한다).
```
버튼 안:  라벨이 가려져 문구가 없다 ([[ADR-061]] 정정 3)
그 밖:    ~하고 있어요          불러오고 있어요 · 캐릭터 정보를 준비하고 있어요 (N/M)
말줄임표: ...(마침표 3개)로 통일. …(1글자) 금지
```

**쓰지 않는 것**: 점선 박스(빈 상태 전용) · 스켈레톤(미도입) · 비-브랜드 CSS 링 스피너 · `MapleWaveProgress`(폐기) · 진행률 바 `h-2` 변형(폐기). 새로고침 아이콘(`RefreshCw`)의 회전은 스피너가 아니라 **기능 신호**라 교체 대상이 아니다.

### 조회 불가 알림 (`components/EmptyState/UnavailableNotice`): [[ADR-060]]
확인 자체를 못 한 상태(보스 수익 롤링 조회 윈도우 밖, [[ADR-032]])는 빈 상태와 **디자인을 공유하지 않는다**. 같은 모양이면 "데이터가 없다"로 오해된다. 톤은 경고(error)가 아니라 **정보**: 사용자가 고칠 수 있는 실패가 아니라 API의 알려진 제약이라 error 색은 과하다.
```
기본:    flex items-start gap-3 rounded-[14px] border border-border bg-info-tint p-4
         + Info 아이콘(h-5 text-info-ink) + 제목 text-sm font-semibold + 설명 text-xs text-text-muted
compact: 카드 안에 중첩될 때. rounded-[10px] bg-surface-2 px-3 py-2.5, 아이콘 h-4, 제목 한 줄만(설명 생략)
```
문구 어미는 실패와 같은 `~습니다` 를 쓴다([[ADR-062]] 결정 5). 정보 톤은 **색(info-tint)이 담당하지 어미가 담당하지 않는다**.

**선택 카드 안의 주의 줄은 이 규격의 축소판이되 컴포넌트를 공유하지 않는다** ([[ADR-035]] 결정 22, 2026-08-03). 트래킹 모드 옵션(온보딩 `TrackingModeStep`·설정 `TrackingModeSelector`)이 각 모드의 한계를 고지하는 자리: `rounded-[8px] bg-info-tint px-2.5 py-1.5 text-xs text-info-ink` + `Info h-3.5`. 색·아이콘·"고칠 수 없는 제약이므로 error 가 아니다"는 판단을 그대로 물려받는다. 이 컴포넌트를 재사용하지 않는 이유는 **`UnavailableNotice` 가 문구를 자기 안에 고정으로 갖기 때문**이고(임의 문구를 못 받는다), 어미도 `~습니다` 가 아니라 **같은 카드 안 설명문과 맞춘 `~요`** 다(한 카드 안에서 어미가 갈리면 두 문장이 다른 출처처럼 읽힌다). 규격 전문은 [../features/settings.md](../features/settings.md).

### 실패 상태 (`components/ErrorState`): [[ADR-062]]
로딩·빈 상태·조회 불가에는 공용 컴포넌트가 있는데 실패에만 없어 화면마다 `text-error` 한 줄을 각자 갖고 있던 것을 통일한다. 세 상태(**조회 중 / 확정된 빈 상태 / 확인 불가·실패**)는 항상 구분 가능해야 하므로([error-resilience.md](./error-resilience.md) 원칙 2) 빈 상태와 **디자인을 공유하지 않는다**.

| | 아이콘 | 색 | 정렬 | 액션 |
|---|---|---|---|---|
| `EmptyState` | 원형 배지 **안** | 브랜드(primary) | 중앙 | 목적지가 앱 안에 있을 때만 |
| `UnavailableNotice` | 단독 `Info` | 정보(info-tint) | 좌측 | 없음(고칠 수 없음) |
| **`ErrorState`** | **단독** `AlertTriangle` | 경고(error) | 중앙 | **항상** |

```
flex min-h-[120px] flex-col items-center justify-center gap-3 px-4 text-center
+ AlertTriangle h-7 w-7 text-error-ink (배지 없이 단독)
+ 제목 text-sm font-semibold text-text
+ 설명 text-xs text-text-muted (mx-auto max-w-[240px])
+ 액션 rounded-full bg-primary text-on-primary px-4 py-2 text-xs
```
- **배지를 쓰지 않는다**. 아래 "아이콘" 절의 *배경 없이 단독* 규칙을 그대로 따른다(예외를 늘리지 않는다). 그 결과 배지 유무만으로 빈 상태와 즉시 갈린다.
- **`ErrorState` 자신은 배경을 두지 않는다**. 색은 아이콘에만, 배경은 감싸는 쪽 카드에 맡긴다. 재시도 버튼은 파괴적 동작이 아니라 진행 동작이라 `bg-primary`(삭제 버튼의 `border-error text-error-ink` 와 구분). ~~`error-tint` 토큰을 만들지 않는다~~ 는 [[ADR-064]] 결정 2로 폐기됐다. `error-tint` 는 `color-mix` 파생이라 테마당 추가 비용이 0이고, 아래 스탈 배너가 쓴다.
- **자체 카드·크기 변형이 없다**. 적용처 두 곳이 모두 이미 껍데기 안이다(피커=모달 카드, 온보딩=페이지). `LoadingState` 를 이 두 자리에 씌우지 않는 것과 같은 판단([[ADR-061]]).
- **원인별 문구·액션**은 자리에 따라 갈린다. 피커의 `invalidApiKey` 는 **액션 없음**(화면이 곧 키 입력으로 이동해 누를 것이 없다, [[ADR-115]] 결정 7 · 2026-08-08: 옛 `설정 열기` 는 설정에 키를 바꿀 자리가 없어 거짓이었다), 나머지는 다시 시도. 온보딩의 401 만 **다시 시도**를 유지한다(무효화 경로가 성립하지 않는 자리라 재시도가 실제 처방이다, [[ADR-115]] 결정 6). 표는 [[ADR-062]] 결정 3.
- **429에는 액션 자체를 주지 않는다**([[ADR-114]] 결정 2, 2026-08-08). 처방이 재시도가 아니라 **키 단계 확인**이기 때문이다. 문구는 제목 `호출 한도를 초과했습니다` / 설명 `입력하신 API 키가 서비스 단계 키인지 확인해주세요`(결정 1). `characterUnavailable` 의 액션 없음도 그대로다. 401(피커)의 "설정 열기"는 그때 유지됐으나 [[ADR-115]] 결정 7 로 **액션 없음**이 됐다(위 줄).

**어디에 띄우는가 ([[ADR-063]])**. 기준은 하나다: **그 문구가 사라진 자리에 남는 것이 있는가.** 남으면 실패는 이벤트이므로 **토스트**(액션을 붙일 수 있다), 문구 자체가 그 자리의 내용이면 **인라인**(`ErrorState`). 판정 근거와 자리별 목록은 [error-resilience.md](./error-resilience.md) 원칙 4.
- **토스트로 옮긴 것**: 스케줄러 3화면의 동기화 전체 실패(새로고침 옆 "n분 전"이 지속 상태를 담당) · 보스 수익의 파티원 수 저장 실패(스테퍼가 남는다) · 일부 캐릭터 실패(이름 대신 인원 수: 본문이 `truncate`라 나열하면 잘린다) · 스케줄러 두 화면의 **캐릭터별** 동기화 실패 · 보스 수익 기간 로드 실패(**카드가 있을 때만**) · 온보딩 계정 선택 실패([[ADR-083]]).
- **인라인으로 남는 것**: 피커 · 온보딩 캐릭터 선택 스텝 · 계정 플로우 카드 · 조회 불가·집계 전 안내 · 설정 행의 값 · 보스 수익 기간 실패(**카드가 없을 때**) · 드롭 히스토리 로드 실패.
- 토스트 액션도 같은 규칙이다. `network`는 **다시 시도**, `rateLimited`는 **액션 없음**, `characterUnavailable`은 **액션 없음**(영구 실패라 눌러도 같은 400, [[ADR-083]] 결정 2). `invalidApiKey` 는 **동기화 훅이 토스트를 아예 띄우지 않는다**. 키 무효화 진입점이 자기 문구(`API 키가 더 이상 유효하지 않습니다`)를 **액션 없이** 띄우고 화면을 키 입력으로 옮긴다([[ADR-115]] 결정 1·7, 2026-08-08).
- **토스트 액션 아이콘**: 액션 슬롯은 아이콘만 보이고 `label` 은 `aria-label` 로만 쓰인다. 기본 아이콘(`RefreshCw`)이 "다시 시도"를 전제하므로 **뜻이 다른 액션은 `ToastAction.icon` 으로 자기 아이콘을 넘긴다**. "설정 열기"에 새로고침 아이콘을 쓰면 무엇을 하는 버튼인지 어긋난다([[ADR-063]]).

**스탈 배너**. 보여줄 항목이 있는 채로 실패했을 때. 목록을 지우지 않고 그 위에 한 줄로 얹는다.
```
mb-3 flex items-center gap-2 rounded-[10px] bg-error-tint px-3 py-2.5
+ AlertTriangle h-4 text-error-ink + 문구 text-xs text-text + (선택) 우측 액션 text-xs font-semibold text-primary-ink
```
- **문구도 액션도 원인별로 갈리고, 액션은 없을 수 있다**([[ADR-114]] 결정 3, 2026-08-08). 배너는 `message` 와 **옵셔널** 액션을 받고 `ScheduleSyncError` 를 직접 받지 않는다(molecule 이 feature 어휘를 알면 안 된다. [[ADR-094]] 결정 2). 포맷은 호출부가 `formatStaleRosterError(error, place)`(`features/schedule-sync/format.ts`)로 한다. 원인별 표는 [../features/content-scheduler.md](../features/content-scheduler.md).
- **액션이 없어도 되는 이유는 자리에 있다**. 배너 아래에 목록이 그대로 남아 있어 막다른 길이 아니다. 같은 401 이 `ErrorState`(온보딩)에서는 재시도를 유지하는 것이 같은 근거의 뒷면이다(그쪽은 목록이 없어 액션을 빼면 화면에 아무 길도 없다).

### 앱 전역 폴백 (`components/ErrorBoundary`): [[ADR-065]]
렌더 중 예외로 화면이 죽었을 때. 이 자리에는 남는 것이 아무것도 없으므로 화면 전체를 채운다.
```
flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center
+ AlertTriangle h-10 w-10 text-error-ink (배지 없이 단독: ErrorState와 같은 어법)
+ 제목 text-base font-semibold text-text
+ 설명 text-sm text-text-muted (mx-auto max-w-[260px])
+ '다시 시작' 버튼 하나 (RotateCcw + bg-primary, max-w-[260px])
```
- **선택지를 하나만 둔다**. 설정 열기·스택트레이스 노출·브랜드 마크 모두 없다. 이 화면의 목적은 복구 도구를 주는 게 아니라 **흰 화면을 없애는 것**이고, 리로드로 안 풀리는 크래시의 탈출구(OS의 앱 데이터 삭제·재설치)는 앱 밖에 있다.
- 크래시 리포팅은 미도입([error-resilience.md](./error-resilience.md) 원칙 7은 여전히 미구현).

### 캐릭터 관리 저장 진행률 모달: 2026-07-16
"저장" 시 추적 캐릭터마다 `syncSchedules` 순차 호출하는 동안 캐릭터 관리 모달 **위에** 진행률 모달을 띄우고 완료 시 함께 닫는다. 진행률 바 스타일은 온보딩 예열 바와 동일(track `h-1.5 w-full rounded-full bg-track` + fill `h-1.5 rounded-full bg-primary`) + "캐릭터 정보를 저장하고 있어요 (N/M)". 공용 `Modal` 재사용, 저장 도중 오버레이 클릭 무시(완료 시 프로그램적으로만 닫음). 콜백 `saveTrackedOcids → refresh → syncSchedules` 로 `onProgress(completed, total)` 전달. 개별 실패는 조용히 폴백, 전역 에러면 화면 에러 상태 전환.

### 캐릭터 초상화 레일: [[ADR-142]], 2026-08-16
**네 화면**(스케줄러 둘 · 관리 둘)에서 드롭다운을 대신하는 컨트롤: 그 드롭다운은 RN 에서 지워졌다. 추적 캐릭터를 원형 초상화로 한 줄에 늘어놓고, 넘치면 가로로 굴린다(`ScrollView horizontal`, 스크롤바 없음). 헤더의 좌우 패딩을 **음수 마진으로 뚫고** 같은 값을 스크롤 콘텐츠 패딩으로 되돌려, 첫/마지막 칸은 제자리에 서고 스크롤만 화면 끝까지 간다.

- **칸 하나 = 68 × 70px · 간격 4px**. 상자가 정사각이 아니고 **원이 위로 붙는다**(중심 y=32). 글자가 아래에만 있어 위쪽 여백은 낭비다. 바깥에서부터 글자 호(r=35) · 링(r=26) · 얼굴 원(지름 40). 값은 `portrait-metrics.ts` 의 `PORTRAIT_RAIL` 에 있고(`compact` 규격은 `PORTRAIT_COMPACT`) **글자와 링이 겹치지 않는 것이 그 표의 유일한 목적**이다(테스트가 관계를 고정한다). 호 경로 계산은 `portrait-arc.ts` 가 든다.
- **레벨과 닉네임이 `TextPath` 로 아래 호 **하나**를 함께 쓴다**. 따로 두르면 아래 호의 글자가 **안쪽으로 자라는**(원형 도장의 관례) 탓에 바깥 줄이 안쪽 줄을 향해 자라 사이를 벌려야 하고, 그만큼 상자가 세로로 커진다. **둘은 크기·굵기·색이 같고 갈리는 것은 자리뿐**이다. 같은 `Path` 를 가리키는 두 `Text` 가 `startOffset`·`textAnchor` 만 다르게 갖는다(글자 모양은 한 상수로 묶는다).
  - **가운데에 맞추는 것은 줄이 아니라 ‘레벨과 이름의 경계’** 다. 레벨은 6시에서 끝나고(`textAnchor="end"`) 이름은 6시에서 시작한다(`start`), 사이는 3px. 줄 전체를 `middle` 로 앉히면 이름이 더 길어 글자가 통째로 오른쪽으로 치우친다. 레벨을 모르면(`level === null`) 이름을 다시 가운데에 앉힌다.
  - **`textAnchor` 는 `TextPath` 가 아니라 `Text` 에 붙인다**. 자식에 주면 `react-native-svg` 가 조용히 버린다(실측). `startOffset` 은 반대로 `TextPath` 의 것이다.
- **진행 링은 한 겹의 연속 호**다. 보스 수익의 ‘칸 링’([[ADR-054]]·[[ADR-059]])과 다르다. 그쪽은 ‘주간 12회’ 한도를 칸으로 쪼갠 것이고 이것은 비율이라, 칸으로 쪼개면 캐릭터마다 칸 크기가 달라져 비교가 깨진다. 색은 `primary`·`third`, 트랙 `border`. `secondary` 는 앱 전체의 ‘완료’ 의미색이라 쓰지 않는다.
  - **컨텐츠 스케줄러: 가운데 기준 좌·우 반원**: 왼쪽 일간(`primary`) · 오른쪽 주간(`third`). 둘 다 **12시에서 시작해 아래로** 차고, 12시·6시에 5°씩 틈을 둬 갈라져 보이게 한다.
  - **관리 화면 둘(`/content/manage`·`/boss/manage`). 링을 아예 안 그린다**(`rings: []`). 그 화면의 일은 캐릭터를 고르는 것이지 진행을 보는 것이 아니다. 자리는 제목 줄이 아니라 **그 아래 줄**이다. ~~링 자리를 비워 두면 죽은 여백이 남으므로 글자를 얼굴 바로 밖으로 당기고(r=28) 칸을 낮춘다(세로 62). 갈리는 것은 그 둘뿐이다(`portraitMetrics`).~~ → **치수는 한 벌이다**([[ADR-161]] 결정 1, 2026-08-22). 네 화면 전부 글자 반지름 35 · 칸 높이 70 · 간격 4 를 쓰고, 죽은 여백은 감수한다. 화면을 옮길 때 같은 캐릭터의 초상화가 커졌다 작아졌다 하는 것이 더 비싸다는 판단이다. 그 자리를 [[ADR-188]] 결정 3 의 **빈 링**이 받는다.
  - **보스 스케줄러: 주간만, 온전한 원 하나**(`primary`, **반시계**, 12시 틈 없음). 월간은 종류가 하나뿐이라 ‘몇 개 중 몇 개’가 1/1 뿐이고, 표현은 따로 정한다(보류). 가를 상대가 없는 링에서 틈은 ‘나눔’이 아니라 ‘결손’으로 읽힌다([[ADR-059]] 정정 1과 같은 판단). **한 바퀴는 호로 못 그려** 그 자리만 `Circle` 이다(트랙과 100% 진행 둘 다).
- **선택 표시는 흐림**이다. 테두리는 진행률이 이미 쓴다. 고른 칸은 `opacity 1`, 나머지는 **`0.3`**(~~`0.45`~~ → [[ADR-161]] 결정 2, 칸이 여섯을 넘으면 0.45 로는 어느 것이 선택인지 한눈에 안 잡혔다), 접근성에는 `aria-selected` 로 따로 말한다.
- 얼굴 크롭은 **`CharacterAvatar` 가 든다**([[ADR-204]] 결정 1 · 위 절). 표는 `lib/face-crop` 하나이고 자리마다 지름만 다르다. 이미지가 없으면 이름 첫 글자.

### 스케줄러 캐릭터 드롭다운: 선택 캐릭터 월드 아이콘: 2026-07-16
> ⛔ **이 드롭다운은 없다**([[ADR-142]] 정정 8, 2026-08-16). 네 화면 모두 위 ‘캐릭터 초상화 레일’이 그 자리이고, 컴포넌트 자체가 지워졌다. 아래는 기록이다.

`CharacterSelectDropdown` 은 네이티브 `<select>` 유지(`<option>` 이미지 불가라 펼친 목록은 텍스트만). 닫힌 상태 왼쪽에 선택 캐릭터의 **월드 엠블럼** 오버레이: `<select>` 를 `relative` 래퍼로 감싸고 `<img>` 를 `pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-auto object-contain`, `<select>` 에 `pl-9`. world 는 캐시 우선 뷰는 스케줄 캐시(`SchedulerCharacterState.world`)에서, 동기화 후 뷰는 sync 결과에서: 캐시 있으면 API 응답 전 즉시 표시. 미매핑 월드 생략.

**화살표는 UA 것을 쓰지 않고 직접 그린다**. `appearance-none` + `ChevronDown`(`pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-muted`, `strokeWidth 2.5`). 두 크기 모두 같다([[ADR-096]] 결정 5, 2026-08-05). 이유 둘:
- **`padding-right` 로는 화살표를 못 옮긴다**(브라우저 실측). 네이티브 `<select>` 의 화살표는 **오른쪽 테두리에 붙어 함께 움직여서**, `padding-right` 를 12→16→32→64px 로 키워도 화살표와 테두리 사이 간격은 그대로고 상자만 넓어진다(글자만 왼쪽으로 밀린다).
- **UA 화살표는 플랫폼마다 모양이 달랐다**. 웹뷰가 Android(Chrome)·iOS(Safari)로 갈려 그대로 두면 같은 화면이 기기마다 다르게 보였다.

**두 가지 크기**:
- `size="default"`. 스케줄러 화면(`/content`·`/boss`). 제목 아래 **독립된 줄**의 주 컨트롤이라 `min-w-[160px] py-3 text-sm`, 엠블럼 `h-[22px] left-3`, `pl-8 pr-9`, chevron `right-3.5 h-4 w-4`.
- `size="compact"`. 관리 화면(`/content/manage`·`/boss/manage`). 제목 줄 우측의 작은 자리라, 이 자리에 있던 읽기 전용 칩과 **같은 크기감**을 유지한다: `rounded-full border border-border py-1 text-xs`, 엠블럼 `h-[14px] left-2.5`, `pl-7 pr-7`, chevron `right-2.5 h-3 w-3`. default 를 그대로 넣으면 헤더가 두꺼워지고 좁은 화면에서 제목과 폭을 다툰다.

`pr` 은 chevron 자리를 비워 두는 값이다. chevron 크기·`right` 를 옮기면 함께 조정한다(따로 두면 글자가 화살표 밑으로 들어간다).

### 진행률 바 프리미티브
`role="progressbar"` + `aria-valuenow/min/max`, track `h-1.5 w-full rounded-full bg-track` + fill `h-full rounded-full bg-primary`. **결정형 진행률은 이 프리미티브 하나**([[ADR-061]] 결정 6). 온보딩 예열·계정 변경 예열·캐릭터 관리 저장·OTA 다운로드·컨텐츠 진행률이 모두 같은 스타일이다. 새 색·모양 신설 금지.

두께만 축이 하나 열려 있다([[ADR-061]] 정정 4). `ProgressBar` 의 `height` 프롭이 `base`(`h-1.5`)와 `thin`(`h-1`) 둘을 받고, `thin` 을 쓰는 곳은 `today` 의 2x2 초기화 타일뿐이다. 세 번째 값은 두지 않는다.

### 체크박스: **채운 상자는 언제나 `primary`** ([[ADR-182]] 정정 1, 2026-08-30)
켠 상자는 `bg-primary` + `border-primary`, 그 안의 체크는 `text-on-primary`. 안 켠 것은 **테두리만**(`border-border`, 배경이 있는 자리면 `border-border-strong`). 크기·모서리는 자리마다 다르다(설정·가계부 18px `rounded-md`, today 위젯 12px `rounded-[3px]`). 고정하는 것은 **색** 하나다.

**‘완료 = `secondary`’ 계보를 여기에 끌어오지 않는다.** `secondary` 는 테마의 두 번째 시드라 메인 컬러와 색상(H)이 무관해서(렌은 빨강 테마에 틸, 엔젤릭버스터는 분홍 테마에 하늘) 상자를 그 색으로 채우면 **테마 밖의 색**으로 읽힌다(사용자 판정). 그 계보가 사는 자리는 **배지**다. 컨텐츠 완료 배지·보스 `CLEAR`·성공 토스트.

## 공유 레이아웃 패턴

### 탭 토글(주간/월간, 일간/주간 등): [[ADR-018]]
드롭다운·탭·카운트 배지를 **별도 카드로 묶지 않는다**(배경 위에 바로).
```
탭 행: flex items-center gap-4
활성 탭: rounded-full bg-primary-tint text-primary-ink px-3 py-[5px] text-sm font-semibold (배지 pill 재사용, 새 스타일 금지)
비활성 탭: 배경 없음, text-sm font-medium text-text-muted, 좌우 패딩 활성과 동일(px-3)
카운트 배지(있는 화면만, 예 n/12): 같은 줄 justify-between 오른쪽 끝, rounded-full bg-primary-tint text-primary-ink text-xs font-semibold px-2.5 py-1
```
활성/비활성 색 차이만으로는 저채도 팔레트에서 약해 배경 pill 필수(굵기 차이만으로 대체 금지). 기능 전용 변형(솔로/파티 필터·보스 수익 네비게이터)은 각 feature 문서.

### 스크롤 영역: 화면이 스크롤을 소유하고, **고정되는 영역은 없다** ([[ADR-099]] · [[ADR-131]])

화면 루트는 공용 셸 **`components/templates/ScreenScroll`** 이다. 스크롤 상태가 `ScrollView` 라는
**뷰에 붙어** 화면과 함께 태어나고 함께 죽으므로, 웹에서 문서 스크롤 하나를 네 탭이 공유하며 겪던
오프셋 계승 문제가 **구조적으로 없다**([[ADR-099]] 가 손으로 만들던 상태가 여기서는 기본값이다).

- **헤더도 함께 스크롤한다**([[ADR-131]]). `PageHeader` 는 셸의 **첫 자식**이고, 웹 시절의
  `fixed` 헤더 + 실측 spacer + `ResizeObserver` 갱신 경로는 **전부 사라졌다**(🗑 ADR-085·ADR-112).
  **잰 높이에 의존하는 자리가 없다**. 새 화면을 만들 때 헤더 높이를 재려 들지 말 것.
- **`sticky` 수단을 쓰지 않는다.** `src/__tests__/sticky-policy.test.ts` 가 소스에
  `stickyHeaderIndices` 가 **하나도 없음**을 단언한다(🗑 ADR-047: 중첩 sticky 는 ‘안 만들기’로
  판정났다). 회귀는 ‘없기로 한 것이 슬그머니 생기는’ 모양으로 오므로 테스트로 막는다.
- **스크롤포트를 "실제로 보이는 영역"에 맞춘다.** 스크롤 인디케이터는 콘텐츠가 아니라 스크롤포트
  위에 겹쳐 그려지므로, 상자가 화면 끝까지 닿으면 노치를 침범하고 하단바 뒤로 사라진다(둘 다 실기기
  관측). 하단 값은 가정이 아니라 **실측**이다(`lib/bottom-bar-metrics.ts`·`bottom-inset.ts`).
- **안전영역에서는 콘텐츠가 깎여 사라진다**([[ADR-134]]). 덮는 페이드가 아니라 **마스크**다
  (`safe-area-fade.ts`). ⚠️ 이 마스크 라이브러리는 **패치해서 쓴다**(`patches/` + `postinstall`).
  안드로이드에서 하위 페이지 뒤로가기 중 마스크를 못 찾아 전환 내내 화면이 검게 나오던 것을 막는다.
- **모달·오버레이는 셸 바깥**에 둔다.

### 화면 스택: 하위 페이지는 밀려 들어온다 (🟡 [[ADR-120]] · 구현은 라이브러리가 한다)

`@react-navigation/native-stack` 이 푸시/팝 전환과 **가장자리 스와이프 백**을 준다. 웹에서 이것을
손으로 만들던 구현(오버레이 셸 · 전환 상수 · 제스처 훅 · 라우트 지연: 955줄)은 **전환과 함께
삭제됐다**.

- **하위 페이지 아래 화면은 언마운트되지 않는다**(⛔ ADR-077 에서 살아남은 계약). 펼침·기간·
  스크롤을 잃지 않는다. 스택이 그것을 구조적으로 지킨다.
- **하위 페이지에는 하단바가 없다**. 탭 화면 위로 밀려 들어온다([[ADR-132]]).
- **전환 중 배경**: 안드로이드에서는 화면이 불투명해야 한다([[ADR-134]] 정정 5 ·
  `theme/screen-backdrop-policy.ts`). 투명한 화면은 벽지만이 아니라 **그 아래 화면도** 비친다.
  iOS 에는 그 증상이 없어 양쪽 모습을 함께 바꾸지 않는다.

### 당겨서 새로고침(pull-to-refresh): [[ADR-130]]

목록 최상단에서 아래로 당기면 그 화면의 헤더 새로고침 버튼과 **같은 재조회**가 돈다(⛔ ADR-072
결정 2 에서 살아남은 계약: 제스처는 버튼의 대체가 아니라 추가 수단이다).

- **제스처·인디케이터 배치는 RN `RefreshControl` 이 맡는다.** 웹에서 손으로 만들던 훅·배너·
  `translateY` 오프셋 계산은 **전부 사라졌다**(🗑 ADR-072·ADR-073).
- **적용 화면**: `today` · 컨텐츠 · 보스 · 보스 수익. 하위 페이지·설정에는 없다.
- **끄는 조건 둘은 남는다**. 빈 상태, 그리고 새로고침이 의미 없는 기간(보스 수익).
- **커스텀 당김 마크는 없다**(⛔ [[ADR-074]]). 두 플랫폼 다 인디케이터에 커스텀 뷰를 넣지 못하고
  안드로이드는 당김 거리조차 주지 않는다. 마크를 그리던 컴포넌트와 임계값·저항 곡선 상수는
  2026-09-01 에 지웠다.

### 레이아웃
- 전체 너비: 모바일 단일 컬럼, max-width 제한 없음(하이브리드 앱이라 데스크톱 와이드 미고려).
  **예외 하나: RN 하단바는 폭 상한 420 을 갖는다**([[ADR-132]] 정정 30). 콘텐츠는 여전히 전폭이라
  넓은 화면에서는 ‘가운데 정렬된 바 + 전폭 목록’이 된다. 콘텐츠 컬럼 폭은 별개의 결정이다.
- 좌측 정렬 기본. 화면 패딩 `p-4`, 블록 사이 `space-y-4`, 카드 안쪽 `p-4`.
- **하단바: RN 은 ‘떠 있는 캡슐 + 두 층 + 뒤로가기’** ([[ADR-132]], 2026-08-13). ~~웹(`app-capacitor`)은 아래 ‘폐기된 정책’의 고정 탭바를 그대로 쓴다~~ → 그 앱은 사라졌다([[ADR-155]]). 이제 유효한 것은 RN 쪽 하나뿐이다.
  ```
  바      **폭 = min(창 − 14×2, 420) · 높이 = round(폭 × 72/374), 하한 64** ([[ADR-132]] 정정 30).
          좌우 14 는 ‘최소’ 여백이고 상한에 걸리면 남는 폭이 좌우로 갈라진다(가운데 정렬).
          안전영역에 바로 붙는다(들어올림 0: 그 12 는 바 높이로 옮겼다) · radius 999 ·
          화면에 떠 있다(콘텐츠가 아래로 지나간다).
          그 ‘안전영역’은 인셋이 아니라 **하한 34 가 깔린 값**이다(아래 정정 31)
  세로 규칙 **칸이 이미 바 폭의 함수라 높이만 상수로 두면 알약 종횡비가 기기마다 달라진다**
          (402pt 92×66 → 320pt 76×66 → 440pt 100×66). 비례 상수는 402pt 기기의 지금 값에서
          역산했다. 그 기기는 한 픽셀도 안 바뀌고 360dp 가 하한 64 에 앉는다. **폭의 상한이
          높이의 상한을 겸한다**(태블릿 = 폭 420 · 높이 81). 따로 적으면 ‘폭은 멈췄는데 높이만
          자라는’ 조합이 생긴다. 실제 값: 320→64 · 360→64 · 390→70 · 402→72 · 430→77 · 태블릿 81
  안쪽여백 **3** (알약 = 높이 − 3×2 = 402pt 에서 66, 비율 0.92) · 레퍼런스 실측 0.89 에 맞춘 값이다.
          넓히면 항목이 ‘바 안에 떠 있는’ 것처럼 보인다
  바탕    폴백일 때 그 모드에서 **가장 밝은 표면**(라이트 `surface` · 다크 `surface2`).
          **어둡게 해서 배경과 가르지 않는다**. 그 판은 글자 가시성을 무너뜨렸다(활성 라벨 대비 2.0)
  글자    활성은 **아이콘·라벨이 같은 색**이고, 그 색은 **그 테마의 메인 컬러**(`primary-ink`)다.
          라이트는 원색 그대로. 다크는 원색이 알약보다 어두워 활성이 비활성보다 흐려지므로
          **`text-muted` 보다 밝아질 만큼 명도만** 올린다. `text` 쪽으로 ‘섞지’ 않는다. 섞으면
          채도가 같이 빠져 머쉬맘의 주황이 갈색(`#8F5014`)이 됐다([[ADR-132]] 정정 23).
          색상은 그대로 남고(실측 오차 0.2° 이내) 채도는 sRGB 가 허용하는 만큼 남는다
          (혼테일 97% · 레테 101% · 검은마법사 60%: 많이 올릴수록 잘린다).
          비활성은 `text-muted` 에서 **채도를 뺀** 값이다(명도는 그대로: 바 대비 ≥4.5 유지).
          바 안에서 색을 지는 자리는 활성 하나다. 그대로 쓰면 레테처럼 `text-muted` 자체가 연보라인
          테마에서 비활성까지 같은 계열로 읽힌다(C0.056, 혼테일의 4.7배). **바 안에서만** 이고
          설정 부제·카드 캡션 등은 토큰 그대로다([[ADR-132]] 정정 24).
          활성↔비활성은 **oklab 거리 ≥ 0.07** 로 갈린다. 명도 대비로 재면 색상이 갈려 멀쩡한
          테마까지 창백해진다([[ADR-132]] 정정 20)
  활성 알약 유리일 때 **알약도 유리**. 색으로 칠한 판을 얹으면 그 자리만 재질이 끊긴다.
          **유리 뒤를 비워 둘 것**(`backgroundColor: transparent`). 뒤판이 있으면 재질이 그것을
          굴절시켜 ‘흰 알약’이 된다. **라이트에서는 tint 로 흰색을 ‘얹지’ 말고 ‘덜어낼’ 것**
          (`text` α.05). `clear` 재질이 이미 하이라이트를 얹어서, 흰 카드 위에서 흰 tint 를 더하면
          포화된 흰 덩어리가 된다(tint 를 빼도 뒤보다 +11.4). 다크는 그 하이라이트가 원하는
          방향이라 그대로 둔다(흰 α.10)
          유리끼리는 명도 차가 작아 **그림자가 층을 만든다**(유리 0.65 · r10 · y3 / 폴백 0.2 · r5 · y2,
          모양은 borderRadius 에서). 유리 쪽 값이 큰 것은 과해서가 아니라 테마 `shadowColor` 의
          알파(`59`=0.35)와 **곱해지기** 때문이다. 0.26 은 실효 0.09 라 라이트에서 층이 안 보였다
  유리    `expo-blur` intensity 18 + 그 위에 바탕색: **`backdrop-filter` 가 아니다**(RN 네이티브
          `UIVisualEffectView`)
  유리    iOS 26+ `expo-glass-effect` 의 `GlassView`(=`UIGlassEffect`). 블러가 아니라 **재질**이라
          배경을 굴절시키고 가장자리에 하이라이트가 돈다. **색을 덮지 않는다**(tint α.3 까지).
          덮는 순간 그냥 반투명 판이 되고 ‘글라스 느낌이 안 난다’
  유리 자리 `GlassView` 를 **`Pressable` 안에 두지 말 것**. 그 자리에서는 iOS 가 재질을 **아예 안
          그린다**. 판은 누름 과녁 밖(부모의 직계 자식)에 절대 배치로 두고, `Pressable` 은 그 위에
          투명한 과녁으로만 얹는다. 코드·props 가 같아도 결과가 다르므로 **눈으로만 비교하면 못
          잡는다**. 의심되면 tint 를 강한 원색으로 바꿔 반응하는지 볼 것([[ADR-132]] 정정 21)
  유리 모드 `colorScheme` 을 **반드시 앱 테마의 `mode` 로 넘길 것**. 기본값 `auto` 는 OS 외형을 보는데
          이 앱은 자체 테마를 쓴다. 빠뜨리면 라이트 OS + 다크 테마에서 **새까만 페이지 위에 밝은
          유리판**이 뜬다([[ADR-132]] 정정 19)
  폴백    iOS 26 미만·안드로이드: 불투명 캡슐 + 테두리. **재질을 흉내 내지 않는다**([[ADR-132]]
          정정 29, 사용자 지시). `expo-blur` 로 흉내 낸 판을 만들어 봤고 되돌렸다(대상을 잘못 주면
          네이티브가 무한 재귀로 죽고, 스크롤 자크가 3.0 → 11.0% 로 뛴다). **맞추는 것은 색이고**,
          그 관계는 유리와 무관하게 성립한다. 알약·← 는 `neutralPlate` 의 무채색 판이고 재질이
          하던 몫은 그림자가 진다
  테두리   유리 위 `rgba(255,255,255,.5/.16)` 헤어라인 · 폴백은 `border`(라이트) / `border`→`text`(다크)
  알약    h = 바 높이 − 여백×2(402pt 에서 66) · 폭은 칸 + 오버행 23 · **폴백도 ‘무채색 판’이다**([[ADR-132]] 정정 28).
          유리가 그리는 그 판과 같은 방향(바에서 `text` 쪽으로 아주 조금 + 채도 0)이고, **테마
          색으로 칠하지 않는다**. 강조는 판이 아니라 글리프가 진다(정정 1). ← 원도 같은 판이다
  입체감   장치 **셋이 함께** 진다. ① 바 그림자(약하게) ② **알약 자체 그림자**(이게 빠지면 바
          전체가 납작한 판으로 보인다) ③ 밝은 테두리. 하나만 세게 주면 ‘두껍다’가 되고, 하나라도
          빼면 ‘평평하다’가 된다
  그림자   **`boxShadow` 로 쓴다. `shadowOpacity`/`shadowRadius`/`shadowOffset` 은 iOS 전용**이라
          안드로이드에는 도달하지 않는다([[ADR-132]] 정정 28). 옮길 때 두 값이 번역된다.
          블러는 CSS 정의라 `shadowRadius` 의 **두 배**, 알파는 테마 `shadowColor` 의 0.35 와
          `shadowOpacity` 를 **미리 곱해** 색에 넣는다. `elevation` 은 함께 걷는다(두 번 그려진다)
  라벨    안드로이드 `Text` 는 글자 상자에 **폰트 메트릭 여백**을 넣어 iOS 보다 5px 크다.
          `includeFontPadding: false` 로 끈다([[ADR-132]] 정정 28)
  ←       원 지름 = **알약 높이 × 0.727**(402pt 에서 48). 바 안쪽 여백을 줄여도 안 따라가고
          ([[ADR-132]] 정정 30 이 기기 폭에만 걸었다) 그래서 알약보다 작다(레퍼런스 둘째 장과 같다)
  경계    라이트 그림자(0 1px 2px / 0 9px 22px −14px) · 다크 border 1px  (ADR-122 와 같은 근거)
  항목    아이콘 25 (stroke 1.5) · 간격 4 · 라벨 10.5px/400 · 자간 −0.01   ← 조절기로 확정(2026-08-13)
  활성    아이콘·라벨 primary-ink + 알약   ← 강조는 ‘판’이 아니라 ‘글리프’가 진다(알약을 tint 로
          칠하면 다크에서 ‘알약이 바보다 밝다’가 뒤집힌다)
  칸 폭   **층과 무관하게 하나** = (바 안쪽 − 패딩) ÷ 그룹 수. 하위 행도 같은 폭이고 **왼쪽 정렬**.
          남는 폭은 오른쪽에 둔다(트랙을 항목 수로 나누면 하위 둘일 때 칸이 두 배가 된다)
  구동    **전부 네이티브 드라이버**. 전환에 레이아웃 값이 하나도 없다. ← 자리는 상자를 넓히는
          대신 행을 한 칸 ‘옮겨’ 만든다. 폭을 애니메이션하면 전부 JS 가 되고, 탭 직후 화면 마운트가
          JS 를 막아 꼬리가 떨린다
  측정    **아무것도 안 잰다. 창 폭에서 계산한다**([[ADR-132]] 정정 30). 바 폭이 창 폭의 함수가
          되면서 `onLayout` 이 필요 없어졌고, 계산은 **첫 프레임부터 맞다**(측정은 첫 프레임이 0
          이라 알약이 한 프레임 접혀 있었다). 애니메이션이 바꾸는 값(트랙 폭)을 재면 그 값이 다시
          애니메이션 범위를 정하는 고리가 되어 **잘못된 배치로 굳는데**(실제 관측), 그 고리도 원인
          자체가 사라진다
  층 전환  280ms · **fade-through**(나가는 행을 앞 40% 에 비우고 그다음 들어오는 행을 채운다.
          겹쳐 섞으면 항목 수가 다른 두 줄이 포개져 글자가 이중으로 보인다) + 미끄러짐 ±10
  ←       **한 칸을 차지한다**(위치·너비가 메뉴 항목과 같다) · 배경만 48 원으로 가운데:
          그래서 하위 항목이 그룹 행의 2~4번 칸에 그대로 앉는다(실측 어긋남 ≤0.5pt)
          레이아웃(자리)과 그림(버튼)을 가른다. 자리는 스페이서가 잡고 버튼은 **맨 위에서 제자리
          페이드**(45% 문턱). 폭을 줄여 잘라내면 ‘1차 바가 덮는’ 것처럼 읽힌다
  알약    **같은 층 안에서만** 미끄러진다 240ms · 층을 넘을 땐 새 자리에 즉시 선다
          (두 행은 다른 항목 집합이라 칸 사이를 잇는 미끄러짐이 거짓이 된다)
  ←       알약에 비례하는 원 · 하위 행에만 · 활성 <text> / 비활성 <text-muted>
  인셋    콘텐츠 paddingBottom = **바 높이** + 안전영역   (스크롤포트는 줄이지 않는다).
          상수가 아니라 `resolveBottomBarMetrics(창 폭).spacePx` 다. [[ADR-134]] 의 ‘바 몫의 절반’
          페이드도 같은 값에서 파생되므로 세 자리가 **한 함수**를 본다
  ```
  **정정 31 (2026-08-18 · 안드로이드 실기기)**. 안드로이드에만 **하단 안전영역 하한 34**. 결정 11 의 ‘안전영역 위 12’가 0 이 되면서 바의 자리가 `insets.bottom` ‘그대로’가 됐고, 그 값의 플랫폼 차이가 화면에 나왔다(iOS **34** 홈 인디케이터 대 안드로이드 **15** = `navigationBars` 45px @3.0 제스처). 상단(31.3 대 59)과 **같은 비율**이라 처방도 같다. [[ADR-139]] 정정 1 의 하단 판이다.
  ```
  값      resolveBottomSafeAreaPx({ insetBottomPx, platform }). `lib/safe-area.ts`
          안드로이드 = max(인셋, 34) · 그 밖 = 인셋 그대로.
          34 는 ‘안드로이드를 더 띄우는 값’이 아니라 **‘iOS 와 같아지는 값’**이다.
          iOS 인셋 자체가 34 라 한 픽셀도 안 바뀌고, 3버튼(48)에는 아무것도 안 더한다
  자리    화면 하단 **전부**. BottomBar 의 bottom(캡슐이 뜨는 높이) · ScreenScroll 콘텐츠 끝 몫과
          하단 페이드 · ToastStack · 화면 자체 paddingBottom(처리방침 · 캐릭터 관리 하단 액션 바 ·
          온보딩 단계 셸: 그 셸의 캐릭터 선택 단계도 같은 액션 바를 갖는다, [[ADR-144]] 정정 2).
          **한 값을 봐야 하는 이유가 상단보다 강하다**. 넷이 서로 물려 있어 한 자리만
          올리면 콘텐츠가 캡슐 뒤로 들어가거나 토스트가 캡슐에 겹친다
  하위    안드로이드 하위 페이지의 두 조각이 ‘인셋’이 아니라 ‘안전영역’을 나눈다
  페이지   portBottomPx = **인셋**(내비바가 실제로 먹는 자리: [[ADR-120]] 결정 19 그대로) ·
          contentBottomPx = **안전영역 − 인셋**(하한이 더한 몫이라 지나가도 된다).
          제스처 15+19 · 3버튼 48+0(무변화). 하한을 portBottomPx 에 통째로 실으면 결정 19 의
          대가(바닥 배경색 띠)가 그만큼 커진다
  제외    **오버레이**(BottomSheet · 캐릭터 피커 · 계정 드롭다운). 그쪽 insets.bottom 은 ‘리듬’이
          아니라 ‘내비바를 안 가린다’라 **인셋 그대로**여야 한다(상단 오버레이와 같은 경계)
  가드    `lib/__tests__/bottom-safe-area.test.ts`(하한 동작: 테스트는 iOS 로 돌아 렌더로는 못 본다) ·
          `src/__tests__/bottom-safe-area-policy.test.ts`(화면 하단이 insets.bottom 을 직접 안 읽는지)
  ```
  - **층은 ‘지금 페이지’가 정한다**. 그 그룹이 하위를 가지면 하위 행, 아니면 그룹 행. 별도 ‘그룹 모드’ 상태를 두지 않는다.
  - **기록은 ‘한 층 내려갈 때’만 남는다**. 같은 층 옆걸음(유틸리티→설정, 보스 수익→가계부)은 안 쌓는다. ← 의 뜻은 ‘이 그룹에서 나간다’ 하나다.
  - **광고 게이트는 그룹 이동에만**(ADR-090 결정 3 축소). 하위 이동과 ← 는 게이트 밖.
  - **여섯 번째 그룹은 안 들어간다**. 360dp 에서 칸이 64dp 라 ‘유틸리티’가 이미 하한이다. 늘릴 땐 라벨 규칙부터 다시 정할 것.
- **안전영역 페이드: RN 은 ‘덮지 않고 깎는다’** ([[ADR-134]], 2026-08-14). 콘텐츠가 크롬과 겹치는 자리(상단 상태바 밑 · 하단 홈 인디케이터)에서 **알파가 0으로 간다.** 배경색을 덮는 스크림이 아니다. 그러면 벽지 테마에서 정지 상태에도 띠가 보여 [[ADR-133]] 이 걷어낸 상태로 돌아간다.
  ```
  자리    ScreenScroll (화면 셸 하나). 마스크 상자 = 스크롤포트. 전역 오버레이로 두면 떠 있는
          바까지 깎이고, 화면마다 두면 열여섯 벌이 된다
  수단    @react-native-masked-view/masked-view 0.3.2: RN 에 mask-image 가 없고 mixBlendMode 에
          destination-out 이 없다(0.86 열거 실측).
          **안드로이드 구현은 패치해서 쓴다**([[ADR-134]] 정정 4 · patches/ + 루트 postinstall).
          그쪽은 마스크를 getChildAt(0) 으로 찾는데, pop 으로 서브트리가 언마운트되면 자식이
          mChildren 에서 빠져 getChildAt(0) 이 null 이 되고(화면은 아직 밀려 나가는 중이라
          Android 는 disappearing child 로 계속 그린다, INVISIBLE 도 무시) 마스크가 평범한
          그림으로 깔린다 = 뒤로가기 전환 내내 화면이 검정 한 장. 패치는 마스크를 **참조로**
          기억하고 drawChild 에서 막는다
  길이    상단 = **상단 안전영역**(= 인셋, 안드로이드는 하한 48: 아래 ‘헤더 상단 여백’과
          **같은 값을 본다**, [[ADR-139]] 정정 1) (**헤더가 있는 화면만**. 없으면 셸이
          스크롤포트를 내려 콘텐츠가 그 자리에 못 온다)
          하단 = **하단 안전영역**(= 인셋, 안드로이드는 하한 34: [[ADR-132]] 정정 31) − portBottomPx
          **+ 바 몫의 절반(36, 탭 화면만)**
          (탭 화면 70: 정정 31 뒤로 **두 플랫폼이 같은 값**이다 · 하위 페이지 = 안전영역 ·
          안드로이드 3버튼 하위 = 0 · 안드로이드 제스처 하위 = 19 = 하한이 더한 몫).
          안전영역까지만 두면 콘텐츠가 **선명한 채로 캡슐 밑에 들어가** 녹는 것이 이미 가려진
          뒤가 되고([[ADR-134]] 정정 1), 바 몫 전부(72)를 올리면 **캡슐 위가 늘 흐릿하다**(정정 3).
          절반이면 **캡슐 한가운데에서 0** 이다. 36 은 `FLOATING_BAR_SPACE_PX / 2` 로 **파생**.
          두 벌로 적으면 바 높이가 바뀔 때 어긋난다
  곡선    **smoothstep²** = (3t²−2t³)² · 정지점 아홉. 한가운데 알파가 **0.25**(제곱 전 0.5)라
          구간의 대부분이 거의 투명하다. 제곱을 고른 이유는 양 끝 기울기가 **여전히 0** 이라
          ‘페이드가 시작·끝나는 선’이 안 보이기 때문: 상수로 누르거나 구간을 잘라 옮기면 그
          성질이 깨진다. 정지점이 아홉인 것은 가팔라진 곡선의 구간 선형 오차를 2% 로 되돌리려는
          것(다섯이면 6.1%). 웹의 (1−t)² 는 그라디언트 × 마스크 두 선형의 **곱이 만든 산물**이지
          고른 곡선이 아니었다
  안 걸 때 두 값이 다 0이면 마스크를 아예 안 건다(오프스크린 합성 비용을 페이드가 보이는 화면으로
          좁힌다). 안드로이드 3버튼 내비의 하위 페이지가 그 경우다
  ```
- **헤더 상단 여백: RN 은 ‘안전영역에 붙인다’** ([[ADR-139]], 2026-08-16). 웹 헤더의 `pt-[calc(1rem+var(--sa-top))]` 에서 **상수 몫 1rem 을 뺀다**. RN 헤더의 `paddingTop` 은 `insets.top` 그대로다. 웹에서 그 16 이 하던 일 둘이 여기서는 다 없어졌다: 불투명 헤더 판의 안쪽 여백(RN 헤더는 자기 배경을 안 칠한다 [[ADR-133]]) · 고정 헤더와 상태바의 시각적 분리(RN 헤더는 고정이 아니다 [[ADR-131]]). ~~**웹(`app-capacitor`)에서는 옛 값이 그대로 유효하다**~~ → 그 앱은 사라졌다([[ADR-155]]). 이제 유효한 것은 RN 쪽 하나뿐이다.
  ```
  범위    헤더가 있는 열아홉 화면 전부. 헤더가 없는 설정 계열은 ScreenScroll 이 상자를 내리고
          콘텐츠의 pt-4 를 뺀 것이 같은 결과다
  제외    **온보딩**. 단계에 제목 줄이 없어 pt-8 은 헤더 여백이 아니라 콘텐츠 여백이다(축이 다르다)
  상수    **없다.** 0 을 더하는 상수는 죽은 값이라 여덟 자리(상수 4 · 리터럴 2 · pt-4 2)가 함께
          사라졌다. 되살릴 땐 여덟이 아니라 공용 PageHeader 한 자리부터 정할 것
  경계    제목 윗변 = [[ADR-134]] 상단 페이드의 끝선이다. 지금은 그 선에서 알파가 1 이라 제목이
          불투명하지만 **여유가 0** 이라, 페이드 길이를 늘리면 제목 윗변부터 갉힌다
  ```
  **정정 1 (2026-08-18 · 안드로이드 실기기)**. 안드로이드에만 **상단 안전영역 하한 48**. `insets.top` ‘그대로’가 플랫폼 차이를 화면에 드러냈다(iOS **59** 대 안드로이드 **31.3** = 상태바 94px @3.0). 하한을 **헤더가 아니라 안전영역 값 자체**에 깐다. 헤더에만 더하면 위 ‘경계’의 ‘제목 윗변 = 페이드 끝선’이 갈라지고 페이드는 짧은 채로 남는다.
  ```
  값      resolveTopSafeAreaPx({ insetTopPx, platform }). `lib/safe-area.ts`
          안드로이드 = max(인셋, 48) · 그 밖 = 인셋 그대로.
          **Math.max 이지 + 가 아니다**. 인셋이 이미 48 이상인 기기엔 아무것도 안 더하고,
          iOS(59)는 한 픽셀도 안 바뀐다
  자리    화면 상단 **전부**. PageHeader · 자체 헤더 셋(보스 수익·드랍 히스토리·아이템 가격) ·
          ScreenScroll 의 상단 페이드 높이와 헤더 없는 화면 marginTop · SettingsPrivacy ·
          빈 상태 셋(컨텐츠·보스·보스 수익). 안 맞추면 **탭마다 제목 높이가 갈린다**
  제외    온보딩(결정 2 그대로) · **오버레이**(Modal·캐릭터 피커·계정 드롭다운). 그쪽 insets.top 은
          ‘리듬’이 아니라 ‘상태바를 안 가린다’라 **인셋 그대로**여야 한다. 인셋을 직접 봐야 하는
          자리가 남는다는 것이 이 함수를 useSafeAreaInsets 래퍼로 만들지 않은 이유다
  대가    상단에도 하단(`bottom-inset.ts`) 같은 플랫폼 갈림이 하나 생긴다 · 48 은 기기 하나(31.3)를
          보고 고른 판정이라 인셋 40~48 기기에서는 더하는 양이 0 에 가까워진다
  ```
- **제목 줄: 최소 높이 32** ([[ADR-145]] 정정 1, 2026-08-17). 제목 줄은 `PageHeaderTitleRow`(templates) 하나로 그리고 그 프리미티브가 `min-h-8` 을 준다. 줄이 `items-center` 라 **가장 높은 자식이 줄 높이를 정하고 제목은 그 안에서 세로 중앙**에 앉는데, 화면마다 함께 서는 것이 달라(새로고침 32 · ← 28 또는 36 · 글자 링크 20 · 없음) 제목이 탭마다 0~4px 씩 튀었다.
  ```
  값      min-h-8(32) = 지금 되풀이되는 가장 큰 과녁(새로고침 `p-2` + 아이콘 16)의 높이
  성질    **최소**다. 고정이 아니다(사용자 지시). 더 큰 것이 들어오면 줄은 자란다
  범위    페이지 헤더의 제목 줄 전부: 탭 여덟 · 하위 페이지 열둘 · `PageHeader` 를 안 쓰는 둘
          (설정 · 스케줄러/수익의 빈 상태 가지). **모달·온보딩 단계는 아니다**(페이지 헤더가 아니다)
  가드    `src/__tests__/page-header-title-row-policy.test.ts`. 제목을 그리는 `*Screen.tsx` 가
          프리미티브를 쓰는지 소스로 확인한다(정책이 문서에만 있으면 다음 화면에서 어긋난다)
  남는 것 히스토리·가격 기록의 ← 는 `h-9 w-9`(36)라 그 둘만 +4 로 남는다. 아이콘 버튼 크기가
          셋(28·32·36)으로 갈려 있는 것은 이 값보다 넓은 문제라 함께 손대지 않았다
  ```
- **바탕은 ‘루트가 칠한다’** ([[ADR-136]], 2026-08-14). 화면(내비게이터)만 칠하면 **화면 밖이 드러나는 순간** 그 아래가 보인다. iOS 는 밀려 들어오는 화면의 모서리를 깎으므로 두 화면의 곡선 사이로 **RN 루트 뷰의 흰색**이 샜다.
  ```
  자리    ThemeProvider 의 View: 웹 `:root`/`body` 의 짝이고, 변수를 얹는 자리가 곧 바탕을 칠하는
          자리다. 테마가 바뀌면 같은 렌더에서 함께 바뀐다
  값      definition.bg 를 **값으로** 준다(`bg-bg` 클래스가 아니다. 자기가 정의하는 변수를 자기
          클래스가 다시 읽는 모양이 된다)
  벽지    [[ADR-088]] 결정 4(‘루트의 bg-bg 를 빼라’)와 **어긋나지 않는다**. 웹 벽지는 루트 뒤였지만
          RN 의 ThemeBackdrop 은 이 View 의 **자식**이라 위에 그려진다. 벽지 테마의 틈은 벽지가 채운다
  주의    app.json 의 backgroundColor 는 **정적**이라 테마 여섯에 못 맞춘다. expo-system-ui 는 새
          네이티브 의존성(재빌드)이고, JS 조상 View 하나로 같은 결과가 나온다
  ```
- **그림의 상자: RN 에서는 ‘두 축을 다 이름 부른다’** ([[ADR-135]], 2026-08-14). 웹의 `w-full`·`h-[17px] w-auto object-contain` 을 그대로 옮기면 **안 적은 축에 에셋의 고유 픽셀 크기가 남는다**. RN 의 `<Image>` 가 스타일을 `[{source.width, source.height}, styles.base, props.style]` 세 겹으로 쌓기 때문이고, 웹에서 그 자리를 메우던 preflight `img{height:auto}` 에 짝이 없기 때문이다. **두 축이 다 정해지면 Yoga 가 `aspectRatio` 를 버리므로** 비율에 맞춘 상자를 전제한 `resizeMode="stretch"` 자리도 함께 무너진다.
  ```
  규칙    한 축만 정하고 싶으면 나머지 축을 **명시적 undefined 로 지우고** aspectRatio 를 준다.
          ‘안 적음’ ≠ ‘undefined’. 후자만 앞 층의 값을 덮는다(RN 스타일 병합의 계약).
  자리    lib/image-aspect.ts 의 naturalAspectStyle(source, { height } | { width }) 하나.
          className 은 그대로 둬도 된다. NativeWind 가 undefined 키를 보존한다(실측)
  증상    엠블럼 좌우 여백 · 안내 이미지 상하 여백 · 원형 초상과 카드 일러스트의 일그러짐.
          전부 ‘CSS 속성이 안 먹는’ 것처럼 보이지만 원인은 **안 적은 축 하나**다
  주의    jest 는 이것을 **원리적으로 못 본다**(프리셋이 Image 를 통째로 목으로 갈아 끼운다).
          테스트가 물을 수 있는 것은 ‘두 축을 이름 불렀는가’(`'height' in style`)까지다
  ```

## 타이포그래피
| 용도 | 스타일 |
|---|---|
| 페이지 제목(h1) | `text-lg font-semibold text-[#2B1B10]` |
| 섹션/카드 제목(h2) | `text-sm font-semibold text-[#2B1B10]` |
| 본문 | `text-sm text-[#5B4636]` |
| 보조/캡션 | `text-sm text-[#8A7362]` |
| 에러 문구 | `text-sm text-error-ink` |

### 시스템 글자 크기(배수)는 `[1.0, 1.235]` 안에서만 움직인다 ([[ADR-152]])

위 표의 크기는 **배수 1.0 일 때의 값**이다. RN 은 OS 의 글자 크기 설정을 배수로 곱하는데
(iOS 0.823~3.571 · Android 0.85~2.0), 이 앱은 그 배수를 **1.0 아래로 안 내려가고 1.235 위로 안
올라가게** 자른다. 축소는 접근성 요구가 아니라 취향이고(그래서 하한 = 설계 기준), 확대는 요구이되
76px 고정 격자가 견디는 칸이 XXL(1.235)까지다.

- **글자는 `components/atoms/Text` 에서 가져온다.** `react-native` 의 `Text`·`TextInput` 직접
  import 는 ESLint 와 테스트가 막는다. 프롭이 한 자리만 빠져도 그 자리만 조용히 옛 동작으로 남기
  때문이다.
- **`TextInput` 은 언제나 RN 것이고, 시트가 보는 값만 아톰이 채운다**([[ADR-170]] 정정 10).
  `@gorhom/bottom-sheet` 는 `animatedKeyboardState.target` 이 비면 키보드가 떠도 시트를 안
  올린다. 아톰이 `onFocus` 에 그 값을 채우고, **켜져 있는 것이 나일 때만** 흐림·언마운트에서
  거둔다. **`BottomSheetTextInput` 을 쓰면 안 된다**(정책 테스트가 막는다): 그 부품은 안쪽이
  `react-native-gesture-handler` 의 입력이라 **안드로이드 한글 조합이 깨진다**(자모가 따로
  확정된다). 조합 입력만 그러므로 영문·숫자로 만져 보면 안 보이는 회귀다.
- **글자 칸에는 `value` 를 되쓰지 않는다**([[ADR-170]] 정정 12: 아톰이 키보드 종류로 가른다).
  부모가 다시 그리는 나무 안에서 `value` 로 글자를 되쓰면 **IME 의 조합 구간이 깨져 자모가 따로
  확정된다**(‘안녕’ → ‘ㅇㅏㄴㄴㅕㅇ’, iOS·안드로이드 둘 다·키보드 무관). 그래서 숫자 키패드 칸만
  `value` 로 통제하고(서식 `1,234` 가 그 되쓰기다) **글자 칸은 `defaultValue` 로 한 번만 심는다.**
  호출부는 종전대로 `value`/`onChangeText` 를 쓴다. 대가는 ‘밖에서 글자 칸을 갈아 끼울 수 없다’이고,
  필요하면 그 칸에 `key` 를 준다.
- **입력 칸의 상자는 아톰이 정한다**([[ADR-170]] 정정 13). 치수를 안 주면 플랫폼 기본값이 그대로
  드러난다(실측: 같은 칸이 **안드로이드 41.14dp · iOS 20.00pt**). 아톰이 `padding: 0` ·
  `includeFontPadding: false` · `textAlignVertical: 'center'` 를 **기본으로 깔고**, 호출부가 준 치수
  (`px-3 py-2` 등)는 그 뒤에 와서 이긴다.
- **자리표시자 색은 아톰이 건다**([[ADR-179]] 결정 5). `placeholderTextColor={definition.textDisabled}`.
  안 주면 RN 이 플랫폼 기본값을 쓰는데 `app.json` 이 `userInterfaceStyle: "automatic"` 이라 그 값이
  **OS 외관**을 따른다: OS 가 라이트인 채 앱 테마만 다크면 iOS 가 `#1A1A1C`(대비 **1.13**)를 그려
  **안 보인다**. 호출부가 직접 주면 그쪽이 이기고, `text-muted` 가 아닌 이유는 **자리표시자가 값이
  아니라 힌트**라서다. **`className`(`placeholder:…`)으로 쓰지 말 것**. 그 변형은 native 프리셋에서만
  `placeholderTextColor` 로 컴파일된다(jest 도 이제 native 프리셋으로 돈다 — [[ADR-179]] 정정 1)
  (앱에서는 되고 테스트로는 못 보는 자리가 된다).
- **글자를 치는 줄에는 최소 높이를 준다**(`min-h-7`). iOS 는 칸이 **내용의 글자 종류대로** 자기 키를
  잰다(한글 20 · 영문 14). 줄을 안 못 박으면 타건마다 줄이, 시트가 크는 구조에서는 **시트 전체가**
  들썩인다. `leading-*` 로는 안 잡힌다. iOS 는 `lineHeight` 를 측정에 안 쓴다(실측).
- **키보드 배선은 넷이 한 벌이다**(`BottomSheet` 조직체가 쥔다). 초점 채우기 ·
  `android_keyboardInputMode="adjustPan"` · `keyboardBlurBehavior="restore"` ·
  **키보드가 뜨면 아래 인셋을 걷기**(홈 인디케이터 몫은 키보드가 이미 덮고 있어 빈 띠가 된다).
  하나만 빠져도 증상이 각각 다르다: **안 올라간다 / 두 번 올라간다 / 안 내려온다 / 시트 끝과
  키보드 사이가 벌어진다.**
  `adjustPan` 인 이유는 **매니페스트의 `adjustResize` 가 죽은 값**이기 때문이다([[ADR-170]] 정정 11).
  이 앱은 edge-to-edge 라 IME 가 인셋으로만 오고 창은 안 줄어든다(계측: 키보드 312dp 에 창 높이 변화 0).
  그 프롭은 ‘매니페스트가 뭐라 적혀 있나’가 아니라 **‘창이 실제로 어떻게 되나’** 를 말하는 자리다.
- **칸에 묶인 글자는 `fixed` 를 준다**. today 위젯 전부 · 하단바 라벨 · 캐릭터 레일 초상의 폴백
  이니셜 · `Badge` 의 `chip`·`mini` 크기(상자가 `h-5`/`h-4` 고정이라 **자동으로**). 기준은 ‘작아 보인다’
  가 아니라 **‘상자가 글자를 따라 커지는가’** 다. 패딩으로 자라는 배지·버튼은 예외가 **아니다**
  (글자가 커지면 상자도 커진다).
- 새 화면을 그릴 때 크기를 고를 자유는 그대로다. 다만 `text-[8px]`~`[11px]` 대역은 **하한이 곧
  화면에 나오는 값**이므로(더 작아질 일이 없다) 그 자리에서만 판단하면 된다.

- **떠 있는 것은 자기 그림만큼만 막는다.** RN 에서 `opacity: 0` 도 `disabled` 도 **터치를 통과시키지
  않는다**. 안 보이는 층이 뒤를 먹는다([[ADR-170]] 정정 7). 접었다 폈다 하는 오버레이에는
  `pointerEvents={열렸나 ? 'auto' : 'none'}` 을, 그것을 담은 상자에는 `box-none` 을 준다.
- **스테퍼는 숫자만 오르내린다**([[ADR-173]] 결정 18). ‘인’·‘회’ 같은 단위를 안 적는다. 무엇을
  세는지는 곁의 라벨과 표식(`Users`)이 말한다. 단위를 `+` 옆에 붙이면 알약의 좌우가 어긋나고,
  단위가 없는 자리에서는 빈 칸만 남는다.

## 애니메이션
- 확정 애니메이션 없음(2026-07-11). hover 색 전환(`hover:bg-*`/`hover:text-*`) 정도만 Tailwind 기본. 페이드·슬라이드 등 명시적 트랜지션은 미도입, 필요해지면 추가.
- 기능 전용 연출(고가 드롭 강조 [[ADR-045]])은 [features/boss-profit.md](../features/boss-profit.md). 모든 모션은 `prefers-reduced-motion: no-preference` 에서만 재생(정적 폴백 유지)이 원칙.

## 아이콘
- **라이브러리: `lucide-react`**(확정). 새 아이콘은 이 라이브러리에서만. 다른 아이콘 **라이브러리** 혼용은 계속 금지다.
- **예외: 도메인 아이덴티티 아이콘은 직접 그린다**([[ADR-066]], 2026-07-31). 그 기능을 대표하는 자리에 한해 커스텀 SVG를 허용하되, **lucide 규격을 지키는 것이 조건**이다: 24 그리드 · `fill="none"` · `stroke="currentColor"` · `strokeLinecap`/`strokeLinejoin` `round` · 기본 `strokeWidth` 2 · 크기는 `className`이 정한다(`width`/`height` 속성은 lucide와 같은 24 폴백까지만: CSS가 속성보다 우선하므로 `h-5 w-5`가 항상 이기고, 폴백이 없으면 `className` 없이 쓸 때 인라인 SVG 기본값 300×150으로 부푼다). 규격을 지켜야 같은 줄에 선 lucide 아이콘과 선 굵기·광학 크기가 어긋나지 않는다. 겹침 표현은 `clipPath`·`mask`가 아니라 **뒤 요소의 선을 끊어서**(한 문서에 여러 번 렌더되면 마스크 `id`가 중복된다). 현재 해당: `ProfitIcon`(수익: 동전 더미 + 앞 동전) · `GearIcon`(하단바 톱니).
- **앱이 직접 그리는 SVG 는 두 디렉터리에 산다**([[ADR-199]]). 가르는 기준은 **움직이냐**다.

| 디렉터리 | 무엇 | 가져오는 법 |
|---|---|---|
| `atoms/Icon/` | `GearIcon` · `ProfitIcon` · `MapleLeaf`(브랜드 마크) | `import { ProfitIcon } from 'components/atoms/Icon'` |
| `atoms/Spinner/` | `MapleSpinner`(16px) · `MapleSweepSpinner`(24px 이상) | `import { MapleSweepSpinner } from 'components/atoms/Spinner'` |

- **뿌리는 `SvgFrame` 이 그린다**(`Icon/icon-base.tsx`). `size` → `width`·`height`, `className` → 색, 격자(`viewBox` + 비율)까지가 그 일이고 **칠에는 의견이 없다.** 격자는 둘이다 — lucide 24 정사각(`LUCIDE_GRID`)과 단풍잎 127×130(`LEAF_GRID`).
- **lucide 규격을 받는 것은 `IconSvg` 다** = `SvgFrame` + 선 프리셋. **새 lucide 계열 아이콘은 이것을 쓰고 좌표만 갖는다.** 뿌리를 직접 그리면 규격이 파일마다 갈리는데, 어긋나도 그림은 나와서 화면을 자세히 보기 전에는 모른다.
- **채운 그림에 `IconSvg` 를 쓰면 안 된다.** `stroke` 는 SVG 상속 속성이라 뿌리에 두면 자식이 전부 받아 2px 윤곽선이 얹힌다(실측). `MapleLeaf` 와 스윕 스피너가 `SvgFrame` 을 직접 쓰는 이유다.
- 프롭은 `IconProps` 하나다(하단바가 lucide 아이콘과 바꿔 끼우므로 이름이 같아야 한다).
- `strokeWidth`: 하단 탭바 `1.5`, 소형 액션(새로고침 등) `2`.
- 아이콘 컨테이너(둥근 배경 박스)로 감싸지 않는다. 강조색 아이콘을 배경 없이 단독으로. **예외 2곳**: 빈 상태 배지(위 `EmptyState`, [[ADR-060]]. 아이콘이 아니라 일러스트 자리)와 드롭 시트 카테고리 헤더.
- 현재 사용: 하단 탭바 `ListChecks`(컨텐츠)/`Swords`(보스)/`ProfitIcon`(수익, 커스텀)/`Settings`(설정), 새로고침 `RefreshCw`, 보스 카드 파티 배지 `Users`, 파티 스테퍼 `Minus`/`Plus`.
- **RN 하단바의 활성 아이콘은 ‘면’이다. 다만 가려서 채운다**([[ADR-132]] 정정 25). fill 과 stroke 가 같은 색이라, **안쪽에 선이 있는 그림은 채우는 순간 그 선이 사라진다**(조준경 → 원판, 달력 → 체크 소실). 통째로 채우는 것은 안쪽에 의미가 없는 넷뿐이고(`LayoutDashboard`·`Wrench`·`ShoppingCart`·`Swords`), 톱니와 수익은 **커스텀이라 채울 자리를 고른다**. `GearIcon` 은 lucide `settings` 와 같은 좌표를 한 패스로 다시 그려 `fillRule="evenodd"` 로 가운데를 비우고(설정 화면들은 계속 lucide `Settings` 를 쓴다), `ProfitIcon` 은 동전 두 개만 채우고 단을 그리는 호는 선으로 남긴다. **채우지 못하는 넷(달력·지갑·목록·조준경)은 대신 획을 굵힌다**(1.5 → 2.75, [[ADR-132]] 정정 27). 채우기와 굵히기는 **배타**다(둘 다 주면 채운 그림이 과해진다). **채운 그림에서는 구멍을 키운다**(톱니 r 3 → 4.5). 둘레의 획이 구멍 안쪽을 먹어 원래 크기로는 ‘덩어리 속 점’이 된다.
- **커스텀 SVG 에 `fill` 프롭을 열 때는 `?? 'none'` 을 붙일 것.** `undefined` 를 그대로 내려보내면 `react-native-svg` 가 뿌리의 `fill="none"` 을 상속하지 않고 **검정**으로 떨어뜨린다. 안 채우는 자리에서 아이콘이 새까매진다.

## NativeWind 가 안 가로채는 컴포넌트 ([[ADR-197]])

`className` 은 `react-native` 의 기본 컴포넌트(`View`·`Text`·`Pressable`)에만 자동으로 붙는다.
아래 넷은 **등록해야 붙고, 등록을 빼먹어도 에러가 안 난다**. 색과 크기만 조용히 사라진다.

| 쓸 것 | 어디서 가져오나 |
|---|---|
| SVG 를 그리는 컴포넌트 | `import { Svg } from 'lib/nativewind-interop'` |
| 그라디언트 배경 | `import { LinearGradient } from 'lib/nativewind-interop'` |
| 애니메이션이 붙는 상자 | `import { AnimatedView } from 'lib/nativewind-interop'` |
| lucide 아이콘 | `import { Users } from 'components/atoms'` |
| 커스텀 아이콘 | `import { ProfitIcon } from 'components/atoms/Icon'` |

- **`react-native-svg` 에서 직접 가져와도 되는 것은 자식 도형뿐이다**(`Path`·`Circle`·`Defs` 등).
  그것들은 `className` 을 안 받는다. 뿌리인 `Svg` 는 반드시 `lib/nativewind-interop` 에서.
- **새 lucide 아이콘은 `components/atoms/Icon/lucide.ts` 에 먼저 더한다.** 배럴(`from 'lucide-react-native'`)에서 바로
  가져오면 클래스가 무시되고 번들도 1.8MB 커진다.
- **아이콘에 `testID` 를 주지 말 것.** lucide 가 그것을 `data-testid` 로 바꿔서 `getByTestId` 가 못
  찾는다. 감싸는 `View` 에 준다.
- `View` 에 `animationName`·`transitionProperty` 를 주면 RN 이 모르는 키라 조용히 버린다.
  애니메이션이 붙는 상자는 `AnimatedView` 여야 한다.

## 안드로이드는 그릴 것이 없는 `View` 를 접는다 (2026-09-02)

`View` 에 배경도 테두리도 없으면 그릴 것이 없어서, RN 안드로이드가 네이티브 뷰를 아예 안 만들고
부모에 접어 넣는다. 그때 준 `rounded-*` 는 실릴 곳이 없다. 나중에 `bg-*` 가 붙어 뷰를 새로 만들 때
그 반지름이 따라오지 않아 **모서리가 각진 채로 그려진다**.

가계부 캘린더의 고른 날 동그라미가 그랬다. 안 고른 날은 `h-6 w-6 rounded-full` 뿐이라 접히고,
누르면 `bg-primary` 가 붙어 네모가 됐다. 처음부터 고른 날로 마운트되는 칸(오늘)은 멀쩡해서
**누른 칸에서만** 났다.

- **처방은 `collapsable={false}`** 다. 반지름을 갖는 `View` 인데 배경·테두리가 조건부면 붙인다.
- **`Pressable` 은 안 걸린다.** 터치 핸들러가 네이티브 뷰를 요구해 접히지 않는다. 테마 필터 칩
  (`ThemeSelector` 의 `CHIP_CLASS`)이 같은 모양인데 멀쩡한 이유가 그것이다.
- **iOS 는 안 걸린다.** `collapsable` 은 안드로이드에서만 뜻이 있고 다른 곳에서는 무시된다.
- 클래스 문자열도 구조도 아니다. 같은 클래스를 다른 자리에 두면 원으로 나오고, 고른 날로
  마운트되면 원으로 나온다. 갈리는 것은 **배경이 마운트 때 있었는가** 하나다.

## 폐기된 정책 (history)

- ~~하단바 활성 강조색은 `primary-ink` 를 `text` 쪽으로 ‘읽힐 때까지’ 민 값(대비 4.5 보장)~~ → **테마의 메인 컬러를 그대로 쓰고, 다크에서만 명도를 올린다**([[ADR-132]] 정정 23, 2026-08-14, 사용자 판정). 옛 규칙은 대비를 얻는 대신 **채도를 잃었다**. 머쉬맘의 주황 `#F58B0F` 이 갈색 `#8F5014`, 엔젤릭버스터의 분홍이 `#924774` 가 됐다. 옛 문장이 겨눈 ‘머쉬맘에서 대비 1.89’는 지금도 사실이고(라이트 원색 1.84~3.43), 그 값을 감수하는 쪽을 **사용자가 선택**한 것이다. 활성 자리는 이제 색 하나가 아니라 유리판·그림자(정정 22)·강조색이 함께 진다.
- ~~다크의 활성 강조색은 `textMuted` 보다 0.06 위까지 명도를 올린 값(채도는 sRGB 가 허용하는 만큼)~~ → **채도가 살아 있는 데까지만 올린다**([[ADR-132]] 정정 34, 2026-08-30, 사용자 판정: *"테마의 메인 컬러와 다르게 좀 칙칙"*). 목표 명도가 sRGB 밖이면 가뭄 매핑이 채도를 깎는데(검은마법사 C0.219 → 0.131), 그것은 정정 23 이 버린 ‘`text` 쪽으로 섞기’와 **같은 것을 빼앗는** 일이었다. 이제 채도가 상한이고 명도가 그 아래에서 움직인다. 검은마법사 `#FF93A4` → `#FF4977`(채도 100% 회복), 혼테일은 사실상 그대로(`#FF823C`), 레테는 안 바뀐다.

- ~~하단 고정 탭바: 화면이 2개 이상 되는 시점부터 `border-t` + 아이콘(위)·라벨(아래), 아직 화면 없는 기능 탭은 만들기 전까지 추가 안 함, 설정은 4번째 탭~~ → **RN 은 떠 있는 캡슐 + 두 층 + 뒤로가기**([[ADR-132]], 2026-08-13). 탭 넷이 화면 수 대비 포화해 ‘넷을 유지한다’는 전제 자체가 깨졌다. **웹에서는 옛 문장이 그대로 유효하다**(교체될 앱이라 옮기지 않는다). 딸린 ‘탭 이동은 캡처 단계 클릭 인터셉터가 책임진다’([[ADR-050]] 결정 1)도 웹 한정으로 남는다. RN 에는 앵커도 문서도 없어 그 사고 경로가 존재하지 않고, 광고 게이트는 바의 그룹 이동 핸들러가 맡는다([[ADR-132]] 결정 9).
- ~~경계 페이드는 색(그라데이션)과 블러(`backdrop-blur-sm`)를 같은 mask 로 함께 옅어지게 한다~~ → **그라데이션만으로 페이드한다**([[ADR-123]], 2026-08-10). `backdrop-filter` 가 만든 합성 레이어의 배경 스냅샷이 iOS 실기기에서 스탈해 잔상으로 남았다. 옛 문장이 겨눈 *"색만 옅어지고 블러는 그대로인 부자연스러운 경계"* 는 블러가 없으면 생기지 않는다.
- ~~429의 재시도 버튼은 비활성화하지 않는다(사용자 결정 2026-07-30)~~ → **액션 자체를 주지 않는다**([[ADR-114]] 결정 2, 2026-08-08, 이슈 #158). 옛 결정은 "초당 한도라면 잠시 뒤 재시도가 통한다"를 전제했으나, 사용자가 쓰는 개발 단계 키는 일 한도를 소진하면 다음 날까지 안 풀리고 새 처방은 재시도가 아니라 키 단계 확인이다.
- ~~스탈 배너는 문구 한 가지("목록이 최신이 아닙니다")에 "다시 시도" 고정~~ → 원인별 문구 + **옵셔널** 액션([[ADR-114]] 결정 3, 2026-08-08). `network` 계열은 옛 문구·액션 그대로라 폐기가 아니라 좁혀진 것이다.
- ~~보스 수익은 아직 문서 스크롤(요소 스크롤러 전환 범위 밖)~~ → 보스 수익도 자기 스크롤 컨테이너를 스크롤한다([[ADR-100]], 2026-08-06). [[ADR-099]] 결정 4가 "범위 밖"으로 미뤄둔 것을 그 ADR 이 폐기했고(스케줄러 4화면이 실기기 검증을 통과한 뒤로는 스크롤 모델이 둘로 남는 비용이 더 컸다), 이 절의 문장만 그때 함께 고쳐지지 않았다.
- ~~스크롤 영역의 헤더 블록은 `sticky top-0` 이고, 보스 수익만 `fixed`(그 화면에서만 증상이 관측됐으므로)~~ → 스케줄러 4화면도 `fixed` + 실측 spacer([[ADR-098]], 2026-08-06). 탭 이동도 같은 스크롤 클램프를 만들고, `sticky` 헤더는 그 프레임에 화면 밖으로 날아간다. [[ADR-085]] 결정 1의 조건("헤더가 문서 최상단 첫 요소라 보이는 모습이 동일")은 이 화면들에서도 성립한다.
- ~~모드 전환 대기는 모달 본문 하단 인라인 `MapleSpinner size=18` + "적용하고 있어요"~~ → 적용 버튼 안 16px + "적용 중"([[ADR-035]] 결정 23, 2026-08-03). 18px 은 두 대역(버튼 안 16 / 그 밖 24·32) 어디에도 없던 유일한 예외였고, 그 자리에 확인 버튼이 생기면서 대기를 그릴 자리가 규칙 안으로 들어왔다. 이로써 `~하고 있어요` 예시에서 "적용하고 있어요"가 빠진다.
- ~~당김 인디케이터는 문구 3상태(`당겨서 새로고침`/`놓으면 새로고침`/`새로고침하고 있어요`) + 채운 단풍잎 회전(진행률 × 180deg·불투명도 0.3~1), 재조회는 스윕 스피너~~ → 문구 없이 단풍잎 로고 링(진행률 드로잉 → 회전)([[ADR-074]], 2026-08-01). 지시문은 손이 이미 하는 동작을 읽어줄 뿐이고, 회전은 "얼마나 남았는지"를 못 말하며, 손을 뗄 때 마크가 바뀌면 한 동작이 둘로 끊겨 보인다.
- ~~당김 인디케이터는 sticky 헤더 아래 불투명 배너(`border-b border-border bg-bg`, 고정 `h-14` 내용을 위에서부터 드러냄), 목록은 고정~~ → 목록이 `transform: translateY()` 로 내려가고 벌어진 틈에 배경 없는 인디케이터([[ADR-073]], 2026-08-01). 배너 방식엔 "당겨진다"는 물리 감각이 없었고(사용자 반려), `transform` 은 레이아웃을 안 건드려 원래 근거(리플로우 없음·수익 헤더 실측 높이 불변)를 그대로 지킨다.
- ~~새 아이콘은 예외 없이 `lucide-react` 에서만 고른다~~ → 도메인 아이덴티티 자리는 lucide 규격을 지킨 커스텀 SVG를 허용([[ADR-066]], 2026-07-31). 선택된 그림(입체 동전 더미)이 라이브러리에 없었고, `Coins` 는 같은 소재의 평면 버전이라 대체가 되지 않았다. 다른 아이콘 **라이브러리** 혼용 금지는 그대로다.
- ~~수익을 가리키는 세 자리(탭바·총 수익 헤드라인·빈 상태)가 각자 lucide `Coins` 를 고른다~~ → 공용 `ProfitIcon` 한 곳([[ADR-066]], 2026-07-31). 셋이 같았던 것은 우연이라 한쪽만 바뀔 수 있었다.
- ~~일부 사용처의 배경 원으로 아이콘 감싸기~~ → 배경 없이 단독 사용으로 확정(2026-07-11).
- ~~비결정형 대기는 `MapleSpinner`(트레일 링) 한 종~~ → 크기로 2종, 24px 이상은 신규 `MapleSweepSpinner`([[ADR-061]], 2026-07-30).
- ~~결정형 진행률은 자리에 따라 `MapleWaveProgress`(화면)·얇은 바(모달)·`h-2` 바(OTA)~~ → 얇은 바 프리미티브 하나로 통일, `MapleWaveProgress`·`h-2` 변형 폐기([[ADR-061]], 2026-07-30).
- ~~로딩 자리마다 껍데기가 달랐다(텍스트 한 줄 / 점선 박스 / 없음)~~ → 목록·카드가 들어올 자리는 공용 셸 승계 카드 `LoadingState`, 점선은 빈 상태 전용([[ADR-061]], 2026-07-30).
- ~~대기 문구가 `~중...`과 `~하고 있어요`로 갈림~~ → 버튼 안은 `~중`(말줄임표 없음), 그 밖은 `~하고 있어요`, 말줄임표는 새로고침 옆 `조회 중...` 한 곳만([[ADR-061]], 2026-07-30).
- ~~피커·온보딩 조회 실패에 재시도 버튼을 두지 않는다(닫았다 다시 열면 재조회되므로 그 경로를 문구로 안내)~~ → 공용 `ErrorState` 가 원인별 액션(다시 시도 / 설정 열기)을 갖는다. 닫았다 여는 것으로 풀리지 않는 실패(401)가 있고, 원인을 못 보여주는 상태의 그 안내는 헛수고를 시킨다([[ADR-062]]가 [[ADR-053]] 결정 3 폐기, 2026-07-30).
- ~~실패 문구는 화면마다 `<p className="text-sm text-error">` 한 줄을 각자 보유~~ → 공용 `ErrorState`(아이콘 + 제목 + 설명 + 액션)([[ADR-062]], 2026-07-30).
- ~~에러 문구 어미가 인라인 `~습니다` / 토스트 `~어요` 로 갈림~~ → 실패·에러·불가는 `~습니다`, 성공·안내는 `~어요`, 진행 중은 `~하고 있어요`([[ADR-062]] 결정 5, 2026-07-30).
- ~~스케줄러 3화면이 동기화 실패를 헤더 아래 인라인 문단(`text-sm text-error`)으로 표시~~ → 토스트로 옮김. 지속 상태는 새로고침 옆 "n분 전"이 담당하고, 토스트에는 원인을 푸는 액션을 붙일 수 있다([[ADR-063]], 2026-07-30).
- ~~보스 수익 파티원 수 저장 실패를 카드 안 인라인 문단에 `err.message` 원문으로 표시~~ → 사용자 문구 토스트. 개발자용 문구·SQLite 네이티브 원문이 새던 유일한 자리였다([[ADR-063]] 결정 4, 2026-07-30).
- ~~일부 캐릭터 실패를 이름 나열로 표시("일부 캐릭터 동기화 실패: A, B: …")~~ → 인원 수를 담은 토스트. Toast 본문이 `truncate`라 이름은 잘렸다([[ADR-063]] 결정 5, 2026-07-30).
- ~~채움 배경 위 텍스트는 짙은 `#2B1206`(문서) / `text-white`(코드 7곳) / `text-bg`(코드 15곳)~~ → `on-*` 토큰([[ADR-064]] 결정 1, 2026-07-30). 셋 다 "primary는 충분히 어둡다"를 전제했고 지시된 적 없는 제한이었다. 밝은 파스텔 primary 테마에서 전부 깨진다.
- ~~틴트 배경은 Tailwind 투명도 접미사로 합성(`bg-primary/15` 등 67곳, 비율 4종)~~ → `*-tint` 값 토큰, 농도 15% 통일([[ADR-064]] 결정 2). 합성 결과가 깔리는 배경(`bg`/`surface`/`surface-2`)에 따라 달라져 대비를 보증할 수 없었다. `Toast`·`StaleBanner`가 이미 `color-mix`로 우회하던 것을 토큰으로 정식화.
- ~~틴트 위 텍스트에 base accent를 그대로 사용(`bg-primary/15 text-primary`, 35곳)~~ → `X-ink`([[ADR-064]] 결정 3). `-text` 토큰이 이 자리를 위해 만들어졌는데 정작 이 레시피가 안 썼다.
- ~~토큰 이름 `primary-text`/`secondary-text`/`third-text`~~ → `*-ink` 개명([[ADR-064]] 결정 3). 이름이 배경이 아니라 역할을 가리키게 했다. `on-X`는 X 채움 위 전경, `X-ink`는 X 계열 텍스트/아이콘.
- ~~진행률 트랙은 `bg-surface-2`~~ → `track` 토큰([[ADR-064]] 결정 4). 채움(`primary`)과의 3:1을 보증하는 주체가 없어, 파스텔 primary + 라이트 테마에서 진행률이 안 읽혔다.
- ~~모달·바텀시트 스크림은 `bg-bg/70`~~ → `scrim` 토큰([[ADR-064]] 결정 6). 배경색을 반투명하게 깐 것이라 밝은 테마에서 스크림이 약했다.
- ~~일러스트 카드는 앱 테마와 무관하게 레테 다크 리터럴 고정(`#1A1720`/`#37323E`/`#E8DFEC`, 23곳)~~ → `media-*` 토큰 + `.media-scope`([[ADR-064]] 결정 5). 스코프 안에서 기준 표면이 바뀌므로 카드 안팎이 같은 레시피를 쓴다. [[ADR-021]]에 미해결로 남아 있던 카드 내부 배지 AA 미달(레테 3.88:1)도 함께 닫힌다.
- ~~`ErrorState`는 `error-tint` 토큰을 만들지 않는다~~ → `error-tint`는 `color-mix` 파생이라 테마당 추가 비용이 0이므로 신설([[ADR-064]] 결정 2가 [[ADR-062]] 결정 1의 해당 항목 폐기, 2026-07-30).
- ~~업데이트 모달의 부 동작(`나중에`)이 주 동작과 같은 크기(`px-5 py-2.5 text-sm`)~~ → `px-4 py-1.5 text-xs` + 버튼 간격 `space-y-1`, 모달 하단 `pb-4`. `GHOST_BTN` 상수라 4개 분기에 함께 적용([[ADR-065]] 결정 2, 2026-07-30).
- ~~바텀 시트 몸통은 `bg`, 위에 `border-t border-border`~~ → 다크에서 표면 계열 넷을 한 칸 올린 **시트 스코프**, 테두리 없음([[ADR-179]], 2026-08-29). 몸통이 ‘자기가 덮는 페이지와 같은 토큰’이라 스크림 깔린 배경과 **1.03~1.05** 였고, 다크에서는 스크림을 아무리 진하게 해도 1.07 이 천장이라 어둡게 하는 쪽으로 길이 없었다.
- ~~`placeholderTextColor` 를 아무도 안 준다(앱 전체 0건)~~ → 아톰이 테마의 `textDisabled` 를 프롭으로 건다([[ADR-179]] 결정 5, 2026-08-29). 플랫폼 기본값이 **OS 외관**을 따라 테마와 어긋났다.
- 색·컴포넌트 규칙이 `{...}` 플레이스홀더였던 초기 UI_GUIDE → 작성 완료.
- ~~스케줄러 두 화면의 **캐릭터별** 동기화 실패는 헤더 아래 인라인 문단(`text-sm text-error-ink`)~~ → 토스트([[ADR-083]] 결정 1, 2026-08-02). [[ADR-063]] 결정 1이 지운 것은 전역 실패 문단뿐이었고, 실패의 대부분이 오는 캐릭터별 경로는 액션 없는 인라인으로 남아 있었다.
- ~~보스 수익 기간 로드 실패는 기간 라벨 아래 밑줄 버튼("이 기간을 불러오지 못했습니다. 다시 시도해주세요")~~ → **카드가 있을 때만** 토스트("이 기간을 불러오지 못했습니다" + 다시 시도), 카드가 없으면 `ErrorState` 유지([[ADR-083]] 결정 3, 2026-08-02).
- ~~온보딩 계정 선택 실패는 목록 상단 인라인 문구(`AccountSelectionList` 의 `errorMessage`)~~ → 토스트([[ADR-083]] 결정 4, 2026-08-02). 네 종류 중 셋은 이미 스토어가 토스트를 띄우고 있어 중복이었다.
- ~~캐릭터 관리 피커의 스크롤과 높이 상한은 `CharacterTrackingGrid` 가 갖는다(`max-h-[70vh] overflow-y-auto`)~~ → 카드가 `max-h-full` 로 **안전영역 뺀 화면** 안에 갇히고, 스크롤포트는 쓰는 쪽(모달 `-mr-6 pr-6` · 온보딩 `max-h-[70vh]`)이 갖는다([[ADR-107]], 2026-08-06). `vh` 는 시스템 바를 포함한 화면 전체라 안전영역이 큰 기기일수록 더 많이 침범했고, 카드 `p-6` 안쪽 스크롤포트는 인디케이터를 모달 끝에서 24px 안으로 들여놨다.
