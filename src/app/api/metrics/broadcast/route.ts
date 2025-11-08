import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const socketUtils = (global as any).socketUtils
    if (!socketUtils) {
      return NextResponse.json({ error: 'Socket.IO not initialized' }, { status: 500 })
    }

    const { containerId, metrics } = await request.json()
    if (!metrics) {
      return NextResponse.json({ error: 'Missing metrics' }, { status: 400 })
    }

    if (!containerId) {
      // System metrics
      socketUtils.broadcastSystemMetrics({ ...metrics, timestamp: new Date().toISOString() })
      return NextResponse.json({ success: true })
    }

    const container = await db.container.findUnique({ where: { containerId } })
    if (!container) {
      return NextResponse.json({ error: 'Container not found' }, { status: 404 })
    }

    socketUtils.broadcastMetricUpdate(containerId, { ...metrics, timestamp: new Date().toISOString() })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error broadcasting metrics:', error)
    return NextResponse.json({ error: 'Failed to broadcast metrics' }, { status: 500 })
  }
}
