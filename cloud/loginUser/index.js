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
    
    // 检查用户是否已存在
    const userQuery = await db.collection('users').where({ openid }).get();
    
    if (userQuery.data.length > 0) {
      // 用户已存在，返回成功
      return {
        success: true,
        openid: openid,
        message: '用户已存在',
        isNewUser: false
      };
    } else {
      // 新用户，创建用户记录
      const userData = {
        openid: openid,
        nickname: '微信用户',
        avatarUrl: '',
        phone: '',
        wechat: '',
        created_at: new Date().toISOString(),
        as_driver: [],
        as_passenger: []
      };
      
      await db.collection('users').add({
        data: userData
      });
      
      return {
        success: true,
        openid: openid,
        message: '新用户注册成功',
        isNewUser: true
      };
    }
  } catch (error) {
    console.error('登录云函数执行失败:', error);
    return {
      success: false,
      message: '登录失败，请稍后重试',
      error: error.message
    };
  }
};
