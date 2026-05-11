import { NextResponse } from 'next/server'
import { BriefingRepository } from '@/server/repositories/briefing.repository'
import { generateAndSendBriefing } from '@/server/services/briefing'

export async function POST(req: Request) {
  // CRON_SECRET authentication
  const authHeader = req.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // UTC+8 current hour
  const now = new Date()
  const utc8Hour = (now.getUTCHours() + 8) % 24

  const configs = await BriefingRepository.findUsersForCurrentHour(utc8Hour)
  console.log(`[Cron] UTC+8 hour=${utc8Hour}, found ${configs.length} users`)

  let sent = 0
  let errors = 0

  for (const config of configs) {
    console.log(`[Cron] Processing user ${config.userId}, email=${config.email}, city=${config.city}`)
    const apiKey = config.user.apiKey || process.env.SILICONFLOW_API_KEY || ''
    if (!apiKey) {
      console.error(`[Cron] No API key for user ${config.userId}`)
      errors++
      continue
    }
    const result = await generateAndSendBriefing(
      { ...config, user: config.user },
      apiKey
    )
    if (result.success) {
      console.log(`[Cron] Sent successfully to ${config.email}`)
      await BriefingRepository.updateLastSentAt(config.id)
      sent++
    } else {
      console.error(`[Cron] Failed for ${config.email}: ${result.error}`)
      errors++
    }
  }

  return NextResponse.json({ sent, errors })
}
