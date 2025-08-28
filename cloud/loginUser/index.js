const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return {
      success: false,
      message: '获取用户标识失败'
    };
  }

  try {
    const db = cloud.database();

    // 优先以 openid 作为文档 ID，保持与前端 doc(openid) 读写一致
    const docSnap = await db.collection('users').doc(openid).get().catch(() => ({}));
    if (docSnap && docSnap.data) {
      return { success: true, openid, message: '用户已存在', isNewUser: false };
    }

    // 兼容旧数据：若存在 where({ openid }) 的文档，则迁移到以 openid 为 docId
    const userQuery = await db.collection('users').where({ openid }).get();
    if (userQuery.data && userQuery.data.length > 0) {
      const old = userQuery.data[0];
      await db.collection('users').doc(openid).set({ data: old }).catch(() => {});
      return { success: true, openid, message: '用户已存在', isNewUser: false };
    }

    // 新用户，创建用户记录（docId = openid）
    const userData = {
      _id: openid,
      openid: openid,
      nickname: '微信用户',
      avatarUrl: '',
      phone: '',
      wechat: '',
      created_at: new Date().toISOString(),
      as_driver: [],
      as_passenger: []
    };
    await db.collection('users').doc(openid).set({ data: userData });

    return { success: true, openid, message: '新用户注册成功', isNewUser: true };
  } catch (error) {
    console.error('登录云函数执行失败:', error);
    return {
      success: false,
      message: '登录失败，请稍后重试',
      error: error.message
    };
  }
};
