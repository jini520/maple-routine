/** 그림 크롭 표(`imageCrops` 칸) 조회. 값은 운영자가 관리 화면에서 눈으로 맞춘다. */
import { IMAGE_CROP_KINDS, type ImageCropKind, type ImageCropRow, type ImageCropsTable } from '../../types/game-data'
import { isNonEmptyString, isOneOf, isRow, rowsOf, uniqueBy, updatedAtOf, type Row } from '../game-data/contract'
import { derive, gameTable } from '../game-data/table'
import type { ImageCrop } from '../image-crop'

/** `lib/image-crop.ts` 가 읽는 두 문법. 다른 값은 크롭 계산이 기본값으로 떨어지므로 받지 않는다. */
const SIZE = /^\d+(\.\d+)?% auto$/
const POSITION = /^-?\d+(\.\d+)?% -?\d+(\.\d+)?%$/

function toCrop(row: Row): ImageCropRow | null {
  if (!isOneOf(row.kind, IMAGE_CROP_KINDS) || !isNonEmptyString(row.slug)) return null
  if (typeof row.size !== 'string' || !SIZE.test(row.size)) return null
  if (typeof row.position !== 'string' || !POSITION.test(row.position)) return null
  return { kind: row.kind, slug: row.slug.normalize('NFC'), size: row.size, position: row.position }
}

/** 크롭이 하나도 없어도 된다. 없는 그림은 기본 크롭으로 그린다. */
export function parseImageCrops(value: unknown): ImageCropsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const crops = rowsOf(value.crops, toCrop, { allowEmpty: true })
  if (crops === null || !uniqueBy(crops, (crop) => `${crop.kind}/${crop.slug}`)) return null
  return { updatedAt, crops }
}

export const imageCropsTable = gameTable<ImageCropsTable>('imageCrops', { updatedAt: null, crops: [] }, parseImageCrops)

const byKey = derive(
  imageCropsTable,
  (table) => new Map(table.crops.map((crop) => [`${crop.kind}/${crop.slug}`, { size: crop.size, position: crop.position }])),
)

const DEFAULT_CROP: ImageCrop = { size: 'cover', position: 'center' }

/** 표에 없는 그림은 `cover` · 가운데다. */
export function imageCropOf(kind: ImageCropKind, slug: string | null): ImageCrop {
  if (slug === null) return DEFAULT_CROP
  return byKey().get(`${kind}/${slug.normalize('NFC')}`) ?? DEFAULT_CROP
}
