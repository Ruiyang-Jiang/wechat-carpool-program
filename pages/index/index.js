// pages/index/index.js
Page({
  data: {
    searchDeparture: '',
    searchDestination: '',
    searchDate: '',

    search2Departure: '',
    search2Destination: '',
    search2Date: ''
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

  // 用户搜索“车找人” => 存储搜索条件 & currentView='passenger'
  searchRides() {
    const { searchDeparture, searchDestination, searchDate } = this.data;
    if (!searchDeparture || !searchDestination || !searchDate) {
      wx.showToast({ title: '请输入完整信息', icon: 'none' });
      return;
    }
    // 存储车找人的搜索条件
    wx.setStorageSync('carSearch', {
      departure_place: searchDeparture,
      arrival_place: searchDestination,
      departure_date: searchDate
    });
    // 告诉 list.js 切换到 “找乘客” 视图
    wx.setStorageSync('currentView', 'passenger');
    // 切换到 list tab
    wx.switchTab({ url: '/pages/list/list' });
  },

  // 用户搜索“人找车” => 存储搜索条件 & currentView='driver'
  searchPeople() {
    const { search2Departure, search2Destination, search2Date } = this.data;
    if (!search2Departure || !search2Destination || !search2Date) {
      wx.showToast({ title: '请输入完整信息', icon: 'none' });
      return;
    }
    // 存储人找车的搜索条件
    wx.setStorageSync('peopleSearch', {
      departure_place: search2Departure,
      arrival_place: search2Destination,
      departure_date: search2Date
    });
    // 告诉 list.js 切换到 “找司机” 视图
    wx.setStorageSync('currentView', 'driver');
    // 切换到 list tab
    wx.switchTab({ url: '/pages/list/list' });
  }
});
