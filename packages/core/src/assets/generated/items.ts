// ⚠️ 이 파일은 생성물이다 — **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.
//
// 만드는 법: `npm run assets:gen` (scripts/generate-asset-manifest.mjs · [[ADR-129]])
// 무엇: 아이템·반지 아이콘 — `lib/item-icons.ts` 가 `iconFile`(확장자 포함)로 찾는다([[ADR-011]] 결정 6)
// 원본: src/assets/items/*.{png,webp} · src/assets/items/rings/*.{png,webp}
//
// 값의 타입은 번들러가 정한다 — 웹(Vite)은 URL 문자열, RN(Metro)은 에셋 id 다. 그 차이를
// 한 줄로 적어 둔 것이 `ImageAssetRef` 이고, 이 파일은 웹·RN 이 **같은 것을 본다**.

import type { ImageAssetRef } from '../../types/image-asset'

import a0 from '../items/rings/Berserker_Ring.png'
import a1 from '../items/rings/Clean_Defense_Ring.png'
import a2 from '../items/rings/Clean_Stance_Ring.png'
import a3 from '../items/rings/Cleansing_Ring.png'
import a4 from '../items/rings/Continuous_Ring.webp'
import a5 from '../items/rings/Crisis_HM_Ring.webp'
import a6 from '../items/rings/Crisis_H_Ring.webp'
import a7 from '../items/rings/Crisis_M_Ring.png'
import a8 from '../items/rings/Critical_Damage_Ring.webp'
import a9 from '../items/rings/Critical_Defense_Ring.png'
import a10 from '../items/rings/Critical_Shift_Ring.png'
import a11 from '../items/rings/Durability_Ring.png'
import a12 from '../items/rings/Health_Cut_Ring.png'
import a13 from '../items/rings/Level_Jump_Ring.png'
import a14 from '../items/rings/Limit_Ring.webp'
import a15 from '../items/rings/Mana_Cut_Ring.png'
import a16 from '../items/rings/Overdrive_Ring.png'
import a17 from '../items/rings/Reflective_Ring.png'
import a18 from '../items/rings/Ring_of_Restraint.webp'
import a19 from '../items/rings/Risk_Taker_Ring.webp'
import a20 from '../items/rings/Stance_Shift_Ring.png'
import a21 from '../items/rings/Swift_Ring.png'
import a22 from '../items/rings/Totalling_Ring.webp'
import a23 from '../items/rings/Tower_Boost_Ring.png'
import a24 from '../items/rings/Ultimatum_Ring.webp'
import a25 from '../items/rings/Weapon_Jump_Ring.webp'
import a26 from '../items/adversary_resolve.webp'
import a27 from '../items/adversary_resolve_piece.webp'
import a28 from '../items/boss_ring_box_black.png'
import a29 from '../items/boss_ring_box_green.png'
import a30 from '../items/boss_ring_box_life.png'
import a31 from '../items/boss_ring_box_red.png'
import a32 from '../items/boss_ring_box_white.png'
import a33 from '../items/box_eternel_adversary.png'
import a34 from '../items/box_eternel_bardrix.png'
import a35 from '../items/box_eternel_destiny.webp'
import a36 from '../items/box_eternel_jupiter.png'
import a37 from '../items/box_eternel_kaling.png'
import a38 from '../items/box_eternel_kalos.png'
import a39 from '../items/box_eternel_limbo.png'
import a40 from '../items/box_eternel_maerin.webp'
import a41 from '../items/box_eternel_maleficStar.png'
import a42 from '../items/box_solerda_maerin_high.webp'
import a43 from '../items/bright_boss_face_acc.png'
import a44 from '../items/bright_boss_merit.png'
import a45 from '../items/bright_boss_pendant.png'
import a46 from '../items/bright_boss_ring.png'
import a47 from '../items/bright_boss_ring2.png'
import a48 from '../items/core_gemstone_mirror.png'
import a49 from '../items/core_gemstone_mitra.png'
import a50 from '../items/cube_bronze_additional.png'
import a51 from '../items/cube_gold.png'
import a52 from '../items/cube_silver.png'
import a53 from '../items/dark_boss_badge.png'
import a54 from '../items/dark_boss_belt.png'
import a55 from '../items/dark_boss_box.png'
import a56 from '../items/dark_boss_box_maerin.webp'
import a57 from '../items/dark_boss_complete_heart.png'
import a58 from '../items/dark_boss_earring.png'
import a59 from '../items/dark_boss_emblem.png'
import a60 from '../items/dark_boss_eye_acc.png'
import a61 from '../items/dark_boss_face_acc.png'
import a62 from '../items/dark_boss_pendant.png'
import a63 from '../items/dark_boss_pocket.png'
import a64 from '../items/dark_boss_ring.png'
import a65 from '../items/dawn_boss_earring.png'
import a66 from '../items/dawn_boss_face_acc.png'
import a67 from '../items/dawn_boss_pendant.png'
import a68 from '../items/dawn_boss_ring.png'
import a69 from '../items/erion_piece.png'
import a70 from '../items/except_belt.png'
import a71 from '../items/except_earring.png'
import a72 from '../items/except_eye_acc.png'
import a73 from '../items/except_face_acc.png'
import a74 from '../items/except_merit.png'
import a75 from '../items/frag_destiny.webp'
import a76 from '../items/frag_eternel_bardrix.png'
import a77 from '../items/frag_eternel_jupiter.png'
import a78 from '../items/frag_eternel_limbo.png'
import a79 from '../items/intense_power_crystal_monthly.webp'
import a80 from '../items/intense_power_crystal_weekly.webp'
import a81 from '../items/kaling_link.webp'
import a82 from '../items/kaling_link_piece.webp'
import a83 from '../items/kalos_will.webp'
import a84 from '../items/kalos_will_piece.webp'
import a85 from '../items/luminous_moonshine_potion.png'
import a86 from '../items/magical_weapon_scroll_coupon.png'
import a87 from '../items/maleficstar_shard.webp'
import a88 from '../items/maleficstar_shard_piece.webp'
import a89 from '../items/papulatus_mark.png'
import a90 from '../items/premium_accessory_scroll_coupon.png'
import a91 from '../items/premium_petequip_scroll_coupon.png'
import a92 from '../items/sole_10.png'
import a93 from '../items/sole_1000.webp'
import a94 from '../items/sole_200.png'
import a95 from '../items/sole_500.webp'
import a96 from '../items/spell_trace.webp'
import a97 from '../items/whetstone_faith.png'
import a98 from '../items/whetstone_life.png'

export const ITEM_ASSETS: Record<string, ImageAssetRef> = {
  "Berserker_Ring.png": a0,
  "Clean_Defense_Ring.png": a1,
  "Clean_Stance_Ring.png": a2,
  "Cleansing_Ring.png": a3,
  "Continuous_Ring.webp": a4,
  "Crisis_HM_Ring.webp": a5,
  "Crisis_H_Ring.webp": a6,
  "Crisis_M_Ring.png": a7,
  "Critical_Damage_Ring.webp": a8,
  "Critical_Defense_Ring.png": a9,
  "Critical_Shift_Ring.png": a10,
  "Durability_Ring.png": a11,
  "Health_Cut_Ring.png": a12,
  "Level_Jump_Ring.png": a13,
  "Limit_Ring.webp": a14,
  "Mana_Cut_Ring.png": a15,
  "Overdrive_Ring.png": a16,
  "Reflective_Ring.png": a17,
  "Ring_of_Restraint.webp": a18,
  "Risk_Taker_Ring.webp": a19,
  "Stance_Shift_Ring.png": a20,
  "Swift_Ring.png": a21,
  "Totalling_Ring.webp": a22,
  "Tower_Boost_Ring.png": a23,
  "Ultimatum_Ring.webp": a24,
  "Weapon_Jump_Ring.webp": a25,
  "adversary_resolve.webp": a26,
  "adversary_resolve_piece.webp": a27,
  "boss_ring_box_black.png": a28,
  "boss_ring_box_green.png": a29,
  "boss_ring_box_life.png": a30,
  "boss_ring_box_red.png": a31,
  "boss_ring_box_white.png": a32,
  "box_eternel_adversary.png": a33,
  "box_eternel_bardrix.png": a34,
  "box_eternel_destiny.webp": a35,
  "box_eternel_jupiter.png": a36,
  "box_eternel_kaling.png": a37,
  "box_eternel_kalos.png": a38,
  "box_eternel_limbo.png": a39,
  "box_eternel_maerin.webp": a40,
  "box_eternel_maleficStar.png": a41,
  "box_solerda_maerin_high.webp": a42,
  "bright_boss_face_acc.png": a43,
  "bright_boss_merit.png": a44,
  "bright_boss_pendant.png": a45,
  "bright_boss_ring.png": a46,
  "bright_boss_ring2.png": a47,
  "core_gemstone_mirror.png": a48,
  "core_gemstone_mitra.png": a49,
  "cube_bronze_additional.png": a50,
  "cube_gold.png": a51,
  "cube_silver.png": a52,
  "dark_boss_badge.png": a53,
  "dark_boss_belt.png": a54,
  "dark_boss_box.png": a55,
  "dark_boss_box_maerin.webp": a56,
  "dark_boss_complete_heart.png": a57,
  "dark_boss_earring.png": a58,
  "dark_boss_emblem.png": a59,
  "dark_boss_eye_acc.png": a60,
  "dark_boss_face_acc.png": a61,
  "dark_boss_pendant.png": a62,
  "dark_boss_pocket.png": a63,
  "dark_boss_ring.png": a64,
  "dawn_boss_earring.png": a65,
  "dawn_boss_face_acc.png": a66,
  "dawn_boss_pendant.png": a67,
  "dawn_boss_ring.png": a68,
  "erion_piece.png": a69,
  "except_belt.png": a70,
  "except_earring.png": a71,
  "except_eye_acc.png": a72,
  "except_face_acc.png": a73,
  "except_merit.png": a74,
  "frag_destiny.webp": a75,
  "frag_eternel_bardrix.png": a76,
  "frag_eternel_jupiter.png": a77,
  "frag_eternel_limbo.png": a78,
  "intense_power_crystal_monthly.webp": a79,
  "intense_power_crystal_weekly.webp": a80,
  "kaling_link.webp": a81,
  "kaling_link_piece.webp": a82,
  "kalos_will.webp": a83,
  "kalos_will_piece.webp": a84,
  "luminous_moonshine_potion.png": a85,
  "magical_weapon_scroll_coupon.png": a86,
  "maleficstar_shard.webp": a87,
  "maleficstar_shard_piece.webp": a88,
  "papulatus_mark.png": a89,
  "premium_accessory_scroll_coupon.png": a90,
  "premium_petequip_scroll_coupon.png": a91,
  "sole_10.png": a92,
  "sole_1000.webp": a93,
  "sole_200.png": a94,
  "sole_500.webp": a95,
  "spell_trace.webp": a96,
  "whetstone_faith.png": a97,
  "whetstone_life.png": a98,
}
