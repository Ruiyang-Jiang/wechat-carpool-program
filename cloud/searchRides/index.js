/**
 * 云函数：searchRides
 * 增强的搜索功能，支持途经点匹配
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const {
    type,              // 'ride' 或 'request'
    departure_place,   // 出发地
    arrival_place,     // 目的地
    departure_date     // 出发日期
  } = event

  if (!type || !departure_place || !arrival_place || !departure_date) {
    return { ok: false, msg: '搜索参数不完整' }
  }

  try {
    let results = []

    if (type === 'ride') {
      // 搜索车找人（ride）
      results = await searchRideOffers(departure_place, arrival_place, departure_date)
    } else if (type === 'request') {
      // 搜索人找车（request）
      results = await searchRideRequests(departure_place, arrival_place, departure_date)
    }

    return {
      ok: true,
      data: results,
      count: results.length
    }

  } catch (error) {
    console.error('搜索失败:', error)
    return { ok: false, msg: '搜索失败' }
  }
}

/**
 * 搜索车找人（ride offers）
 * 支持途经点匹配，并在内存中确保行程顺序（出发点在目的地之前）
 */
async function searchRideOffers(departure_place, arrival_place, departure_date) {
  const baseQuery = { type: 'ride', status: 'open', departure_date }
  
  // 获取基础数据集
  const allRides = await db.collection('rides').where(baseQuery).get()

  const filtered = allRides.data
    .map(item => {
      const depCity  = item && item.departure_place ? item.departure_place.city  : ''
      const depState = item && item.departure_place ? item.departure_place.state : ''
      const arrCity  = item && item.arrival_place   ? item.arrival_place.city    : ''
      const arrState = item && item.arrival_place   ? item.arrival_place.state   : ''

      const route = [
        { city: depCity, state: depState, kind: 'depart' },
        ...(Array.isArray(item.stopovers) ? item.stopovers.map(s => ({ ...s, kind: 'stopover' })) : []),
        { city: arrCity, state: arrState, kind: 'arrival' }
      ]
      
      console.log('Checking ride:', item._id, 'route:', route.map(r => r.city))
      console.log('Looking for:', departure_place.city, '->', arrival_place.city)
      
      const depIndex = route.findIndex(p => p.city === departure_place.city)
      const arrIndex = route.findIndex(p => p.city === arrival_place.city)
      
      console.log('Found at indexes:', depIndex, arrIndex)
      
      if (depIndex !== -1 && arrIndex !== -1 && depIndex <= arrIndex) {
        let matchType = 'exact'
        if (route[depIndex].kind === 'stopover' || route[arrIndex].kind === 'stopover') {
          matchType = depIndex === 0 && arrIndex === route.length - 1 ? 'partial' : 'stopover'
        }
        console.log('Match found with type:', matchType)
        return { ...item, matchType }
      }
      return null
    })
    .filter(Boolean)

  console.log('Search results for ride offers:', filtered.length)
  return filtered
}

/**
 * 搜索人找车（ride requests）
 */
async function searchRideRequests(departure_place, arrival_place, departure_date) {
  const baseQuery = { type: 'request', status: 'open', departure_date }
  
  // 获取基础数据集
  const allRequests = await db.collection('rides').where(baseQuery).get()

  const filtered = allRequests.data
    .map(item => {
      const depCity  = item && item.departure_place ? item.departure_place.city  : ''
      const depState = item && item.departure_place ? item.departure_place.state : ''
      const arrCity  = item && item.arrival_place   ? item.arrival_place.city    : ''
      const arrState = item && item.arrival_place   ? item.arrival_place.state   : ''

      const route = [
        { city: depCity, state: depState, kind: 'depart' },
        ...(Array.isArray(item.stopovers) ? item.stopovers.map(s => ({ ...s, kind: 'stopover' })) : []),
        { city: arrCity, state: arrState, kind: 'arrival' }
      ]
      
      const depIndex = route.findIndex(p => p.city === departure_place.city)
      const arrIndex = route.findIndex(p => p.city === arrival_place.city)
      
      if (depIndex !== -1 && arrIndex !== -1 && depIndex <= arrIndex) {
        let matchType = 'exact'
        if (route[depIndex].kind === 'stopover' || route[arrIndex].kind === 'stopover') {
          matchType = depIndex === 0 && arrIndex === route.length - 1 ? 'partial' : 'stopover'
        }
        return { ...item, matchType }
      }
      return null
    })
    .filter(Boolean)

  console.log('Search results for ride requests:', filtered.length)
  return filtered
}