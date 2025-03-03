// pages/list/list.js
const db = wx.cloud.database();

Page({
  data: {
    // 当前子视图：passenger(找乘客) / driver(找司机)
    currentView: 'passenger',

    // 是否有搜索条件：如果没有，就显示“请在首页搜索”
    showPassengerSearchPrompt: true, // 找乘客Tab默认显示提示
    showDriverSearchPrompt: true,    // 找司机Tab默认显示提示

    // 找乘客（rides）数据
    passengerData: [],
    // 找乘客排序
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

    // 找司机（rideRequest）数据
    driverData: [],
    // 找司机排序
    driverSortFields: [
      { label: "日期 & 出发时间", value: "departure_date_time" },
      { label: "期望价格", value: "price" },
      { label: "出发人数", value: "passenger_number" }
    ],
    driverSortFieldIndex: 0,
    driverSortOrderIndex: 0,

    // 缓存的搜索条件
    passengerSearch: null, // carSearch
    driverSearch: null,    // peopleSearch
  },

  onLoad() {
    // 读取首页存的搜索条件
    const passengerSearch = wx.getStorageSync('carSearch') || null;    // rides
    const driverSearch = wx.getStorageSync('peopleSearch') || null;    // rideRequest

    // 如果有 passengerSearch，则说明用户搜索了“车找人”
    // 如果有 driverSearch，则说明用户搜索了“人找车”
    // 如果同时都有，就你自行决定哪一个优先，或者默认 passenger
    
    // 默认使用 passenger
    let currentView = 'passenger';
    let showPassengerSearchPrompt = true;
    let showDriverSearchPrompt = true;

    if (passengerSearch) {
      showPassengerSearchPrompt = false; // 用户有搜索 => 不显示提示
    }
    if (driverSearch) {
      showDriverSearchPrompt = false;
      // 如果你想优先显示司机结果，可加： currentView = 'driver';
    }

    this.setData({
      passengerSearch,
      driverSearch,
      currentView,
      showPassengerSearchPrompt,
      showDriverSearchPrompt
    }, () => {
      // 根据默认 currentView 加载对应数据
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

  /** 切换到找乘客Tab */
  gotoFindPassenger() {
    this.setData({ currentView: 'passenger' }, () => {
      if (!this.data.showPassengerSearchPrompt) {
        this.loadPassengerData();
      }
    });
  },

  /** 切换到找司机Tab */
  gotoFindDriver() {
    this.setData({ currentView: 'driver' }, () => {
      if (!this.data.showDriverSearchPrompt) {
        this.loadDriverData();
      }
    });
  },

  /** 加载 找乘客(rides) 数据 */
  loadPassengerData() {
    const search = this.data.passengerSearch; // departure_place / arrival_place / departure_date
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
        let sorted = this.sortPassenger(res.data);
        this.setData({ passengerData: sorted });
      })
      .catch(err => {
        console.error("查询 rides 失败", err);
        wx.showToast({ title: '加载数据失败', icon: 'none' });
      });
  },

  /** 加载 找司机(rideRequest) 数据 */
  loadDriverData() {
    const search = this.data.driverSearch; // departure_place / arrival_place / departure_date
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

  /** 清除 “车找人” 搜索 (找乘客) */
  clearPassengerSearch() {
    wx.removeStorageSync('carSearch');
    this.setData({
      passengerSearch: null,
      showPassengerSearchPrompt: true,
      passengerData: []
    });
  },

  /** 清除 “人找车” 搜索 (找司机) */
  clearDriverSearch() {
    wx.removeStorageSync('peopleSearch');
    this.setData({
      driverSearch: null,
      showDriverSearchPrompt: true,
      driverData: []
    });
  },

  /** 找乘客 - 用户切换排序字段 */
  onPassengerSortFieldChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ passengerSortFieldIndex: idx }, () => {
      if (!this.data.showPassengerSearchPrompt) {
        this.loadPassengerData();
      }
    });
  },
  /** 找乘客 - 用户切换排序方式 */
  onPassengerSortOrderChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ passengerSortOrderIndex: idx }, () => {
      if (!this.data.showPassengerSearchPrompt) {
        this.loadPassengerData();
      }
    });
  },

  /** 找司机 - 用户切换排序字段 */
  onDriverSortFieldChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ driverSortFieldIndex: idx }, () => {
      if (!this.data.showDriverSearchPrompt) {
        this.loadDriverData();
      }
    });
  },
  /** 找司机 - 用户切换排序方式 */
  onDriverSortOrderChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ driverSortOrderIndex: idx }, () => {
      if (!this.data.showDriverSearchPrompt) {
        this.loadDriverData();
      }
    });
  },

  /** 排序 找乘客(rides) 数据 */
  sortPassenger(data) {
    let {
      passengerSortFields, passengerSortFieldIndex,
      passengerSortOrderOptions, passengerSortOrderIndex
    } = this.data;
    let field = passengerSortFields[passengerSortFieldIndex].value; // "departure_date_time" / "price" / "empty_seats"
    let order = passengerSortOrderOptions[passengerSortOrderIndex].value; // "asc" / "desc"

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

  /** 排序 找司机(rideRequest) 数据 */
  sortDriver(data) {
    let {
      driverSortFields, driverSortFieldIndex,
      driverSortOrderOptions, driverSortOrderIndex
    } = this.data;
    let field = driverSortFields[driverSortFieldIndex].value; // "departure_date_time" / "price" / "passenger_number"
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
  }
});
