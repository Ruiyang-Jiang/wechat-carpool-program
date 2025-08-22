// pages/list/list.js
const db = wx.cloud.database()
const _  = db.command

/* ---------- 公共工具 ---------- */
function decorate (ride) {
  const timestamp = new Date(`${ride.departure_date} ${ride.departure_time || '00:00'}`).getTime()
  const userOpenid = wx.getStorageSync('openid') || ''
  
  return {
    ...ride,
    isPast: timestamp < Date.now(),
    displayType: ride.type === 'ride' ? '找乘客' : '找司机',
    isOwnRequest: ride.type === 'request' && ride.publisher_id === userOpenid,
    hasJoined: ride.type === 'request' && Array.isArray(ride.participants) && 
               ride.participants.some(p => p.openid === userOpenid)
  }
}

Page({
  data: {
    /* Tab */
    currentView: 'passenger',          // passenger | driver

    /* 搜索提示开关 */
    showPassengerSearchPrompt: false,  // 改为false，默认显示数据
    showDriverSearchPrompt:    false,  // 改为false，默认显示数据

    /* 搜索条件与数据 */
    passengerSearch: null,
    driverSearch:    null,
    passengerData:   [],
    driverData:      [],

    /* 是否有精确匹配的搜索结果 */
    hasExactMatchResults: false,

    /* 排序选项 —— 找乘客 */
    passengerSortFields: [
      { label:'日期 & 出发时间', value:'departure_date_time' },
      { label:'价格',           value:'price' },
      { label:'空余座位',       value:'empty_seats' }
    ],
    passengerSortFieldIndex: 0,
    passengerSortOrderOptions: [
      { label:'从低到高 (ASC)', value:'asc'  },
      { label:'从高到低 (DESC)',value:'desc' }
    ],
    passengerSortOrderIndex: 0,

    /* 排序选项 —— 找司机 */
    driverSortFields: [
      { label:'日期 & 出发时间', value:'departure_date_time' },
      { label:'期望价格',       value:'price' },
      { label:'出发人数',       value:'passenger_number' }
    ],
    driverSortFieldIndex: 0,
    driverSortOrderOptions: [
      { label:'从低到高 (ASC)', value:'asc'  },
      { label:'从高到低 (DESC)',value:'desc' }
    ],
    driverSortOrderIndex: 0,

    passengerEmpty: false,  // 车找人空态
    driverEmpty: false,     // 人找车空态
  },

  /* ---------------- 生命周期 ---------------- */
  onShow () {
    /* 读取本地缓存：搜索条件 + 上次停留 Tab */
    const passengerSearch = wx.getStorageSync('carSearch')    || null
    const driverSearch    = wx.getStorageSync('peopleSearch') || null
    const storedView      = wx.getStorageSync('currentView')  || 'passenger'

    this.setData({
      passengerSearch,
      driverSearch,
      currentView: storedView,
      showPassengerSearchPrompt: false,  // 默认显示数据
      showDriverSearchPrompt:    false,   // 默认显示数据
      hasExactMatchResults: false  // 重置精确匹配状态
    }, () => {
      // 默认加载最近一周的数据
      if (this.data.currentView === 'passenger') {
        this.loadPassengerData()
      } else {
        this.loadDriverData()
      }
    })
  },

  /* ---------------- Tab 切换 ---------------- */
  gotoFindPassenger () {
    wx.setStorageSync('currentView', 'passenger')
    this.setData({ currentView: 'passenger' }, () => {
      this.loadPassengerData()
    })
  },
  gotoFindDriver () {
    wx.setStorageSync('currentView', 'driver')
    this.setData({ currentView: 'driver' }, () => {
      this.loadDriverData()
    })
  },

  /* ============ 加载「车找人」(ride) ============ */
  loadPassengerData () {
    // 优先使用搜索结果
    const searchResults = wx.getStorageSync('searchResults')
    if (searchResults && Array.isArray(searchResults)) {
      const sorted = this.sortPassenger(searchResults).map(item => {
        const decorated = decorate(item)
        // 添加匹配类型标识
        if (item.matchType) {
          decorated.matchType = item.matchType
          decorated.matchLabel = this.getMatchLabel(item.matchType)
        }

        return decorated
      })
      
      // 检查是否有精确匹配的结果
      const hasExactMatch = sorted.some(item => item.matchType === 'exact')
      this.setData({ 
        passengerData: sorted, 
        passengerEmpty: sorted.length === 0,
        hasExactMatchResults: hasExactMatch
      })
      
      // 清除搜索结果缓存
      wx.removeStorageSync('searchResults')
      return
    }

    // 默认加载最近一周的数据
    this.setData({ hasExactMatchResults: false })
    this.loadRecentPassengerData()
  },

  /* ============ 加载最近一周的车找人数据 ============ */
  loadRecentPassengerData() {
    const now = new Date()
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    // 格式化日期为 YYYY-MM-DD 格式
    const today = now.toISOString().split('T')[0]
    const nextWeek = oneWeekLater.toISOString().split('T')[0]

    let query = db.collection('rides').where({
      type: 'ride',
      status: 'open',
      departure_date: db.command.gte(today).and(db.command.lte(nextWeek))
    })

    query.get()
      .then(res => {
        const sorted = this.sortPassenger(res.data).map(decorate)
        this.setData({ passengerData: sorted, passengerEmpty: sorted.length === 0 })
      })
      .catch(err => {
        console.error('查询最近一周 rides (ride) 失败', err)
        wx.showToast({ title:'加载数据失败', icon:'none' })
      })
  },

  /* ============ 获取匹配类型标签 ============ */
  getMatchLabel(matchType) {
    const labels = {
      'exact': '精确匹配',
      'stopover': '途经点匹配',
      'partial': '部分匹配'
    }
    return labels[matchType] || ''
  },

  /* ============ 加载「人找车」(request) ============ */
  loadDriverData () {
    // 优先使用搜索结果
    const searchResults = wx.getStorageSync('searchResults')
    if (searchResults && Array.isArray(searchResults)) {
      const sorted = this.sortDriver(searchResults).map(item => {
        const decorated = decorate(item)
        // 添加匹配类型标识
        if (item.matchType) {
          decorated.matchType = item.matchType
          decorated.matchLabel = this.getMatchLabel(item.matchType)
        }
        return decorated
      })
      
      // 检查是否有精确匹配的结果
      const hasExactMatch = sorted.some(item => item.matchType === 'exact')
      this.setData({ 
        driverData: sorted, 
        driverEmpty: sorted.length === 0,
        hasExactMatchResults: hasExactMatch
      })
      
      // 清除搜索结果缓存
      wx.removeStorageSync('searchResults')
      return
    }

    // 默认加载最近一周的数据
    this.setData({ hasExactMatchResults: false })
    this.loadRecentDriverData()
  },

  /* ============ 加载最近一周的人找车数据 ============ */
  loadRecentDriverData() {
    const now = new Date()
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    // 格式化日期为 YYYY-MM-DD 格式
    const today = now.toISOString().split('T')[0]
    const nextWeek = oneWeekLater.toISOString().split('T')[0]

    let query = db.collection('rides').where({
      type: 'request',
      status: 'open',
      departure_date: db.command.gte(today).and(db.command.lte(nextWeek))
    })

    query.get()
      .then(res => {
        const sorted = this.sortDriver(res.data).map(decorate)
        this.setData({ driverData: sorted, driverEmpty: sorted.length === 0 })
      })
      .catch(err => {
        console.error('查询最近一周 rides (request) 失败', err)
        wx.showToast({ title:'加载数据失败', icon:'none' })
      })
  },

  /* ---------------- 清除搜索 ---------------- */
  clearPassengerSearch () {
    wx.removeStorageSync('carSearch')
    wx.removeStorageSync('currentView')
    this.setData({
      passengerSearch: null,
      passengerData:   [],
      showPassengerSearchPrompt: false,
      hasExactMatchResults: false
    })
    // 重新加载最近一周的数据
    this.loadPassengerData()
  },
  clearDriverSearch () {
    wx.removeStorageSync('peopleSearch')
    wx.removeStorageSync('currentView')
    this.setData({
      driverSearch: null,
      driverData:      [],
      showDriverSearchPrompt: false,
      hasExactMatchResults: false
    })
    // 重新加载最近一周的数据
    this.loadDriverData()
  },

  /* ---------------- 排序逻辑 ---------------- */
  onPassengerSortFieldChange (e) {
    this.setData({ passengerSortFieldIndex: Number(e.detail.value) }, () => {
      this.loadPassengerData()
    })
  },
  onPassengerSortOrderChange (e) {
    this.setData({ passengerSortOrderIndex: Number(e.detail.value) }, () => {
      this.loadPassengerData()
    })
  },
  sortPassenger (data) {
    const { passengerSortFields, passengerSortFieldIndex,
            passengerSortOrderOptions, passengerSortOrderIndex } = this.data
    const field = passengerSortFields[passengerSortFieldIndex].value
    const order = passengerSortOrderOptions[passengerSortOrderIndex].value
    return data.sort((a, b) => {
      if (field === 'departure_date_time') {
        const valA = `${a.departure_date} ${a.departure_time || '00:00'}`
        const valB = `${b.departure_date} ${b.departure_time || '00:00'}`
        return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      } else {
        const valA = a[field] || 0
        const valB = b[field] || 0
        return order === 'asc' ? valA - valB : valB - valA
      }
    })
  },

  onDriverSortFieldChange (e) {
    this.setData({ driverSortFieldIndex: Number(e.detail.value) }, () => {
      this.loadDriverData()
    })
  },
  onDriverSortOrderChange (e) {
    this.setData({ driverSortOrderIndex: Number(e.detail.value) }, () => {
      this.loadDriverData()
    })
  },
  sortDriver (data) {
    const { driverSortFields, driverSortFieldIndex,
            driverSortOrderOptions, driverSortOrderIndex } = this.data
    const field = driverSortFields[driverSortFieldIndex].value
    const order = driverSortOrderOptions[driverSortOrderIndex].value
    return data.sort((a, b) => {
      if (field === 'departure_date_time') {
        const valA = `${a.departure_date} ${a.departure_time || '00:00'}`
        const valB = `${b.departure_date} ${b.departure_time || '00:00'}`
        return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      } else {
        const valA = a[field] || 0
        const valB = b[field] || 0
        return order === 'asc' ? valA - valB : valB - valA
      }
    })
  },

  /* ---------------- 点击卡片跳详情 ---------------- */
  chooseItem (e) {
    const { id, type } = e.currentTarget.dataset     // 'ride' | 'request'
    wx.navigateTo({
      url: `/pages/detail/detail?type=${type === 'ride' ? 'rides' : 'request'}&id=${id}`
    })
  },

  /* ---------------- Join请求处理 ---------------- */
  handleStopPropagation() {
    // 阻止事件冒泡到父级卡片点击事件
  },

  joinRequest(e) {
    const requestId = e.currentTarget.dataset.id
    if (!requestId) return

    wx.showLoading({ title: '加入中...', mask: true })
    wx.cloud.callFunction({
      name: 'joinRequestAsPassenger',
      data: { requestId },
      success: (res) => {
        wx.hideLoading()
        if (res.result && res.result.ok) {
          wx.showToast({ title: '加入成功', icon: 'success' })
          // 刷新当前列表数据
          if (this.data.currentView === 'driver') {
            this.loadDriverData()
          }
        } else {
          wx.showToast({ 
            title: (res.result && res.result.msg) || '加入失败', 
            icon: 'none' 
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('Join request failed:', err)
        wx.showToast({ title: '操作失败', icon: 'none' })
      }
    })
  },

  /* ---------------- 重新搜索 ---------------- */
  retrySearch() {
    // 跳转回首页进行重新搜索
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  /* ---------------- 刷新数据 ---------------- */
  refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true })
    
    if (this.data.currentView === 'passenger') {
      this.loadPassengerData()
    } else {
      this.loadDriverData()
    }
    
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({ title: '刷新完成', icon: 'success' })
    }, 1000)
  }
})
