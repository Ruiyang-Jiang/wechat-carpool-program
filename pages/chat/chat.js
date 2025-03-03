Page({
  data: {
    rideId: "",
    user_id: "",
    user_name: "",
    messages: [],
    messageContent: "",
    driver_wechat: "",
    pending_passengers: [],
    confirmed_passengers: []
  },

  onLoad(options) {
    this.setData({
      rideId: options.rideId,
      user_id: wx.getStorageSync("user_id"),
      user_name: wx.getStorageSync("user_name")
    });

    this.loadMessages();
    this.loadRideDetails();
  },

  loadMessages() {
    const db = wx.cloud.database();
    db.collection("rides").doc(this.data.rideId).get().then(res => {
      this.setData({ messages: res.data.messages || [] });
      this.scrollToBottom();
    });
  },

  loadRideDetails() {
    const db = wx.cloud.database();
    db.collection("rides").doc(this.data.rideId).get().then(res => {
      this.setData({
        driver_wechat: res.data.driver_wechat,
        pending_passengers: res.data.pending_passengers || [],
        confirmed_passengers: res.data.confirmed_passengers || []
      });
    });
  },

  onInputMessage(e) {
    this.setData({ messageContent: e.detail.value });
  },

  sendMessage() {
    if (!this.data.messageContent.trim()) return;

    const newMessage = {
      user_id: this.data.user_id,
      user_name: this.data.user_name,
      content: this.data.messageContent,
      timestamp: new Date().toLocaleString()
    };

    const db = wx.cloud.database();
    db.collection("rides").doc(this.data.rideId).update({
      data: {
        messages: db.command.push(newMessage)
      }
    }).then(() => {
      this.loadMessages();
      this.setData({ messageContent: "" });
    });
  },

  addWechat() {
    wx.showModal({
      title: "车主微信",
      content: `请添加车主微信：${this.data.driver_wechat}`,
      showCancel: false
    });
  },

  scrollToBottom() {
    this.setData({ scrollTop: 99999 });
  }
});
