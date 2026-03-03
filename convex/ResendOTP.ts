import { Email } from "@convex-dev/auth/providers/Email"
import { generateRandomString } from "@oslojs/crypto/random"
import { Resend as ResendAPI } from "resend"

export const ResendOTP = Email({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    return generateRandomString(
      { read: (bytes) => crypto.getRandomValues(bytes) },
      "0123456789",
      6,
    )
  },
  async sendVerificationRequest({ identifier: email, provider, token, expires }) {
    const resend = new ResendAPI(provider.apiKey as string)
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL ?? "Quincy <noreply@quincy.app>",
      to: [email],
      subject: `${token} — your Quincy sign-in code`,
      text: `Your sign-in code is: ${token}\n\nThis code expires at ${expires.toLocaleTimeString()}.\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #1a1a2e;">
          <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 8px;">Sign in to Quincy</h1>
          <p style="color: #555; margin: 0 0 32px;">Enter this code in the app to continue:</p>
          <div style="background: #f4f4f8; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
            <span style="font-size: 40px; font-weight: 700; letter-spacing: 8px; font-variant-numeric: tabular-nums;">${token}</span>
          </div>
          <p style="color: #888; font-size: 13px; margin: 0;">Expires at ${expires.toLocaleTimeString()}. If you didn't request this, ignore this email.</p>
        </div>
      `,
    })
    if (error) throw new Error(JSON.stringify(error))
  },
})
