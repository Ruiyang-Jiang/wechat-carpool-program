// pages/detail/detail.js
const db = wx.cloud.database()
const _  = db.command

Page({
  data: {
    itemId:   '',
    detail:   null,
    publisherInfo: {},
    userOpenid: '',
    isLoading: true,
    participantsInfo: [],
    canJoinAsPassenger: false,
    canDriverAccept: true
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

  /* 返回页面时刷新登录状态与展示 */
  onShow() {
    const openid = wx.getStorageSync('openid') || ''
    this.setData({ userOpenid: openid })
    if (this.data.detail && this.data.detail.publisher_id) {
      this.loadPublisher(this.data.detail.publisher_id)
    }
  },

  /* ---------- 获取行程详情 ---------- */
  loadDetail() {
    db.collection('rides').doc(this.data.itemId).get()
      .then(res => {
        const detail = res.data
        const canJoinAsPassenger = detail.type === 'request'
          && this.data.userOpenid
          && this.data.userOpenid !== detail.publisher_id
          && !(Array.isArray(detail.participants) && detail.participants.some(p => p.openid === this.data.userOpenid))
        const canDriverAccept = detail.type === 'request'
          && this.data.userOpenid
          && this.data.userOpenid !== detail.publisher_id
        this.setData({ detail, isLoading:false, canJoinAsPassenger, canDriverAccept })
        if (res.data.publisher_id) this.loadPublisher(res.data.publisher_id)
        if (detail.type === 'request') this.loadParticipantsUsers(detail)
      })
      .catch(err=>{
        console.error(err)
        wx.showToast({ title:'加载失败', icon:'none' })
        this.setData({ isLoading:false })
      })
  },

  /* ---------- 参与者信息 ---------- */
  loadParticipantsUsers(detail){
    const ids = (detail.participants || []).map(p => p.openid)
    if (!ids.length) return
    db.collection('users').where({ _id: _.in(ids) }).get()
      .then(res => {
        const map = {}
        res.data.forEach(u => { map[u._id] = u })
        const participantsInfo = ids.map(id => ({ openid: id, nickName: map[id]?.nickName || '', wechat: map[id]?.wechat || '' }))
        this.setData({ participantsInfo })
      })
  },

  /* ---------- 发布者信息 ---------- */
  loadPublisher(openid){
    db.collection('users').doc(openid).get()
      .then(res=>{
        const info = res.data || {}
        // 优先使用行程里填写的微信号
        if (this.data.detail.contact_wechat) info.wechat = this.data.detail.contact_wechat
        // 不再隐藏微信号，让UI层处理显示逻辑
        this.setData({ publisherInfo: info, userOpenid: this.data.userOpenid })
      })
  },

  handleCopyWeChat(){
    const userOpenid = wx.getStorageSync('openid') || ''
    if (!userOpenid) {
      // 直接云函数登录，不跳页面
      wx.showLoading({ title: '登录中...', mask: true })
      wx.cloud.callFunction({ name: 'loginUser',
        success: (res)=>{
          wx.hideLoading()
          if (res?.result?.success && res.result.openid){
            wx.setStorageSync('openid', res.result.openid)
            this.setData({ userOpenid: res.result.openid })
            wx.showToast({ title:'已登录', icon:'success' })
            // 登录后继续复制
            this.handleCopyWeChat()
          } else {
            wx.showToast({ title: res?.result?.message || '登录失败', icon:'none' })
          }
        },
        fail: (err)=>{ wx.hideLoading(); console.error('loginUser fail:', err); wx.showToast({ title:'登录失败', icon:'none' }) }
      })
      return
    }
    const wxid = this.data.publisherInfo.wechat
    if (!wxid) { wx.showToast({ title:'未提供微信号', icon:'none' }); return }
    wx.setClipboardData({ data: wxid })

    // 复制后通知发布者
    try {
      const d = this.data.detail || {}
      const route = `${d.departure_place?.city || ''} → ${d.arrival_place?.city || ''}`
      const date  = `${d.departure_date || ''} ${d.departure_time || ''}`.trim()
      const title = d.type === 'ride' ? '车找人' : '人找车'
      const content = `有人对你的${title}（${date}，${route}）行程感兴趣并复制了您的联系方式`
      const touser  = d.publisher_id
      if (touser) {
        wx.cloud.callFunction({ name:'sendWeChatNotification', data:{ touser, content, rideInfo:{ id:d._id, type:d.type, date, route } } })
      }
    } catch (e) { /* 忽略通知失败 */ }
  },

  // 通过云函数进行登录
  loginViaCloudFunction() {
    wx.showLoading({ title: '登录中...', mask: true })
    
    // 调用登录云函数
    wx.cloud.callFunction({
      name: 'loginUser',
      success: (res) => {
        wx.hideLoading()
        if (res.result && res.result.success) {
          // 登录成功，存储openid
          wx.setStorageSync('openid', res.result.openid)
          // 刷新页面状态
          this.setData({ userOpenid: res.result.openid })
          // 重新加载发布者信息
          if (this.data.detail && this.data.detail.publisher_id) {
            this.loadPublisher(this.data.detail.publisher_id)
          }
          wx.showToast({ title: '登录成功', icon: 'success' })
        } else {
          wx.showToast({ 
            title: res.result?.message || '登录失败', 
            icon: 'none' 
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('登录云函数调用失败:', err)
        wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' })
      }
    })
  },

  copyParticipantWeChat(e){
    const userOpenid = wx.getStorageSync('openid') || ''
    if (!userOpenid) {
      wx.showLoading({ title: '登录中...', mask: true })
      wx.cloud.callFunction({ name:'loginUser',
        success:(res)=>{
          wx.hideLoading()
          if (res?.result?.success && res.result.openid){
            wx.setStorageSync('openid', res.result.openid)
            this.setData({ userOpenid: res.result.openid })
            wx.showToast({ title:'已登录', icon:'success' })
            // 登录后继续复制
            this.copyParticipantWeChat(e)
          } else {
            wx.showToast({ title: res?.result?.message || '登录失败', icon:'none' })
          }
        },
        fail:(err)=>{ wx.hideLoading(); console.error('loginUser fail:', err); wx.showToast({ title:'登录失败', icon:'none' }) }
      })
      return
    }

    const wxid = e.currentTarget.dataset.wxid
    if (!wxid) return
    wx.setClipboardData({ data: wxid })

    // 复制参与者微信后通知请求发布者（仅在请求页）
    try {
      const d = this.data.detail || {}
      if (d.type === 'request') {
        const route = `${d.departure_place?.city || ''} → ${d.arrival_place?.city || ''}`
        const date  = `${d.departure_date || ''} ${d.departure_time || ''}`.trim()
        const content = `有参与者微信被复制，乘客对你的请求（${date}，${route}）感兴趣`
        const touser  = d.publisher_id
        if (touser) {
          wx.cloud.callFunction({ name:'sendWeChatNotification', data:{ touser, content } })
        }
      }
    } catch (e) { /* 忽略通知失败 */ }
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
          name:'joinRequest',
          data:{ requestId: itemId },
          success: result => {
            if (result.result.ok) {
              wx.showToast({ title:'接单成功', icon:'success' })
              // 1.5s 后跳“我的”-> 接单记录 并携带参数
              setTimeout(()=>{
                wx.switchTab({
                  url:'/pages/myinfo/myinfo?tab=driver&from=accept'
                })
              }, 1500)
            } else {
              wx.showToast({ title: result.result.msg || '接单失败', icon:'none' })
            }
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
  ,

  /* ---------- 作为乘客加入人找车请求 ---------- */
  joinAsPassenger(){
    const { itemId, detail } = this.data
    if (detail.type !== 'request') return
    wx.showLoading({ title:'提交中...', mask:true })
    wx.cloud.callFunction({
      name:'joinRequestAsPassenger',
      data:{ requestId: itemId },
      success: result => {
        if (result.result && result.result.ok) {
          wx.showToast({ title:'已加入', icon:'success' })
          this.loadDetail()
        } else {
          wx.showToast({ title: (result.result && result.result.msg) || '加入失败', icon:'none' })
        }
      },
      fail: err => {
        console.error(err)
        wx.showToast({ title:'操作失败', icon:'none' })
      },
      complete: () => wx.hideLoading()
    })
  },

  /* 举报/反馈入口 */
  openFeedback(){
    wx.navigateTo({ url: '/pages/feedback/feedback?type=举报' })
  }
})
