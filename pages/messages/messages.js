// pages/messages/messages.js
const db = wx.cloud.database();

Page({
  data: {
    chatItems: []
  },

  onShow() {
    this.loadChatList();
  },

  // 加载我收到的消息
  loadChatList() {
    const myOpenid = wx.getStorageSync("openid");
    if (!myOpenid) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    // messages 集合: receiver_openid == myOpenid
    db.collection("messages").where({
      receiver_openid: myOpenid
    }).get().then(res => {
      // sort by updated_at desc
      let items = res.data.sort((a, b) => {
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
      this.setData({ chatItems: items });
    });
  },

  // 点击后 => unread_count=0 => 跳转 detail => messages 协同
  openChat(e) {
    const chatId = e.currentTarget.dataset.id;
    const rideId = e.currentTarget.dataset.rideid;
    // set unread_count=0
    db.collection("messages").doc(chatId).update({
      data: {
        unread_count: 0
      }
    }).then(() => {
      // 跳转 detail
      wx.navigateTo({
        url: `/pages/detail/detail?type=rides&id=${rideId}`
      });
    });
  }
});
