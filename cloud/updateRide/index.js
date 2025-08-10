const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext() || {}
  const { rideId, patch }   = event
  if (!rideId || !patch) return { ok:false, msg:'参数不足' }

  return await db.runTransaction(async trx=>{
    const ride = (await trx.collection('rides').doc(rideId).get()).data
    if (!ride) return { ok:false, msg:'行程不存在' }
    const owner = ride.driver_id || ride.publisher_id
    if (owner !== openid) return { ok:false, msg:'无权限修改' }

    /* 座位数不得 < 已报名人数 */
    if (patch.empty_seats !== undefined){
      const booked = ride.passengers?.length||0
      if (patch.empty_seats < booked)
        return { ok:false, msg:`已有 ${booked} 人报名` }
    }

    await trx.collection('rides').doc(rideId).update({
      data:{ ...patch, updated_at: db.serverDate() }
    })
    return { ok:true }
  })
}
