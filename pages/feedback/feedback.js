Page({
  data: {
    types: ['举报', '建议', '问题'],
    typeIndex: 0,
    title: '',
    content: '',
    contact: '',
    /* 新增：用于 UI */
    contentLen: 0,
    canSubmit: false
  },
  onLoad(options){
    if (options && options.type) {
      const idx = this.data.types.indexOf(options.type)
      if (idx >= 0) this.setData({ typeIndex: idx })
    }
  },
  onTypeChange(e){ this.setData({ typeIndex: Number(e.detail.value) }) },
  onTitle(e){
    const title = e.detail.value
    this.setData({
      title,
      canSubmit: !!title && (this.data.contentLen >= 10)
    })
  },
  onContent(e){
    const content = e.detail.value
    const len = content ? content.length : 0
    this.setData({
      content,
      contentLen: len,
      canSubmit: !!this.data.title && (len >= 10)
    })
  },
  onContact(e){ this.setData({ contact: e.detail.value }) },
  submit(){
    const { types, typeIndex, title, content, contact, contentLen } = this.data
    if (!title || contentLen < 10) {
      wx.showToast({ title: '请填写标题与≥10字内容', icon: 'none' })
      return
    }
    wx.showLoading({ title: '提交中...', mask: true })
    wx.cloud.callFunction({
      name: 'submitFeedback',
      data: { type: types[typeIndex], title, content, contact },
      success: (res) => {
        wx.hideLoading()
        if (res.result && res.result.ok) {
          wx.showToast({ title: '已收到，我们会在 24–48 小时内处理', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1200)
        } else {
          wx.showToast({ title: (res.result && res.result.msg) || '提交失败', icon: 'none' })
        }
      },
      fail: () => { wx.hideLoading(); wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' }) }
    })
  }
})
