import { prisma } from '@/server/db/client'

export interface BriefingConfigData {
  email: string
  pushHour: number
  city?: string
  newsTopics?: string
  isEnabled: boolean
}

export const BriefingRepository = {
  async findByUserId(userId: string) {
    return prisma.briefingConfig.findUnique({ where: { userId } })
  },

  async upsert(userId: string, data: BriefingConfigData) {
    return prisma.briefingConfig.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })
  },

  async findUsersForCurrentHour(hour: number) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return prisma.briefingConfig.findMany({
      where: {
        isEnabled: true,
        pushHour: hour,
        OR: [
          { lastSentAt: null },
          { lastSentAt: { lt: today } },
        ],
      },
      include: { user: { select: { id: true, apiKey: true } } },
    })
  },

  async updateLastSentAt(id: string) {
    return prisma.briefingConfig.update({
      where: { id },
      data: { lastSentAt: new Date() },
    })
  },
}
