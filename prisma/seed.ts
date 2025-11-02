import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create sample containers
  const containers = await Promise.all([
    prisma.container.create({
      data: {
        containerId: 'abc123def456',
        name: 'web-server',
        image: 'nginx:latest',
        status: 'running',
        ports: JSON.stringify([{ host: 80, container: 80, protocol: 'tcp' }])
      }
    }),
    prisma.container.create({
      data: {
        containerId: 'def456ghi789',
        name: 'database',
        image: 'postgres:13',
        status: 'running',
        ports: JSON.stringify([{ host: 5432, container: 5432, protocol: 'tcp' }])
      }
    }),
    prisma.container.create({
      data: {
        containerId: 'ghi789jkl012',
        name: 'redis-cache',
        image: 'redis:alpine',
        status: 'stopped',
        ports: JSON.stringify([{ host: 6379, container: 6379, protocol: 'tcp' }])
      }
    })
  ])

  console.log('✅ Created containers')

  // Create sample metrics for the last 24 hours
  const now = new Date()
  const metricsData = []

  for (const container of containers) {
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
      
      metricsData.push({
        containerId: container.id,
        cpuUsage: Math.random() * 100,
        memUsage: Math.random() * 100,
        memLimit: 2048,
        netIn: Math.random() * 1000000,
        netOut: Math.random() * 1000000,
        diskRead: Math.random() * 100000,
        diskWrite: Math.random() * 100000,
        timestamp
      })
    }
  }

  await prisma.containerMetric.createMany({
    data: metricsData
  })

  console.log('✅ Created metrics')

  // Create sample alerts
  const alerts = await Promise.all([
    prisma.alert.create({
      data: {
        severity: 'CRITICAL',
        message: 'High CPU usage detected on web-server',
        source: 'docker',
        containerId: containers[0].id,
        resolved: false
      }
    }),
    prisma.alert.create({
      data: {
        severity: 'HIGH',
        message: 'Memory usage exceeding threshold on database',
        source: 'docker',
        containerId: containers[1].id,
        resolved: false
      }
    }),
    prisma.alert.create({
      data: {
        severity: 'MEDIUM',
        message: 'Container redis-cache stopped unexpectedly',
        source: 'system',
        containerId: containers[2].id,
        resolved: true
      }
    }),
    prisma.alert.create({
      data: {
        severity: 'LOW',
        message: 'Network traffic spike detected',
        source: 'docker',
        containerId: containers[0].id,
        resolved: true
      }
    })
  ])

  console.log('✅ Created alerts')

  // Create sample scans
  const scans = await Promise.all([
    prisma.scan.create({
      data: {
        containerId: containers[0].id,
        scanType: 'trivy',
        status: 'completed',
        result: JSON.stringify({
          vulnerabilities: [
            { severity: 'HIGH', package: 'nginx', version: '1.21.0' },
            { severity: 'MEDIUM', package: 'openssl', version: '1.1.1' }
          ]
        }),
        summary: 'Found 2 vulnerabilities',
        duration: 15000
      }
    }),
    prisma.scan.create({
      data: {
        containerId: containers[1].id,
        scanType: 'trivy',
        status: 'completed',
        result: JSON.stringify({
          vulnerabilities: [
            { severity: 'CRITICAL', package: 'postgresql', version: '13.4' }
          ]
        }),
        summary: 'Found 1 critical vulnerability',
        duration: 25000
      }
    }),
    prisma.scan.create({
      data: {
        containerId: containers[2].id,
        scanType: 'yara',
        status: 'failed',
        summary: 'Scan failed due to container being stopped',
        duration: 5000
      }
    })
  ])

  console.log('✅ Created scans')
  console.log('🎉 Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })