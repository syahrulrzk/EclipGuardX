import { db } from './src/lib/db.js'

async function seedDatabase() {
  try {
    console.log('Seeding database with sample data...')

    // Create sample containers
    const containers = await Promise.all([
      db.container.create({
        data: {
          containerId: 'container_001',
          name: 'nginx-web',
          image: 'nginx:latest',
          status: 'running',
          ports: JSON.stringify([{ host: 80, container: 80 }])
        }
      }),
      db.container.create({
        data: {
          containerId: 'container_002',
          name: 'postgres-db',
          image: 'postgres:15',
          status: 'running',
          ports: JSON.stringify([{ host: 5432, container: 5432 }])
        }
      }),
      db.container.create({
        data: {
          containerId: 'container_003',
          name: 'redis-cache',
          image: 'redis:7-alpine',
          status: 'running',
          ports: JSON.stringify([{ host: 6379, container: 6379 }])
        }
      }),
      db.container.create({
        data: {
          containerId: 'container_004',
          name: 'app-backend',
          image: 'node:18-alpine',
          status: 'stopped'
        }
      })
    ])

    console.log(`Created ${containers.length} containers`)

    // Create sample metrics (last 7 days)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    const metrics = []
    for (let i = 0; i < 168; i++) { // 168 hours = 7 days
      const timestamp = new Date(sevenDaysAgo.getTime() + i * 60 * 60 * 1000)
      
      for (const container of containers) {
        metrics.push({
          containerId: container.id,
          cpuUsage: Math.random() * 30 + 10, // 10-40%
          memUsage: Math.random() * 40 + 30, // 30-70%
          netIn: Math.random() * 1000000, // Random bytes
          netOut: Math.random() * 800000,
          diskRead: Math.random() * 50000,
          diskWrite: Math.random() * 30000,
          timestamp
        })
      }
    }

    await db.containerMetric.createMany({
      data: metrics
    })
    console.log(`Created ${metrics.length} metric records`)

    // Create sample alerts
    const alerts = [
      {
        severity: 'CRITICAL',
        message: 'High CPU usage detected on nginx-web',
        source: 'docker',
        containerId: containers[0].id,
        timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
      },
      {
        severity: 'HIGH',
        message: 'Vulnerability detected in postgres:15 image',
        source: 'trivy',
        containerId: containers[1].id,
        timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000) // 5 hours ago
      },
      {
        severity: 'MEDIUM',
        message: 'Memory usage above 80% threshold',
        source: 'system',
        containerId: containers[1].id,
        timestamp: new Date(now.getTime() - 10 * 60 * 60 * 1000), // 10 hours ago
        resolved: true
      },
      {
        severity: 'LOW',
        message: 'Container restart detected',
        source: 'docker',
        containerId: containers[0].id,
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
        resolved: true
      },
      {
        severity: 'HIGH',
        message: 'Security scan detected suspicious activity',
        source: 'yara',
        containerId: containers[2].id,
        timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      }
    ]

    for (const alert of alerts) {
      await db.alert.create({
        data: alert
      })
    }
    console.log(`Created ${alerts.length} alert records`)

    // Create sample scans
    const scans = [
      {
        containerId: containers[0].id,
        scanType: 'trivy',
        status: 'completed',
        result: JSON.stringify({
          vulnerabilities: [
            {
              id: 'CVE-2023-1234',
              severity: 'HIGH',
              package: 'nginx',
              version: '1.21.0',
              fixedVersion: '1.21.1'
            }
          ]
        }),
        summary: '1 vulnerability found',
        duration: 8500,
        timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000) // 6 hours ago
      },
      {
        containerId: containers[1].id,
        scanType: 'yara',
        status: 'completed',
        result: JSON.stringify({
          detections: []
        }),
        summary: 'No malware detected',
        duration: 12000,
        timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000) // 12 hours ago
      },
      {
        containerId: containers[2].id,
        scanType: 'trivy',
        status: 'completed',
        result: JSON.stringify({
          vulnerabilities: []
        }),
        summary: 'No vulnerabilities found',
        duration: 5400,
        timestamp: new Date(now.getTime() - 18 * 60 * 60 * 1000) // 18 hours ago
      },
      {
        containerId: containers[3].id,
        scanType: 'trivy',
        status: 'failed',
        summary: 'Scan failed to complete',
        timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000) // 1 day ago
      }
    ]

    for (const scan of scans) {
      await db.scan.create({
        data: scan
      })
    }
    console.log(`Created ${scans.length} scan records`)

    // Create some old data (35 days ago) for cleanup testing
    const oldDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)
    
    // Old metrics
    const oldMetrics = []
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(oldDate.getTime() + i * 60 * 60 * 1000)
      
      for (const container of containers.slice(0, 2)) {
        oldMetrics.push({
          containerId: container.id,
          cpuUsage: Math.random() * 50 + 20,
          memUsage: Math.random() * 60 + 40,
          netIn: Math.random() * 2000000,
          netOut: Math.random() * 1500000,
          timestamp
        })
      }
    }

    await db.containerMetric.createMany({
      data: oldMetrics
    })

    // Old resolved alerts
    await db.alert.createMany({
      data: [
        {
          severity: 'MEDIUM',
          message: 'Old resolved alert 1',
          source: 'system',
          containerId: containers[0].id,
          timestamp: oldDate,
          resolved: true
        },
        {
          severity: 'LOW',
          message: 'Old resolved alert 2',
          source: 'docker',
          containerId: containers[1].id,
          timestamp: new Date(oldDate.getTime() + 2 * 60 * 60 * 1000),
          resolved: true
        }
      ]
    })

    // Old completed scans
    await db.scan.createMany({
      data: [
        {
          containerId: containers[0].id,
          scanType: 'trivy',
          status: 'completed',
          result: JSON.stringify({ vulnerabilities: [] }),
          summary: 'Old scan - no issues',
          duration: 6500,
          timestamp: oldDate
        },
        {
          containerId: containers[1].id,
          scanType: 'yara',
          status: 'completed',
          result: JSON.stringify({ detections: [] }),
          summary: 'Old scan - clean',
          duration: 8900,
          timestamp: new Date(oldDate.getTime() + 4 * 60 * 60 * 1000)
        }
      ]
    })

    console.log('Database seeding completed successfully!')
    console.log('Sample data includes:')
    console.log(`- ${containers.length} containers`)
    console.log(`- ${metrics.length + oldMetrics.length} total metrics (${oldMetrics.length} old)`)
    console.log(`- ${alerts.length + 2} total alerts (2 old resolved)`)
    console.log(`- ${scans.length + 2} total scans (2 old completed)`)

  } catch (error) {
    console.error('Error seeding database:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('Database seeding completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Database seeding failed:', error)
      process.exit(1)
    })
}

export { seedDatabase }