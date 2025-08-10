/**
 * 云函数：createRideRequest
 * 乘客发布「人找车」需求 —— 单表 rides
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  /* ---------- 取 openid（Node-18 建议写法） ---------- */
  const { OPENID: openid } = cloud.getWXContext() || {}
  if (!openid) return { ok: false, msg: '获取 openid 失败' }

  /* ---------- 解包并校验 ---------- */
  const {
    departure_place, arrival_place,
    departure_date, departure_time = '',
    price = 0, passenger_number = 1,
    contact_wechat = ''
  } = event

  if (!departure_place?.city)          return { ok:false, msg:'缺少出发地' }
  if (!arrival_place?.city)            return { ok:false, msg:'缺少目的地' }
  if (passenger_number <= 0)           return { ok:false, msg:'乘客人数需 > 0' }

  /* 出发日期校验 */
  const today = new Date().toISOString().slice(0, 10)
  if (departure_date < today)
    return { ok:false, msg:'出发日期不能早于今天' }

  /* ---------- 保存 / 更新用户微信号 ---------- */
  if (contact_wechat) {
    await db.collection('users').doc(openid).set({
      data: { wechat: contact_wechat }
    }).catch(() => {})               // 首次无 doc 时 set() 会创建
  }

  /* ---------- 写入 rides ---------- */
  const requestId = (await db.collection('rides').add({
    data: {
      type: 'request',
      status: 'open',
      publisher_id: openid,
      driver_id: '',

      departure_place,
      arrival_place,
      departure_date,
      departure_time,

      price: Number(price) || 0,
      passenger_number,
      empty_seats: 0,
      passengers: [],

      contact_wechat,
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  }))._id

  return { ok: true, requestId }      // ← 前端判定 res.result.ok
}
