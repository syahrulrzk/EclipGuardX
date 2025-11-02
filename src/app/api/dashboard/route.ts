import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24')

    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    // Get container counts
    const totalContainers = await db.container.count()
    const runningContainers = await db.container.count({
      where: { status: 'running' }
    })

    // Get alert counts
    const criticalAlerts = await db.alert.count({
      where: {
        severity: 'CRITICAL',
        resolved: false
      }
    })

    const totalAlerts = await db.alert.count({
      where: {
        timestamp: { gte: since }
      }
    })

    // Get recent metrics for charts
    const recentMetrics = await db.containerMetric.findMany({
      where: {
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'asc' },
      take: 1000
    })

    // Get recent system metrics for charts
    const recentSystemMetrics = await db.systemMetric.findMany({
      where: {
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'asc' },
      take: 1000
    })

    // Get recent alerts
    const recentAlerts = await db.alert.findMany({
      where: {
        timestamp: { gte: since }
      },
      include: {
        container: {
          select: {
            name: true,
            containerId: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    })

    // Get recent scans
    const recentScans = await db.scan.findMany({
      where: {
        timestamp: { gte: since }
      },
      include: {
        container: {
          select: {
            name: true,
            containerId: true,
            image: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    })

    // Calculate security score (simplified)
    const completedScans = await db.scan.count({
      where: {
        status: 'completed',
        timestamp: { gte: since }
      }
    })

    const failedScans = await db.scan.count({
      where: {
        status: 'failed',
        timestamp: { gte: since }
      }
    })

    const securityScore = Math.max(0, Math.min(100,
      100 - (criticalAlerts * 10) - (failedScans * 5)
    ))

    // Get all containers for the container list
    const allContainers = await db.container.findMany({
      include: {
        _count: {
          select: {
            alerts: {
              where: { resolved: false }
            },
            scans: {
              where: { status: 'completed' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`Found ${allContainers.length} containers`)

    return NextResponse.json({
      containers: {
        total: totalContainers,
        running: runningContainers,
        stopped: totalContainers - runningContainers,
        list: allContainers
      },
      alerts: {
        critical: criticalAlerts,
        total: totalAlerts,
        recent: recentAlerts
      },
      scans: {
        recent: recentScans,
        completed: completedScans,
        failed: failedScans
      },
      metrics: recentMetrics,
      systemMetrics: recentSystemMetrics,
      securityScore: Math.round(securityScore)
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
