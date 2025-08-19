const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _  = db.command

/**
 * 乘客加入「人找车」请求：
 * - 同意该请求标注的价格（无需额外确认）
 * - 在请求文档上累加 participants，并在用户文档上记录 as_passenger
 */
exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext() || {}
  const { requestId } = event || {}

  if (!openid)   return { ok:false, msg:'获取 openid 失败' }
  if (!requestId) return { ok:false, msg:'缺少 requestId' }

  return await db.runTransaction(async trx => {
    const doc = await trx.collection('rides').doc(requestId).get()
    const request = doc.data
    if (!request || request.type !== 'request')
      return { ok:false, msg:'请求不存在' }

    if (request.status !== 'open')
      return { ok:false, msg:'该请求已不接受加入' }

    if (request.publisher_id === openid)
      return { ok:false, msg:'不能加入自己发布的请求' }

    const already = (request.participants || []).some(p => p.openid === openid)
    if (already) return { ok:true, msg:'您已加入' }

    await trx.collection('rides').doc(requestId).update({
      data:{
        participants: _.push({ openid, join_time: db.serverDate() }),
        passenger_number: _.inc(1),
        updated_at: db.serverDate()
      }
    })

    await trx.collection('users').doc(openid).set({
      data:{ as_passenger: _.addToSet(requestId) }
    }).catch(async () => {
      await trx.collection('users').doc(openid).update({
        data:{ as_passenger: _.addToSet(requestId) }
      })
    })

    return { ok:true }
  })
}


