// pages/publish/publish.js
const { primeCities, searchCities, validateCity } = require('../../utils/us-cities-optimized.js')

const DEBUG = true                         // <<< 统一开关

function log(...args){ DEBUG && console.log('[publish]', ...args) }
function warn(...args){ DEBUG && console.warn('[publish]', ...args) }

Page({
  data:{
    /* ------- 页面 / 组件状态 ------- */
    currentSubTab: 'driver',      // 默认 Tab：'driver'=找乘客，'passenger'=找司机
    todayString:   '',            // onLoad 中写入"YYYY-MM-DD"
    currentTime:   '',            // onLoad 中写入"HH:mm"
    userOpenid:    '',            // 用户登录状态
  
    /* ------- 位置相关 ------- */
    departure_place:{ city:'', state:'', lat:null, lng:null },
    arrival_place:  { city:'', state:'', lat:null, lng:null },
  
    /* ------- 出发信息 ------- */
    departure_date: '',           // 出发日期（picker）
    departure_time: '',           // 出发时间（picker）
    car_model:      '',           // 车型
    empty_seats:    3,            // 司机模式：剩余座位
    passenger_number:1,           // 乘客模式：乘客人数
    price:          '',           // 价格/人
    contact_wechat: '',           // 微信号
  
    /* ------- 下拉联想 ------- */
    departureSuggestions: [],     // 出发城市建议列表
    arrivalSuggestions:  [],      // 目的城市建议列表

    /* ------- 途经点功能 ------- */
    stopovers: [],                // 途经点列表
    stopoverSuggestions: [],      // 途经点建议列表
    showStopoverInput: false      // 是否显示途经点输入框
  },
  /* ---------- 生命周期 ---------- */
  onLoad(){
    // 预热城市数据
    primeCities().catch(()=>{})
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm   = String(now.getMonth()+1).padStart(2,'0')
    const dd   = String(now.getDate()).padStart(2,'0')
    const hh   = String(now.getHours()).padStart(2,'0')
    const min  = String(now.getMinutes()).padStart(2,'0')

    this.setData({ todayString:`${yyyy}-${mm}-${dd}`, currentTime:`${hh}:${min}` })
    log('todayString', this.data.todayString, 'currentTime', this.data.currentTime)

    const userInfo = wx.getStorageSync('userInfo')||{}
    if(userInfo.wechat) this.setData({ contact_wechat:userInfo.wechat })
    log('cached wechat', userInfo.wechat||'none')
    
    // 检查登录状态
    this.checkLoginStatus()
  },

  onShow() {
    // 每次显示页面时检查登录状态
    this.checkLoginStatus()
  },

  // 检查登录状态
  checkLoginStatus() {
    const openid = wx.getStorageSync('openid') || ''
    this.setData({ userOpenid: openid })
  },

  /* ---------- Tab 切换 ---------- */
  onSubTabChange(e){
    const tab = e.currentTarget.dataset.tab
    log('switch tab ->', tab)
    this.setData({ currentSubTab: tab })
  },

  /* ---------- 城市输入 & 选择 ---------- */
  onDepartureInput(e){
    const v = e.detail.value
    this.setData({ 'departure_place.city': v })
    const sug = v.trim() ? searchCities(v.trim()) : []
    log('dep input', v, 'suggest', sug.length)
    this.setData({ departureSuggestions: sug })
  },
  chooseDeparture(e){
    const item = e.currentTarget.dataset.item
    log('choose departure', item)
    this.setData({ departure_place:{ ...item }, departureSuggestions:[] })
  },
  onArrivalInput(e){
    const v = e.detail.value
    this.setData({ 'arrival_place.city': v })
    const sug = v.trim() ? searchCities(v.trim()) : []
    log('arr input', v, 'suggest', sug.length)
    this.setData({ arrivalSuggestions: sug })
  },
  chooseArrival(e){
    const item = e.currentTarget.dataset.item
    log('choose arrival', item)
    this.setData({ arrival_place:{ ...item }, arrivalSuggestions:[] })
  },

  /* ---------- 通用输入 ---------- */
  onInputChange(e){
    const { field } = e.currentTarget.dataset
    this.setData({ [field]: e.detail.value })
    log('input', field, '->', e.detail.value)
  },

  /* ---------- 日期 / 时间 ---------- */
  onDepartDateChange(e){
    this.setData({ departure_date:e.detail.value })
    log('depart date', e.detail.value)
    if(e.detail.value !== this.data.todayString) this.setData({ currentTime:'00:00' })
  },
  onDepartTimeChange(e){
    this.setData({ departure_time:e.detail.value })
    log('depart time', e.detail.value)
  },

  /* ---------- 提交 ---------- */
  submitRide(){
    // 检查登录状态
    if (!this.data.userOpenid) {
      wx.showModal({
        title: '需要登录',
        content: '登录后才能发布顺风车信息',
        success: res => {
          if (res.confirm) {
            this.loginViaCloudFunction()
          }
        }
      })
      return
    }

    const d = this.data
    const mode     = d.currentSubTab === 'passenger' ? 'request' : 'ride'
    const funcName = mode === 'ride' ? 'createRide' : 'createRideRequest'

    /* ========== 基础校验（所有情况都要） ========== */
    if (!d.departure_place.city || !validateCity(d.departure_place.city)){
      return wx.showToast({ title:'请选择有效的出发城市', icon:'none' })
    }
    if (!d.arrival_place.city || !validateCity(d.arrival_place.city)){
      return wx.showToast({ title:'请选择有效的目的城市', icon:'none' })
    }
    if (!d.departure_date){
      return wx.showToast({ title:'请选择出发日期', icon:'none' })
    }
    if (!d.departure_time){
      return wx.showToast({ title:'请选择出发时间', icon:'none' })
    }
    if (!d.price){
      return wx.showToast({ title:'请输入价格', icon:'none' })
    }
    if (!d.contact_wechat.trim()){
      return wx.showToast({ title:'请输入微信号', icon:'none' })
    }

    /* ========== 分支校验 ========== */
    if (mode === 'ride'){ // 司机发布
      if (!d.empty_seats){
        return wx.showToast({ title:'请输入空余座位数', icon:'none' })
      }
      const seats = parseInt(d.empty_seats,10)
      if (isNaN(seats) || seats <= 0){
        return wx.showToast({ title:'空余座位需为正整数', icon:'none' })
      }
    }else{               // 乘客需求
      if (!d.passenger_number){
        return wx.showToast({ title:'请输入乘坐人数', icon:'none' })
      }
      const num = parseInt(d.passenger_number,10)
      if (isNaN(num) || num <= 0){
        return wx.showToast({ title:'乘坐人数需为正整数', icon:'none' })
      }
    }

    /* ========== 构造 payload & 调云函数 ========== */
    const payload = {
      departure_place: d.departure_place,
      arrival_place:   d.arrival_place,
      departure_date:  d.departure_date,
      departure_time:  d.departure_time,
      price:           Number(d.price),
      contact_wechat:  d.contact_wechat,
      car_model:       d.car_model,                   // ✅ 可空发送
      passenger_number: mode==='request'
                        ? parseInt(d.passenger_number,10)
                        : 0,
      empty_seats:     mode==='ride'
                        ? parseInt(d.empty_seats,10)
                        : 0,
      stopovers:       d.stopovers
    }

    // 防止重复提交
    if (this.data.submitting) {
      return wx.showToast({ title: '正在提交中...', icon: 'none' })
    }

    this.setData({ submitting: true })

    wx.cloud.callFunction({
      name: funcName,
      data: payload,
      success: res=>{
        if(res.result.ok){
          wx.showToast({ title:'发布成功', icon:'success' })
          this.resetForm()
        }else{
          wx.showToast({ title:res.result.msg||'后端校验失败', icon:'none' })
        }
      },
      fail: err=>{
        console.error(err)
        wx.showToast({ title:'发布失败', icon:'none' })
      },
      complete: () => {
        this.setData({ submitting: false })
      }
    })
  },

  /* ---------- 途经点管理 ---------- */
  addStopover() {
    this.setData({
      showStopoverInput: true,
      stopoverSuggestions: []
    })
  },

  cancelStopoverInput() {
    this.setData({
      showStopoverInput: false,
      stopoverSuggestions: []
    })
  },

  toggleStopoverInput() {
    this.setData({
      showStopoverInput: !this.data.showStopoverInput,
      stopoverSuggestions: []
    })
  },

  onStopoverInput(e) {
    const value = e.detail.value.trim()
    if (!value) {
      this.setData({ stopoverSuggestions: [] })
      return
    }

    // 使用相同的城市建议逻辑
    const suggestions = searchCities(value)
    this.setData({ stopoverSuggestions: suggestions })
  },

  chooseStopover(e) {
    const item = e.currentTarget.dataset.item
    const stopovers = [...this.data.stopovers]

    // 检查是否已存在
    const exists = stopovers.some(s => s.city === item.city && s.state === item.state)
    if (exists) {
      wx.showToast({ title: '该途经点已存在', icon: 'none' })
      return
    }

    // 检查是否与出发地或目的地重复
    const { departure_place, arrival_place } = this.data
    if ((departure_place.city === item.city && departure_place.state === item.state) ||
        (arrival_place.city === item.city && arrival_place.state === item.state)) {
      wx.showToast({ title: '经停点不能与出发地或目的地相同', icon: 'none' })
      return
    }

    stopovers.push(item)
    this.setData({
      stopovers,
      stopoverSuggestions: [],
      showStopoverInput: false
    })
  },

  removeStopover(e) {
    const index = e.currentTarget.dataset.index
    const stopovers = [...this.data.stopovers]
    stopovers.splice(index, 1)
    this.setData({ stopovers })
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

  /* ---------- 重置 ---------- */
  resetForm(){
    this.setData({
      departure_place:{ city:'',state:'',lat:null,lng:null },
      arrival_place:  { city:'',state:'',lat:null,lng:null },
      departure_date:this.data.todayString,
      departure_time:this.data.currentTime,
      price:'', passenger_number:1, empty_seats:3,
      car_model:'', contact_wechat:'',
      stopovers: [],
      showStopoverInput: false,
      submitting: false
    })
  }

})
