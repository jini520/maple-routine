/**
 * 떠 있는 하단바의 색. 값이 아니라 관계를 정의하는 표.
 *
 * 색을 하나씩 고치면 반드시 다른 하나가 깨진다(배경과 안 갈리고, 갈리게 하면 어두워지고,
 * 어두운 위의 강조색 글자는 안 읽힌다). 그래서 관계를 적고 테스트가 테마 전부에 대고 지킨다.
 *
 * | 관계 | 왜 | 최소(6테마) |
 * |---|---|---|
 * | 테두리 ↔ 페이지 배경 | 바가 떠 보이게 하는 것은 색이 아니라 가장자리다 | 1.35 |
 * | 알약 ↔ 바 | 활성 자리가 판으로 읽혀야 한다. 라이트는 옅게 | 다크 1.16 · 라이트 1.04 |
 * | 활성 라벨 ↔ 알약 | 글자는 읽혀야 한다 | 8.8 |
 * | 비활성 라벨 ↔ 바 | 같음 | 5.88 |
 *
 * 바탕은 그 모드에서 가장 밝은 표면이고 페이지와의 분리는 테두리가 맡는다. 어둡게 해서
 * 분리하려 들면 그 위 글자가 안 읽힌다.
 *
 * 활성 라벨은 강조색이 아니다. 강조는 아이콘이 지고 라벨은 `text` 다. `primary-ink` 로 두면
 * 테마에 따라 대비가 2.0 까지 내려간다.
 *
 * 테마 이름이 아니라 `mode` 로 분기한다.
 */

import { hexToOklch, mixOklab, oklchToHex, withChroma } from '../lib/color'
import type { ThemeDefinition } from '../types/theme'

function withAlpha(hex: string, alpha: number): string {
  const value = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${value}`
}

export interface BarColors {
  /** 캡슐 바탕. 그 모드에서 가장 밝은 표면. */
  readonly bar: string
  /**
   * 활성 알약. 유리가 그리는 그 판(`neutralPlate`)이다. ← 원도 같은 값을 쓴다.
   *
   * 라이트는 무채색이라 바와 1.04 밖에 안 갈린다. 그 자리를 메우는 것은 그림자고, 그래서 이
   * 값과 `PLATE_SHADOW` 는 함께 움직인다. 한쪽만 세게 하면 유리 쪽과 다시 갈린다.
   */
  readonly pill: string
  /** 테두리. 페이지와 바를 가르는 것은 색이 아니라 이 선이다. */
  readonly edge: string

  // 아래 셋은 iOS 26 Liquid Glass 에서만 쓴다.
  /**
   * 유리에 얹는 아주 옅은 색. 진하게 넣으면 재질이 색에 가려 그냥 반투명 판이 된다.
   */
  readonly glassTint: string
  /** 유리 가장자리. 재질 자체의 하이라이트에 **더해지는** 얇은 선이라 알파가 낮다. */
  readonly glassEdge: string
  /**
   * 유리 위 활성 알약의 tint. 채운 판이 아니라 조금 더 밝은 재질이다.
   *
   * 색조를 바꾸지 않는다. 바와 갈리는 일은 밝기 차 · 그림자 · 헤어라인이 한다.
   *
   * 라이트에서는 흰색을 얹는 게 아니라 덜어낸다. 흰 카드 위에서 알약만 흰 덩어리로 뭉개지는
   * 원인은 tint 가 아니라 `clear` 재질 자체가 얹는 하이라이트다. tint 를 0.38 → 0.12 로 내려도
   * 알약은 되레 밝아지고(253.2 → 253.3) 아예 빼도 뒤 카드보다 +11.4 다.
   *
   * 그래서 `text` 를 아주 옅게 깔아 그 하이라이트를 상쇄한다. 0.05 에서 알약이 뒤 카드와 같은
   * 밝기가 되고(+0.6) 바보다 5.9 낮아 캡슐이 렌즈로 읽힌다. 0.10 은 회색 판으로 죽는다.
   *
   * 다크는 반대로 둔다. 그 재질이 얹는 밝은 하이라이트가 다크에서는 원하는 방향이다.
   */
  readonly pillOnGlass: string

  /**
   * 활성 항목의 아이콘과 라벨이 함께 쓰는 색. 강조색을 읽힐 때까지 민 값.
   *
   * 둘 다 `primary-ink` 로 두면 머쉬맘에서 대비가 1.89 다. 그래서 색조는 두고 `text` 쪽으로
   * 밀어 4.5 를 넘긴다. 테마마다 미는 정도가 다르다(머쉬맘 0.5 · 렌 0.25 · 검은마법사 0.55).
   * 계산이라 새 테마가 들어와도 저절로 지켜진다.
   */
  readonly accent: string

  /**
   * 비활성 아이콘·라벨. 테마의 `textMuted` 에서 채도를 뺀 값.
   *
   * 바 안에서 색을 지는 자리는 활성 하나다. 레테의 `textMuted` 는 그 자체가 연보라라
   * (`#B89CBD`, 채도 C0.056. 여섯 중 가장 높고 혼테일의 4.7 배) 비활성까지 같은 보라 계열로
   * 읽힌다. 테마 이름으로 한 테마만 예외 두는 대신 규칙으로 둔다. 명도는 그대로라 바 위에서
   * 읽힌다 는 관계가 유지된다.
   *
   * 바 안에서만이다. 같은 테마의 다른 보조 텍스트(설정 부제 · 카드 캡션)는 `text-muted` 를
   * 그대로 쓴다. 그쪽까지 바꾸면 테마 정체성을 건드리게 된다.
   */
  readonly muted: string
}

/**
 * 강조색은 테마의 메인 컬러 그대로다. 다크에서만 명도를 올린다.
 *
 * `text` 쪽으로 섞어 대비 4.5 를 맞추면 채도를 같이 빼앗는다. 머쉬맘의 주황 `#F58B0F` 이
 * `#8F5014`(갈색)로, 엔젤릭버스터의 분홍이 `#924774`(칙칙한 자주)로 간다.
 *
 * 라이트는 원색을 그대로 쓴다. 밝은 판 위에서 메인 컬러는 이미 어두운 쪽이라 방향이 맞다.
 *
 * 다크는 원색이 판보다 어두워 활성이 비활성보다 흐려진다(레테 실측: 활성 원색 L0.60 대
 * `textMuted` L0.73). 이때만 명도만 올린다. 색상과 채도를 붙들어 그 테마의 색이 남는다.
 *
 * 다만 채도가 살아 있는 데까지만이다. 목표 명도가 sRGB 밖이면 `oklchToHex` 의 가뭄 매핑이
 * 채도를 깎아서 넣는다(검은마법사 C0.219 → 0.131). 그것은 `text` 쪽으로 섞기와 같은 것을
 * 빼앗는 일이다. 그래서 채도가 상한이고 명도가 그 아래에서 움직인다. 원 채도를 못 지키는
 * 지점에서 멈춘다.
 *
 * 대가는 검은마법사에서 활성이 비활성보다 어둡다는 것이다(L0.68 대 muted L0.72). 활성을
 * 세우는 일은 이미 색 혼자 지지 않는다(유리판·그림자 · 채운 아이콘 · 굵은 획).
 */
/** 명도를 재는 걸음. 이보다 잘게 재도 hex 8비트가 같은 색을 낸다. */
const LIFT_STEP = 0.005

/**
 * 채도 손실의 허용치. **절대값**이다. hex 8비트로 왕복하면 채도가 ±0.001 씩 흔들려서, 비율로
 * 재면 채도가 낮은 테마(레테 C0.099)가 그 흔들림만으로 첫 걸음에서 멈춘다.
 */
const CHROMA_TOLERANCE = 0.005

function liftAboveMuted(accent: string, muted: string): string {
  const target = hexToOklch(muted).l + 0.06
  const { l, c, h } = hexToOklch(accent)
  if (l >= target) return accent

  let lifted = accent
  for (let step = LIFT_STEP; l + step <= target + LIFT_STEP; step += LIFT_STEP) {
    const candidate = oklchToHex({ l: Math.min(l + step, target), c, h })
    // 가뭄 매핑이 채도를 깎기 시작했다. 여기가 메인 컬러로 남는 마지막 자리다.
    if (hexToOklch(candidate).c < c - CHROMA_TOLERANCE) break
    lifted = candidate
  }

  return lifted
}

/**
 * 폴백이 그리는 판. 유리가 그리는 그 판과 같은 물건이어야 한다.
 *
 * 유리 알약은 색을 얹지 않는다. `clear` 재질이 얹는 하이라이트를 `text` α.05 로 덜어낸 판이고,
 * 재질이 배경을 굴절시키며 채도까지 함께 빼 준다. iOS 실측 (246,245,245) 가 바 (254,243,249)
 * 옆에서 무채색 렌즈로 읽히는 이유다.
 *
 * 폴백에는 그 재질이 없으므로 둘 다 여기서 직접 한다. 바에서 `text` 쪽으로 아주 조금 밀고
 * 채도를 0 으로 뺀다.
 *
 * 맞추는 것은 tint 가 아니라 유리의 순 결과다. tint 만 옮기면(α.05 = 0.95) 판이 한참 어둡다.
 * 유리는 tint 로 내린 만큼을 재질의 하이라이트로 도로 올린다. 그래서 상수는 그 합을 실측해
 * 정한다. 0.98 에서 엔젤릭버스터가 `#F5F5F5` 로, iOS 실기 실측과 한 자리 안에서 만난다.
 *
 * 대가는 `렌`(표면이 순백)에서 판이 바와 1.04 밖에 안 갈린다는 것이다. 거기서는 그림자가
 * 판을 진다. 세기를 더 주고 싶어지면 판이 아니라 그림자를 볼 것. 판이 색을 지기 시작하면
 * 강조는 판이 아니라 글리프가 진다 는 규칙이 깨진다.
 */
function neutralPlate(bar: string, text: string): string {
  return withChroma(mixOklab(bar, text, 0.98), 0)
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
      // 다크에는 밝은 틴트가 없다. `primaryTint` 가 어두운 wash 라 알약으로 쓰면 오히려 가라앉는다.
      // `border` 를 면으로 쓴다. 그 모드에서 표면보다 한 단 밝은 중립값이 그것뿐이고, 조금만
      // 섞으면 레테처럼 표면과 테두리가 가까운 테마에서 분리가 1.16 까지 내려간다(실측).
      pill,
      // 어두운 배경 위에서는 `border` 단독이 약하다. `text` 쪽으로 밀어 가장자리를 세운다.
      edge: mixOklab(theme.border, theme.text, 0.6),
    }
  }

  return {
    glassTint: withAlpha(theme.surface, 0.3),
    glassEdge: 'rgba(255,255,255,0.6)',
    pillOnGlass: withAlpha(theme.text, 0.05),
    accent: theme.primaryInk,
    muted: withChroma(theme.textMuted, 0),
    bar: theme.surface,
    // 유리가 그리는 그 판이다. `pillOnGlass` 와 같은 방향(바에서 `text` 쪽으로 아주 조금)이고,
    // 유리 재질이 덤으로 빼 주는 채도까지 여기서 직접 뺀다.
    pill: neutralPlate(theme.surface, theme.text),
    // 라이트에서는 `border` 가 이미 표면 가장자리로 쓰이는 값이다. 그대로 쓴다.
    edge: theme.border,
  }
}
