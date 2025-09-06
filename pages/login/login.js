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
    
    // 2秒后自动跳转到首页（如果用户没有主动登录）
    setTimeout(() => {
      if (!this.data.loggedIn) {
        wx.switchTab({ url: "/pages/index/index" });
      }
    }, 2000);
  },

  /**
   * 检查用户是否已经注册
   */
  checkLoginStatus() {
    const db = wx.cloud.database();
    const openid = wx.getStorageSync("openid");

    if (openid) {
      db.collection("users").doc(openid).get().then((res) => {
        if (res.data) {
          // 用户已注册（以 openid 作为 docId 的规范写法）
          this.setData({ userInfo: res.data, loggedIn: true });
          wx.switchTab({ url: "/pages/index/index" });
        } else {
          this.setData({ loggedIn: false });
        }
      }).catch((err) => {
        console.error("读取用户信息失败:", err);
        if (err && (err.errCode === -1 || err.code === 'DATABASE_COLLECTION_NOT_EXIST')) {
          this.initializeDatabase();
        } else {
          wx.showToast({ title: '数据库连接失败，请稍后重试', icon: 'none' });
        }
        this.setData({ loggedIn: false });
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
            // 以 openid 作为 docId（与云函数 loginUser 保持一致）
            db.collection("users").doc(openid).get().then(snap => {
              if (!snap.data) {
                // 新用户：创建文档（docId = openid）
                db.collection("users").doc(openid).set({
                  data: {
                    _id: openid,
                    openid: openid,
                    nickname: userInfo.nickName,
                    avatarUrl: userInfo.avatarUrl,
                    phone: "",
                    wechat: "",
                    created_at: new Date().toISOString(),
                    as_driver: [],
                    as_passenger: []
                  }
                }).then(() => {
                  wx.showToast({ title: "注册成功", icon: "success" });
                  this.setData({ userInfo: userInfo, loggedIn: true });
                  wx.switchTab({ url: "/pages/index/index" });
                })
              } else {
                // 老用户：更新头像/昵称
                db.collection("users").doc(openid).update({
                  data: {
                    nickname: userInfo.nickName,
                    avatarUrl: userInfo.avatarUrl
                  }
                }).then(() => {
                  wx.showToast({ title: "登录成功", icon: "success" });
                  this.setData({ userInfo: userInfo, loggedIn: true });
                  wx.switchTab({ url: "/pages/index/index" });
                })
              }
            }).catch((err) => {
              console.error("读取/写入用户失败:", err);
              wx.showToast({ title: "登录失败，请稍后重试", icon: "none" });
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
  },

  /**
   * 初始化数据库（创建必要的集合）
   */
  initializeDatabase() {
    console.log('尝试初始化数据库...');
    wx.cloud.callFunction({
      name: 'databaseMigration',
      data: { action: 'migrate' },
      success: (res) => {
        console.log('数据库初始化成功:', res);
        if (res.result.success) {
          wx.showToast({
            title: '数据库初始化成功',
            icon: 'success'
          });
          // 重新检查登录状态
          setTimeout(() => {
            this.checkLoginStatus();
          }, 1000);
        }
      },
      fail: (err) => {
        console.error('数据库初始化失败:', err);
        wx.showToast({
          title: '数据库初始化失败，请联系管理员',
          icon: 'none'
        });
      }
    });
  }
});
