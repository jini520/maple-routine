# 안내 사이트

`mapleroutine.store` 는 앱 홍보 첫 화면과, 스토어와 AdMob 이 요구하는 문서, API 키 발급 가이드를 올려 둔 정적
사이트다. 앱 기능을 웹으로 옮긴 것이 아니고, RN 앱과 코드를 함께 쓰지 않는다. 왜 이렇게 만들었는지는 [[ADR-015]]
에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `site/index.html` | 첫 화면(`/`)의 홍보 페이지. 빌드하지 않고 그대로 나간다 |
| `site/home.css` · `site/home.js` | 홍보 페이지만 쓰는 스타일과 폰 줄의 좌우 화살표 |
| `site/images/home/` | 홍보 페이지의 스크린샷 · 스토어 배지 · 앱 아이콘 · 공유 미리보기 그림 |
| `site/robots.txt` · `site/sitemap.xml` | 검색엔진이 읽는 수집 규칙과 페이지 목록 |
| `site/template.html` | 문서 페이지의 공통 틀(헤더 · 푸터 · 메타). `{{title}}` · `{{description}}` · `{{canonical}}` · `{{content}}` 를 채운다 |
| `site/style.css` | 라이트 · 다크 대응. 표는 따로 가로 스크롤되고, 본문 이미지는 화면 폭에 맞춘다 |
| `site/support.md` · `api-key.md` | 문서 페이지 본문 |
| `site/images/api-key/` | 발급 가이드 스크린샷 일곱 장 |
| `site/app-ads.txt` | AdMob 판매 권한 선언 |
| `PRIVACY.md` | 개인정보 처리방침 원본. 저장소 루트에 있다 |
| `scripts/build-site.mjs` | `npm run build:site` → `dist-site/` |
| `scripts/deploy-site.sh` | `npm run deploy:site`. 빌드하고 Oracle 로 올린다 |
| `app/auth/api-key-links.ts` | 앱이 여는 가이드 주소와 넥슨 Open API 주소 |
| `app/settings/SettingsAboutScreen.tsx` | 앱에서 `/privacy` 를 인앱 브라우저로 연다 |

## 페이지

| 주소 | 원본 | 쓰는 곳 |
|---|---|---|
| `/` | `site/index.html` | 앱 홍보. App Store 마케팅 URL · Play 웹사이트 |
| `/privacy` | `PRIVACY.md` | Play · App Store 등록정보의 개인정보 처리방침 URL, 앱 설정 |
| `/support` | `site/support.md` | App Store 지원 URL |
| `/api-key` | `site/api-key.md` | 앱의 키 입력 화면과 개발 단계 키 안내 모달 |
| `/app-ads.txt` | `site/app-ads.txt` | AdMob |
| `/robots.txt` · `/sitemap.xml` | `site/robots.txt` · `site/sitemap.xml` | 검색엔진 |

새 문서 페이지를 더할 때는 `build-site.mjs` 의 `PAGES` 배열에 `{ out, source }` 한 줄을 넣고, `site/sitemap.xml` 에도
주소를 더한다. 출력 경로가 주소를
정한다(`api-key/index.html` → `/api-key`). 이미지 같은 정적 파일은 `site/` 에 넣기만 하면 함께 나간다.

본문의 이미지 경로는 `/images/api-key/…` 처럼 절대 경로로 쓴다. 페이지가 `/api-key/` 아래에 있어서 상대 경로는
한 단계 어긋난다.

## 첫 화면

첫 화면은 기능마다 글과 폰 스크린샷을 놓은 홍보 페이지다. 폭 860px 이하에서 모바일 배치로 바뀌고, 폰 여러 대는
가로로 넘기는 줄에 놓고 좌우 화살표를 단다. 끝에 닿은 쪽 화살표는 흐려진다.

스토어 배지는 공식 그림을 쓰고 기기에 맞는 하나만 보여 준다. 규칙과 출처는 [[ADR-015]] 결정 9 에 있다. 검색엔진에
두는 정보(대표 주소 · 공유 미리보기 · 구조화 데이터 · `robots.txt` · `sitemap.xml`)는 결정 10 에 있다.

스크린샷을 바꿀 때는 `feat-debug-demo-seed` 브랜치의 데모 데이터로 시뮬레이터에서 찍고, 폭 620px webp 로 줄여
`site/images/home/` 에 넣는다.

## 검색엔진 등록

운영자 계정으로 사람이 한다. 소유 확인은 HTML 메타 태그로 하고, 받은 태그를 `site/index.html` 머리에 넣어 다시
배포한 뒤 각 도구에서 확인을 누른다. 확인이 끝나면 `https://mapleroutine.store/sitemap.xml` 을 제출한다.

| 도구 | 하는 일 |
|---|---|
| Google Search Console | URL 접두어 속성 `https://mapleroutine.store/` 를 만들고 메타 태그로 확인한다 |
| 네이버 서치어드바이저 | 사이트를 등록하고 메타 태그로 확인한다. 사이트맵 제출과 웹 페이지 수집 요청을 한다 |
| Bing 웹마스터 도구 | Google Search Console 에서 가져오기로 등록한다 |

## 배포

```
npm run deploy:site
```

1. `npm run build:site` 로 `dist-site/` 를 만든다.
2. `rsync -az --delete` 로 `ubuntu@158.179.175.230:/var/www/mapleroutine/` 에 올린다. `DEPLOY_HOST` ·
   `DEPLOY_DEST` 환경 변수로 바꿀 수 있다.
3. `/` · `/privacy` · `/support` · `/api-key` · `/app-ads.txt` · `/robots.txt` · `/sitemap.xml` 의 응답 코드를 출력한다.
   모두 `200` 인지 확인한다.

Oracle 접속 키는 배포하는 사람의 `~/.ssh` 에만 있다. `dist-site/` 는 커밋하지 않는다.

## `app-ads.txt`

```
google.com, pub-5278246170608284, DIRECT, f08c47fec0942fa0
```

광고를 사는 쪽은 입찰하기 전에 이 파일을 보고, 광고 지면을 파는 쪽이 정말 이 앱의 개발자인지 확인한다. 파일이
없으면 광고가 안 나오는 것은 아니지만 인증되지 않은 지면으로 취급되어 더 싸게 팔린다. 화면으로는 알 수 없는
문제다.

AdMob 은 스토어 등록정보의 개발자 웹사이트 주소를 보고, 그 도메인 루트에서 이 파일을 찾는다. 그래서 아래 세 값이
같은 도메인이어야 한다. `www.` 를 붙이면 다른 도메인으로 본다.

| 위치 | 값 | 확인하는 방법 |
|---|---|---|
| App Store 마케팅 URL | `https://mapleroutine.store/` | `itunes.apple.com/lookup?id=6797579391&country=kr` 의 `sellerUrl` |
| Play 스토어 등록정보 웹사이트 | `https://mapleroutine.store` | Play Console → 성장 관리 → 스토어 현황 → 스토어 설정 |
| 이 사이트 | `mapleroutine.store/app-ads.txt` | `curl -sS -w '%{http_code} %{content_type}'` 결과가 `200 text/plain` |

퍼블리셔 ID(`pub-5278246170608284`)는 `AndroidManifest.xml` 과 `Info.plist` 의 앱 ID 와 같은 AdMob 계정이어야
한다. 마지막 값 `f08c47fec0942fa0` 은 Google 의 인증 기관 ID 로, 모든 게시자가 같은 값을 쓴다.
