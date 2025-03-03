Page({
  data: {
    chats: []
  },

  onLoad() {
    this.loadChats();
  },

  loadChats() {
    const db = wx.cloud.database();
    const userId = wx.getStorageSync("user_id");

    db.collection("rides").where({
      messages: db.command.neq([])
    }).get().then(res => {
      let chatList = [];
      res.data.forEach(ride => {
        ride.messages.forEach(msg => {
          if (msg.user_id !== userId) {
            chatList.push({
              ride_id: ride._id,
              user_name: msg.user_name,
              avatar: msg.avatar,
              last_message: msg.content,
              timestamp: msg.timestamp
            });
          }
        });
      });

      this.setData({ chats: chatList });
    });
  },

  goToChat(e) {
    wx.navigateTo({
      url: `/pages/chat/chat?rideId=${e.currentTarget.dataset.rideid}`
    });
  }
});
