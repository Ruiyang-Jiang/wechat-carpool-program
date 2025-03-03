// pages/index/index.js
Page({
  data: {
    searchDeparture: '',
    searchDestination: '',
    searchDate: '',

    search2Departure: '',
    search2Destination: '',
    search2Date: '',
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

  // 存储搜索条件，跳转到找乘客页面
  searchRides() {
    const { searchDeparture, searchDestination, searchDate } = this.data;

    if (!searchDeparture || !searchDestination || !searchDate) {
        wx.showToast({ title: '请输入完整信息', icon: 'none' });
        return;
    }

    wx.setStorageSync('carSearch', {
        departure_place: searchDeparture,
        arrival_place: searchDestination,
        departure_date: searchDate
    });

    wx.switchTab({ url: '/pages/list/list' });
  },

  // 存储搜索条件，跳转到找司机页面
  searchPeople() {
    const { search2Departure, search2Destination, search2Date } = this.data;

    if (!search2Departure || !search2Destination || !search2Date) {
        wx.showToast({ title: '请输入完整信息', icon: 'none' });
        return;
    }

    wx.setStorageSync('peopleSearch', {
        departure_place: search2Departure,
        arrival_place: search2Destination,
        departure_date: search2Date
    });

    wx.switchTab({
      url: '/pages/list/list',
    });
  }
});
