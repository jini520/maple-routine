/** 그림 크롭 표(`imageCrops` 칸) 조회. 값은 운영자가 관리 화면에서 눈으로 맞춘다. */
import { IMAGE_CROP_TYPES, type ImageCropRow, type ImageCropsTable, type ImageCropType } from '../../types/game-data'
import { isFiniteNumber, isNonEmptyString, isOneOf, isRow, rowsOf, uniqueBy, updatedAtOf, type Row } from '../game-data/contract'
import { derive, gameTable } from '../game-data/table'
import { COVER_CROP, type ImageCrop } from '../image-crop'

function toCrop(row: Row): ImageCropRow | null {
  if (!isOneOf(row.type, IMAGE_CROP_TYPES) || !isNonEmptyString(row.assetId)) return null
  const { widthPercent, positionXPercent, positionYPercent } = row
  // 폭이 0 이하이면 그림이 사라진다. 위치는 100 을 넘거나 음수여도 된다. 크롭 표에 실제로 있다.
  if (!isFiniteNumber(widthPercent) || widthPercent <= 0) return null
  if (!isFiniteNumber(positionXPercent) || !isFiniteNumber(positionYPercent)) return null
  return { type: row.type, assetId: row.assetId, widthPercent, positionXPercent, positionYPercent }
}

/** 크롭이 하나도 없어도 된다. 없는 그림은 기본 크롭으로 그린다. */
export function parseImageCrops(value: unknown): ImageCropsTable | null {
  if (!isRow(value)) return null
  const updatedAt = updatedAtOf(value)
  if (updatedAt === false) return null
  const imageCrops = rowsOf(value.imageCrops, toCrop, { allowEmpty: true })
  if (imageCrops === null || !uniqueBy(imageCrops, (crop) => `${crop.type}/${crop.assetId}`)) return null
  return { updatedAt, imageCrops }
}

export const imageCropsTable = gameTable<ImageCropsTable>('imageCrops', { updatedAt: null, imageCrops: [] }, parseImageCrops)

const byKey = derive(
  imageCropsTable,
  (table) =>
    new Map<string, ImageCrop>(
      table.imageCrops.map((crop) => [
        `${crop.type}/${crop.assetId}`,
        {
          kind: 'sized',
          widthPercent: crop.widthPercent,
          positionXPercent: crop.positionXPercent,
          positionYPercent: crop.positionYPercent,
        },
      ]),
    ),
)

/** 그림 id 의 크롭. 표에 없는 그림과 빈 칸은 상자를 덮는다(`cover`). */
export function imageCropOf(type: ImageCropType, assetId: string | null | undefined): ImageCrop {
  if (assetId == null) return COVER_CROP
  return byKey().get(`${type}/${assetId}`) ?? COVER_CROP
}
