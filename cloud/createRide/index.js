// cloud/createRide/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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

  /* ---- (略) 参数校验，可保留 ---- */

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
