Page({
  data: {
    chatItems: []
  },

  onLoad() {
    this.loadChatItems();
  },

  loadChatItems() {
    const db = wx.cloud.database();
    db.collection("messages").where({
      user_id: wx.getStorageSync("user_id")
    }).get().then(res => {
      this.setData({ chatItems: res.data });
    });
  },

  navigateToChat(e) {
    const { rideId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/detail/detail?type=rides&id=${rideId}`
    });
  }
});
