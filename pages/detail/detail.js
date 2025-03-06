// pages/detail/detail.js
const db = wx.cloud.database();
Page({
  data: {
    itemType: "", // "rides" or "request"
    itemId: "",
    detail: null,    // 具体数据
    publisherInfo: null, // 发布者的信息
    messages: [],    // 简易交流区
    newMessage: "",   // 输入的新消息
    rideId: '',
    userId: '',
    rideDetails: {},
    driverAvatar: '',
    driverUsername: ''
  },

  onLoad(options) {
    const { type, id } = options;
    this.setData({
      itemType: type,
      itemId: id,
      rideId: id,
      userId: wx.getStorageSync('user_id')
    }, () => {
      this.loadDetail();
    });
  },

  // 加载条目详情
  loadDetail() {
    const { itemType, itemId } = this.data;
    const collectionName = itemType === "rides" ? "rides" : "rideRequest";
    db.collection(collectionName).doc(itemId).get()
      .then(res => {
        this.setData({ detail: res.data });
        // 加载发布者信息
        this.loadPublisher(res.data.publisher_id);
        // 加载交流信息
        this.loadMessages();
      })
      .catch(err => {
        console.error("加载详情失败", err);
      });
  },

  loadPublisher(publisherId) {
    if (!publisherId) return;
    db.collection("users").where({ _id: publisherId }).get()
      .then(res => {
        if (res.data.length > 0) {
          const publisher = res.data[0];
          this.setData({ 
            publisherInfo: publisher,
            driverAvatar: publisher.avatarUrl,
            driverUsername: publisher.nickName
          });
        }
      })
      .catch(err => {
        console.error("加载发布者信息失败", err);
      });
  },

  loadMessages() {
    const db = wx.cloud.database();
    db.collection("rides").doc(this.data.rideId).get().then(res => {
      this.setData({ messages: res.data.messages || [] });
    });
  },

  // 简单的交流功能（示例）
  onMessageInput(e) {
    this.setData({ newMessage: e.detail.value });
  },
  sendMessage() {
    const msg = this.data.newMessage.trim();
    if (!msg) return;
    // 将消息存储到 detail 对象中
    const userOpenid = wx.getStorageSync("openid");
    const userNickname = "我"; // 或者从用户信息里取

    // 仅示例：将 messages 存到 ride doc 里
    const collectionName = this.data.itemType === "rides" ? "rides" : "rideRequest";
    db.collection(collectionName).doc(this.data.itemId).update({
      data: {
        messages: db.command.push({
          userOpenid,
          userNickname,
          content: msg,
          timestamp: new Date()
        })
      }
    }).then(() => {
      wx.showToast({ title: "发送成功" });
      this.setData({ newMessage: "" });
      this.loadMessages(); // 重新加载
    });
  },

  // 接单逻辑
  takeOrder() {
    const userOpenid = wx.getStorageSync("openid");
    if (!userOpenid) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    if (this.data.itemType === "rides") {
      // 乘客点击 => as_passenger
      const rideId = this.data.itemId;
      db.collection("users").where({ openid: userOpenid }).update({
        data: {
          as_passenger: db.command.push(rideId)
        }
      }).then(() => {
        wx.showToast({ title: "接单成功", icon: "success" });
      });
    } else {
      // rideRequest => 司机点击 => 从 rideRequest 转移到 rides
      const request = this.data.detail;
      // 1. 在 rides 新建
      db.collection("rides").add({
        data: {
          publisher_id: request.publisher_id,
          departure_place: request.departure_place,
          arrival_place: request.arrival_place,
          departure_date: request.departure_date,
          departure_time: request.departure_time,
          price: request.price,
          has_driver: true,
          driver_id: userOpenid,
          empty_seats: request.passenger_number || 3, // Use passenger_number or default
          status: 'open',
          car_model: request.car_model || '未知', // Add any other fields needed
          messages: request.messages || []
        }
      }).then(res => {
        const newRideId = res._id;
        // 2. 删除 rideRequest 里的旧记录
        db.collection("rideRequest").doc(request._id).remove();

        // 3. 更新当前司机 as_driver
        db.collection("users").where({ openid: userOpenid }).update({
          data: {
            as_driver: db.command.push(newRideId)
          }
        }).then(() => {
          wx.showToast({ title: "转为车找人成功", icon: "success" });
        });
      });
    }
  },

  // 修改信息（示例）
  editItem() {
    // 跳转到编辑页面
    wx.navigateTo({
      url: `/pages/editItem/editItem?type=${this.data.itemType}&id=${this.data.itemId}`
    });
  },

  // 删除条目
  deleteItem() {
    const collectionName = this.data.itemType === "rides" ? "rides" : "rideRequest";
    db.collection(collectionName).doc(this.data.itemId).remove().then(() => {
      wx.showToast({ title: "删除成功", icon: "success" });
      wx.navigateBack();
    });
  },

  loadRideDetails() {
    db.collection('rides').doc(this.data.rideId).get().then(res => {
      this.setData({ rideDetails: res.data });
    });
  },

  acceptRide() {
    const rideId = this.data.rideId;
    const userId = this.data.userId;

    // Update the ride to include this user as a passenger
    db.collection('rides').doc(rideId).update({
      data: {
        passengers: db.command.addToSet(userId)
      }
    }).then(() => {
      // Update the user's data to include this ride
      db.collection('users').where({ _id: userId }).update({
        data: {
          as_passenger: db.command.addToSet(rideId)
        }
      }).then(() => {
        wx.showToast({ title: '接单成功', icon: 'success' });
      }).catch(err => {
        console.error('更新用户信息失败:', err);
        wx.showToast({ title: '更新失败', icon: 'none' });
      });
    }).catch(err => {
      console.error('接单失败:', err);
      wx.showToast({ title: '接单失败', icon: 'none' });
    });
  }
});
