#!/bin/sh
# Figma 시안(비로그인 홈 H2 · Web/진입)의 그림을 assets/ 에 받는다. 링크는 2026-12-04 쯤 만료된다.
set -e
cd "$(dirname "$0")"
mkdir -p assets
F=https://www.figma.com/api/mcp/asset
get() { curl -fsSL -o "assets/$1" "$F/$2"; echo "assets/$1"; }
H=1b693205-5128-44e5-a7db-585a818a5bd0
get hero-mask.svg $H/041d2.svg
get hero-light-boss-profit.png $H/278cc.png
get hero-light-drop.png $H/394a0.png
get hero-light-stats.png $H/aba8c.png
get hero-light-today.png $H/07d42.png
get app-store.png $H/3ee0e.png
get google-play.png $H/2e3a9.png
D=343f49a7-b139-4701-8be4-03728db6ae8a
get hero-dark-boss-profit.png $D/8b7c3.png
get hero-dark-drop.png $D/8e454.png
get hero-dark-stats.png $D/42502.png
get hero-dark-today.png $D/5605f.png
X=fc735905-3131-4c7f-924c-498782b9e065
get feature-profit.png $X/b4ed6.png
get feature-enhance.png $X/b975d.png
get feature-party.png $X/2e521.png
E=e3a95524-e8c3-4a24-bdc2-d2ef042292b9
get event.png $E/931a1.png
get cashshop.png $E/97c22.png
U=7759be38-995d-4d32-8cbc-0fd1d5da943f
get tool-maspi.png $U/2f5e4.png
get tool-split.png $U/76c3c.png
get tool-boss.png $U/1f6e9.png
get tool-glow.svg $U/6977d.svg
get sparkline.svg 99b7a1cd-eda2-4f59-a80d-9a2cb0118a96/69cad.svg
L=3f937ded-2e2d-46ed-863a-378d8c0769c6
i=1
for h in 3cf6a c6bde 48729 3d6b7 90b97 46a1c ae0ed 55eaa 78e37 f11cb 8da2f e13a8 ffe86 42547 5f5f1; do
  get "leaf-$(printf %02d $i).svg" "$L/$h.svg"
  i=$((i + 1))
done
