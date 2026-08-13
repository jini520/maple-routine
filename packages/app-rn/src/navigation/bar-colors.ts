/**
 * 떠 있는 바의 색 — [[ADR-132]] 결정 11 + 정정 12.
 *
 * ## 네 값이 서로를 붙든다
 *
 * 색을 하나씩 고치다 보면 반드시 다른 하나가 깨진다(실제로 세 판을 그렇게 돌았다 — 배경과 안 갈리고,
 * 갈리게 했더니 어두워지고, 어두운 위에 강조색 글자를 얹었더니 안 읽혔다). 그래서 이 파일은 값이
 * 아니라 **관계**를 정의하고, 그 관계를 테스트가 테마 전부에 대고 지킨다.
 *
 * | 관계 | 왜 | 최소(6테마) |
 * |---|---|---|
 * | 테두리 ↔ 페이지 배경 | 바가 페이지에서 떠 보이게 하는 것은 «색» 이 아니라 **가장자리**다 | 1.35 |
 * | 알약 ↔ 바 | 활성 자리가 판으로 읽혀야 한다 | 1.16 |
 * | 활성 라벨 ↔ 알약 | **글자는 읽혀야 한다** | 8.8 |
 * | 비활성 라벨 ↔ 바 | 〃 | 5.88 |
 *
 * ## 바는 «밝은 쪽» 이다 (정정 12)
 *
 * 한때 배경과 갈라내려고 바탕을 `border` 쪽으로 밀었는데, 그러면 **바가 어두워지고 그 위 글자가
 * 안 읽힌다**(사용자 판정). 지금은 반대다 — 바탕은 그 모드에서 가장 밝은 표면(`surface` ·
 * 다크는 `surface2`)이고, **페이지와의 분리는 테두리가 맡는다.** 색을 어둡게 해서 분리하려던 것이
 * 애초에 잘못된 축이었다.
 *
 * ## 활성 «라벨» 은 강조색이 아니다
 *
 * 강조색은 아이콘이 진다. 라벨까지 `primary-ink` 로 두면 테마에 따라 대비가 **2.0** 까지 내려간다
 * (머쉬맘 `primaryInk` 는 밝은 주황 `#F58B0F` 라 밝은 알약 위에서 거의 안 보인다). 라벨을 `text` 로
 * 두면 8.8 이상이 나온다 — 강조는 남고 글자는 읽힌다.
 *
 * 테마 **이름**이 아니라 `mode` 로 분기하는 것은 [[ADR-064]] 결정 8 그대로다.
 */

import { hexToOklch, mixOklab, oklchToHex, withChroma } from '@core/lib/color'
import type { ThemeDefinition } from '@core/types/theme'

function withAlpha(hex: string, alpha: number): string {
  const value = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${value}`
}

export interface BarColors {
  /** 캡슐 바탕 — 그 모드에서 **가장 밝은 표면**. */
  readonly bar: string
  /** 활성 알약. 바와 갈리되 그 위 글자(`text`)가 읽히는 밝기를 지킨다. */
  readonly pill: string
  /** 테두리 — **페이지와 바를 가르는 것은 이 선이다**(색이 아니라). */
  readonly edge: string

  // ── 아래 셋은 iOS 26 «Liquid Glass» 에서만 쓴다 (정정 13) ──────────────────────
  /**
   * 유리에 얹는 **아주 옅은** 색. 진하게 넣으면 재질이 색에 가려 그냥 반투명 판이 된다 —
   * 한 번 그렇게 만들었다가 «글라스 느낌이 전혀 안 난다» 로 반려됐다.
   */
  readonly glassTint: string
  /** 유리 가장자리. 재질 자체의 하이라이트에 **더해지는** 얇은 선이라 알파가 낮다. */
  readonly glassEdge: string
  /**
   * 유리 위 활성 알약의 tint — 채운 판이 아니라 «조금 더 밝은 재질» 이다.
   *
   * **색조를 바꾸지 않는다.** 활성 자리를 강조색으로 칠하는 판을 한 번 만들었다가 되돌렸다 —
   * 지시에 없던 변경이었고, 그 근거였던 «흰 테마에서 알약이 안 보인다» 도 오진이었다(활성 항목이
   * 크롭 밖에 있었다). 바와 갈리는 일은 **밝기 차 + 그림자 + 헤어라인**이 한다.
   *
   * **라이트에서는 흰색을 «얹는» 게 아니라 «덜어낸다».** 사용자가 «가계부 쪽은 유리가 안 돼
   * 있다» 로 잡은 증상 — 흰 카드 위에서 알약만 흰 덩어리로 뭉개지고, 같은 화면의 ← 는 뒤 분홍이
   * 비쳤다 — 의 원인은 tint 가 아니라 **`clear` 재질 자체가 얹는 하이라이트**다. tint 를 0.38 →
   * 0.12 로 내려도 알약은 되레 밝아졌고(253.2 → 253.3), **아예 빼도** 뒤 카드보다 +11.4 였다.
   *
   * 그래서 `text` 를 아주 옅게 깔아 그 하이라이트를 상쇄한다. 0.05 에서 알약이 뒤 카드와 같은
   * 밝기로 «통과» 하고(+0.6) 바보다 5.9 낮아 캡슐이 렌즈로 읽힌다. 0.10 은 회색 판으로 죽는다.
   * 어두운 아트워크 위에서도 성립한다(배경 27 · 알약 205 · 바 198 — 관계가 뒤집혀도 갈린다).
   *
   * 다크는 반대로 둔다. 그 재질이 얹는 밝은 하이라이트가 다크에서는 **원하는 방향**이라 상쇄할
   * 이유가 없다. 다만 다크 유리는 아직 눈으로 확인한 적이 없다([[ADR-132]] 열린 질문).
   */
  readonly pillOnGlass: string

  /**
   * 활성 항목의 **아이콘과 라벨이 함께 쓰는** 색 — 강조색을 «읽힐 때까지» 민 값.
   *
   * 아이콘만 `primary-ink`, 라벨은 `text` 로 갈라 뒀더니 «색이 안 맞는다» 는 판정을 받았다
   * (사용자, 2026-08-13). 그렇다고 둘 다 `primary-ink` 로 두면 머쉬맘에서 대비가 **1.89** 다.
   * 그래서 색조는 두고 **`text` 쪽으로 밀어** 4.5 를 넘긴다 — 테마마다 미는 정도가 다르다
   * (머쉬맘 0.5 · 렌 0.25 · 검은마법사 0.55). 계산이라 새 테마가 들어와도 저절로 지켜진다.
   */
  readonly accent: string

  /**
   * 비활성 아이콘·라벨 — 테마의 `textMuted` 에서 **채도를 뺀** 값 (정정 24).
   *
   * 바 안에서 **색을 지는 자리는 활성 하나**다. 레테의 `textMuted` 는 그 자체가 연보라라
   * (`#B89CBD`, 채도 C0.056 — 여섯 중 가장 높고 혼테일의 4.7 배) 비활성까지 같은 보라 계열로
   * 읽혔다(사용자 관찰 — *"레테 테마만 비활성 탭의 색이 같은 보라계열이야"*).
   *
   * 테마 이름으로 레테만 예외 두는 것은 [[ADR-064]] 결정 8 이 막는다. 그래서 규칙으로 둔다 —
   * **바의 비활성은 무채색**. 명도는 그대로라 «바 위에서 읽힌다» 는 관계는 유지된다.
   *
   * **바 안에서만** 이다. 같은 테마의 다른 보조 텍스트(설정 부제 · 카드 캡션)는 `text-muted` 를
   * 그대로 쓴다 — 그쪽까지 바꾸면 테마 정체성을 건드리게 된다(사용자 선택, 2026-08-14).
   */
  readonly muted: string
}

/**
 * 강조색은 **테마의 메인 컬러 그대로**다 — 다크에서만 명도를 올린다 (정정 23).
 *
 * 예전에는 `text` 쪽으로 섞어 대비 4.5 를 맞췄는데, 그 방향은 **채도를 같이 빼앗는다**. 머쉬맘의
 * 주황 `#F58B0F` 이 `#8F5014`(갈색)로, 엔젤릭버스터의 분홍이 `#924774`(칙칙한 자주)로 갔다 —
 * 사용자 판정 *"active 탭의 컬러가 왜 저래? 테마의 메인컬러를 넣어."*
 *
 * 라이트는 원색을 그대로 쓴다. 밝은 판 위에서 메인 컬러는 이미 «어두운 쪽» 이라 방향이 맞다.
 *
 * 다크는 반대다 — 원색이 판보다 어두워서 **활성이 비활성보다 흐려진다**(레테 실측: 활성 원색
 * L0.60 vs `textMuted` L0.73). 이때만 `withLightness` 로 **명도만** 올린다. 색상과 채도를 붙들기
 * 때문에 그 테마의 색은 남는다 — 섞어서 미는 것과 결정적으로 다른 점이다([[ADR-064]] 결정 8).
 */
function liftAboveMuted(accent: string, muted: string): string {
  const target = hexToOklch(muted).l + 0.06
  const { l, c, h } = hexToOklch(accent)

  return l >= target ? accent : oklchToHex({ l: target, c, h })
}

export function resolveBarColors(theme: ThemeDefinition): BarColors {
  if (theme.mode === 'dark') {
    const pill = theme.border

    return {
      glassTint: withAlpha(theme.surface2, 0.28),
      glassEdge: 'rgba(255,255,255,0.22)',
      pillOnGlass: 'rgba(255,255,255,0.1)',
      accent: liftAboveMuted(theme.primaryInk, theme.textMuted),
      muted: withChroma(theme.textMuted, 0),
      bar: theme.surface2,
      // 다크에는 밝은 틴트가 없다 — `primaryTint` 가 어두운 wash 라 알약으로 쓰면 오히려 가라앉는다.
      // `border` 를 **면으로** 쓴다: 그 모드에서 «표면보다 한 단 밝은» 유일한 중립값이고, 조금만
      // 섞으면 레테처럼 표면과 테두리가 가까운 테마에서 분리가 1.16 까지 내려간다(실측).
      pill,
      // 어두운 배경 위에서는 `border` 단독이 약하다. `text` 쪽으로 밀어 가장자리를 세운다.
      edge: mixOklab(theme.border, theme.text, 0.6),
    }
  }

  const pill = mixOklab(theme.primaryTint, theme.primary, 0.85)

  return {
    glassTint: withAlpha(theme.surface, 0.3),
    glassEdge: 'rgba(255,255,255,0.6)',
    pillOnGlass: withAlpha(theme.text, 0.05),
    accent: theme.primaryInk,
    muted: withChroma(theme.textMuted, 0),
    bar: theme.surface,
    // 틴트 단독은 바(거의 흰색)와 1.11 밖에 안 갈린다. `primary` 를 조금 섞어 판으로 세운다.
    pill,
    // 라이트에서는 `border` 가 이미 «표면 가장자리» 로 쓰이는 값이다 — 그대로 쓴다.
    edge: theme.border,
  }
}
