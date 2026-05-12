import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM_ADDRESS = process.env.BRIEFING_FROM_EMAIL || process.env.SMTP_USER || ''
const FROM_NAME = process.env.BRIEFING_FROM_NAME || 'AI Life Agent'

export async function sendBriefingEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      to,
      subject,
      html,
    })
    console.log('[BriefingEmail] Sent:', info.messageId)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[BriefingEmail] Send failed:', message)
    return { success: false, error: message }
  }
}
