import type { Tool } from './types'

const WEATHER_API_URL = 'https://restapi.amap.com/v3/weather/weatherInfo'

interface AMapLiveWeather {
  province?: string
  city?: string
  weather?: string
  temperature?: string
  humidity?: string
  winddirection?: string
  windpower?: string
  reporttime?: string
}

interface AMapWeatherResponse {
  status?: string
  info?: string
  infocode?: string
  count?: string
  lives?: AMapLiveWeather[]
}

/**
 * 天气查询工具（高德天气）
 *
 * 入参：
 * - location: 城市名 / 区县名（如：北京、上海、渝中区）
 *
 * 返回：JSON 字符串，供大模型与前端天气卡片消费
 */
export function createWeatherTool(apiKey: string): Tool {
  return {
    name: 'get_weather',
    description:
      '当用户询问天气、气温、湿度、风向风力时调用此工具，获取指定城市/地区的实时天气信息。',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: '要查询的地点名称，例如：北京、上海、重庆、渝中区',
        },
      },
      required: ['location'],
    },

    execute: async (args: Record<string, unknown>) => {
      const location = String(args.location ?? '').trim()

      if (!apiKey) {
        return JSON.stringify({
          success: false,
          error: 'WEATHER_API_KEY 未配置',
        })
      }

      if (!location) {
        return JSON.stringify({
          success: false,
          error: 'location 参数不能为空',
        })
      }

      try {
        const params = new URLSearchParams({
          city: location,
          key: apiKey,
          output: 'JSON',
          extensions: 'base',
        })

        const response = await fetch(`${WEATHER_API_URL}?${params.toString()}`)

        if (!response.ok) {
          return JSON.stringify({
            success: false,
            error: `天气服务请求失败(${response.status})`,
            location,
          })
        }

        const data = (await response.json()) as AMapWeatherResponse

        // 高德返回约定：status === '1' 表示成功
        if (data.status !== '1') {
          return JSON.stringify({
            success: false,
            error: data.info || '天气服务返回失败',
            code: data.infocode,
            location,
          })
        }

        const live = data.lives?.[0]
        if (!live) {
          return JSON.stringify({
            success: false,
            error: '未查询到该地点天气信息',
            location,
          })
        }

        const temp = Number.parseFloat(live.temperature ?? '')
        const humidity = Number.parseInt(live.humidity ?? '', 10)

        const result = {
          success: true,
          source: 'amap',
          city: `${live.province ?? ''}${live.city ?? ''}`.trim() || location,
          temp: Number.isFinite(temp) ? temp : live.temperature ?? null,
          condition: live.weather ?? '未知',
          humidity: Number.isFinite(humidity) ? humidity : undefined,
          wind:
            live.winddirection && live.windpower
              ? `${live.winddirection}风 ${live.windpower}级`
              : undefined,
          reportTime: live.reporttime ?? undefined,
          raw: {
            province: live.province,
            city: live.city,
            weather: live.weather,
            temperature: live.temperature,
            humidity: live.humidity,
            winddirection: live.winddirection,
            windpower: live.windpower,
            reporttime: live.reporttime,
          },
        }

        return JSON.stringify(result)
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : '获取天气信息失败，请稍后再试。',
          location,
        })
      }
    },
  }
}
