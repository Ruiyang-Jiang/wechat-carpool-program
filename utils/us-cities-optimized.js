// 优化的城市搜索模块
const { usCities } = require('./us-cities.js')

// 预热函数：确保大列表在冷启动时被加载到内存
function primeCities() {
  try {
    // 访问一次长度，触发惰性加载（若有）
    void usCities.length
  } catch (_) {}
  return Promise.resolve(true)
}

function searchCities(keyword) {
  if (!keyword) return [];

  keyword = keyword.toLowerCase().trim();
  
  // 按匹配优先级排序：开头匹配 > 包含匹配
  const scored = usCities
    .map(city => {
      const cityName = city.city.toLowerCase();
      const stateId = city.state_id.toLowerCase();
      
      let score = 0;
      if (cityName.startsWith(keyword)) score = 100;
      else if (cityName.includes(keyword)) score = 50;
      else if (stateId.startsWith(keyword)) score = 30;
      else if (stateId.includes(keyword)) score = 10;
      
      return { ...city, score };
    })
    .filter(city => city.score > 0)
    .sort((a, b) => b.score - a.score || a.city.localeCompare(b.city))
    .slice(0, 8);

  return scored.map(city => ({
    city: city.city,
    state: city.state_id,
    lat: city.lat,
    lng: city.lng
  }));
}

function validateCity(cityName) {
  return usCities.some(item => item.city.toLowerCase() === cityName.toLowerCase());
}

module.exports = {
  primeCities,
  searchCities,
  validateCity
};
