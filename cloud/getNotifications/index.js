const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _  = db.command

exports.main = async (event) => {
  const { OPENID: openid } = cloud.getWXContext() || {}
  const { page = 1, pageSize = 20, markAsRead = false } = event

  if (!openid) {
    return { ok: false, msg: '获取用户标识失败' }
  }

  try {
    // 获取用户的通知消息
    const notificationsQuery = db.collection('notifications')
      .where({ recipient_id: openid })
      .orderBy('created_at', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)

    const notifications = await notificationsQuery.get()
    
    // 如果需要标记为已读
    if (markAsRead && notifications.data.length > 0) {
      const unreadIds = notifications.data
        .filter(n => !n.is_read)
        .map(n => n._id)
      
      if (unreadIds.length > 0) {
        await db.collection('notifications')
          .where({ _id: db.command.in(unreadIds) })
          .update({
            data: { is_read: true }
          })
      }
    }

    // 获取未读消息数量
    const unreadCount = await db.collection('notifications')
      .where({ 
        recipient_id: openid,
        is_read: false 
      })
      .count()

    return {
      ok: true,
      data: {
        notifications: notifications.data,
        unreadCount: unreadCount.total,
        hasMore: notifications.data.length === pageSize
      }
    }
  } catch (error) {
    console.error('获取通知失败:', error)
    return {
      ok: false,
      msg: '获取通知失败',
      error: error.message
    }
  }
}
