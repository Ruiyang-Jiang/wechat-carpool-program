// pages/myinfo/myinfo.js
const db = wx.cloud.database()
const _  = db.command

/* ---------- 工具函数 ---------- */
function sortByDateDesc(arr = []) {
  return arr.sort((a, b) => {
    const tA = new Date(`${a.departure_date} ${a.departure_time || '00:00'}`).getTime()
    const tB = new Date(`${b.departure_date} ${b.departure_time || '00:00'}`).getTime()
    return tB - tA
  })
}

/* 给每条 ride 打标记：是否已过期 + 显示找司机/找乘客 */
function decorate(ride) {
  const timestamp = new Date(`${ride.departure_date} ${ride.departure_time || '00:00'}`).getTime()
  return {
    ...ride,
    isPast: timestamp < Date.now(),
    displayType: ride.type === 'ride' ? '找乘客' : '找司机'
  }
}

Page({
  /* ---------------- data ---------------- */
  data: {
    loggedIn: false,
    userInfo: {},

    currentTab: 'passenger',      // passenger | driver | mine
    ridesAsPassenger: [],
    ridesAsDriver: [],
    myPublished: [],

    isRefreshing: false
  },

  /* ---------------- 生命周期 ---------------- */
  onLoad(opts) {
    // 如果从接单成功跳转而来
    if (opts.tab === 'driver') this.setData({ currentTab: 'driver' })
    if (opts.from === 'accept') {
      wx.showModal({
        title: '接单成功',
        content: '请检查并可根据实际情况修改乘客人数或价格',
        showCancel: false
      })
    }
  },
  onShow() { this.initPage() },

  /* ---------------- 页面初始化 ---------------- */
  async initPage() {
    let openid = wx.getStorageSync('openid')
    // 自动登录，避免未登录导致“我发布”看不到最新数据
    if (!openid) {
      try {
        const res = await wx.cloud.callFunction({ name: 'loginUser' })
        if (res?.result?.success && res.result.openid) {
          openid = res.result.openid
          wx.setStorageSync('openid', openid)
        }
      } catch (e) { /* ignore login failure,保持未登录状态 */ }
    }
    if (!openid) { this.setData({ loggedIn: false, userInfo: {} }); return }

    const userRes = await db.collection('users').doc(openid).get().catch(() => ({}))
    const user = userRes.data || {}
    this.setData({ loggedIn: true, userInfo: user })

    await Promise.all([
      this.loadPassengerRides(user),
      this.loadDriverRides(user),
      this.loadMyPublished(openid)
    ])
  },

  /* ---------------- Tab 切换 ---------------- */
  switchToPassenger() { this.setData({ currentTab: 'passenger' }) },
  switchToDriver()    { this.setData({ currentTab: 'driver'    }) },
  switchToMine()      { this.setData({ currentTab: 'mine'      }) },

  /* ---------------- 下拉刷新 ---------------- */
  async onRefresh() {
    this.setData({ isRefreshing: true })
    await this.initPage()
    this.setData({ isRefreshing: false })
    wx.showToast({ title: '刷新成功', icon: 'success' })
  },

  /* ---------------- 加载三类记录 ---------------- */
  async loadPassengerRides(user) {
    if (!user.as_passenger || user.as_passenger.length === 0) {
      this.setData({ ridesAsPassenger: [] })
      return
    }
    const res = await db.collection('rides').where({ _id: _.in(user.as_passenger) }).get()
    this.setData({ ridesAsPassenger: sortByDateDesc(res.data).map(decorate) })
  },

  async loadDriverRides(user) {
    if (!user.as_driver || user.as_driver.length === 0) {
      this.setData({ ridesAsDriver: [] })
      return
    }
    const res = await db.collection('rides').where({ _id: _.in(user.as_driver) }).get()
    this.setData({ ridesAsDriver: sortByDateDesc(res.data).map(decorate) })
  },

  async loadMyPublished(openid) {
    const res = await db.collection('rides')
      .where({
        publisher_id: openid,
        status: _.neq('closed')  // 过滤掉已关闭的记录
      })
      .orderBy('created_at', 'desc')
      .limit(50)
      .get()
    this.setData({ myPublished: sortByDateDesc(res.data).map(decorate) })
  },

  /* ------------------------------------------------------------------ */
  /* --------------------------- 编辑功能 ----------------------------- */
  /* ------------------------------------------------------------------ */

  /* ====== 输入绑定 ====== */
  onMineFieldInput(e) {
    const { id, field } = e.currentTarget.dataset
    const list = this.data.myPublished.map(item => (
      item._id === id ? { ...item, [field]: e.detail.value } : item
    ))
    this.setData({ myPublished: list })
  },
  onDriverFieldInput(e) {
    const { id, field } = e.currentTarget.dataset
    const list = this.data.ridesAsDriver.map(item => (
      item._id === id ? { ...item, [field]: e.detail.value } : item
    ))
    this.setData({ ridesAsDriver: list })
  },

  /* ====== 保存 ====== */
  saveMine(e) {
    const id = e.currentTarget.dataset.id
    const ride = this.data.myPublished.find(r => r._id === id)
    if (!ride) return
    this.updateRide(id, {
      price: Number(ride.price) || 0,
      empty_seats: parseInt(ride.empty_seats || 0, 10),
      passenger_number: parseInt(ride.passenger_number || 0, 10)
    })
  },
  saveDriver(e) {
    const id = e.currentTarget.dataset.id
    const ride = this.data.ridesAsDriver.find(r => r._id === id)
    if (!ride) return
    this.updateRide(id, {
      price: Number(ride.price) || 0,
      passenger_number: parseInt(ride.passenger_number || 0, 10)
    })
  },
  updateRide(id, patch) {
    wx.cloud.callFunction({
      name: 'updateRide',
      data: { rideId: id, patch },
      success: r => {
        if (r.result.ok) {
          wx.showToast({ title: '已保存', icon: 'success' })
          this.initPage()
        } else wx.showToast({ title: r.result.msg, icon: 'none' })
      },
      fail: err => { console.error(err); wx.showToast({ title: '保存失败', icon: 'none' }) }
    })
  },

  /* ====== 删除我发布 ====== */
  closeRide(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      success: res => {
        if (!res.confirm) return
        wx.cloud.callFunction({
          name: 'closeRide',
          data: { rideId: id },
          success: r => {
            if (r.result.ok) {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.initPage()
            } else wx.showToast({ title: r.result.msg, icon: 'none' })
          },
          fail: err => { console.error(err); wx.showToast({ title: '删除失败', icon: 'none' }) }
        })
      }
    })
  },

  /* 联系方式编辑 */
  onUserField(e) {
    const { field } = e.currentTarget.dataset
    this.setData({ [`userInfo.${field}`]: e.detail.value })
  },
  saveUserInfo() {
    wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        phone: this.data.userInfo.phone || '',
        wechat: this.data.userInfo.wechat || ''
      },
      success: () => wx.showToast({ title: '更新成功', icon: 'success' }),
      fail: err => { console.error(err); wx.showToast({ title: '更新失败', icon: 'none' }) }
    })
  },

  /* 跳详情 */
  navigateToDetail(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` })
  }
  ,

  /* 打开隐私协议 */
  openPrivacy() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({})
    } else {
      wx.showToast({ title: '当前版本不支持', icon: 'none' })
    }
  },

  /* 打开设置页 */
  goSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  // 通过云函数进行登录
  loginViaCloudFunction() {
    wx.showLoading({ title: '登录中...', mask: true })
    wx.cloud.callFunction({ name:'loginUser',
      success:(res)=>{
        wx.hideLoading()
        if (res?.result?.success && res.result.openid){
          wx.setStorageSync('openid', res.result.openid)
          this.initPage()
          wx.showToast({ title:'登录成功', icon:'success' })
        } else {
          wx.showToast({ title: res?.result?.message || '登录失败', icon:'none' })
        }
      },
      fail:(err)=>{ wx.hideLoading(); console.error('loginUser fail:', err); wx.showToast({ title:'登录失败', icon:'none' }) }
    })
  }
})
