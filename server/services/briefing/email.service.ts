import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = process.env.BRIEFING_FROM_EMAIL || 'onboarding@resend.dev'

export async function sendBriefingEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    })
    if (error) {
      console.error('[BriefingEmail] Resend error:', error.message)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[BriefingEmail] Send failed:', message)
    return { success: false, error: message }
  }
}
