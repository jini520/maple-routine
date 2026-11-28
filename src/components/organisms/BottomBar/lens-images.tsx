/**
 * 하단바 렌즈가 휘는 그림(항목 줄 · 렌즈 뒤 그림)을 만드는 훅과 색 변환. 언제 뜨고 언제 쓰는지의 판정은 `lens-snapshot.ts` 에 있다.
 *
 * 렌즈 캔버스(`BarLens.tsx`)와 파일을 나눈 것은 컴포넌트 파일이 훅을 함께 내보내면 fast refresh 가 깨지기 때문이다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { PixelRatio, View } from 'react-native'
import {
  AlphaType,
  ColorType,
  Skia,
  TileMode,
  makeImageFromView,
  useImage,
  type DataSourceParam,
  type SkImage,
} from '@shopify/react-native-skia'

import { BarGlyph } from './BarGlyph'
import { getThemeBackgroundUrl } from '../../../lib/assets/asset-lookup'
import type { ThemeDefinition } from '../../../types/theme'
import { resolveThemeBackdropLayout } from '../../templates/ThemeBackdrop/theme-backdrop-layout'
import { backdropKey, hasInk, rowRetryDelay, usableSnapshot, type Snapshot, type StripRect } from './lens-snapshot'
import type { GroupId } from '../../../navigation/bar-groups'
import type { TabRouteName } from '../../../navigation/routes'

export interface LensRowItem {
  key: GroupId | TabRouteName
  label: string
  center: number
}

export interface LensRowSpec {
  key: string
  width: number
  items: LensRowItem[]
}

export interface LensRowImages {
  base: SkImage
  accent: SkImage
  edge: SkImage
}

/**
 * 렌즈가 휠 항목 줄 그림을 뜨는 훅. 화면 밖에 원본 뷰(`sources`)를 그려 두고, `signature` 나 `refresh` 가 바뀔 때 뜬다.
 * 아이콘이 찍히지 않은 그림은 쓰지 않고 다시 뜬다. 쓸 그림이 없는 줄은 `images` 에 없고, 바는 그 줄을 앱 뷰로 둔다.
 */
export function useLensRowImages(
  rows: LensRowSpec[],
  height: number,
  pillW: number,
  pillH: number,
  accent: string,
  muted: string,
  edgeColor: string,
  signature: string,
  ext: number,
  plateColor: string,
  pageColor: string,
  vertical = false,
  refresh = 0,
): { images: Record<string, LensRowImages>; sources: React.JSX.Element } {
  // 뜬 그림은 뜰 때의 signature 와 함께 둔다. 테마가 바뀌면 새로 뜨는 동안 옛 색 그림을 내지 않는다.
  const [shot, setShot] = useState<Snapshot<Record<string, LensRowImages>> | null>(null)
  const images = usableSnapshot(shot, signature) ?? {}
  const refs = useRef<Record<string, View | null>>({})

  useEffect(() => {
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | null = null
    const capture = async (attempt: number) => {
      // 원본 뷰가 그려진 뒤에 뜬다(두 프레임). 길게 기다리면 테마를 바꾼 뒤 그만큼 렌즈 없이 지낸다.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const next: Record<string, LensRowImages> = {}
      for (const row of rows) {
        const take = (kind: string) => {
          const view = refs.current[`${row.key}:${kind}`]
          return view ? makeImageFromView({ current: view }) : Promise.resolve(null)
        }
        const [base, accentImage, edge] = await Promise.all([take('base'), take('accent'), take('edge')])
        if (base && accentImage && edge && rowHasInk(base, row, height, vertical)) next[row.key] = { base, accent: accentImage, edge }
      }
      if (cancelled) return
      // 위 화면에 가려진 동안 뜨면 실기기에서 빈 그림이 나왔다. 빈 그림을 쓰면 누를 때 아이콘이 다 사라진다.
      const delay = rowRetryDelay(attempt, Object.keys(next).length === rows.length)
      if (delay !== null) {
        retry = setTimeout(() => void capture(attempt + 1), delay)
        return
      }
      setShot({ key: signature, value: next })
    }
    void capture(0)
    return () => {
      cancelled = true
      if (retry !== null) clearTimeout(retry)
    }
    // signature · 다시 뜨기 요청(refresh)이 바뀔 때만 다시 뜬다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, refresh])

  const sources = (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: -2000 }}>
      {rows.map((row) =>
        (['base', 'accent', 'edge'] as const).map((kind) => (
          <View
            key={`${row.key}:${kind}`}
            ref={(view) => {
              refs.current[`${row.key}:${kind}`] = view
            }}
            collapsable={false}
            style={vertical ? { width: height, height: row.width, backgroundColor: 'transparent' } : { width: row.width, height, backgroundColor: 'transparent' }}
          >
            {kind === 'edge' ? (
              <View
                style={
                  vertical
                    ? { position: 'absolute', left: 0, top: 0, width: height, height: row.width, backgroundColor: pageColor }
                    : { position: 'absolute', left: 0, top: 0, width: row.width, height, backgroundColor: pageColor }
                }
              >
              <View
                style={{
                  position: 'absolute',
                  ...(vertical
                    ? { top: 0, left: ext, height: row.width, width: height - ext * 2 }
                    : { left: 0, top: ext, width: row.width, height: height - ext * 2 }),
                  borderRadius: 999,
                  backgroundColor: plateColor,
                }}
              />
              </View>
            ) : (
              row.items.map((item) => (
                <View
                  key={item.key}
                  style={{
                    position: 'absolute',
                    ...(vertical
                      ? { top: item.center - pillW / 2, left: (height - pillH) / 2, height: pillW, width: pillH }
                      : { left: item.center - pillW / 2, top: (height - pillH) / 2, width: pillW, height: pillH }),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BarGlyph id={item.key} label={item.label} active={kind === 'accent'} accent={accent} muted={muted} />
                </View>
              ))
            )}
          </View>
        )),
      )}
    </View>
  )

  return { images, sources }
}

/** 뜬 줄 그림의 첫 칸 가운데 둘레에 아이콘이 찍혔는가. */
function rowHasInk(image: SkImage, row: LensRowSpec, height: number, vertical: boolean): boolean {
  const item = row.items[0]
  if (item === undefined) return true
  const scale = image.width() / (vertical ? height : row.width)
  const cx = Math.round((vertical ? height / 2 : item.center) * scale)
  const cy = Math.round((vertical ? item.center : height / 2) * scale)
  const size = Math.round(24 * scale)
  const pixels = image.readPixels(Math.max(0, cx - size / 2), Math.max(0, cy - size / 2), {
    width: size,
    height: size,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Premul,
  })
  return pixels === null || hasInk(pixels)
}

/** 렌즈 뒤 그림과 흐린 사본. 창 좌표 `strip` 자리의 그림이다. */
export interface PageImages {
  sharp: SkImage
  blurred: SkImage
  strip: StripRect
}

/**
 * 렌즈 뒤 그림을 그리는 훅. 화면을 뜨지 않고, 바 뒤에 빈 화면이 있었다 치고 테마로 그린다. 페이지 바탕색 위에
 * `ThemeBackdrop` 과 같은 배치로 배경 그림과 덮는 색을 얹고, 그 가운데 `strip` 자리만 남긴다.
 *
 * 화면을 뜨면 스크롤한 뒤 옛 화면이 렌즈에 비친다. 그림은 `backdropKey` 가 바뀔 때만 다시 그린다.
 *
 * @param enabled 렌즈를 쓰는 플랫폼인가. 아니면 그리지 않는다
 */
export function useLensBackdrop(options: {
  enabled: boolean
  definition: ThemeDefinition
  themeKey: string
  strip: StripRect
  windowWidthPx: number
  windowHeightPx: number
}): PageImages | null {
  const { enabled, definition, themeKey, strip, windowWidthPx, windowHeightPx } = options
  const background = definition.background
  const source = enabled && background !== undefined ? getThemeBackgroundUrl(background.image) : null
  const image = useImage(source as DataSourceParam)
  // 배경 그림 · 위치 · 덮는 세기도 그림을 바꾸므로 열쇠에 넣는다.
  const key = backdropKey({ themeKey: [themeKey, background?.image, background?.position, background?.dim].join('|'), strip })

  return useMemo(() => {
    if (!enabled) return null
    if (source !== null && image === null) return null
    const scale = PixelRatio.get()
    const width = Math.ceil(strip.width * scale)
    const height = Math.ceil(strip.height * scale)
    const draw = (blur: number): SkImage | null => {
      const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height)
      if (surface === null) return null
      const canvas = surface.getCanvas()
      canvas.scale(scale, scale)
      canvas.translate(-strip.x, -strip.y)
      const layer = Skia.Paint()
      if (blur > 0) layer.setImageFilter(Skia.ImageFilter.MakeBlur(blur, blur, TileMode.Clamp, null))
      canvas.saveLayer(layer)
      const paint = Skia.Paint()
      paint.setColor(Skia.Color(definition.bg))
      canvas.drawRect(Skia.XYWHRect(0, 0, windowWidthPx, windowHeightPx), paint)
      if (image !== null && background !== undefined) {
        const placement = resolveThemeBackdropLayout(
          { width: windowWidthPx, height: windowHeightPx },
          { width: image.width(), height: image.height() },
          background.position,
        )
        if (placement !== null) {
          canvas.drawImageRect(
            image,
            Skia.XYWHRect(0, 0, image.width(), image.height()),
            Skia.XYWHRect(placement.left, placement.top, placement.width, placement.height),
            Skia.Paint(),
          )
        }
        const dim = Skia.Paint()
        dim.setColor(Skia.Color(definition.bg))
        dim.setAlphaf(background.dim)
        canvas.drawRect(Skia.XYWHRect(0, 0, windowWidthPx, windowHeightPx), dim)
      }
      canvas.restore()
      surface.flush()
      const snap = surface.makeImageSnapshot()
      return snap.makeNonTextureImage() ?? snap
    }
    const sharp = draw(0)
    // 흐린 사본은 렌즈 안 바 판에 쓴다. 약 10pt.
    const blurred = draw(10)
    return sharp === null || blurred === null ? null : { sharp, blurred, strip }
    // key 가 테마 · 띠를 모두 담는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, image, enabled, windowWidthPx, windowHeightPx])
}

/** `rgba(r, g, b, a)` 나 `#rrggbb` 를 셰이더 uniform 값(0~1 네 개)으로. */
export function colorToUniform(color: string): number[] {
  const rgba = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\)/.exec(color)
  if (rgba) return [Number(rgba[1]) / 255, Number(rgba[2]) / 255, Number(rgba[3]) / 255, rgba[4] === undefined ? 1 : Number(rgba[4])]
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]
  }
  return [0, 0, 0, 0]
}

