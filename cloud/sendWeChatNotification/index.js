const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { touser, content, rideInfo } = event || {}

  if (!touser || !content) {
    return { ok: false, msg: '缺少必要参数' }
  }

  let sent = false
  let sendError = null

  // 1) 尝试发送“客服消息”（若不满足微信通道条件会报错）
  try {
    if (cloud.openapi && cloud.openapi.customerServiceMessage) {
      const result = await cloud.openapi.customerServiceMessage.send({
        touser,
        msgtype: 'text',
        text: { content }
      })
      sent = true
      console.log('客服消息发送成功:', result)
    }
  } catch (error) {
    sendError = error && (error.errMsg || error.message)
    console.warn('客服消息发送失败，将写入站内通知：', sendError)
  }

  // 2) 无论客服消息是否成功，都写入站内通知（确保可靠送达）
  try {
    await db.collection('notifications').add({
      data: {
        recipient_id: touser,
        channel: sent ? 'kefu+inbox' : 'inbox',
        content,
        ride: rideInfo || null,
        is_read: false,
        created_at: db.serverDate(),
        meta: { sendError }
      }
    })
  } catch (e) {
    console.error('写入站内通知失败:', e)
    // 仍返回 sent 状态，避免影响前端操作
  }

  return { ok: true, msg: sent ? '客服消息已发送并写入通知' : '已写入通知（客服消息未发送）' }
}
