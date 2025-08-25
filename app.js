// app.js
App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
    wx.cloud.init({
      // env 参数说明：
      //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
      //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
      //   如不填则使用默认环境（第一个创建的环境）
      env: "carpool-0gazzzn11db221a4",
      traceUser:true,
    });

    // 可选：调用 wx.login 获取临时 code，用于后端换取 session（不做强制跳转）
    wx.login({
      success: () => {}
    })

    // 系统级隐私授权：如需授权，则拉起授权弹窗
    if (wx.getPrivacySetting && wx.requirePrivacyAuthorize) {
      wx.getPrivacySetting({
        success: (res) => {
          if (res.needAuthorization) {
            wx.requirePrivacyAuthorize({
              success: () => {},
              fail: () => {},
              complete: () => {}
            })
          }
        }
      })
    }
  },

  // 当需要拉起隐私弹窗时回调；这里引导用户查看隐私协议
  onNeedPrivacyAuthorization(resolve) {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({
        success: () => {},
        complete: () => {
          // 返回给框架，继续拉起系统隐私弹窗
          if (typeof resolve === 'function') resolve()
        }
      })
    } else {
      // 低版本兜底
      if (typeof resolve === 'function') resolve()
    }
  },

  globalData: {
    userInfo: null
  }
})
