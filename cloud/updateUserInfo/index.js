const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event)=>{
  const { OPENID: openid } = cloud.getWXContext() || {}
  const { phone='', wechat='' } = event
  await db.collection('users').doc(openid).set({
    data:{ phone, wechat }
  }).catch(()=>{})
  return { ok:true }
}
