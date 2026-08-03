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

`product.md`의 "별도 공개 웹 서비스 — 보류"는 **여전히 유효하다.** 이 사이트는 랜딩·정보 서비스가
아니라 위 두 요건을 채우는 최소 문서 두 장이다.

## 구조

```
site/
  template.html   공통 셸(헤더·푸터·메타). {{title}} {{description}} {{content}} 치환
  style.css       라이트/다크 대응, 표는 자체 가로 스크롤
  index.md        앱 소개
  support.md      문의·자주 묻는 질문
PRIVACY.md        개인정보 처리방침 ← 저장소 루트가 원본
scripts/build-site.mjs   → dist-site/
```

**개인정보 처리방침의 원본은 `PRIVACY.md` 하나다.** 웹용 사본을 따로 두면 법적 문서가 두 벌이
되어 서로 다른 내용을 말하게 되므로, 빌드 시점에 렌더링해서 쓴다. 그래서 `PRIVACY.md` 를 고치면
사이트가 따라온다 — 반대로 사이트 쪽만 고치는 경로는 없다.

메타데이터를 프런트매터(`---`)가 아니라 **상단 HTML 주석**으로 읽는 이유도 같다. `PRIVACY.md` 는
GitHub에서도 그대로 읽히는 문서라 렌더링 안 되는 블록이 맨 위에 붙으면 안 된다.

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

- 앱 설정 화면에서 개인정보 처리방침으로 나가는 링크 — 아직 없다(스토어 관행상 넣는 편이 좋다)
- 스토어 출시 후 배지·다운로드 링크를 `index.md` 에 추가할지
