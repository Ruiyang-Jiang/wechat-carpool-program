/**
 * 司机接单 “人找车” 请求
 * 入参：{ requestId }
 * 流程：
 *   1. 检查记录存在、type=request、status=open
 *   2. 把该记录转为 ride：
 *        - type    : 'ride'
 *        - driver_id / empty_seats / has_driver
 *        - passengers[] 添加发布者自己
 *   3. 更新双方 user 文档的 as_driver / as_passenger
 * 全程事务，出错回滚
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _  = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const driverId  = wxContext.OPENID            // 当前登录小程序的司机
  const requestId = event.requestId

  if (!requestId) return { ok:false, msg:'缺少 requestId' }

  const trx = await db.startTransaction()
  try {
    /* ---------- 1. 拉取请求记录 ---------- */
    const reqSnap = await trx.collection('rides').doc(requestId).get()
    const req = reqSnap.data
    if (!req)                   throw new Error('记录不存在')
    if (req.type !== 'request') throw new Error('记录类型错误')
    if (req.status !== 'open')  throw new Error('已被接单或关闭')

    /* ---------- 2. 更新成 ride ---------- */
    const emptySeats = req.passenger_number || 1

    await trx.collection('rides').doc(requestId).update({
      data: {
        type:        'ride',
        driver_id:   driverId,
        empty_seats: emptySeats,
        has_driver:  true,
        passengers:  _.push({ openid:req.publisher_id, join_time: db.serverDate() }),
        updated_at:  db.serverDate()
      }
    })

    /* ---------- 3. 更新 driver / passenger 的 users 文档 ---------- */
    await ensureUser(trx, driverId)
    await ensureUser(trx, req.publisher_id)

    await trx.collection('users').doc(driverId).update({
      data:{ as_driver: _.addToSet(requestId) }
    })
    await trx.collection('users').doc(req.publisher_id).update({
      data:{ as_passenger: _.addToSet(requestId) }
    })

    await trx.commit()
    return { ok:true }
  } catch (e) {
    await trx.rollback()
    return { ok:false, msg:e.message }
  }
}

/* 若 users 文档不存在则创建（保持 _id = openid） */
async function ensureUser(trx, openid){
  const snap = await trx.collection('users').doc(openid).get().catch(()=>({}))
  if (!snap.data){
    await trx.collection('users').doc(openid).set({
      data:{
        as_driver:    [],
        as_passenger: [],
        created_at:   trx.database.serverDate()
      }
    })
  }
}
