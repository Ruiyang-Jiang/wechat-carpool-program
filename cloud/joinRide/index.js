const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _  = db.command

exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext() || {}
  const { rideId } = event

  if (!rideId)         return { ok:false, msg:'缺少 rideId' }
  if (!openid)         return { ok:false, msg:'获取 openid 失败' }

  return await db.runTransaction(async trx => {
    const rideDoc = await trx.collection('rides').doc(rideId).get()
    const ride    = rideDoc.data
    if (!ride || ride.type !== 'ride')
      return { ok:false, msg:'行程不存在' }

    if (ride.status !== 'open' || ride.empty_seats <= 0)
      return { ok:false, msg:'已无法报名' }

    if (ride.passengers?.some(p => p.openid === openid))
      return { ok:false, msg:'您已报名' }

    // 获取乘客信息
    const passengerDoc = await trx.collection('users').doc(openid).get()
    const passenger = passengerDoc.data || {}

    /* 1. 更新行程 */
    await trx.collection('rides').doc(rideId).update({
      data:{
        passengers: _.push({ openid, join_time: db.serverDate() }),
        empty_seats: _.inc(-1),
        status: ride.empty_seats - 1 === 0 ? 'full' : 'open',
        updated_at: db.serverDate()
      }
    })

    /* 2. 更新用户表 */
    await trx.collection('users').doc(openid).set({
      data:{ as_passenger: _.addToSet(rideId) }
    }).catch(async () => {
      // 若已存在文档则走 update
      await trx.collection('users').doc(openid).update({
        data:{ as_passenger: _.addToSet(rideId) }
      })
    })

    /* 3. 给发布者发送微信通知消息 */
    try {
      // 格式化日期和时间
      const departureDate = new Date(ride.departure_date)
      const month = departureDate.getMonth() + 1
      const day = departureDate.getDate()
      const time = ride.departure_time || '00:00'
      
      // 构建消息内容
      const messageContent = `你的${month}月${day}号${time}点的行程有人加入，联系方式为${passenger.wechat || passenger.phone || '未提供联系方式'}`
      
      // 调用微信通知云函数
      await cloud.callFunction({
        name: 'sendWeChatNotification',
        data: {
          touser: ride.publisher_id,
          content: messageContent,
          rideInfo: {
            departure_date: ride.departure_date,
            departure_time: ride.departure_time,
            departure_place: ride.departure_place,
            arrival_place: ride.arrival_place
          }
        }
      })
      
      console.log('微信通知消息发送成功')
    } catch (error) {
      console.error('发送微信通知消息失败:', error)
      // 微信通知发送失败不影响主要业务逻辑
    }

    return { ok:true }
  })
}
