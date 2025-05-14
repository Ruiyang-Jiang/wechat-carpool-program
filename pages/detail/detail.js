// pages/detail/detail.js
const db = wx.cloud.database();
Page({
  data: {
    itemType: "", // "rides" or "request"
    itemId: "",
    detail: null,    // 具体数据
    publisherInfo: null, // 发布者的信息
    userOpenid: "",  // 当前用户 openid
    isLoading: true,  // 加载状态
    adUnitId: 'your-ad-unit-id-here', // 替换为你的广告单元ID
  },

  onLoad(options) {
    console.log("Detail page onLoad options:", options);
    const { type, id } = options;
    
    if (!type || !id) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 先获取用户openid
    const userOpenid = wx.getStorageSync("openid");
    
    this.setData({
      itemType: type,
      itemId: id,
      userOpenid: userOpenid,
      isLoading: true
    });

    console.log("Initial state:", {
      itemType: type,
      itemId: id,
      userOpenid: userOpenid
    });

    // 加载详情数据
    this.loadDetail();
  },

  loadDetail() {
    const { itemType, itemId } = this.data;
    console.log("Loading detail for:", itemType, itemId);

    if (!itemId) {
      console.error("No itemId provided");
      return;
    }

    const db = wx.cloud.database();
    // 修正collection名称判断
    const collectionName = itemType === "rides" ? "rides" : "rideRequest";
    
    db.collection(collectionName).doc(itemId).get()
      .then(res => {
        console.log("Detail data loaded:", res.data);
        if (!res.data) {
          throw new Error('No data found');
        }
        
        this.setData({ 
          detail: res.data,
          isLoading: false
        });

        console.log("Current state after loading detail:", {
          itemType: this.data.itemType,
          detail: res.data,
          userOpenid: this.data.userOpenid
        });

        // 加载发布者信息
        if (res.data.publisher_id) {
          this.loadPublisher(res.data.publisher_id);
        }
      })
      .catch(err => {
        console.error("加载详情失败:", err);
        wx.showToast({ 
          title: "加载详情失败", 
          icon: "none" 
        });
        this.setData({ isLoading: false });
      });
  },

  loadPublisher(publisherId) {
    if (!publisherId) {
      console.error("No publisherId provided");
      return;
    }

    const db = wx.cloud.database();
    db.collection("users").where({
      _openid: publisherId
    }).get()
      .then(res => {
        console.log("Publisher data loaded:", res.data);
        if (res.data && res.data.length > 0) {
          const publisherInfo = res.data[0];
          // 如果发布信息中有微信号，优先使用发布信息中的微信号
          if (this.data.detail.contact_wechat) {
            publisherInfo.wechat = this.data.detail.contact_wechat;
          }
          this.setData({ publisherInfo });
        }
      })
      .catch(err => {
        console.error("加载发布者信息失败:", err);
      });
  },

  handleCopyWeChat() {
    if (!this.data.publisherInfo?.wechat) {
      wx.showToast({
        title: '未提供微信号',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '获取微信号',
      content: '确定要获取发布者的微信号吗？',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: this.data.publisherInfo.wechat,
            success: () => {
              wx.showToast({
                title: '微信号已复制',
                icon: 'success'
              });
            }
          });
        }
      }
    });
  },

  handleTakeRide() {
    if (!this.data.userOpenid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    if (!this.data.detail) {
      wx.showToast({ title: '数据加载中', icon: 'none' });
      return;
    }

    const db = wx.cloud.database();
    const rideId = this.data.itemId;
    const userOpenid = this.data.userOpenid;

    // 检查是否还有空位
    if (this.data.detail.empty_seats <= 0) {
      wx.showToast({ title: '已无空余座位', icon: 'none' });
      return;
    }

    // 1. 更新 rides 集合
    db.collection('rides').doc(rideId).update({
      data: {
        empty_seats: db.command.inc(-1),
        passengers: db.command.addToSet(userOpenid)
      }
    }).then(() => {
      // 2. 更新用户的 as_passenger 数组
      return db.collection('users').where({
        openid: userOpenid
      }).update({
        data: {
          as_passenger: db.command.addToSet(rideId)
        }
      });
    }).then(() => {
      wx.showToast({ 
        title: '乘坐成功', 
        icon: 'success',
        success: () => {
          setTimeout(() => wx.navigateBack(), 1500);
        }
      });
    }).catch(err => {
      console.error('乘坐失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  // 接单逻辑
  takeOrder() {
    const userOpenid = wx.getStorageSync("openid");
    if (!userOpenid) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    const db = wx.cloud.database();
    const { itemType, itemId, detail } = this.data;

    if (itemType === "rides") {
      // 乘客点击乘坐此车
      if (detail.empty_seats <= 0) {
        wx.showToast({ title: "已无空余座位", icon: "none" });
        return;
      }

      // 1. 更新 rides 集合中的空位数和乘客列表
      db.collection("rides").doc(itemId).update({
        data: {
          empty_seats: db.command.inc(-1),
          passengers: db.command.addToSet(userOpenid)
        }
      }).then(() => {
        // 2. 更新用户的乘车记录
        return db.collection("users").where({
          openid: userOpenid
        }).update({
          data: {
            as_passenger: db.command.addToSet(itemId)
          }
        });
      }).then(() => {
        wx.showToast({ 
          title: "乘坐成功", 
          icon: "success",
          success: () => {
            setTimeout(() => wx.navigateBack(), 1500);
          }
        });
      }).catch(err => {
        console.error("乘坐失败:", err);
        wx.showToast({ title: "操作失败", icon: "none" });
      });

    } else {
      // 司机接受人找车请求
      const request = this.data.detail;
      
      // 1. 在 rides 集合中创建新记录
      db.collection("rides").add({
        data: {
          publisher_id: request.publisher_id,
          driver_id: userOpenid,
          departure_place: request.departure_place,
          arrival_place: request.arrival_place,
          departure_date: request.departure_date,
          departure_time: request.departure_time,
          price: request.price,
          empty_seats: request.passenger_number || 1,
          passengers: [request.publisher_id],
          status: 'accepted',
          created_at: db.serverDate()
        }
      }).then(res => {
        const newRideId = res._id;

        // 2. 更新司机的接单记录
        return db.collection("users").where({
          openid: userOpenid
        }).update({
          data: {
            as_driver: db.command.addToSet(newRideId)
          }
        }).then(() => {
          // 3. 更新发布者的乘车记录
          return db.collection("users").where({
            openid: request.publisher_id
          }).update({
            data: {
              as_passenger: db.command.addToSet(newRideId)
            }
          });
        }).then(() => {
          // 4. 删除原始请求
          return db.collection("rideRequest").doc(itemId).remove();
        });
      }).then(() => {
        wx.showToast({
          title: "接单成功",
          icon: "success",
          success: () => {
            setTimeout(() => wx.navigateBack(), 1500);
          }
        });
      }).catch(err => {
        console.error("接单失败:", err);
        wx.showToast({ title: "操作失败", icon: "none" });
      });
    }
  },

  handleAcceptRequest() {
    if (!this.data.userOpenid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    if (!this.data.detail) {
      wx.showToast({ title: '数据加载中', icon: 'none' });
      return;
    }

    const db = wx.cloud.database();
    const requestId = this.data.itemId;
    const userOpenid = this.data.userOpenid;
    const requestDetail = this.data.detail;

    // 1. 创建新的 ride
    db.collection('rides').add({
      data: {
        publisher_id: requestDetail.publisher_id,
        driver_id: userOpenid,
        departure_place: requestDetail.departure_place,
        arrival_place: requestDetail.arrival_place,
        departure_date: requestDetail.departure_date,
        departure_time: requestDetail.departure_time,
        price: requestDetail.price,
        empty_seats: requestDetail.passenger_number,
        passengers: [requestDetail.publisher_id],
        status: 'accepted',
        created_at: db.serverDate()
      }
    }).then(res => {
      const newRideId = res._id;
      
      // 2. 更新司机的 as_driver 数组
      return db.collection('users').where({
        openid: userOpenid
      }).update({
        data: {
          as_driver: db.command.addToSet(newRideId)
        }
      }).then(() => {
        // 3. 更新发布者的 as_passenger 数组
        return db.collection('users').where({
          openid: requestDetail.publisher_id
        }).update({
          data: {
            as_passenger: db.command.addToSet(newRideId)
          }
        });
      }).then(() => {
        // 4. 删除原请求
        return db.collection('rideRequest').doc(requestId).remove();
      });
    }).then(() => {
      wx.showToast({
        title: '接单成功',
        icon: 'success',
        success: () => {
          setTimeout(() => wx.navigateBack(), 1500);
        }
      });
    }).catch(err => {
      console.error('接单失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  }
});
