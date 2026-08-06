# 안내 사이트 (mapleroutine.store)

> **범위**: 스토어가 요구하는 개인정보 처리방침·지원 URL을 서빙하는 최소 정적 사이트. 앱 기능을 웹으로 옮기는 것이 아니다.
> **관련 소스**: `site/`(템플릿·스타일·페이지 마크다운) · `PRIVACY.md`(**개인정보 처리방침 원본**) · `scripts/build-site.mjs` · `.github/workflows/pages.yml` · `npm run build:site`.
> **관련 ADR**: [[ADR-090]](광고 도입 — 이 사이트가 필요해진 이유). **관련 문서**: [ads.md](./ads.md), [../foundation/product.md](../foundation/product.md).

## 왜 있는가

광고를 도입하면서 스토어 등록 요건이 늘었다([[ADR-090]] 결정 5).

| 요건 | 요구처 | URL |
|---|---|---|
| 개인정보 처리방침 | **Play · App Store 양쪽 필수** | `mapleroutine.store/privacy` |
| 지원(Support) URL | **App Store 필수** | `mapleroutine.store/support` |
| `app-ads.txt` | **AdMob** — 없으면 광고 수요가 줄어든다 | `mapleroutine.store/app-ads.txt` |

`product.md`의 "별도 공개 웹 서비스 — 보류"는 **여전히 유효하다.** 이 사이트는 랜딩·정보 서비스가
아니라 위 두 요건을 채우는 최소 문서 두 장이다.

## 구조

```
site/
  template.html   공통 셸(헤더·푸터·메타). {{title}} {{description}} {{content}} 치환
  style.css       라이트/다크 대응, 표는 자체 가로 스크롤
  index.md        앱 소개
  support.md      문의·자주 묻는 질문
  app-ads.txt     AdMob 판매 권한 선언(아래)
PRIVACY.md        개인정보 처리방침 ← 저장소 루트가 원본
scripts/build-site.mjs   → dist-site/
```

빌드 스크립트는 `site/` 에서 `.md` 와 `template.html` 만 **소스로 취급해 제외**하고 나머지를
그대로 복사한다. `style.css` 와 `app-ads.txt` 가 별도 설정 없이 나가는 이유가 이것이다 — 정적
자산을 추가할 때 스크립트를 고칠 필요가 없다.

**개인정보 처리방침의 원본은 `PRIVACY.md` 하나다.** 웹용 사본을 따로 두면 법적 문서가 두 벌이
되어 서로 다른 내용을 말하게 되므로, 빌드 시점에 렌더링해서 쓴다. 그래서 `PRIVACY.md` 를 고치면
사이트가 따라온다 — 반대로 사이트 쪽만 고치는 경로는 없다.

메타데이터를 프런트매터(`---`)가 아니라 **상단 HTML 주석**으로 읽는 이유도 같다. `PRIVACY.md` 는
GitHub에서도 그대로 읽히는 문서라 렌더링 안 되는 블록이 맨 위에 붙으면 안 된다.

## `app-ads.txt` — 이 사이트가 광고 수익에 관여하는 지점

**우리 앱의 광고 지면을 누가 팔 수 있는지 선언하는 파일**이다. 구매자(광고 수요처)는 입찰 전에
이 파일을 확인해서, 지면을 파는 주체가 진짜 개발자가 맞는지 검증한다. 없으면 **인증되지 않은
지면으로 취급돼 입찰에 참여하는 수요가 줄어든다** — 광고가 아예 안 뜨는 게 아니라 조용히 덜
비싸게 팔린다. [ads.md](./ads.md) 의 "증상 없는 실패" 계열이다.

```
google.com, pub-5278246170608284, DIRECT, f08c47fec0942fa0
```

**AdMob은 이 사이트를 스토어 등록정보를 통해 찾아온다.** 앱 스토어에 적힌 개발자 웹사이트 URL의
도메인 루트에서 `app-ads.txt` 를 크롤링하는 방식이라, 아래 세 값이 하나로 이어져야 한다.

| 고리 | 값 | 확인 방법 |
|---|---|---|
| App Store 마케팅 URL | `https://mapleroutine.store/` | `itunes.apple.com/lookup?id=6797579391` 의 `sellerUrl` |
| Play 스토어 등록정보 웹사이트 | `https://mapleroutine.store` | Play Console → 성장 관리 → 스토어 현황 → 스토어 설정 |
| 이 사이트 | `mapleroutine.store/app-ads.txt` | `curl -sS -w '%{http_code} %{content_type}'` → `200 text/plain` |

- **`www.` 를 붙이면 안 된다.** `mapleroutine.store` 와 `www.mapleroutine.store` 는 다른 도메인으로
  취급되고, 커스텀 도메인은 apex(`CNAME` 파일 = `mapleroutine.store`)로 잡혀 있다.
- **퍼블리셔 ID는 네이티브 설정의 앱 ID와 같은 계정이어야 한다.** 이 값은 `AndroidManifest.xml` ·
  `Info.plist` · `native/ads.ts` 에도 흩어져 있어 한쪽만 바뀌면 조용히 어긋난다 —
  `native/__tests__/ads.test.ts` 가 네 곳을 한꺼번에 읽어 드리프트를 잡는다.
- 마지막 필드 `f08c47fec0942fa0` 은 Google의 고정 인증 기관 ID다. 게시자마다 다른 값이 아니다.

## 배포

`main` 에 `site/**` · `PRIVACY.md` · 빌드 스크립트 · 워크플로가 바뀌면 GitHub Actions가
빌드해 Pages로 올린다(수동 실행도 가능). 앱 번들(vite)과는 완전히 별개다.

- `CNAME`(`mapleroutine.store`)과 `.nojekyll` 은 **빌드 스크립트가 생성한다** — 저장소에 두면
  잊고, `CNAME` 이 빠지면 배포할 때마다 커스텀 도메인 설정이 풀린다.
- `dist-site/` 는 `.gitignore` 대상이다.

### 최초 1회 설정 (사용자 작업)

1. **저장소 → Settings → Pages → Source 를 "GitHub Actions" 로**
2. **가비아 DNS 관리**에서 레코드 추가 — 네임서버는 가비아에 그대로 둔다

   | 타입 | 호스트 | 값 |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `jini520.github.io.` |

3. DNS 전파 후 저장소 → Settings → Pages 에서 **Enforce HTTPS** 체크

## 열린 질문

- **App Store 배지·다운로드 링크를 `index.md` 에 추가할지** — 2026-08-06 App Store 게시
  (`id6797579391`)로 링크할 대상이 생겼다. Play는 아직 미게시라 한쪽만 먼저 붙일지 함께 붙일지 미정

> 앱 설정 화면의 개인정보 처리방침 링크는 **완료**됐다(2026-08-04, `SettingsScreen.tsx`) — 열린
> 질문에서 내린다.
