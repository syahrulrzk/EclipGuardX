import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { exec } from 'child_process'
import { Prisma } from '@prisma/client'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Helper function to parse Docker logs
const parseDockerLog = (line: string): {
  timestamp: Date
  message: string
  logLevel: string
  source: string
} | null => {
  if (!line.trim()) return null

  // More robust parsing for "timestamp message" format
  const firstSpaceIndex = line.indexOf(' ')
  let timestamp: Date
  let message: string

  if (firstSpaceIndex > -1) {
    const potentialTimestamp = line.substring(0, firstSpaceIndex)
    const tempDate = new Date(potentialTimestamp)
    if (!isNaN(tempDate.getTime())) {
      // Valid timestamp
      timestamp = tempDate
      message = line.substring(firstSpaceIndex + 1)
    } else {
      // Invalid timestamp, treat whole line as message
      timestamp = new Date()
      message = line
    }
  } else {
    // No space, treat whole line as message
    timestamp = new Date()
    message = line
  }

  let logLevel = 'INFO' // Default
  if (message.toLowerCase().includes('error')) logLevel = 'ERROR'
  else if (message.toLowerCase().includes('warn')) logLevel = 'WARN'
  else if (message.toLowerCase().includes('debug')) logLevel = 'DEBUG'

  return {
    timestamp,
    message,
    logLevel,
    source: 'stdout' // Default source
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Find container in database to get the Docker container ID
    const container = await db.container.findUnique({
      where: { id }
    })

    if (!container || !container.containerId) {
      return NextResponse.json(
        { error: 'Container not found or missing Docker ID' },
        { status: 404 }
      )
    }

    // Fetch logs from Docker using 'docker logs' command
    // Fetch logs for the last 14 days
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    
    const { stdout, stderr } = await execAsync(
      `docker logs --since ${fourteenDaysAgo.toISOString()} --timestamps ${container.containerId}`
    )

    if (stderr) {
      console.warn(`Docker logs stderr for ${container.containerId}:`, stderr)
    }

    const logLines = stdout.trim().split('\n').filter(line => line)
    
    if (logLines.length === 0) {
      return NextResponse.json({
        message: 'No new logs to collect',
        logsCollected: 0
      })
    }

    // Parse and save logs to the database
    const logsToCreate: Prisma.ContainerLogCreateManyInput[] = logLines
      .map(line => parseDockerLog(line))
      .filter((parsed): parsed is Exclude<ReturnType<typeof parseDockerLog>, null> => parsed !== null)
      .map(parsed => ({
        containerId: container.id,
        ...parsed
      }))

    const result = await db.containerLog.createMany({
      data: logsToCreate
    })

    return NextResponse.json({
      message: 'Logs collected successfully',
      logsCollected: result.count
    })
  } catch (error) {
    console.error('Error collecting container logs:', error)
    return NextResponse.json(
      { error: 'Failed to collect container logs' },
      { status: 500 }
    )
  }
}
