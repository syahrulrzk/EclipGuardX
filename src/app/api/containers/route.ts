import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { db } from '@/lib/db'

const execAsync = promisify(exec)

interface ContainerInfo {
  id: string
  name: string
  image: string
  status: string
  ports: string
  createdAt: string
}

async function syncContainersToDatabase(allContainers: any[]) {
  try {
    // Get current Docker container IDs
    const currentDockerIds = allContainers.map(c => c.id)

    // Upsert containers in database
    for (const container of allContainers) {
      await db.container.upsert({
        where: { containerId: container.id },
        update: {
          name: container.name,
          image: container.image,
          status: container.status,
          ports: container.ports || null,
          updatedAt: new Date()
        },
        create: {
          containerId: container.id,
          name: container.name,
          image: container.image,
          status: container.status,
          ports: container.ports || null
        }
      })
    }

    // Remove containers from database that are no longer in Docker
    if (currentDockerIds.length > 0) {
      await db.container.deleteMany({
        where: {
          containerId: {
            notIn: currentDockerIds
          }
        }
      })
    }

    console.log(`Synced ${allContainers.length} containers to database`)
  } catch (error) {
    console.error('Error syncing containers to database:', error)
    // Don't fail the request, just log the error
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching real-time containers from host...')
    
    // Get running containers using Docker command
    const { stdout: runningContainers } = await execAsync(
      'docker ps --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}"'
    )
    
    // Get all containers (including stopped ones)
    const { stdout: allContainers } = await execAsync(
      'docker ps -a --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}"'
    )
    
    // Parse running containers
    const runningList = runningContainers.trim().split('\n').filter(line => line).map(line => {
      const [id, name, image, status, ports, createdAt] = line.split('\t')
      return {
        id,
        name,
        image,
        status: 'running',
        ports,
        createdAt,
        isRunning: true
      }
    })
    
    // Parse all containers
    const allList = allContainers.trim().split('\n').filter(line => line).map(line => {
      const [id, name, image, status, ports, createdAt] = line.split('\t')
      const isRunning = status.toLowerCase().includes('up')
      return {
        id,
        name,
        image,
        status: isRunning ? 'running' : 'stopped',
        ports,
        createdAt,
        isRunning
      }
    })
    
    console.log(`Found ${runningList.length} running containers out of ${allList.length} total containers`)

    // Sync containers to database
    await syncContainersToDatabase(allList)

    // Fetch containers from database with relationships
    const containersWithCounts = await db.container.findMany({
      include: {
        _count: {
          select: {
            alerts: true,
            scans: true
          }
        },
        metrics: {
          orderBy: {
            timestamp: 'desc'
          },
          take: 1
        }
      }
    })

    return NextResponse.json(containersWithCounts)
    
  } catch (error) {
    console.error('Error fetching containers:', error)
    
    // Fallback: return empty data if Docker is not available
    return NextResponse.json({
      running: [],
      all: [],
      total: 0,
      runningCount: 0,
      stoppedCount: 0,
      lastUpdated: new Date().toISOString(),
      error: 'Docker not available or permission denied'
    }, { status: 500 })
  }
}
