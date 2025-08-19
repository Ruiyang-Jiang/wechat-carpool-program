const { searchCities, validateCity } = require('../../utils/us-cities-optimized.js');

Page({
  data: {
    activeTab: 'rides',   // 新增：默认显示车找人
    // 搜索车找人
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

    searchDate: '',

    // 搜索人找车
    search2Departure: {
      city: '',
      state: '',
      lat: null,
      lng: null
    },
    search2Destination: {
      city: '',
      state: '',
      lat: null,
      lng: null
    },
    search2Date: '',
    departure2Suggestions: [],
    destination2Suggestions: []
  },

  onLoad() {
    
  
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onSearchDateChange(e) {
    this.setData({ searchDate: e.detail.value });
  },

  onSearch2DateChange(e) {
    this.setData({ search2Date: e.detail.value });
  },

  /* ========== 顶部切换 ========== */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.activeTab) {
      this.setData({ activeTab: tab });
    }
  },

  /* ========== 日期选择弹窗 ========== */
  /* ------------ 删除无用的日期选择函数 ------------ */

  // 处理出发地输入
  onDepartureInput(e) {
    const value = e.detail.value;
    this.setData({
      'departure_place.city': value
    });
    
    if (!value.trim()) {
      this.setData({ departureSuggestions: [] });
      return;
    }

    const suggestions = searchCities(value);
    setTimeout(() => {
      this.setData({ departureSuggestions: suggestions });
    }, 0);
  },

  // 处理目的地输入
  onArrivalInput(e) {
    const value = e.detail.value;
    this.setData({
      'arrival_place.city': value
    });

    if (!value.trim()) {
      this.setData({ arrivalSuggestions: [] });
      return;
    }

    const suggestions = searchCities(value);
    setTimeout(() => {
      this.setData({ arrivalSuggestions: suggestions });
    }, 0);
  },

  // 第二个搜索框的出发地输入
  onDeparture2Input(e) {
    const value = e.detail.value;
    this.setData({
      'search2Departure.city': value
    });
    
    if (!value.trim()) {
      this.setData({ departure2Suggestions: [] });
      return;
    }

    const suggestions = searchCities(value);
    setTimeout(() => {
      this.setData({ departure2Suggestions: suggestions });
    }, 0);
  },

  // 第二个搜索框的目的地输入
  onDestination2Input(e) {
    const value = e.detail.value;
    this.setData({
      'search2Destination.city': value
    });
    
    if (!value.trim()) {
      this.setData({ destination2Suggestions: [] });
      return;
    }

    const suggestions = searchCities(value);
    setTimeout(() => {
      this.setData({ destination2Suggestions: suggestions });
    }, 0);
  },

  // 选择出发地
  chooseDeparture(e) {
    const item = e.currentTarget.dataset.item;
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

  // 选择第二个搜索框的出发地
  chooseDeparture2(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      search2Departure: {
        city: item.city,
        state: item.state,
        lat: item.lat,
        lng: item.lng
      },
      departure2Suggestions: []
    });
  },

  // 选择第二个搜索框的目的地
  chooseDestination2(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      search2Destination: {
        city: item.city,
        state: item.state,
        lat: item.lat,
        lng: item.lng
      },
      destination2Suggestions: []
    });
  },

  // 搜索车找人
  searchRides() {
    const { departure_place, arrival_place, searchDate } = this.data;

    if (!departure_place.city || !validateCity(departure_place.city)) {
      wx.showToast({ title: '请选择有效的出发城市', icon: 'none' });
      return;
    }
    if (!arrival_place.city || !validateCity(arrival_place.city)) {
      wx.showToast({ title: '请选择有效的目的城市', icon: 'none' });
      return;
    }
    if (!searchDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }

    // 使用增强搜索功能
    wx.showLoading({ title: '搜索中...', mask: true });

    wx.cloud.callFunction({
      name: 'searchRides',
      data: {
        type: 'ride',
        departure_place,
        arrival_place,
        departure_date: searchDate
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result.ok) {
          // 保存搜索结果到本地存储
          wx.setStorageSync('searchResults', res.result.data);
          wx.setStorageSync('carSearch', {
            departure_place,
            arrival_place,
            departure_date: searchDate
          });
          wx.setStorageSync('currentView', 'passenger');
          wx.switchTab({ url: '/pages/list/list' });
        } else {
          wx.showToast({ title: res.result.msg || '搜索失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('搜索失败:', err);
        // 降级到原有搜索方式
        wx.setStorageSync('carSearch', {
          departure_place,
          arrival_place,
          departure_date: searchDate
        });
        wx.setStorageSync('currentView', 'passenger');
        wx.switchTab({ url: '/pages/list/list' });
      }
    });
  },

  // 搜索人找车
  searchPeople() {
    const { search2Departure, search2Destination, search2Date } = this.data;

    if (!search2Departure.city || !validateCity(search2Departure.city)) {
      wx.showToast({ title: '请选择有效的出发城市', icon: 'none' });
      return;
    }
    if (!search2Destination.city || !validateCity(search2Destination.city)) {
      wx.showToast({ title: '请选择有效的目的城市', icon: 'none' });
      return;
    }
    if (!search2Date) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }

    // 使用增强搜索功能
    wx.showLoading({ title: '搜索中...', mask: true });

    wx.cloud.callFunction({
      name: 'searchRides',
      data: {
        type: 'request',
        departure_place: search2Departure,
        arrival_place: search2Destination,
        departure_date: search2Date
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result.ok) {
          // 保存搜索结果到本地存储
          wx.setStorageSync('searchResults', res.result.data);
          wx.setStorageSync('peopleSearch', {
            departure_place: search2Departure,
            arrival_place: search2Destination,
            departure_date: search2Date
          });
          wx.setStorageSync('currentView', 'driver');
          wx.switchTab({ url: '/pages/list/list' });
        } else {
          wx.showToast({ title: res.result.msg || '搜索失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('搜索失败:', err);
        // 降级到原有搜索方式
        wx.setStorageSync('peopleSearch', {
          departure_place: search2Departure,
          arrival_place: search2Destination,
          departure_date: search2Date
        });
        wx.setStorageSync('currentView', 'driver');
        wx.switchTab({ url: '/pages/list/list' });
      }
    });
  }
});
