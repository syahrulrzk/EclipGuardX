import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDatabase() {
  try {
    console.log('Checking database contents...')
    
    const containers = await prisma.container.findMany()
    console.log('Containers:', containers.length)
    console.log('Container details:', containers.map(c => ({ id: c.id, name: c.name, containerId: c.containerId, status: c.status })))
    
    const alerts = await prisma.alert.findMany()
    console.log('Alerts:', alerts.length)
    
    const metrics = await prisma.containerMetric.findMany()
    console.log('Metrics:', metrics.length)
    
    const scans = await prisma.scan.findMany()
    console.log('Scans:', scans.length)
    
  } catch (error) {
    console.error('Error checking database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()