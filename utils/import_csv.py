import csv
import json

def convert_csv_to_json():
    cities = []
    
    with open('uscities.csv', 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            city = {
                "city": row['city'],
                "state_id": row['state_id'],
                "lat": float(row['lat']),
                "lng": float(row['lng'])
            }
            cities.append(city)
    
    # 写入 JavaScript 文件
    with open('us-cities.js', 'w', encoding='utf-8') as file:
        file.write('// 从CSV导入的城市数据\n')
        file.write('export const usCities = ')
        json.dump(cities, file, indent=2)
        file.write(';\n\n')
        
        # 添加搜索和验证函数
        file.write('''
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
    .slice(0, 10) // 限制返回结果数量
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