// pages/publish/publish.js
const db = wx.cloud.database();

Page({
  data: {
    // 当前子Tab: passenger(我要找车) / driver(我要发车)
    currentSubTab: 'passenger',

    // 乘客和司机共同的字段
    departure_place: '',
    departure_date: '',
    departure_time: '',
    arrival_place: '',
    arrival_date: '',
    arrival_time: '',
    price: '',
    car_model: '',   // 🚗 车辆型号（选填）

    // 仅乘客模式需要的字段
    passenger_number: 1, // 乘客人数

    // 仅司机模式需要的字段
    empty_seats: 3, // 空余座位

    // 用于日期和时间控件的限制
    todayString: '',      // 例如 "2025-03-01"
    currentTime: '',      // 例如 "14:30"
  },

  onLoad() {
    // 计算并设置今天的日期、当前时间，供 picker start 属性使用
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    
    this.setData({
      todayString: `${yyyy}-${mm}-${dd}`, // 限制最小可选日期为今天
      currentTime: `${hh}:${min}`,        // 限制最小可选时间为此刻
    });
  },

  // 切换子Tab
  onSubTabChange(e) {
    this.setData({
      currentSubTab: e.currentTarget.dataset.tab
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
      departure_date,
      departure_time,
      arrival_place,
      price,
      passenger_number,
      empty_seats,
      car_model
    } = this.data;

    // 获取 todayString 和 currentTime
    const todayString = this.data.todayString;
    const currentTime = this.data.currentTime;

    // 简单校验
    if (!departure_place) {
      wx.showToast({ title: '请输入出发地', icon: 'none' });
      return;
    }
    if (!arrival_place) {
      wx.showToast({ title: '请输入目的地', icon: 'none' });
      return;
    }
    if (!departure_date) {
      wx.showToast({ title: '请选择出发日期', icon: 'none' });
      return;
    }
    if (!price) {
      wx.showToast({ title: '请输入价格', icon: 'none' });
      return;
    }

    if (!departure_time) {
      wx.showToast({ title: '请选择出发时间', icon: 'none' });
      return;
    }

    // 获取当前用户 openid
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 🚨 若出发日期是今天，则出发时间必须大于等于当前时间
    if (departure_date === todayString) {
      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      const [selectedHour, selectedMinute] = departure_time.split(':').map(Number);

      if (
        selectedHour < currentHour || 
        (selectedHour === currentHour && selectedMinute < currentMinute)
      ) {
        wx.showToast({ 
          title: '出发时间不能早于当前时间', 
          icon: 'none' 
        });
        return;
      }
    }

    if (currentSubTab === 'passenger') {
      // 【乘客】=> rideRequest 集合
      db.collection('rideRequest').add({
        data: {
          departure_place,
          departure_date,
          departure_time,
          arrival_place,
          has_driver: false,
          passenger_id: openid,
          passenger_number: parseInt(passenger_number) || 1,
          price: parseFloat(price) || 0
        }
      }).then(() => {
          wx.showToast({ title: '发布成功', icon: 'success' });
          this.resetForm();
      }).catch(err => {
        console.error('rideRequest 发布失败:', err);
        wx.showToast({ title: '发布失败', icon: 'none' });
      });

    } else {
      // 【司机】=> rides 集合
      db.collection('rides').add({
        data: {
          departure_place,
          departure_date,
          departure_time,
          arrival_place,
          has_driver: true,
          driver_id: openid,
          empty_seats: parseInt(empty_seats) || 3,
          price: parseFloat(price) || 0,
          car_model: car_model || '',  // 🚗 添加汽车型号（选填）
          passengers: [],
          status: 'open'
        }
      }).then(() => {
          wx.showToast({ title: '发布成功', icon: 'success' });
          this.resetForm();
        }).catch(err => {
        console.error('rides 发布失败:', err);
        wx.showToast({ title: '发布失败', icon: 'none' });
      });
    }
  },

  // 重置表单
  resetForm() {
    this.setData({
      departure_place: '',
      departure_date: '',
      departure_time: '',
      arrival_place: '',
      price: '',
      passenger_number: 1,
      empty_seats: 3,
      car_model: ''  // 🚗 重置汽车型号
    });
  }
});
