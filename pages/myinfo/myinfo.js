// pages/myinfo/myinfo.js
const db = wx.cloud.database();

Page({
  data: {
    userInfo: {},
    loggedIn: false,
    currentTab: "passenger",  // "passenger" | "driver" | "mine"

    ridesAsDriver: [],   // 我接单的
    ridesAsPassenger: [], // 我乘坐的
    myPublishedRides: [],       // 我发布的 rides
    myPublishedRequests: [],    // 我发布的 rideRequest
  },

  onLoad() {
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    const openid = wx.getStorageSync("openid");
    if (!openid) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    // 加载用户信息
    db.collection("users").where({ openid }).get().then(res => {
      if (res.data.length > 0) {
        const userInfo = res.data[0];
        this.setData({ userInfo, loggedIn: true });
        // 加载"我乘坐的/我接单的"
        this.loadRides(userInfo);
        // 加载"我发布的"
        this.loadMyPublished();
      } else {
        wx.showToast({ title: "用户信息不存在", icon: "none" });
      }
    }).catch(err => {
      console.error("获取用户信息失败:", err);
    });
  },

  loadRides(userInfo) {
    // 我乘坐的
    if (Array.isArray(userInfo.as_passenger) && userInfo.as_passenger.length > 0) {
      db.collection("rides")
        .where({ _id: db.command.in(userInfo.as_passenger) })
        .get()
        .then(res => {
          this.setData({ ridesAsPassenger: res.data });
        })
        .catch(err => console.error("获取乘坐信息失败:", err));
    }
    // 我接单的
    if (Array.isArray(userInfo.as_driver) && userInfo.as_driver.length > 0) {
      db.collection("rides")
        .where({ _id: db.command.in(userInfo.as_driver) })
        .get()
        .then(res => {
          this.setData({ ridesAsDriver: res.data });
        })
        .catch(err => console.error("获取接单信息失败:", err));
    }
  },

  // 加载我发布过的 rides & rideRequest
  loadMyPublished() {
    const openid = this.data.userInfo.openid;
    // 我发布的 rides
    db.collection("rides").where({
      publisher_id: openid
    }).get().then(res => {
      this.setData({ myPublishedRides: res.data });
    }).catch(err => console.error("加载我发布的 rides 失败:", err));

    // 我发布的 rideRequest
    db.collection("rideRequest").where({
      publisher_id: openid
    }).get().then(res => {
      this.setData({ myPublishedRequests: res.data });
    }).catch(err => console.error("加载我发布的 rideRequest 失败:", err));
  },

// **更新价格**
  updatePrice(e) {
    const rideId = e.currentTarget.dataset.id;
    const newPrice = e.detail.value;

    const updatedRides = this.data.myPublishedRides.map(ride => {
      if (ride._id === rideId) {
        return { ...ride, price: newPrice };
      }
      return ride;
    });

    this.setData({ myPublishedRides: updatedRides });
  },

  // **更新空余座位**
  updateSeats(e) {
    const rideId = e.currentTarget.dataset.id;
    const newSeats = e.detail.value;

    const updatedRides = this.data.myPublishedRides.map(ride => {
      if (ride._id === rideId) {
        return { ...ride, empty_seats: newSeats };
      }
      return ride;
    });

    this.setData({ myPublishedRides: updatedRides });
  },

  // tab 切换
  switchToPassenger() {
    this.setData({ currentTab: "passenger" });
  },
  switchToDriver() {
    this.setData({ currentTab: "driver" });
  },
  switchToMine() {
    this.setData({ currentTab: "mine" });
  },

  deletePublishedRide(e) {
    const rideId = e.currentTarget.dataset.id;
    db.collection("rides").doc(rideId).remove().then(() => {
      wx.showToast({ title: "删除成功", icon: "success" });
      this.loadMyPublished();
    }).catch(err => {
      console.error("删除失败:", err);
      wx.showToast({ title: "删除失败", icon: "none" });
    });
  },

  editPublishedRequest(e) {
    const requestId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/editRequest/editRequest?id=${requestId}` });
  },


  // **保存修改到数据库**
  saveUpdates(e) {
    const rideId = e.currentTarget.dataset.id;
    const updatedRide = this.data.myPublishedRides.find(ride => ride._id === rideId);
    
    if (!updatedRide) return;

    db.collection("rides").doc(rideId).update({
      data: {
        price: parseFloat(updatedRide.price) || 0,
        empty_seats: parseInt(updatedRide.empty_seats) || 0
      }
    }).then(() => {
      wx.showToast({ title: "更新成功", icon: "success" });
      this.loadMyPublished(); // Reload data
    }).catch(err => {
      console.error("更新失败:", err);
      wx.showToast({ title: "更新失败", icon: "none" });
    });
  },

  // 更新手机号/微信
  updatePhone(e) {
    this.setData({ "userInfo.phone": e.detail.value });
  },
  updateWechat(e) {
    this.setData({ "userInfo.wechat": e.detail.value });
  },
  saveUserInfo() {
    db.collection("users").where({ openid: this.data.userInfo.openid }).update({
      data: {
        phone: this.data.userInfo.phone,
        wechat: this.data.userInfo.wechat
      }
    }).then(() => {
      wx.showToast({ title: "更新成功", icon: "success" });
    }).catch(err => {
      console.error("更新用户信息失败:", err);
      wx.showToast({ title: "更新失败", icon: "none" });
    });
  },

  updateRequestPrice(e) {
    const requestId = e.currentTarget.dataset.id;
    const newPrice = e.detail.value;

    const updatedRequests = this.data.myPublishedRequests.map(request => {
      if (request._id === requestId) {
        return { ...request, price: newPrice };
      }
      return request;
    });

    this.setData({ myPublishedRequests: updatedRequests });
  },

  updatePassengerNumber(e) {
    const requestId = e.currentTarget.dataset.id;
    const newPassengerNumber = e.detail.value;

    const updatedRequests = this.data.myPublishedRequests.map(request => {
      if (request._id === requestId) {
        return { ...request, passenger_number: newPassengerNumber };
      }
      return request;
    });

    this.setData({ myPublishedRequests: updatedRequests });
  },

  saveRequestUpdates(e) {
    const requestId = e.currentTarget.dataset.id;
    const updatedRequest = this.data.myPublishedRequests.find(request => request._id === requestId);

    if (!updatedRequest) return;

    db.collection("rideRequest").doc(requestId).update({
      data: {
        price: parseFloat(updatedRequest.price) || 0,
        passenger_number: parseInt(updatedRequest.passenger_number) || 0
      }
    }).then(() => {
      wx.showToast({ title: "更新成功", icon: "success" });
      this.loadMyPublished(); // Reload data
    }).catch(err => {
      console.error("更新失败:", err);
      wx.showToast({ title: "更新失败", icon: "none" });
    });
  },

  deletePublishedRequest(e) {
    const requestId = e.currentTarget.dataset.id;
    db.collection("rideRequest").doc(requestId).remove().then(() => {
      wx.showToast({ title: "删除成功", icon: "success" });
      this.loadMyPublished();
    }).catch(err => {
      console.error("删除失败:", err);
      wx.showToast({ title: "删除失败", icon: "none" });
    });
  },

  // Add a method to navigate to the detail page
  navigateToDetail(e) {
    const { id, type } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/detail/detail?type=${type}&id=${id}`
    });
  }
});
