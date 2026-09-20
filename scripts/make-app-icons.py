# -*- coding: utf-8 -*-
"""앱 아이콘 한 장에서 iOS·안드로이드 산출물을 낸다. `python3 scripts/make-app-icons.py`

바꾸려면 원본 경로를 인자로 준다(`python3 scripts/make-app-icons.py assets/belona_app_icon.png`). 배경색(`values/colors.xml` 의
`iconBackground` 와 `app.json` 의 `adaptiveIcon.backgroundColor`)은 **손으로** 맞춘다 - 그림
가장자리에서 뽑은 색이라 그림이 바뀌면 함께 바뀐다.

`expo prebuild` 를 돌리지 않는다. 그것은 손으로 쓴 안드로이드 파일과 릴리스 서명을 지운다.
네이티브 자리에 직접 쓴다.

**어댑티브 전경은 108dp 캔버스인데 보이는 것은 가운데 72dp** 다. 그림을 66.7% 로 앉히면
그 보이는 사각형을 정확히 채운다. 그림이 꽉 찬 한 장이라 여백을 더 두면 런처 마스크 안에
작은 사각형이 떠 있는 꼴이 된다.
"""
import sys

from PIL import Image, ImageDraw

SRC = sys.argv[1] if len(sys.argv) > 1 else 'assets/pinkbeen_app_icon.png'
IOS = 'ios/app/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png'
RES = 'android/app/src/main/res'
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
SAFE = 2 / 3

art = Image.open(SRC).convert('RGB')
print(f'원본 {art.size[0]}x{art.size[1]}')

def square(side):
    return art.resize((side, side), Image.LANCZOS)

def circled(side):
    out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    mask = Image.new('L', (side, side), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, side - 1, side - 1], fill=255)
    out.paste(square(side), (0, 0), mask)
    return out

def adaptive(canvas):
    """108dp 캔버스. 그림은 가운데 72dp 를 채우고 둘레는 투명이다."""
    out = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    side = round(canvas * SAFE)
    out.paste(square(side).convert('RGBA'), ((canvas - side) // 2,) * 2)
    return out

# 1024 원본 두 장. `icon.png` 은 알파가 없어야 한다(App Store 가 거부한다).
square(1024).save('assets/icon.png')
square(1024).save(IOS)
adaptive(1024).save('assets/adaptive-icon.png')
print('assets/icon.png · assets/adaptive-icon.png · iOS 1024 썼다')

for name, scale in DENSITIES.items():
    legacy = round(48 * scale)
    canvas = round(108 * scale)
    square(legacy).save(f'{RES}/mipmap-{name}/ic_launcher.webp', lossless=True)
    circled(legacy).save(f'{RES}/mipmap-{name}/ic_launcher_round.webp', lossless=True)
    adaptive(canvas).save(f'{RES}/mipmap-{name}/ic_launcher_foreground.webp', lossless=True)
    print(f'  {name}: 정사각 {legacy} · 원형 {legacy} · 전경 {canvas}')
