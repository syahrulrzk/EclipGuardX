import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { reportType, timeRange, format = 'json' } = await request.json()
    
    if (!reportType || !timeRange) {
      return NextResponse.json(
        { error: 'Report type and time range are required' },
        { status: 400 }
      )
    }

    // Calculate date range
    const to = new Date()
    let from = new Date()
    
    switch (timeRange) {
      case '1h':
        from.setHours(from.getHours() - 1)
        break
      case '24h':
        from.setHours(from.getHours() - 24)
        break
      case '7d':
        from.setDate(from.getDate() - 7)
        break
      case '30d':
        from.setDate(from.getDate() - 30)
        break
      default:
        return NextResponse.json(
          { error: 'Invalid time range' },
          { status: 400 }
        )
    }

    let reportData: any = {}

    switch (reportType) {
      case 'security':
        // Generate comprehensive security report
        const [alerts, scans, containers] = await Promise.all([
          db.alert.findMany({
            where: {
              timestamp: {
                gte: from,
                lte: to
              },
              include: {
                container: true
              }
            }
          }),
          db.scan.findMany({
            where: {
              timestamp: {
                gte: from,
                lte: to
              },
              include: {
                container: true
              }
            }
          }),
          db.container.findMany({
            include: {
              _count: {
                select: {
                  alerts: true,
                  scans: true
                }
              }
            }
          })
        ])

        const securityScore = Math.max(0, Math.min(100, 
          100 - (alerts.filter(a => a.severity === 'CRITICAL' && !a.resolved).length * 10) - 
          (alerts.filter(a => a.severity === 'HIGH' && !a.resolved).length * 5)
        ))

        reportData = {
          reportType: 'Security Summary',
          timeRange,
          generatedAt: new Date().toISOString(),
          period: {
            from: from.toISOString(),
            to: to.toISOString()
          },
          summary: {
            totalContainers: containers.length,
            runningContainers: containers.filter(c => c.status === 'running').length,
            totalAlerts: alerts.length,
            unresolvedAlerts: alerts.filter(a => !a.resolved).length,
            criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL').length,
            totalScans: scans.length,
            completedScans: scans.filter(s => s.status === 'completed').length,
            failedScans: scans.filter(s => s.status === 'failed').length,
            securityScore
          },
          alerts: alerts.map(alert => ({
            id: alert.id,
            severity: alert.severity,
            message: alert.message,
            source: alert.source,
            timestamp: alert.timestamp,
            resolved: alert.resolved,
            container: alert.container?.name || 'Unknown'
          })),
          scans: scans.map(scan => ({
            id: scan.id,
            scanType: scan.scanType,
            status: scan.status,
            summary: scan.summary,
            timestamp: scan.timestamp,
            duration: scan.duration,
            container: scan.container?.name || 'Unknown'
          })),
          containers: containers.map(container => ({
            id: container.id,
            name: container.name,
            image: container.image,
            status: container.status,
            alertCount: container._count.alerts,
            scanCount: container._count.scans
          }))
        }
        break

      case 'compliance':
        // Generate compliance report
        const allContainers = await db.container.findMany({
          include: {
            alerts: {
              where: {
                timestamp: {
                  gte: from,
                  lte: to
                }
              }
            },
            scans: {
              where: {
                timestamp: {
                  gte: from,
                  lte: to
                }
              }
            }
          }
        })

        const complianceIssues = []
        const compliantContainers = []

        for (const container of allContainers) {
          const hasCriticalAlerts = container.alerts.some(a => a.severity === 'CRITICAL' && !a.resolved)
          const hasRecentScan = container.scans.length > 0
          const scanPassed = container.scans.some(s => s.status === 'completed')
          
          if (hasCriticalAlerts || !hasRecentScan || !scanPassed) {
            complianceIssues.push({
              container: container.name,
              issues: [
                ...(hasCriticalAlerts ? ['Has unresolved critical alerts'] : []),
                ...(!hasRecentScan ? ['No recent security scans'] : []),
                ...(!scanPassed ? ['Recent scans failed'] : [])
              ]
            })
          } else {
            compliantContainers.push(container.name)
          }
        }

        reportData = {
          reportType: 'Compliance Report',
          timeRange,
          generatedAt: new Date().toISOString(),
          period: {
            from: from.toISOString(),
            to: to.toISOString()
          },
          summary: {
            totalContainers: allContainers.length,
            compliantContainers: compliantContainers.length,
            nonCompliantContainers: complianceIssues.length,
            complianceRate: (compliantContainers.length / allContainers.length * 100).toFixed(2)
          },
          complianceIssues,
          compliantContainers
        }
        break

      case 'performance':
        // Generate performance report
        const metrics = await db.containerMetric.findMany({
          where: {
            timestamp: {
              gte: from,
              lte: to
            }
          },
          include: {
            container: true
          },
          orderBy: {
            timestamp: 'asc'
          }
        })

        const containerPerformance = new Map()
        
        for (const metric of metrics) {
          const containerName = metric.container?.name || 'Unknown'
          if (!containerPerformance.has(containerName)) {
            containerPerformance.set(containerName, {
              name: containerName,
              cpuMetrics: [],
              memoryMetrics: [],
              networkInMetrics: [],
              networkOutMetrics: []
            })
          }
          
          const perf = containerPerformance.get(containerName)
          perf.cpuMetrics.push(metric.cpuUsage)
          perf.memoryMetrics.push(metric.memUsage)
          perf.networkInMetrics.push(metric.netIn)
          perf.networkOutMetrics.push(metric.netOut)
        }

        const performanceSummary = Array.from(containerPerformance.values()).map(perf => ({
          container: perf.name,
          avgCpu: perf.cpuMetrics.reduce((a, b) => a + b, 0) / perf.cpuMetrics.length,
          maxCpu: Math.max(...perf.cpuMetrics),
          avgMemory: perf.memoryMetrics.reduce((a, b) => a + b, 0) / perf.memoryMetrics.length,
          maxMemory: Math.max(...perf.memoryMetrics),
          totalNetworkIn: perf.networkInMetrics.reduce((a, b) => a + b, 0),
          totalNetworkOut: perf.networkOutMetrics.reduce((a, b) => a + b, 0),
          dataPoints: perf.cpuMetrics.length
        }))

        reportData = {
          reportType: 'Performance Report',
          timeRange,
          generatedAt: new Date().toISOString(),
          period: {
            from: from.toISOString(),
            to: to.toISOString()
          },
          summary: {
            totalDataPoints: metrics.length,
            totalContainers: containerPerformance.size,
            avgCpuUsage: performanceSummary.reduce((sum, p) => sum + p.avgCpu, 0) / performanceSummary.length,
            avgMemoryUsage: performanceSummary.reduce((sum, p) => sum + p.avgMemory, 0) / performanceSummary.length,
            totalNetworkIn: performanceSummary.reduce((sum, p) => sum + p.totalNetworkIn, 0),
            totalNetworkOut: performanceSummary.reduce((sum, p) => sum + p.totalNetworkOut, 0)
          },
          containerPerformance: performanceSummary
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        )
    }

    if (format === 'csv') {
      // Convert to CSV format
      const flattenData = (obj: any, prefix = ''): any[] => {
        const result: any[] = []
        
        if (Array.isArray(obj)) {
          return obj
        }
        
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result.push(...flattenData(value, `${prefix}${key}.`))
          } else if (Array.isArray(value)) {
            result.push({ [`${prefix}${key}`]: JSON.stringify(value) })
          } else {
            result.push({ [`${prefix}${key}`]: value })
          }
        }
        
        return result
      }

      const flatData = flattenData(reportData)
      const headers = Object.keys(flatData[0] || {})
      const csvContent = [
        headers.join(','),
        ...flatData.map(row => headers.map(header => `"${row[header]}"`).join(','))
      ].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="eclipguardx-${reportType}-report-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    return NextResponse.json(reportData)
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}