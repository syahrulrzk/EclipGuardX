import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const whereClause: any = {}

    if (from || to) {
      whereClause.timestamp = {}
      if (from) whereClause.timestamp.gte = new Date(from)
      if (to) whereClause.timestamp.lte = new Date(to)
    }

    const metrics = await db.systemMetric.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: limit
    })

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching system metrics:', error)
    return NextResponse.json({ error: 'Failed to fetch system metrics' }, { status: 500 })
  }
}