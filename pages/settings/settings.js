// pages/settings/settings.js
Page({
  deleteAccount() {
    wx.showModal({
      title: '确认删除账号',
      content: '将删除您的账号信息及发布/参与记录，此操作不可恢复。确认继续？',
      success: (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中...', mask: true })
        wx.cloud.callFunction({
          name: 'deleteAccount',
          success: (r) => {
            wx.hideLoading()
            if (r.result && r.result.ok) {
              wx.showToast({ title: '已删除', icon: 'success' })
              // 清理本地登录态
              wx.removeStorageSync('openid')
              setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 1200)
            } else {
              wx.showToast({ title: (r.result && r.result.msg) || '删除失败', icon: 'none' })
            }
          },
          fail: (err) => {
            wx.hideLoading()
            console.error(err)
            wx.showToast({ title: '删除失败，请稍后重试', icon: 'none' })
          }
        })
      }
    })
  },
  goFeedback() { wx.navigateTo({ url: '/pages/feedback/feedback' }) },
  goPrivacy()  { wx.navigateTo({ url: '/pages/policy/privacy' })  },
  goTerms()    { wx.navigateTo({ url: '/pages/policy/terms' })    },
  contactSupport() {
    wx.showModal({
      title: '联系客服',
      content: '请通过邮箱 rj393@cornell.edu 联系我们，或使用页面内的举报/反馈入口。',
      showCancel: false
    })
  }
})

