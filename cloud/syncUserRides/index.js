/**
 * 同步指定用户（或全体用户）的 as_passenger / as_driver
 * - 移除 rides 集合中不存在或 status != 'open' 的 ID
 * - 若 rides.passengers / driver_id 丢失用户，则补写
 *
 * event:
 *   { openid?: 'xxx' }  // 传则只处理该用户；不传则遍历全部
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _  = db.command

exports.main = async (event) => {
  const targetOpenid = event.openid || null
  const userQuery = targetOpenid ? db.collection('users').where({ _openid: targetOpenid })
                                 : db.collection('users')

  const users = (await userQuery.get()).data
  const result = []

  for (const user of users) {
    const openid = user._openid
    const newDriver = await fixList(openid, user.as_driver || [], 'driver')
    const newPass   = await fixList(openid, user.as_passenger || [], 'passenger')

    // 仅当有变更才 update
    if (newDriver.changed || newPass.changed) {
      await db.collection('users').doc(openid).update({
        data: {
          ...(newDriver.changed && { as_driver: newDriver.list }),
          ...(newPass.changed   && { as_passenger: newPass.list })
        }
      })
    }
    result.push({ openid, driver:newDriver.summary, passenger:newPass.summary })
  }
  return { ok:true, result }
}

/* ----------- helper ----------- */
async function fixList(openid, idArr, mode){
  if (!idArr.length) return { list:[], changed:false, summary:'empty' }

  // ① 取对应 rides 文档
  const rides = (await db.collection('rides').where({ _id: _.in(idArr) }).get()).data
  const rideMap = Object.fromEntries(rides.map(r=>[r._id, r]))

  // ② 构造新列表：只保留 still open 的
  const kept = idArr.filter(id => rideMap[id] && rideMap[id].status === 'open')
  const changed = kept.length !== idArr.length

  // ③ 反向补写：用户不在 ride.passengers / driver_id 列表中
  for (const ride of rides) {
    if (ride.status !== 'open') continue
    if (mode === 'driver' && ride.driver_id !== openid) continue
    if (mode === 'passenger' &&
        !(ride.passengers || []).some(p => p.openid === openid)) {
      await db.collection('rides').doc(ride._id).update({
        data:{ passengers: _.push({ openid, join_time: db.serverDate() }) }
      })
    }
  }

  return {
    list: kept,
    changed,
    summary: `${idArr.length} -> ${kept.length}`
  }
}
