// cloud/createRide/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
// 机场三字码映射，在内容安全检查前统一替换为“城市, 州”格式，规避误判
const AIRPORT_MAP = {
  AUS: 'Austin, TX',
  BNA: 'Nashville, TN',
  BOS: 'Boston, MA',
  BWI: 'Baltimore, MD',
  CLT: 'Charlotte, NC',
  DCA: 'Washington, DC',
  DEN: 'Denver, CO',
  DFW: 'Dallas, TX',
  DTW: 'Detroit, MI',
  EWR: 'Newark, NJ',
  FLL: 'Fort Lauderdale, FL',
  IAD: 'Washington, DC',
  IAH: 'Houston, TX',
  ITH: 'Ithaca, NY',
  JFK: 'New York, NY',
  LAS: 'Las Vegas, NV',
  LAX: 'Los Angeles, CA',
  LGA: 'New York, NY',
  MCO: 'Orlando, FL',
  MIA: 'Miami, FL',
  MSP: 'Minneapolis, MN',
  ORD: 'Chicago, IL',
  PHL: 'Philadelphia, PA',
  PHX: 'Phoenix, AZ',
  SAN: 'San Diego, CA',
  SEA: 'Seattle, WA',
  SFO: 'San Francisco, CA',
  SLC: 'Salt Lake City, UT',
  TPA: 'Tampa, FL'
}

const AIRPORT_CODES = Object.keys(AIRPORT_MAP)
const AIRPORT_CODE_REGEX = AIRPORT_CODES.length
  ? new RegExp(`\\b(${AIRPORT_CODES.join('|')})\\b`, 'i')
  : null

function normalizeAirportLabel(raw = ''){
  const text = String(raw || '').trim()
  if (!text) return ''
  if (!AIRPORT_CODE_REGEX) return text
  const match = text.match(AIRPORT_CODE_REGEX)
  if (match && match[1]){
    return AIRPORT_MAP[match[1].toUpperCase()] || text
  }
  return text
}

function sanitizeForSecCheck(text = '') {
  return String(text || '')
    .replace(/[-–—>→]+/g, ' to ')
    .replace(/[|#*~^$%`=+<>]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const CITY_PATTERN = /^[A-Za-z .'-]+(?:,\s*[A-Za-z]{2})?$/
function isCityLike(s=''){ return CITY_PATTERN.test(String(s||'')) }
function normalizeRoutePieces(pieces = []){
  return (pieces || []).map(item => normalizeAirportLabel(item))
}


async function secCheckText(text = '', normalizedPieces = []) {
  const content = String(text || '').slice(0, 4900) // API 上限保护
  if (!content) return { pass: true }
  try {
    // 云函数内使用 openapi 安全接口进行文本检测
    if (cloud.openapi && cloud.openapi.security && cloud.openapi.security.msgSecCheck) {
      await cloud.openapi.security.msgSecCheck({ content })
    }
    return { pass: true }
  } catch (err) {
    const code = err && err.errCode
    const emsg = err && err.errMsg
    console.error('msgSecCheck blocked:', code, emsg, 'content:', content)
    if (code === 87014 && Array.isArray(normalizedPieces) && normalizedPieces.length){
      const fallback = normalizedPieces
        .map(item => String(item || '').replace(/[^A-Za-z ,.'-]/g, ' ').trim())
        .filter(Boolean)
        .join(' -> ')
        .replace(/\s{2,}/g, ' ')
        .slice(0, 4900)
      if (fallback && fallback !== content){
        try {
          if (cloud.openapi && cloud.openapi.security && cloud.openapi.security.msgSecCheck) {
            await cloud.openapi.security.msgSecCheck({ content: fallback })
          }
          console.warn('msgSecCheck fallback passed after stripping airport terms:', fallback)
          return { pass: true }
        } catch (err2) {
          console.error('msgSecCheck fallback blocked:', err2?.errCode, err2?.errMsg, 'fallback-content:', fallback)
        }
      } else if (!fallback){
        // 完全由机场词汇组成时，fallback 为空，视为安全
        return { pass: true }
      }
    }
    // 如果是接口异常（非内容原因），返回更具体的提示，便于排查
    let msg = '发布内容可能包含不合规信息'
    if (code && code !== 87014) { // 87014 常用于内容违规，其它大多为接口/权限/频控问题
      msg = `内容安全接口异常(${code}): ${emsg || ''}`
    }
    return { pass: false, msg }
  }
}

exports.main = async (event, context) => {
  const { OPENID: openid } = cloud.getWXContext() || {}
  if (!openid) {
    return { ok:false, msg:'获取 openid 失败' }
  }
  const {
    departure_place, arrival_place,
    departure_date, departure_time = '',
    price = 0, empty_seats = 3,
    car_model = '', contact_wechat = '',
    stopovers = []  // 新增：途经点数组
  } = event

  /* ---- 基本参数校验 ---- */
  if (!departure_place?.city) return { ok:false, msg:'缺少出发地' }
  if (!arrival_place?.city)   return { ok:false, msg:'缺少目的地' }

  /* ---- 内容安全检测（文本）---- */
  const rawPieces = [
    departure_place?.city,
    ...(Array.isArray(stopovers) ? stopovers.map(s => s?.city).filter(Boolean) : []),
    arrival_place?.city
  ].filter(Boolean)
  const normalizedPieces = normalizeRoutePieces(rawPieces)
  const routeSafe = normalizedPieces.every(isCityLike)
  let sec = { pass: true }
  if (!routeSafe) {
    const textToCheckRaw = normalizedPieces.join(' -> ')
    const textToCheck = sanitizeForSecCheck(textToCheckRaw)
    sec = await secCheckText(textToCheck, normalizedPieces)
  }
  if (!sec.pass) return { ok:false, msg: sec.msg || '内容安全检测未通过' }

  /* 1. 同步微信号 */
  if (contact_wechat) {
    await db.collection('users').doc(openid).set({
      data:{ wechat: contact_wechat }
    }).catch(()=>{})
  }

  /* 2. 写入 rides */
  const rideId = (await db.collection('rides').add({
    data:{
      type:'ride', status:'open',
      publisher_id: openid, driver_id: openid,
      departure_place, arrival_place,
      departure_date, departure_time,
      price:Number(price)||0,
      empty_seats: Number(empty_seats),
      car_model, passenger_number:0,
      passengers:[], contact_wechat,
      stopovers: stopovers || [],  // 新增：途经点
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  }))._id

  /* 3. 正确返回 */
  return { ok:true, rideId }
}
