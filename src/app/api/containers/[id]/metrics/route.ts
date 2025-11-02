import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = parseInt(searchParams.get('limit') || '100')

    // First, find the container by its Docker ID to get the database ID
    const container = await db.container.findUnique({
      where: { containerId: id }
    })

    if (!container) {
      return NextResponse.json({ error: 'Container not found' }, { status: 404 })
    }

    const whereClause: any = {
      containerId: container.id // Use the database container ID
    }

    if (from || to) {
      whereClause.timestamp = {}
      if (from) whereClause.timestamp.gte = new Date(from)
      if (to) whereClause.timestamp.lte = new Date(to)
    }

    const metrics = await db.containerMetric.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: limit
    })

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching container metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch container metrics' },
      { status: 500 }
    )
}
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // First, find the container by its Docker ID to get the database ID
    const container = await db.container.findUnique({
      where: { containerId: id }
    })

    if (!container) {
      return NextResponse.json({ error: 'Container not found' }, { status: 404 })
    }

    const { cpuUsage, memUsage, memLimit, netIn, netOut, diskRead, diskWrite } = await request.json()

    const metric = await db.containerMetric.create({
      data: {
        containerId: container.id, // Use the database container ID
        cpuUsage,
        memUsage,
        memLimit,
        netIn,
        netOut,
        diskRead,
        diskWrite
      }
    })

    return NextResponse.json(metric, { status: 201 })
  } catch (error) {
    console.error('Error creating container metric:', error)
    return NextResponse.json(
      { error: 'Failed to create container metric' },
      { status: 500 }
    )
  }
}
