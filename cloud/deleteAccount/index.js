const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _  = db.command

/**
 * 彻底删除用户账号与相关记录（或做脱敏处理）
 * - 删除 users 文档（docId=openId）
 * - 将 rides 中该用户发布/参与的记录标记为 removed 或移除关联
 */
exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext() || {}
  if (!openid) return { ok:false, msg:'获取 openid 失败' }

  try {
    // 1) 删除用户文档
    await db.collection('users').doc(openid).remove().catch(()=>{})

    // 2) 关闭或脱敏该用户发布的行程
    const ridesCol = db.collection('rides')
    // 2a) 关闭他作为发布者/司机的行程
    await ridesCol.where({ publisher_id: openid }).update({
      data: { status: 'removed', updated_at: db.serverDate() }
    })
    await ridesCol.where({ driver_id: openid }).update({
      data: { status: 'removed', updated_at: db.serverDate() }
    })

    // 2b) 从他人请求的 participants 中移除该用户
    const participation = await ridesCol.where({ 'participants.openid': openid }).get()
    const batch = participation.data || []
    for (const ride of batch) {
      const newParticipants = (ride.participants || []).filter(p => p.openid !== openid)
      await ridesCol.doc(ride._id).update({ data: { participants: newParticipants, updated_at: db.serverDate() } })
    }

    return { ok:true }
  } catch (e) {
    console.error('deleteAccount failed', e)
    return { ok:false, msg:'删除失败' }
  }
}

