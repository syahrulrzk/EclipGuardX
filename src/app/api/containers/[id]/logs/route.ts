import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '500')
    const logLevel = searchParams.get('logLevel') || undefined
    const since = searchParams.get('since') || undefined
    const date = searchParams.get('date') || undefined
    const source = searchParams.get('source') || undefined
    const summaryOnly = searchParams.get('summaryOnly') === 'true'

    const { id } = await params

    // Find the container in database by ID (not containerId)
    const container = await db.container.findFirst({
      where: { id: id }
    })

    if (!container) {
      return NextResponse.json(
        { error: 'Container not found in database', id: id },
        { status: 404 }
      )
    }

    // Build query filters
    const whereClause: any = {
      containerId: container.id
    }

    // Filter by log level if provided
    if (logLevel) {
      whereClause.logLevel = logLevel.toUpperCase()
    }

    // Filter by source if provided
    if (source) {
      whereClause.source = source
    }

    // Filter by time if provided
    if (date) {
      const startDate = new Date(`${date}T00:00:00.000Z`)
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
      whereClause.timestamp = {
        gte: startDate,
        lt: endDate
      }
    } else if (since) {
      whereClause.timestamp = {
        gte: new Date(since)
      }
    } else {
      // Default to last 14 days
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      whereClause.timestamp = {
        gte: fourteenDaysAgo
      }
    }

    // Get total log count
    const totalLogs = await db.containerLog.count({ where: whereClause })

    // Get log statistics
    const stats = await db.containerLog.groupBy({
      by: ['logLevel'],
      where: whereClause,
      _count: {
        id: true
      }
    })

    const logStats = stats.reduce((acc, stat) => {
      acc[stat.logLevel] = stat._count.id
      return acc
    }, {} as Record<string, number>)

    // If summaryOnly, return just the stats and total
    if (summaryOnly) {
      return NextResponse.json({
        container: {
          id: container.id,
          name: container.name,
          dockerId: container.containerId
        },
        stats: logStats,
        total: totalLogs,
        fetchedAt: new Date().toISOString()
      })
    }

    // Fetch logs from database
    const logs = await db.containerLog.findMany({
      where: whereClause,
      orderBy: {
        timestamp: 'desc'
      },
      take: limit
    })

    // Format logs for display
    const formattedLogs = logs.map(log => ({
      id: log.id,
      level: log.logLevel,
      message: log.message,
      timestamp: log.timestamp.toISOString(),
      source: log.source
    }))

    // Group logs by date
    const dateSummaries: Record<string, { count: number; sizeMB: number }> = {}
    logs.forEach(log => {
      const date = log.timestamp.toISOString().split('T')[0] // YYYY-MM-DD
      if (!dateSummaries[date]) {
        dateSummaries[date] = { count: 0, sizeMB: 0 }
      }
      dateSummaries[date].count++
      dateSummaries[date].sizeMB += log.message.length
    })
    // Convert size to MB
    Object.values(dateSummaries).forEach(summary => {
      summary.sizeMB = summary.sizeMB / (1024 * 1024)
      summary.sizeMB = Math.round(summary.sizeMB * 100) / 100 // Round to 2 decimals
    })

    return NextResponse.json({
      container: {
        id: container.id,
        name: container.name,
        dockerId: container.containerId
      },
      logs: formattedLogs,
      stats: logStats,
      total: totalLogs,
      limit,
      filters: {
        logLevel: logLevel || 'all',
        source: source || 'all',
        since: whereClause.timestamp?.gte?.toISOString() || null
      },
      dateSummaries,
      fetchedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching container logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch container logs' },
      { status: 500 }
    )
  }
}
