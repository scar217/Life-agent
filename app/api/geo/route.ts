/**
 * 地区检测 API
 */

import { NextResponse } from 'next/server'
import { getClientIP, getCountryCode, isAllowedCountry } from '@/server/services/geo'

export async function GET(req: Request) {
  const ip = getClientIP(req.headers)
  const countryCode = await getCountryCode(ip)
  const allowed = isAllowedCountry(countryCode)
  return NextResponse.json({
    allowed,
    country: countryCode,
  })
}
