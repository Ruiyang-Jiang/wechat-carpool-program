/**
 * 用户反馈云函数
 * 收集用户的问题反馈和建议
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID: openid } = cloud.getWXContext() || {}
  if (!openid) {
    return { ok: false, msg: '获取用户信息失败' }
  }

  const {
    type,        // 反馈类型：'bug', 'suggestion', 'other'
    title,       // 反馈标题
    content,     // 反馈内容
    contact      // 联系方式（可选）
  } = event

  // 参数校验
  if (!type || !title || !content) {
    return { ok: false, msg: '请填写完整的反馈信息' }
  }

  if (content.length < 10) {
    return { ok: false, msg: '反馈内容至少需要10个字符' }
  }

  if (content.length > 1000) {
    return { ok: false, msg: '反馈内容不能超过1000个字符' }
  }

  try {
    // 获取用户信息
    const userRes = await db.collection('users').doc(openid).get().catch(() => ({}))
    const user = userRes.data || {}

    // 保存反馈到数据库
    const feedbackId = (await db.collection('feedback').add({
      data: {
        user_openid: openid,
        user_nickname: user.nickname || '匿名用户',
        type: type,
        title: title.trim(),
        content: content.trim(),
        contact: contact ? contact.trim() : '',
        status: 'pending',  // pending, processing, resolved, closed
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      }
    }))._id

    console.log(`新反馈提交: ${feedbackId}, 用户: ${user.nickname || openid}`)

    return {
      ok: true,
      feedbackId,
      msg: '反馈提交成功，我们会尽快处理！'
    }

  } catch (error) {
    console.error('提交反馈失败:', error)
    return {
      ok: false,
      msg: '提交失败，请稍后重试'
    }
  }
}