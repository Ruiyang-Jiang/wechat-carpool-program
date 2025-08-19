import csv
import json

POP_THRESHOLD = 3000            # 只保留人口 > 3000 的城市
SRC_CSV = 'uscities.csv'
DST_JS = 'us-cities.js'

def _to_int(s: str, default=None):
    if s is None:
        return default
    try:
        return int(str(s).replace(',', '').strip())
    except Exception:
        try:
            # 有些数据是浮点字符串，取整
            return int(float(str(s).replace(',', '').strip()))
        except Exception:
            return default

def _to_float(s: str, default=None):
    if s is None:
        return default
    try:
        return float(str(s).strip())
    except Exception:
        return default

def convert_csv_to_json():
    cities = []

    with open(SRC_CSV, 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            # 解析人口，过滤 <= 3000 的城市
            pop = _to_int(row.get('population'))
            if pop is None or pop <= POP_THRESHOLD:
                continue

            city_name = (row.get('city') or '').strip()
            state_id = (row.get('state_id') or '').strip()

            lat = _to_float(row.get('lat'))
            lng = _to_float(row.get('lng'))
            # 经纬度缺失或非法就跳过
            if not city_name or not state_id or lat is None or lng is None:
                continue

            city = {
                "city": city_name,
                "state_id": state_id,
                "lat": float(lat),
                "lng": float(lng)
            }
            cities.append(city)

    # 写入 JavaScript 文件（为减小体积不缩进）
    with open(DST_JS, 'w', encoding='utf-8') as file:
        file.write('// 从CSV导入的城市数据（仅人口 > 3000）\n')
        file.write('export const usCities = ')
        json.dump(cities, file, separators=(',', ':'))  # 紧凑输出
        file.write(';\n\n')

        # 添加搜索和验证函数（保持你的原有接口）
        file.write(r'''
// 优化的搜索函数
export function searchCities(keyword) {
  if (!keyword) return [];
  keyword = keyword.toLowerCase().trim();

  return usCities
    .filter(city => {
      const cityName = city.city.toLowerCase();
      const stateId = city.state_id.toLowerCase();
      const fullName = `${cityName}, ${stateId}`;
      return fullName.includes(keyword) ||
             cityName.includes(keyword) ||
             stateId.includes(keyword);
    })
    .slice(0, 10)
    .map(city => ({
      en: `${city.city}, ${city.state_id}`,
      state: city.state_id,
      lat: city.lat,
      lng: city.lng
    }));
}

// 验证城市是否在列表中
export function validateCity(cityString) {
  if (!cityString) return false;
  const normalizedInput = cityString.toLowerCase().trim();
  return usCities.some(city =>
    `${city.city}, ${city.state_id}`.toLowerCase() === normalizedInput
  );
}
''')

if __name__ == '__main__':
    convert_csv_to_json()
