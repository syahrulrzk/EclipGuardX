import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { days = 30, dryRun = false } = await request.json()
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    console.log(`Running cleanup for data older than ${days} days (before ${cutoffDate.toISOString()})`)
    
    const results = {
      metricsDeleted: 0,
      alertsDeleted: 0,
      scansDeleted: 0,
      errors: [] as string[]
    }

    if (!dryRun) {
      try {
        // Delete old container metrics
        const metricsResult = await db.containerMetric.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        })
        results.metricsDeleted = metricsResult.count
        console.log(`Deleted ${metricsResult.count} old container metrics`)
      } catch (error) {
        const errorMsg = `Error deleting container metrics: ${error}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }

      try {
        // Delete old resolved alerts (keep unresolved alerts regardless of age)
        const alertsResult = await db.alert.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            },
            resolved: true
          }
        })
        results.alertsDeleted = alertsResult.count
        console.log(`Deleted ${alertsResult.count} old resolved alerts`)
      } catch (error) {
        const errorMsg = `Error deleting alerts: ${error}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }

      try {
        // Delete old completed scans
        const scansResult = await db.scan.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            },
            status: 'completed'
          }
        })
        results.scansDeleted = scansResult.count
        console.log(`Deleted ${scansResult.count} old completed scans`)
      } catch (error) {
        const errorMsg = `Error deleting scans: ${error}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    } else {
      // Dry run - just count what would be deleted
      try {
        const metricsCount = await db.containerMetric.count({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        })
        results.metricsDeleted = metricsCount
        console.log(`Would delete ${metricsCount} old container metrics`)
      } catch (error) {
        const errorMsg = `Error counting container metrics: ${error}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }

      try {
        const alertsCount = await db.alert.count({
          where: {
            timestamp: {
              lt: cutoffDate
            },
            resolved: true
          }
        })
        results.alertsDeleted = alertsCount
        console.log(`Would delete ${alertsCount} old resolved alerts`)
      } catch (error) {
        const errorMsg = `Error counting alerts: ${error}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }

      try {
        const scansCount = await db.scan.count({
          where: {
            timestamp: {
              lt: cutoffDate
            },
            status: 'completed'
          }
        })
        results.scansDeleted = scansCount
        console.log(`Would delete ${scansCount} old completed scans`)
      } catch (error) {
        const errorMsg = `Error counting scans: ${error}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    const totalDeleted = results.metricsDeleted + results.alertsDeleted + results.scansDeleted
    
    return NextResponse.json({
      success: results.errors.length === 0,
      message: dryRun 
        ? `Dry run complete. Would delete ${totalDeleted} records.`
        : `Cleanup complete. Deleted ${totalDeleted} records.`,
      cutoffDate: cutoffDate.toISOString(),
      dryRun,
      ...results
    })
  } catch (error) {
    console.error('Error in cleanup operation:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform cleanup operation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get database statistics
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const [
      totalMetrics,
      oldMetrics,
      totalAlerts,
      oldAlerts,
      totalScans,
      oldScans
    ] = await Promise.all([
      // Total metrics
      db.containerMetric.count(),
      // Metrics older than 30 days
      db.containerMetric.count({
        where: {
          timestamp: {
            lt: thirtyDaysAgo
          }
        }
      }),
      // Total alerts
      db.alert.count(),
      // Resolved alerts older than 30 days
      db.alert.count({
        where: {
          timestamp: {
            lt: thirtyDaysAgo
          },
          resolved: true
        }
      }),
      // Total scans
      db.scan.count(),
      // Completed scans older than 30 days
      db.scan.count({
        where: {
          timestamp: {
            lt: thirtyDaysAgo
          },
          status: 'completed'
        }
      })
    ])

    const stats = {
      database: {
        totalMetrics,
        oldMetrics,
        totalAlerts,
        oldAlerts,
        totalScans,
        oldScans
      },
      cleanupEstimate: {
        metricsToDelete: oldMetrics,
        alertsToDelete: oldAlerts,
        scansToDelete: oldScans,
        totalToDelete: oldMetrics + oldAlerts + oldScans
      },
      lastCleanup: thirtyDaysAgo.toISOString(),
      nextCleanup: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() // Next day
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching cleanup stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cleanup statistics' },
      { status: 500 }
    )
  }
}