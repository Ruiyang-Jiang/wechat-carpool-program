const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { touser, content, rideInfo } = event

  if (!touser || !content) {
    return { ok: false, msg: '缺少必要参数' }
  }

  try {
    // 使用微信客服消息发送通知
    const result = await cloud.openapi.customerServiceMessage.send({
      touser: touser,
      msgtype: 'text',
      text: {
        content: content
      }
    })

    console.log('微信客服消息发送成功:', result)
    return { ok: true, msg: '通知发送成功' }
  } catch (error) {
    console.error('发送微信客服消息失败:', error)
    return { ok: false, msg: '通知发送失败', error: error.message }
  }
}
