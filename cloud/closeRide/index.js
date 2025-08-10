const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event)=>{
  const { OPENID: openid } = cloud.getWXContext() || {}
  const { rideId } = event
  if (!rideId) return { ok:false, msg:'缺少 rideId' }

  const res = await db.collection('rides').doc(rideId).get()
  if (!res.data) return { ok:false, msg:'行程不存在' }
  const owner = res.data.driver_id || res.data.publisher_id
  if (owner !== openid) return { ok:false, msg:'无权限' }

  await db.collection('rides').doc(rideId).update({
    data:{ status:'closed', updated_at: db.serverDate() }
  })
  return { ok:true }
}
