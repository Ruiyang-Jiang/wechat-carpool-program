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

    return { ok:true }
  })
}
