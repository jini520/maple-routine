# 기능 설명 이미지 (`src/assets/guide/`)

`src/data/feature-guides/**` 의 안내가 **직접 import** 하는 스크린샷 자리다([[ADR-125]] 결정 4).

```
src/assets/guide/<안내 id>/<번호>-<무엇>.webp
예) src/assets/guide/boss-party/01-card.webp
```

- 폴더 이름은 **안내 id** 다(`FeatureGuide.id`). 안내가 두 그룹에 서기도 하므로 그룹으로 나누지 않는다.
- 형식은 **`.webp`**.
- 넣는 법 — 그 안내 파일 상단의 주석 처리된 `import` 를 풀고, 해당 블록에 `image: { src, alt }` 를 넣는다. 대체 텍스트는 타입이 강제하므로 빠뜨릴 수 없다.
- **`import.meta.glob` 을 쓰지 않는다.** 파일명이 틀렸을 때 `undefined` 로 조용히 통과하는 대신 빌드가 실패해야 한다.

**OTA 는 `dist` 전체를 압축해 내려주므로 여기 넣는 이미지가 곧 번들 용량이다** — 지연 로드가 깎아 주지 않는다. 기준선(이미지 0장, 2026-08-10): zip 5.6MB.
