# -*- coding: utf-8 -*-
"""스플래시 이름 `메이플 루틴` 의 글자를 SVG 패스로 뽑아 `src/app/splash/wordmark.ts` 를 쓴다.

    uv run --with fonttools python scripts/make-splash-wordmark.py "<Maplestory Light.ttf 경로>"

서체는 넥슨 메이플스토리 서체 Light 다. https://maplestory.nexon.com/Media/Font 의 TTF zip 안에 있다. 서체
파일은 저장소에 두지 않는다. 넥슨의 안내가 수정 · 편집을 금지하고, 글자를 그림으로 만든 결과물은 자유롭게 쓸 수
있다고 해서 패스만 둔다.

패스의 좌표는 em 상자 기준이다. 왼쪽 위가 (0, 0), 아래가 y 양수, 한 글자의 상자 높이는 ascender − descender 다.
서체 좌표(y 위가 양수)를 그대로 두면 `react-native-svg` 에서 뒤집어 그려야 하므로 여기서 뒤집어 둔다.
"""
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

TEXT = '메이플 루틴'
OUT = Path(__file__).resolve().parent.parent / 'src' / 'app' / 'splash' / 'wordmark.ts'


def main(font_path: str) -> None:
    font = TTFont(font_path)
    upm = font['head'].unitsPerEm
    asc = font['OS/2'].sTypoAscender
    desc = font['OS/2'].sTypoDescender
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    hmtx = font['hmtx']

    glyphs = []
    for ch in TEXT:
        name = cmap[ord(ch)]
        advance = hmtx[name][0]
        pen = SVGPathPen(glyph_set, ntos=lambda v: f'{v:.0f}')
        # y 를 뒤집고 ascender 만큼 내린다. 상자 위가 0 이 된다.
        glyph_set[name].draw(TransformPen(pen, (1, 0, 0, -1, 0, asc)))
        glyphs.append((ch, advance, pen.getCommands()))

    lines = [
        '/**',
        ' * 스플래시 이름 `메이플 루틴` 의 글자 패스. `scripts/make-splash-wordmark.py` 가 만든다. 손으로 고치지 않는다.',
        ' *',
        ' * 좌표는 em 상자 기준이다. 왼쪽 위가 (0, 0) 이고 아래가 y 양수다. 상자 높이는 `emHeight` 다.',
        ' */',
        'export interface WordmarkGlyph {',
        '  /** 글자. 띄어쓰기는 패스가 비어 있다. */',
        '  char: string',
        '  /** 다음 글자까지의 폭. 서체 단위 */',
        '  advance: number',
        '  /** SVG 패스. 서체 단위 */',
        '  path: string',
        '}',
        '',
        f'export const WORDMARK_UNITS_PER_EM = {upm}',
        f'export const WORDMARK_EM_HEIGHT = {asc - desc}',
        '',
        'export const WORDMARK_GLYPHS: readonly WordmarkGlyph[] = [',
    ]
    for ch, advance, path in glyphs:
        lines.append(f"  {{ char: '{ch}', advance: {advance}, path: '{path}' }},")
    lines.append(']')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'wrote {OUT.relative_to(OUT.parents[3])}: {len(glyphs)} glyphs, upm {upm}, em height {asc - desc}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: make-splash-wordmark.py <Maplestory Light.ttf>')
    main(sys.argv[1])
