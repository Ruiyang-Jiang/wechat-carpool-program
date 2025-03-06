// pages/list/list.js
const db = wx.cloud.database();

Page({
  data: {
    // 当前子视图: "passenger"（找乘客）或 "driver"（找司机）
    currentView: 'passenger',

    // 若没有搜索条件，就提示“请在首页搜索”，不进行数据库查询
    showPassengerSearchPrompt: true, // 找乘客提示
    showDriverSearchPrompt: true,    // 找司机提示

    // 找乘客 (rides)
    passengerSearch: null, // { departure_place, arrival_place, departure_date }
    passengerData: [],

    // 找司机 (rideRequest)
    driverSearch: null, // { departure_place, arrival_place, departure_date }
    driverData: [],

    // 排序（找乘客）
    passengerSortFields: [
      { label: "日期 & 出发时间", value: "departure_date_time" },
      { label: "价格", value: "price" },
      { label: "空余座位", value: "empty_seats" }
    ],
    passengerSortFieldIndex: 0,
    passengerSortOrderOptions: [
      { label: "从低到高 (ASC)", value: "asc" },
      { label: "从高到低 (DESC)", value: "desc" }
    ],
    passengerSortOrderIndex: 0,

    // 排序（找司机）
    driverSortFields: [
      { label: "日期 & 出发时间", value: "departure_date_time" },
      { label: "期望价格", value: "price" },
      { label: "出发人数", value: "passenger_number" }
    ],
    driverSortFieldIndex: 0,
    driverSortOrderOptions: [
      { label: "从低到高 (ASC)", value: "asc" },
      { label: "从高到低 (DESC)", value: "desc" }
    ],
    driverSortOrderIndex: 0
  },

  // 注意: switchTab 进入页面时，会触发 onShow() 而不是 onLoad()！
  onShow() {
    // 从 Storage 获取搜索条件与当前视图
    const passengerSearch = wx.getStorageSync('carSearch') || null;
    const driverSearch = wx.getStorageSync('peopleSearch') || null;
    const storedView = wx.getStorageSync('currentView') || 'passenger';

    let showPassengerSearchPrompt = true;
    let showDriverSearchPrompt = true;

    // 如果首页搜索了“车找人”，则 passengerSearch 不为空
    if (passengerSearch) {
      showPassengerSearchPrompt = false; // 不显示“请在首页搜索”提示
    }
    // 如果首页搜索了“人找车”，则 driverSearch 不为空
    if (driverSearch) {
      showDriverSearchPrompt = false;
    }

    // 更新 data
    this.setData({
      passengerSearch,
      driverSearch,
      currentView: storedView,  // “passenger” or “driver”
      showPassengerSearchPrompt,
      showDriverSearchPrompt
    }, () => {
      // 根据 currentView 加载对应数据
      if (this.data.currentView === 'passenger') {
        if (!this.data.showPassengerSearchPrompt) {
          this.loadPassengerData();
        }
      } else {
        if (!this.data.showDriverSearchPrompt) {
          this.loadDriverData();
        }
      }
    });
  },

  // ------------------- 切换按钮 -------------------
  gotoFindPassenger() {
    this.setData({ currentView: 'passenger' }, () => {
      if (!this.data.showPassengerSearchPrompt) {
        this.loadPassengerData();
      }
    });
  },
  gotoFindDriver() {
    this.setData({ currentView: 'driver' }, () => {
      if (!this.data.showDriverSearchPrompt) {
        this.loadDriverData();
      }
    });
  },

  // ------------------- 加载找乘客 (rides) -------------------
  loadPassengerData() {
    // 若没有搜索条件，就提示“请在首页搜索”，不加载数据库
    if (this.data.showPassengerSearchPrompt) return;

    const search = this.data.passengerSearch; 
    let query = db.collection("rides");
    if (search) {
      query = query.where({
        departure_place: search.departure_place,
        arrival_place: search.arrival_place,
        departure_date: search.departure_date
      });
    }

    query.get()
      .then(res => {
        // 排序
        let sorted = this.sortPassenger(res.data);
        this.setData({ passengerData: sorted });
      })
      .catch(err => {
        console.error("查询 rides 失败", err);
        wx.showToast({ title: '加载数据失败', icon: 'none' });
      });
  },

  // ------------------- 加载找司机 (rideRequest) -------------------
  loadDriverData() {
    if (this.data.showDriverSearchPrompt) return;
    
    const search = this.data.driverSearch;
    let query = db.collection("rideRequest");
    if (search) {
      query = query.where({
        departure_place: search.departure_place,
        arrival_place: search.arrival_place,
        departure_date: search.departure_date
      });
    }

    query.get()
      .then(res => {
        let sorted = this.sortDriver(res.data);
        this.setData({ driverData: sorted });
      })
      .catch(err => {
        console.error("查询 rideRequest 失败", err);
        wx.showToast({ title: '加载数据失败', icon: 'none' });
      });
  },

  // ------------------- 清除搜索 -------------------
  clearPassengerSearch() {
    wx.removeStorageSync('carSearch');
    wx.removeStorageSync('currentView');
    this.setData({
      passengerSearch: null,
      showPassengerSearchPrompt: true,
      passengerData: []
    });
  },
  clearDriverSearch() {
    wx.removeStorageSync('peopleSearch');
    wx.removeStorageSync('currentView');
    this.setData({
      driverSearch: null,
      showDriverSearchPrompt: true,
      driverData: []
    });
  },

  // ------------------- 排序 (找乘客) -------------------
  onPassengerSortFieldChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ passengerSortFieldIndex: idx }, () => {
      if (!this.data.showPassengerSearchPrompt) {
        this.loadPassengerData();
      }
    });
  },
  onPassengerSortOrderChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ passengerSortOrderIndex: idx }, () => {
      if (!this.data.showPassengerSearchPrompt) {
        this.loadPassengerData();
      }
    });
  },
  sortPassenger(data) {
    const { 
      passengerSortFields, passengerSortFieldIndex,
      passengerSortOrderOptions, passengerSortOrderIndex
    } = this.data;

    // 排序字段: departure_date_time / price / empty_seats
    let field = passengerSortFields[passengerSortFieldIndex].value;
    // 升序/降序
    let order = passengerSortOrderOptions[passengerSortOrderIndex].value;

    return data.sort((a, b) => {
      if (field === "departure_date_time") {
        let valA = `${a.departure_date} ${a.departure_time || "00:00"}`;
        let valB = `${b.departure_date} ${b.departure_time || "00:00"}`;
        return order === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        let valA = a[field] || 0;
        let valB = b[field] || 0;
        return order === "asc" ? valA - valB : valB - valA;
      }
    });
  },

  // ------------------- 排序 (找司机) -------------------
  onDriverSortFieldChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ driverSortFieldIndex: idx }, () => {
      if (!this.data.showDriverSearchPrompt) {
        this.loadDriverData();
      }
    });
  },
  onDriverSortOrderChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ driverSortOrderIndex: idx }, () => {
      if (!this.data.showDriverSearchPrompt) {
        this.loadDriverData();
      }
    });
  },
  sortDriver(data) {
    const {
      driverSortFields, driverSortFieldIndex,
      driverSortOrderOptions, driverSortOrderIndex
    } = this.data;

    // departure_date_time / price / passenger_number
    let field = driverSortFields[driverSortFieldIndex].value;
    let order = driverSortOrderOptions[driverSortOrderIndex].value;

    return data.sort((a, b) => {
      if (field === "departure_date_time") {
        let valA = `${a.departure_date} ${a.departure_time || "00:00"}`;
        let valB = `${b.departure_date} ${b.departure_time || "00:00"}`;
        return order === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        let valA = a[field] || 0;
        let valB = b[field] || 0;
        return order === "asc" ? valA - valB : valB - valA;
      }
    });
  },
  chooseItem(e) {
    const itemId = e.currentTarget.dataset.id;
    const itemType = e.currentTarget.dataset.type; // "rides" or "request"
    // 跳转到 detail page
    wx.navigateTo({
      url: `/pages/detail/detail?type=${itemType}&id=${itemId}`
    })
  }
});
