import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity')
    const source = searchParams.get('source')
    const limit = parseInt(searchParams.get('limit') || '50')
    const resolved = searchParams.get('resolved')

    const whereClause: any = {}

    if (severity) whereClause.severity = severity
    if (source) whereClause.source = source
    if (resolved !== null) whereClause.resolved = resolved === 'true'

    const alerts = await db.alert.findMany({
      where: whereClause,
      include: {
        container: {
          select: {
            name: true,
            containerId: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    })

    return NextResponse.json(alerts)
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { severity, message, source, containerId } = await request.json()

    const alert = await db.alert.create({
      data: {
        severity,
        message,
        source,
        containerId
      },
      include: {
        container: {
          select: {
            name: true,
            containerId: true
          }
        }
      }
    })

    return NextResponse.json(alert, { status: 201 })
  } catch (error) {
    console.error('Error creating alert:', error)
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    )
  }
}