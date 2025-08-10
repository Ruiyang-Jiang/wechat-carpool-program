// pages/detail/detail.js
const db = wx.cloud.database()
const _  = db.command

Page({
  data: {
    itemId:   '',
    detail:   null,
    publisherInfo: {},
    userOpenid: '',
    isLoading: true
  },

  /* ---------- 页面加载 ---------- */
  onLoad(options) {
    const { id } = options
    if (!id) {
      wx.showToast({ title:'参数错误', icon:'none' })
      setTimeout(()=>wx.navigateBack(), 1500)
      return
    }
    const openid = wx.getStorageSync('openid') || ''
    this.setData({ itemId: id, userOpenid: openid }, this.loadDetail)
  },

  /* ---------- 获取行程详情 ---------- */
  loadDetail() {
    db.collection('rides').doc(this.data.itemId).get()
      .then(res => {
        this.setData({ detail: res.data, isLoading:false })
        if (res.data.publisher_id) this.loadPublisher(res.data.publisher_id)
      })
      .catch(err=>{
        console.error(err)
        wx.showToast({ title:'加载失败', icon:'none' })
        this.setData({ isLoading:false })
      })
  },

  /* ---------- 发布者信息 ---------- */
  loadPublisher(openid){
    db.collection('users').doc(openid).get()
      .then(res=>{
        const info = res.data || {}
        // 优先使用行程里填写的微信号
        if (this.data.detail.contact_wechat) info.wechat = this.data.detail.contact_wechat
        this.setData({ publisherInfo: info })
      })
  },

  handleCopyWeChat(){
    const wxid = this.data.publisherInfo.wechat
    if (!wxid) {
      wx.showToast({ title:'未提供微信号', icon:'none' })
      return
    }
    wx.setClipboardData({ data: wxid })
  },

  /* ---------- 接单 / 报名 ---------- */
  takeOrder() {
    const { detail, userOpenid, itemId } = this.data
    if (!userOpenid) {
      wx.showToast({ title:'请先登录', icon:'none' })
      return
    }

    /* === 1. 乘客报名车找人 === */
    if (detail.type === 'ride') {
      if (detail.empty_seats <= 0) {
        wx.showToast({ title:'已无空位', icon:'none' })
        return
      }
      wx.showLoading({ title:'提交中...', mask:true })
      wx.cloud.callFunction({
        name:'joinRide',
        data:{ rideId: itemId },
        success: _=>{
          wx.showToast({ title:'乘坐成功', icon:'success' })
          this.loadDetail()           // 立即刷新空余座位
        },
        fail: err=>{
          console.error(err)
          wx.showToast({ title:'操作失败', icon:'none' })
        },
        complete: ()=>wx.hideLoading()
      })
      return
    }

    /* === 2. 司机接单人找车 === */
    wx.showModal({
      title:'确认接单',
      content:`将为 ${detail.passenger_number} 位乘客提供顺风车服务`,
      success: res=>{
        if (!res.confirm) return
        wx.showLoading({ title:'提交中...', mask:true })
        wx.cloud.callFunction({
          name:'acceptRequest',
          data:{ requestId: itemId },
          success:_=>{
            wx.showToast({ title:'接单成功', icon:'success' })
            // 1.5s 后跳“我的”-> 接单记录 并携带参数
            setTimeout(()=>{
              wx.switchTab({
                url:'/pages/myinfo/myinfo?tab=driver&from=accept'
              })
            }, 1500)
          },
          fail: err=>{
            console.error(err)
            wx.showToast({ title:'操作失败', icon:'none' })
          },
          complete: ()=>wx.hideLoading()
        })
      }
    })
  }
})
