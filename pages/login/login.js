Page({
  data: {
    userInfo: {}, // 存储用户信息
    loggedIn: false // 是否已登录
  },

  /**
   * 页面加载时触发
   * 1. 检查用户是否已登录
   * 2. 获取 openid
   */
  onLoad() {
    this.checkLoginStatus();
  },

  /**
   * 检查用户是否已经注册
   */
  checkLoginStatus() {
    const db = wx.cloud.database();
    const openid = wx.getStorageSync("openid");

    if (openid) {
      db.collection("users").where({ openid }).get().then((res) => {
        if (res.data.length > 0) {
          // 用户已注册，更新状态
          this.setData({
            userInfo: res.data[0],
            loggedIn: true
          });

          // 直接跳转到首页
          wx.switchTab({ url: "/pages/index/index" });
        } else {
          this.setData({ loggedIn: false });
        }
      }).catch((err) => {
        console.error("数据库查询失败:", err);
      });
    }
  },

  /**
   * 用户点击登录按钮时触发
   */
  login() {
    wx.getUserProfile({
      desc: "用于完善用户资料",
      success: (res) => {
        console.log("获取用户信息成功:", res.userInfo);
        this.registerUser(res.userInfo);
      },
      fail: (err) => {
        console.error("获取用户信息失败:", err);
        wx.showToast({
          title: "请授权获取用户信息",
          icon: "none"
        });
      }
    });
  },

  /**
   * 注册新用户（存入数据库）
   */
  registerUser(userInfo) {
    wx.login({
      success: () => {
        wx.cloud.callFunction({
          name: "getOpenId",
          success: (res) => {
            const openid = res.result.openid;
            wx.setStorageSync("openid", openid); // 存储 openid

            const db = wx.cloud.database();

            // 先检查数据库是否已有该用户
            db.collection("users").where({ openid }).get().then(queryRes => {
              if (queryRes.data.length === 0) {
                // 新用户，存入数据库
                db.collection("users").add({
                  data: {
                    openid: openid,
                    nickname: userInfo.nickName,
                    avatarUrl: userInfo.avatarUrl,
                    phone: "",  // 预留字段，用户可以手动输入
                    wechat: "", // 预留字段，用户可以手动输入
                    created_at: new Date().toISOString(),
                    as_driver: [], // 司机的顺风车订单
                    as_passenger: [] // 乘客的顺风车订单
                  }
                }).then(() => {
                  wx.showToast({ title: "注册成功", icon: "success" });

                  // 更新页面状态
                  this.setData({
                    userInfo: userInfo,
                    loggedIn: true
                  });

                  // 跳转到首页
                  wx.switchTab({ url: "/pages/index/index" });
                }).catch((err) => {
                  console.error("用户信息存储失败:", err);
                });
              } else {
                // 旧用户，更新数据库信息
                db.collection("users").where({ openid }).update({
                  data: {
                    nickname: userInfo.nickName,
                    avatarUrl: userInfo.avatarUrl
                  }
                }).then(() => {
                  wx.showToast({ title: "登录成功", icon: "success" });

                  // 更新页面状态
                  this.setData({
                    userInfo: userInfo,
                    loggedIn: true
                  });

                  // 跳转到首页
                  wx.switchTab({ url: "/pages/index/index" });
                }).catch((err) => {
                  console.error("用户信息更新失败:", err);
                });
              }
            }).catch((err) => {
              console.error("数据库查询失败:", err);
            });
          },
          fail: (err) => {
            console.error("获取 OpenID 失败:", err);
            wx.showToast({ title: "获取 OpenID 失败", icon: "none" });
          }
        });
      },
      fail: () => {
        wx.showToast({ title: "微信登录失败", icon: "none" });
      }
    });
  }
});
