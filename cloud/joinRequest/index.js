/**
 * 云函数：joinRequest
 * 司机加入乘客的「人找车」请求
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext() || {}
  const { requestId } = event

  if (!openid) return { ok: false, msg: '获取用户信息失败' }
  if (!requestId) return { ok: false, msg: '缺少请求ID' }

  return await db.runTransaction(async trx => {
    // 获取请求详情
    const requestDoc = await trx.collection('rides').doc(requestId).get()
    const request = requestDoc.data

    if (!request || request.type !== 'request') {
      return { ok: false, msg: '请求不存在' }
    }

    if (request.status !== 'open') {
      return { ok: false, msg: '该请求已被接单或已关闭' }
    }

    if (request.publisher_id === openid) {
      return { ok: false, msg: '不能接自己发布的请求' }
    }

    // 更新请求状态，设置司机
    await trx.collection('rides').doc(requestId).update({
      data: {
        driver_id: openid,
        status: 'matched',
        updated_at: db.serverDate()
      }
    })

    // 确保司机用户记录存在并更新
    await ensureUser(trx, openid)
    await trx.collection('users').doc(openid).update({
      data: {
        as_driver: _.push(requestId)
      }
    })

    // 确保乘客用户记录存在并更新
    await ensureUser(trx, request.publisher_id)
    await trx.collection('users').doc(request.publisher_id).update({
      data: {
        as_passenger: _.push(requestId)
      }
    })

    return { ok: true, msg: '接单成功' }
  })
}

/* 若 users 文档不存在则创建（保持 _id = openid） */
async function ensureUser(trx, openid) {
  const snap = await trx.collection('users').doc(openid).get().catch(() => ({}))
  if (!snap.data) {
    await trx.collection('users').doc(openid).set({
      data: {
        as_driver: [],
        as_passenger: [],
        created_at: trx.database.serverDate()
      }
    })
  }
}