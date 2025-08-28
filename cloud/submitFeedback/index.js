/**
 * 用户反馈云函数
 * 收集用户的问题反馈和建议，并可选发送邮件到维护者邮箱
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

let nodemailer = null
try { nodemailer = require('nodemailer') } catch (e) { /* 未安装时忽略邮件发送 */ }

async function sendMailSafe(payload) {
  if (!nodemailer) return { sent: false, reason: 'nodemailer_not_installed' }

  const {
    SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM,
    FEEDBACK_TO
  } = process.env

  const to = FEEDBACK_TO || 'rj393@cornell.edu'
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.warn('SMTP env not fully configured, skip email')
    return { sent: false, reason: 'smtp_not_configured' }
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 465),
    secure: String(SMTP_SECURE || 'true') === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  })

  const { type, title, content, contact, feedbackId, openid } = payload
  const subject = `[顺风车反馈][${type}] ${title}`
  const text = `类型: ${type}\n标题: ${title}\n内容: ${content}\n联系方式: ${contact || '-'}\n用户: ${openid}\n反馈ID: ${feedbackId}`
  const html = `
    <h3>新的用户反馈</h3>
    <ul>
      <li><b>类型</b>: ${type}</li>
      <li><b>标题</b>: ${title}</li>
      <li><b>用户</b>: ${openid}</li>
      <li><b>反馈ID</b>: ${feedbackId}</li>
      <li><b>联系方式</b>: ${contact || '-'}</li>
    </ul>
    <pre style="white-space:pre-wrap">${content}</pre>
  `

  try {
    const info = await transporter.sendMail({ from: SMTP_FROM, to, subject, text, html })
    console.log('Feedback email sent:', info && info.messageId)
    return { sent: true }
  } catch (err) {
    console.error('Send feedback email failed:', err)
    return { sent: false, reason: 'send_failed', error: err && err.message }
  }
}

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

    // 尝试发送邮件（异步，不影响主流程）
    sendMailSafe({ type, title, content, contact, feedbackId, openid })
      .then(r => { if (!r.sent) console.warn('mail skipped:', r) })
      .catch(err => console.error('mail error:', err))

    return { ok: true, feedbackId, msg: '反馈提交成功，我们会尽快处理！' }

  } catch (error) {
    console.error('提交反馈失败:', error)
    return {
      ok: false,
      msg: '提交失败，请稍后重试'
    }
  }
}