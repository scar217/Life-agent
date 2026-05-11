import cron from 'node-cron'
import { BriefingRepository } from '@/server/repositories/briefing.repository'
import { generateAndSendBriefing } from '@/server/services/briefing'

let cronStarted = false
let isProcessing = false

export function startBriefingCron(): void {
  if (cronStarted) return

  // Only run in server context (not during build/edge)
  if (typeof window !== 'undefined') return

  // Check every minute if any user needs a briefing
  cron.schedule('* * * * *', async () => {
    if (isProcessing) return // Prevent concurrent runs
    isProcessing = true

    try {
      const now = new Date()
      const utc8Hour = (now.getUTCHours() + 8) % 24

      const configs = await BriefingRepository.findUsersForCurrentHour(utc8Hour)
      if (configs.length === 0) return

      console.log(`[BriefingCron] UTC+8 hour=${utc8Hour}, processing ${configs.length} user(s)`)

      for (const config of configs) {
        const apiKey = config.user.apiKey || process.env.SILICONFLOW_API_KEY || ''
        if (!apiKey) {
          console.error(`[BriefingCron] No API key for user ${config.userId}`)
          continue
        }

        const result = await generateAndSendBriefing(
          { ...config, user: config.user },
          apiKey
        )

        if (result.success) {
          console.log(`[BriefingCron] Sent to ${config.email}`)
          await BriefingRepository.updateLastSentAt(config.id)
        } else {
          console.error(`[BriefingCron] Failed for ${config.email}: ${result.error}`)
        }
      }
    } finally {
      isProcessing = false
    }
  })

  cronStarted = true
  console.log('[BriefingCron] Started — checking every minute')
}
