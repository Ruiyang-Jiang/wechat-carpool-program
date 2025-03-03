Page({
  data: {
    userInfo: {}, // 存储用户信息
    loggedIn: false, // 是否已登录
    ridesAsDriver: [], // 作为司机的顺风车
    ridesAsPassenger: [], // 作为乘客的顺风车
    currentTab: "passenger" // 默认显示"我乘坐的"
  },

  /**
   * 页面加载时触发
   */
  onLoad() {
    this.checkLoginStatus();
  },

  /**
   * 检查用户是否已登录并加载数据
   */
  checkLoginStatus() {
    const db = wx.cloud.database();
    const openid = wx.getStorageSync("openid");

    if (!openid) {
      wx.showToast({
        title: "请先登录",
        icon: "none"
      });
      return;
    }

    // 加载用户信息
    db.collection("users").where({ openid }).get().then((res) => {
      if (res.data.length > 0) {
        const userInfo = res.data[0];
        this.setData({
          userInfo,
          loggedIn: true
        });

        // 加载"我乘坐的" & "我接单的" 顺风车
        this.loadRides(userInfo);
      } else {
        wx.showToast({ title: "用户信息不存在", icon: "none" });
      }
    }).catch((err) => {
      console.error("获取用户信息失败:", err);
    });
  },

  /**
   * 加载用户的顺风车信息
   */
  loadRides(userInfo) {
    const db = wx.cloud.database();

    // ✅ 修正：确保 `as_passenger` 存在且是数组
    if (Array.isArray(userInfo.as_passenger) && userInfo.as_passenger.length > 0) {
      db.collection("rides")
        .where({ _id: db.command.in(userInfo.as_passenger) })
        .get()
        .then((res) => {
          this.setData({ ridesAsPassenger: res.data });
          console.log("我乘坐的顺风车:", res.data);
        })
        .catch((err) => {
          console.error("获取乘坐顺风车信息失败:", err);
        });
    } else {
      console.warn("as_passenger 字段为空或不存在");
    }

    // ✅ 修正：确保 `as_driver` 存在且是数组
    if (Array.isArray(userInfo.as_driver) && userInfo.as_driver.length > 0) {
      db.collection("rides")
        .where({ _id: db.command.in(userInfo.as_driver) })
        .get()
        .then((res) => {
          this.setData({ ridesAsDriver: res.data });
          console.log("我接单的顺风车:", res.data);
        })
        .catch((err) => {
          console.error("获取接单顺风车信息失败:", err);
        });
    } else {
      console.warn("as_driver 字段为空或不存在");
    }
  },


  /**
   * 切换到 "我乘坐的" 订单
   */
  switchToPassenger() {
    this.setData({ currentTab: "passenger" });
  },

  /**
   * 切换到 "我接单的" 订单
   */
  switchToDriver() {
    this.setData({ currentTab: "driver" });
  },

  /**
   * 绑定输入框，更新用户手机号
   */
  updatePhone(e) {
    this.setData({ "userInfo.phone": e.detail.value });
  },

  /**
   * 绑定输入框，更新用户微信号
   */
  updateWechat(e) {
    this.setData({ "userInfo.wechat": e.detail.value });
  },

  /**
   * 提交更新用户信息
   */
  saveUserInfo() {
    const db = wx.cloud.database();
    db.collection("users").where({ openid: this.data.userInfo.openid }).update({
      data: {
        phone: this.data.userInfo.phone,
        wechat: this.data.userInfo.wechat
      }
    }).then(() => {
      wx.showToast({ title: "更新成功", icon: "success" });
    }).catch((err) => {
      console.error("更新用户信息失败:", err);
      wx.showToast({ title: "更新失败", icon: "none" });
    });
  }
});
