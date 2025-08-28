// cloud/createRide/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function secCheckText(text = '') {
  const content = String(text || '').slice(0, 4900) // API 上限保护
  if (!content) return { pass: true }
  try {
    // 云函数内使用 openapi 安全接口进行文本检测
    if (cloud.openapi && cloud.openapi.security && cloud.openapi.security.msgSecCheck) {
      await cloud.openapi.security.msgSecCheck({ content })
    }
    return { pass: true }
  } catch (err) {
    console.error('msgSecCheck blocked:', err && err.errCode, err && err.errMsg)
    return { pass: false, msg: '发布内容可能包含不合规信息' }
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
  const textToCheck = [
    departure_place?.city, arrival_place?.city,
    (stopovers || []).map(s => s?.city).filter(Boolean).join(' '),
    car_model, contact_wechat
  ].filter(Boolean).join(' ')
  const sec = await secCheckText(textToCheck)
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
