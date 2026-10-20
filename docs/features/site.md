# 안내 사이트

`mapleroutine.store` 는 스토어와 AdMob 이 요구하는 문서와 API 키 발급 가이드를 올려 둔 정적 사이트다. 앱
기능을 웹으로 옮긴 것이 아니고, RN 앱과 코드를 함께 쓰지 않는다. 왜 이렇게 만들었는지는 [[ADR-015]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `site/template.html` | 공통 틀(헤더 · 푸터 · 메타). `{{title}}` · `{{description}}` · `{{content}}` 를 채운다 |
| `site/style.css` | 라이트 · 다크 대응. 표는 따로 가로 스크롤되고, 본문 이미지는 화면 폭에 맞춘다 |
| `site/index.md` · `support.md` · `api-key.md` | 페이지 본문 |
| `site/images/api-key/` | 발급 가이드 스크린샷 일곱 장 |
| `site/app-ads.txt` | AdMob 판매 권한 선언 |
| `PRIVACY.md` | 개인정보 처리방침 원본. 저장소 루트에 있다 |
| `scripts/build-site.mjs` | `npm run build:site` → `dist-site/` |
| `scripts/deploy-site.sh` | `npm run deploy:site`. 빌드하고 Oracle 로 올린다 |
| `app/auth/api-key-links.ts` | 앱이 여는 가이드 주소와 넥슨 Open API 주소 |
| `app/settings/SettingsPrivacyScreen.tsx` | 앱에서 `/privacy` 를 `WebView` 로 띄운다 |

## 페이지

| 주소 | 원본 | 쓰는 곳 |
|---|---|---|
| `/` | `site/index.md` | 앱 소개 |
| `/privacy` | `PRIVACY.md` | Play · App Store 등록정보의 개인정보 처리방침 URL, 앱 설정 |
| `/support` | `site/support.md` | App Store 지원 URL |
| `/api-key` | `site/api-key.md` | 앱의 키 입력 화면과 개발 단계 키 안내 모달 |
| `/app-ads.txt` | `site/app-ads.txt` | AdMob |

새 페이지를 더할 때는 `build-site.mjs` 의 `PAGES` 배열에 `{ out, source }` 한 줄을 넣는다. 출력 경로가 주소를
정한다(`api-key/index.html` → `/api-key`). 이미지 같은 정적 파일은 `site/` 에 넣기만 하면 함께 나간다.

본문의 이미지 경로는 `/images/api-key/…` 처럼 절대 경로로 쓴다. 페이지가 `/api-key/` 아래에 있어서 상대 경로는
한 단계 어긋난다.

## 배포

```
npm run deploy:site
```

1. `npm run build:site` 로 `dist-site/` 를 만든다.
2. `rsync -az --delete` 로 `ubuntu@158.179.175.230:/var/www/mapleroutine/` 에 올린다. `DEPLOY_HOST` ·
   `DEPLOY_DEST` 환경 변수로 바꿀 수 있다.
3. `/` · `/privacy` · `/support` · `/api-key` · `/app-ads.txt` 의 응답 코드를 출력한다. 모두 `200` 인지 확인한다.

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
