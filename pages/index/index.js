const { searchCities, validateCity } = require('../../utils/us-cities-optimized.js');

Page({
  data: {
    activeTab: 'rides',

    // —— 车找人：标准化后的最终值 —— //
    departure_place: { city: '', state: '', lat: null, lng: null },
    arrival_place:   { city: '', state: '', lat: null, lng: null },
    // —— 车找人：输入框里显示/编辑的内容（仅用于展示和检索） —— //
    departureQuery: '',
    arrivalQuery:   '',

    departureSuggestions: [],
    arrivalSuggestions: [],
    searchDate: '',

    // —— 人找车：标准化后的最终值 —— //
    search2Departure:   { city: '', state: '', lat: null, lng: null },
    search2Destination: { city: '', state: '', lat: null, lng: null },
    // —— 人找车：输入框里显示/编辑的内容 —— //
    departure2Query: '',
    destination2Query: '',

    departure2Suggestions: [],
    destination2Suggestions: [],
    search2Date: ''
  },

  onLoad() {},

  onSearchDateChange(e)  { this.setData({ searchDate:  e.detail.value }); },
  onSearch2DateChange(e) { this.setData({ search2Date: e.detail.value }); },

  /* ========== 顶部切换 ========== */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.activeTab) this.setData({ activeTab: tab });
  },

  /* ========== 车找人：出发地输入/选择/失焦 ========== */
  onDepartureInput(e) {
    const value = e.detail.value || '';
    this.setData({ departureQuery: value });

    if (!value) return this.setData({ departureSuggestions: [] });

    const suggestions = searchCities(value);
    this.setData({ departureSuggestions: suggestions });
  },
  chooseDeparture(e) {
    const item = e.currentTarget.dataset.item;
    // 写入标准地址对象 + 回填输入框为 "City, ST"
    this.setData({
      departure_place: { city: item.city, state: item.state, lat: item.lat, lng: item.lng },
      departureQuery:  `${item.city}, ${item.state}`,
      departureSuggestions: []
    });
  },
  onDepartureBlur() {
    // 若未通过选择写入标准对象，则清空，强制必须选择
    const { departure_place, departureQuery } = this.data;
    // 已选过：departure_place.city 有值，且 query 与 City, ST 一致就不动
    const pickedText = departure_place.city ? `${departure_place.city}, ${departure_place.state}` : '';
    if (!pickedText || departureQuery !== pickedText) {
      this.setData({
        departure_place: { city: '', state: '', lat: null, lng: null },
        departureQuery: ''
      });
    }
    this.setData({ departureSuggestions: [] });
  },

  /* ========== 车找人：目的地输入/选择/失焦 ========== */
  onArrivalInput(e) {
    const value = e.detail.value || '';
    this.setData({ arrivalQuery: value });

    if (!value) return this.setData({ arrivalSuggestions: [] });

    const suggestions = searchCities(value);
    this.setData({ arrivalSuggestions: suggestions });
  },
  chooseArrival(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      arrival_place: { city: item.city, state: item.state, lat: item.lat, lng: item.lng },
      arrivalQuery:  `${item.city}, ${item.state}`,
      arrivalSuggestions: []
    });
  },
  onArrivalBlur() {
    const { arrival_place, arrivalQuery } = this.data;
    const pickedText = arrival_place.city ? `${arrival_place.city}, ${arrival_place.state}` : '';
    if (!pickedText || arrivalQuery !== pickedText) {
      this.setData({
        arrival_place: { city: '', state: '', lat: null, lng: null },
        arrivalQuery: ''
      });
    }
    this.setData({ arrivalSuggestions: [] });
  },

  /* ========== 人找车：出发地输入/选择/失焦 ========== */
  onDeparture2Input(e) {
    const value = e.detail.value || '';
    this.setData({ departure2Query: value });

    if (!value) return this.setData({ departure2Suggestions: [] });

    const suggestions = searchCities(value);
    this.setData({ departure2Suggestions: suggestions });
  },
  chooseDeparture2(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      search2Departure: { city: item.city, state: item.state, lat: item.lat, lng: item.lng },
      departure2Query:  `${item.city}, ${item.state}`,
      departure2Suggestions: []
    });
  },
  onDeparture2Blur() {
    const { search2Departure, departure2Query } = this.data;
    const pickedText = search2Departure.city ? `${search2Departure.city}, ${search2Departure.state}` : '';
    if (!pickedText || departure2Query !== pickedText) {
      this.setData({
        search2Departure: { city: '', state: '', lat: null, lng: null },
        departure2Query: ''
      });
    }
    this.setData({ departure2Suggestions: [] });
  },

  /* ========== 人找车：目的地输入/选择/失焦 ========== */
  onDestination2Input(e) {
    const value = e.detail.value || '';
    this.setData({ destination2Query: value });

    if (!value) return this.setData({ destination2Suggestions: [] });

    const suggestions = searchCities(value);
    this.setData({ destination2Suggestions: suggestions });
  },
  chooseDestination2(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      search2Destination: { city: item.city, state: item.state, lat: item.lat, lng: item.lng },
      destination2Query:  `${item.city}, ${item.state}`,
      destination2Suggestions: []
    });
  },
  onDestination2Blur() {
    const { search2Destination, destination2Query } = this.data;
    const pickedText = search2Destination.city ? `${search2Destination.city}, ${search2Destination.state}` : '';
    if (!pickedText || destination2Query !== pickedText) {
      this.setData({
        search2Destination: { city: '', state: '', lat: null, lng: null },
        destination2Query: ''
      });
    }
    this.setData({ destination2Suggestions: [] });
  },

  /* ========== 搜索：使用“标准对象”，不再从输入框文本取值 ========== */
  searchRides() {
    const { departure_place, arrival_place, searchDate } = this.data;

    if (!departure_place.city || !validateCity(departure_place.city)) {
      wx.showToast({ title: '请选择有效的出发城市', icon: 'none' }); return;
    }
    if (!arrival_place.city || !validateCity(arrival_place.city)) {
      wx.showToast({ title: '请选择有效的目的城市', icon: 'none' }); return;
    }
    if (!searchDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' }); return;
    }

    wx.showLoading({ title: '搜索中...', mask: true });
    wx.cloud.callFunction({
      name: 'searchRides',
      data: { type: 'ride', departure_place, arrival_place, departure_date: searchDate },
      success: (res) => {
        wx.hideLoading();
        if (res.result.ok) {
          wx.setStorageSync('searchResults', res.result.data);
          wx.setStorageSync('carSearch', { departure_place, arrival_place, departure_date: searchDate });
          wx.setStorageSync('currentView', 'passenger');
          wx.switchTab({ url: '/pages/list/list' });
        } else {
          wx.showToast({ title: res.result.msg || '搜索失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('搜索失败:', err);
        wx.setStorageSync('carSearch', { departure_place, arrival_place, departure_date: searchDate });
        wx.setStorageSync('currentView', 'passenger');
        wx.switchTab({ url: '/pages/list/list' });
      }
    });
  },

  searchPeople() {
    const { search2Departure, search2Destination, search2Date } = this.data;

    if (!search2Departure.city || !validateCity(search2Departure.city)) {
      wx.showToast({ title: '请选择有效的出发城市', icon: 'none' }); return;
    }
    if (!search2Destination.city || !validateCity(search2Destination.city)) {
      wx.showToast({ title: '请选择有效的目的城市', icon: 'none' }); return;
    }
    if (!search2Date) {
      wx.showToast({ title: '请选择日期', icon: 'none' }); return;
    }

    wx.showLoading({ title: '搜索中...', mask: true });
    wx.cloud.callFunction({
      name: 'searchRides',
      data: {
        type: 'request',
        departure_place: search2Departure,
        arrival_place:   search2Destination,
        departure_date:  search2Date
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result.ok) {
          wx.setStorageSync('searchResults', res.result.data);
          wx.setStorageSync('peopleSearch', {
            departure_place: search2Departure,
            arrival_place:   search2Destination,
            departure_date:  search2Date
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
        wx.setStorageSync('peopleSearch', {
          departure_place: search2Departure,
          arrival_place:   search2Destination,
          departure_date:  search2Date
        });
        wx.setStorageSync('currentView', 'driver');
        wx.switchTab({ url: '/pages/list/list' });
      }
    });
  }
});
