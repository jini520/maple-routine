#!/usr/bin/env python3
"""고가 드롭 연출(DropEff) 프레임 origin 계측 스크립트 (ADR-048).

`src/lib/drop-effect-layout.ts` 의 DROP_EFFECT_ORIGINS 테이블을 만들어 낸 도구다.

왜 필요한가:
  인게임 클라이언트는 WZ 스프라이트마다 origin 좌표를 갖고 그 점 기준으로 렌더링하지만,
  이 프로젝트 에셋은 원본 PNG 시퀀스를 검은배경 JPEG로 최적화하며(ADR-038 결정 9)
  origin 메타데이터가 유실됐다. 그래서 값을 추정하지 않고 비트맵에서 계측해 복원한다.

언제 다시 돌리나:
  `src/assets/drop-effect/{pre,loop,end}` 를 다시 export 했을 때. 테이블과 에셋은
  인덱스로만 묶여 있어서, 프레임 수가 어긋나는 것만 단위 테스트가 잡고 값의 드리프트는
  잡지 못한다. 에셋을 갈아끼웠으면 이 스크립트를 돌려 테이블을 통째로 교체할 것.

사용법:
  pip install numpy pillow
  python3 scripts/measure-drop-effect-origins.py            # TS 테이블 + 정합 지표 출력
  python3 scripts/measure-drop-effect-origins.py --metrics  # 지표만

계측 방법:
  ① 하단 80행(지면 플레어)의 휘도 가중 중심을 x 초기값으로 잡고,
  ② loop 전 프레임 평균을 템플릿 삼아 matched filter(Σ template·frame)로 재정합,
  ③ 템플릿을 다시 만들며 ITERATIONS 회 반복, ④ 포물선 보간으로 x 를 서브픽셀까지 내린다.
  pre/end 는 기둥 길이가 달라 SSD 가 아니라 matched filter 를 쓴다 — 겹치는 하단부만으로
  정합되므로 짧은 프레임(pre/0)이나 꺼져가는 프레임(end/4)도 같은 기준으로 맞는다.

  y 는 정합 중에는 자유도로 열어 두지만(±SEARCH_RADIUS_Y), 결과는 쓰지 않고 **출력 테이블의
  y 는 항상 비트맵 높이**다. 렌더링 기준이 지면선이고 그게 곧 비트맵 바닥이기 때문 — 전 프레임의
  콘텐츠 하단 여백이 3~6px로 일정하고, 세로 정합 점수 곡선은 ±12px 구간에서 5% 이내로 평평해
  세로 미세조정은 신호가 아니라 노이즈다. 그럼에도 정합 중에 y 를 묶어두지 않는 이유는 그래야
  x 가 조금 더 안정적으로 잡히기 때문이다(기둥 몸통 축 표준편차 0.37px vs 묶었을 때 0.44px).

  런타임은 2자유도 탐색이라 39프레임 기준 30초 안팎이다.
"""

import argparse
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:  # pragma: no cover - 개발자 도구라 런타임 의존성 아님
    sys.exit("numpy 와 pillow 가 필요합니다: pip install numpy pillow")

ASSETS = Path(__file__).resolve().parent.parent / "src" / "assets" / "drop-effect"
PHASES = ("pre", "loop", "end")

# 정합용 캔버스. 가장 큰 프레임(약 285x826)이 앵커 기준으로 다 들어가고 탐색 여유가 있으면 된다.
CANVAS_H, CANVAS_W = 900, 560
ANCHOR_X, ANCHOR_Y = 280, 862

SEARCH_RADIUS_X = 24  # 관측된 최대 어긋남이 26px 이라 넉넉히 잡는다.
SEARCH_RADIUS_Y = 8  # 정합 자유도로만 쓰고 결과는 버린다(docstring 참고).
# 템플릿이 매 회 갱신돼 마지막까지 1px 안팎에서 미세하게 흔들린다 — 수렴을 기다리지 않고 회차로 끊는다.
# 이 값을 바꾸면 결과가 서브픽셀 단위로 달라진다(현재 테이블은 6회 기준).
ITERATIONS = 6
EMPTY_MAX = 0.05  # 이 밝기에 못 미치면 정합할 내용이 없는 프레임(end 마지막 = 완전 페이드아웃)


def load_phase(phase):
    """`0.jpg`, `1.jpg` … 를 숫자 순으로 읽는다(파일명 렉시코 정렬 함정 방지: 10 < 2)."""
    paths = sorted(
        (ASSETS / phase).glob("*.jpg"), key=lambda p: int(p.stem)
    )
    if not paths:
        sys.exit(f"프레임을 찾을 수 없습니다: {ASSETS / phase}")
    return [np.asarray(Image.open(p).convert("L"), dtype=np.float32) / 255 for p in paths]


def base_axis(frame, rows=80):
    """하단 `rows` 행(지면 플레어)의 휘도 가중 x 중심. 희미한 꼬리는 잘라 낸다."""
    col = frame[-rows:].sum(axis=0)
    col = np.maximum(col - col.max() * 0.05, 0)
    return float((col * np.arange(frame.shape[1])).sum() / max(col.sum(), 1e-6))


def place(frame, origin_x, origin_y=None):
    """origin 이 캔버스 앵커에 오도록 프레임을 올린다. origin_y 기본값은 비트맵 하단."""
    canvas = np.zeros((CANVAS_H, CANVAS_W), np.float32)
    h, w = frame.shape
    if origin_y is None:
        origin_y = h
    top, left = int(round(ANCHOR_Y - origin_y)), int(round(ANCHOR_X - origin_x))
    y0, x0 = max(top, 0), max(left, 0)
    y1, x1 = min(top + h, CANVAS_H), min(left + w, CANVAS_W)
    if y1 > y0 and x1 > x0:
        canvas[y0:y1, x0:x1] = frame[y0 - top : y1 - top, x0 - left : x1 - left]
    return canvas


def refine(frame, origin_x, origin_y, template):
    """matched filter 로 (x, y)를 다시 맞추고, x 만 포물선 보간으로 서브픽셀까지 내린다."""
    scores = {
        (dx, dy): float((template * place(frame, origin_x + dx, origin_y + dy)).sum())
        for dy in range(-SEARCH_RADIUS_Y, SEARCH_RADIUS_Y + 1)
        for dx in range(-SEARCH_RADIUS_X, SEARCH_RADIUS_X + 1)
    }
    best_dx, best_dy = max(scores, key=scores.get)
    sub = 0.0
    if abs(best_dx) != SEARCH_RADIUS_X:  # 경계에 붙었으면 보간 불가
        left = scores[(best_dx - 1, best_dy)]
        center = scores[(best_dx, best_dy)]
        right = scores[(best_dx + 1, best_dy)]
        denom = left - 2 * center + right
        if denom != 0:
            sub = max(-0.5, min(0.5, 0.5 * (left - right) / denom))
    return origin_x + best_dx + sub, origin_y + best_dy


def measure(frames):
    """프레임별 (x, 정합용 y)를 돌려준다. 테이블에 쓰는 y 는 여기 결과가 아니라 비트맵 높이다."""
    origins = {
        p: [(base_axis(f), float(f.shape[0])) for f in frames[p]] for p in PHASES
    }
    for iteration in range(ITERATIONS):
        template = sum(
            place(f, x, y) for f, (x, y) in zip(frames["loop"], origins["loop"])
        ) / len(frames["loop"])
        moved = 0.0
        for phase in PHASES:
            updated = []
            for frame, (x, y) in zip(frames[phase], origins[phase]):
                if frame.max() < EMPTY_MAX:  # 빈 프레임은 정합 대상이 아니다
                    updated.append((frame.shape[1] / 2, y))
                    continue
                nx, ny = refine(frame, x, y, template)
                moved = max(moved, abs(nx - x), abs(ny - y))
                updated.append((nx, ny))
            origins[phase] = updated
        print(f"  iter {iteration}: 최대 이동 {moved:.2f}px", file=sys.stderr)
    return origins


def beam_axis(canvas, top=620, bottom=120):
    """정렬 결과 평가용 — 기둥 몸통 구간의 축 x."""
    band = canvas[ANCHOR_Y - top : ANCHOR_Y - bottom]
    col = band.sum(axis=0)
    col = np.maximum(col - col.max() * 0.1, 0)
    if col.sum() < 1e-6:
        return None
    return float((col * np.arange(CANVAS_W)).sum() / col.sum())


def report_metrics(frames, origins):
    print("\n정합 지표 — loop 전 프레임, 기둥 몸통 축 x")
    print(f"{'':<22}{'표준편차':>10}{'최대-최소':>12}{'프레임 간 최대 점프':>22}")
    for label, get_x in (
        ("하단-중앙(기존 방식)", lambda f, x: f.shape[1] / 2),
        ("origin 테이블", lambda f, x: x),
    ):
        xs = [
            v
            for v in (
                beam_axis(place(f, get_x(f, x)))
                for f, (x, _) in zip(frames["loop"], origins["loop"])
            )
            if v is not None
        ]
        arr = np.array(xs)
        jump = np.abs(np.diff(arr)).max()
        print(f"{label:<22}{arr.std():>9.2f}px{np.ptp(arr):>11.2f}px{jump:>21.2f}px")


def emit_table(frames, origins):
    print("\n// ↓ src/lib/drop-effect-layout.ts 의 DROP_EFFECT_ORIGINS 를 통째로 교체\n")
    print("export const DROP_EFFECT_ORIGINS: Record<DropEffectPhase, readonly DropEffectOrigin[]> = {")
    for phase in PHASES:
        print(f"  {phase}: [")
        for i, (frame, (x, _)) in enumerate(zip(frames[phase], origins[phase])):
            h, w = frame.shape  # y 는 정합 결과가 아니라 항상 비트맵 높이(= 지면선)
            note = "" if frame.max() >= EMPTY_MAX else " — 전 픽셀 검정, 정합 대상 없음(하단-중앙)"
            print(f"    [{round(x, 1)}, {h}], // {i} ({w}x{h}){note}")
        print("  ],")
    print("}")


def main():
    parser = argparse.ArgumentParser(description="DropEff 프레임 origin 계측 (ADR-048)")
    parser.add_argument("--metrics", action="store_true", help="TS 테이블 없이 지표만 출력")
    args = parser.parse_args()

    frames = {p: load_phase(p) for p in PHASES}
    print(
        "프레임: " + ", ".join(f"{p} {len(frames[p])}장" for p in PHASES) + " — 정합 시작",
        file=sys.stderr,
    )
    origins = measure(frames)
    report_metrics(frames, origins)
    if not args.metrics:
        emit_table(frames, origins)


if __name__ == "__main__":
    main()
