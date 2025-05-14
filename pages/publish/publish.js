// pages/publish/publish.js
const { searchCities, validateCity } = require('../../utils/us-cities.js');
const db = wx.cloud.database();

Page({
  data: {
    // 当前子Tab: passenger(我要找车) / driver(我要发车)
    currentSubTab: 'passenger',

    // 地址相关字段
    departure_place: {
      city: '',     // 完整城市名 (e.g., "Ithaca, NY")
      state: '',  // 州
      lat: null,  // 纬度
      lng: null   // 经度
    },
    arrival_place: {
      city: '',
      state: '',
      lat: null,
      lng: null
    },
    departureSuggestions: [],
    arrivalSuggestions: [],

    // 乘客和司机共同的字段
    departure_date: '',
    departure_time: '',
    price: '',
    car_model: '',   // 🚗 车辆型号（选填）

    // 仅乘客模式需要的字段
    passenger_number: 1, // 乘客人数

    // 仅司机模式需要的字段
    empty_seats: 3, // 空余座位

    // 用于日期和时间控件的限制
    todayString: '',      // 例如 "2025-03-01"
    currentTime: '',      // 例如 "14:30"

    regions: ['United States', 'China', 'Other'],
    regionIndex: 0,

    contact_wechat: '', // 添加微信号字段
  },

  onLoad() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    this.setData({
      todayString: `${yyyy}-${mm}-${dd}`,
      currentTime: `${hh}:${min}`,
    });

    // 尝试从用户信息中获取已保存的微信号
    const userInfo = wx.getStorageSync('userInfo') || {};
    if (userInfo.wechat) {
      this.setData({
        contact_wechat: userInfo.wechat
      });
    }
  },

  // 切换子Tab
  onSubTabChange(e) {
    this.setData({
      currentSubTab: e.currentTarget.dataset.tab
    });
  },

  // 处理出发地输入
  onDepartureInput(e) {
    const value = e.detail.value;
    console.log('Input value:', value);
    
    this.setData({
      'departure_place.city': value
    });

    if (!value.trim()) {
      this.setData({ departureSuggestions: [] });
      return;
    }

    const suggestions = searchCities(value);
    console.log('Suggestions:', suggestions);
    
    // 确保在主线程中更新数据
    setTimeout(() => {
      this.setData({ 
        departureSuggestions: suggestions 
      });
    }, 0);
  },

  // 选择出发地
  chooseDeparture(e) {
    const item = e.currentTarget.dataset.item;
    console.log('Selected item:', item);
    
    this.setData({
      departure_place: {
        city: item.city,
        state: item.state,
        lat: item.lat,
        lng: item.lng
      },
      departureSuggestions: []
    });
  },

  // 处理目的地输入
  onArrivalInput(e) {
    const value = e.detail.value;
    console.log('Input value:', value);
    this.setData({
      'arrival_place.city': value
    });

    if (!value.trim()) {
      this.setData({ arrivalSuggestions: [] });
      return;
    }

    const suggestions = searchCities(value);
    this.setData({ arrivalSuggestions: suggestions });
  },

  // 选择目的地
  chooseArrival(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      arrival_place: {
        city: item.city,
        state: item.state,
        lat: item.lat,
        lng: item.lng
      },
      arrivalSuggestions: []
    });
  },

  // 通用输入处理
  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [field]: e.detail.value
    });
  },

  // 出发日期
  onDepartDateChange(e) {
    this.setData({
      departure_date: e.detail.value
    });
  },
  // 出发时间
  onDepartTimeChange(e) {
    this.setData({
      departure_time: e.detail.value
    });
  },
  // 抵达日期
  onArriveDateChange(e) {
    this.setData({
      arrival_date: e.detail.value
    });
  },
  // 抵达时间
  onArriveTimeChange(e) {
    this.setData({
      arrival_time: e.detail.value
    });
  },

  // 提交发布
  submitRide() {
    const {
      currentSubTab,
      departure_place,
      arrival_place,
      departure_date,
      departure_time,
      price,
      passenger_number,
      empty_seats,
      car_model,
      contact_wechat  // 获取微信号
    } = this.data;

    // 验证城市格式
    console.log("departure_place", departure_place)
    console.log(departure_place.city)
    console.log(validateCity(departure_place.city))
    if (!departure_place.city || !validateCity(departure_place.city)) {
      wx.showToast({
        title: '请从列表中选择有效的出发城市',
        icon: 'none'
      });
      return;
    }

    console.log(arrival_place)
    if (!arrival_place.city || !validateCity(arrival_place.city)) {
      wx.showToast({
        title: '请从列表中选择有效的目的城市',
        icon: 'none'
      });
      return;
    }

    // 验证微信号
    if (!contact_wechat.trim()) {
      wx.showToast({
        title: '请输入微信号',
        icon: 'none'
      });
      return;
    }

    // 简单校验
    if (!departure_date) {
      wx.showToast({ title: '请选择出发日期', icon: 'none' });
      return;
    }
    if (!departure_time) {
      wx.showToast({ title: '请选择出发时间', icon: 'none' });
      return;
    }
    if (!price) {
      wx.showToast({ title: '请输入价格', icon: 'none' });
      return;
    }

    // 获取当前用户 openid
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 更新用户信息中的微信号
    const db = wx.cloud.database();
    db.collection('users').where({
      _openid: openid
    }).update({
      data: {
        wechat: contact_wechat
      }
    }).then(() => {
      // 保存到本地存储
      const userInfo = wx.getStorageSync('userInfo') || {};
      userInfo.wechat = contact_wechat;
      wx.setStorageSync('userInfo', userInfo);
    });

    // 构建发布数据
    const rideData = {
      publisher_id: openid,
      departure_place: {
        city: departure_place.city,
        state: departure_place.state,
        lat: departure_place.lat,
        lng: departure_place.lng
      },
      arrival_place: {
        city: arrival_place.city,
        state: arrival_place.state,
        lat: arrival_place.lat,
        lng: arrival_place.lng
      },
      departure_date,
      departure_time,
      price: parseFloat(price) || 0,
      contact_wechat,  // 添加微信号到发布数据
      status: 'open',
      create_time: db.serverDate()
    };

    if (currentSubTab === 'passenger') {
      Object.assign(rideData, {
        passenger_number: parseInt(passenger_number) || 1,
        has_driver: false
      });
      
      db.collection('rideRequest').add({
        data: rideData
      }).then(() => {
        wx.showToast({ title: '发布成功', icon: 'success' });
        this.resetForm();
      }).catch(err => {
        console.error('发布失败:', err);
        wx.showToast({ title: '发布失败', icon: 'none' });
      });
    } else {
      Object.assign(rideData, {
        empty_seats: parseInt(empty_seats) || 3,
        car_model: car_model || '',
        has_driver: true,
        passengers: []
      });

      db.collection('rides').add({
        data: rideData
      }).then(() => {
        wx.showToast({ title: '发布成功', icon: 'success' });
        this.resetForm();
      }).catch(err => {
        console.error('发布失败:', err);
        wx.showToast({ title: '发布失败', icon: 'none' });
      });
    }
  },

  // 重置表单
  resetForm() {
    this.setData({
      departure_place: {
        city: '',
        state: '',
        lat: null,
        lng: null
      },
      departure_date: '',
      departure_time: '',
      arrival_place: {
        city: '',
        state: '',
        lat: null,
        lng: null
      },
      price: '',
      passenger_number: 1,
      empty_seats: 3,
      car_model: '',  // 🚗 重置汽车型号
      contact_wechat: '', // 重置微信号
    });
  },

  onRegionChange(e) {
    this.setData({
      regionIndex: e.detail.value
    });
  }
});
