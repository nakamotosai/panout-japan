/**
 * 日本默认构图 / 进站必载瓦片参考框（历史与 30 天已改为全球）
 * 球场景不钳平移；此框仅用于 bootstrap 与兼容小包。
 */
export const REGION = {
  minLon: 105,
  maxLon: 150,
  minLat: 20,
  maxLat: 50,
}

/** 历史兼容：平面时代原点（球坐标不再使用） */
export const ORIGIN_LON = (REGION.minLon + REGION.maxLon) / 2
export const ORIGIN_LAT = (REGION.minLat + REGION.maxLat) / 2

/**
 * 日本附近陆锚（默认构图 / 框参考，非平移钳）
 * @type {Array<[number, number]>}
 */
export const REGION_LAND_ANCHORS = [
  [116.4, 39.9], // 北京
  [121.5, 31.2], // 上海
  [114.1, 22.3], // 香港
  [139.7, 35.7], // 东京
  [135.5, 34.7], // 大阪
  [141.3, 43.1], // 札幌
  [130.4, 33.6], // 福冈
  [121.0, 23.7], // 台湾
  [126.0, 37.5], // 首尔
]
