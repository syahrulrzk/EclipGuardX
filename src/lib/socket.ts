import { Server } from 'socket.io'

interface ContainerMetric {
  containerId: string
  cpuUsage: number
  memUsage: number
  memLimit?: number
  netIn: number
  netOut: number
  diskRead?: number
  diskWrite?: number
  timestamp: string
}

interface AlertData {
  id: string
  severity: string
  message: string
  source: string
  containerId?: string
  timestamp: string
}

interface ScanResult {
  id: string
  containerId: string
  scanType: string
  status: string
  result?: string
  summary?: string
  duration?: number
  timestamp: string
}

interface ContainerStatus {
  containerId: string
  status: string
  name: string
  image: string
  timestamp: string
}

export const setupSocket = (io: Server) => {
  // Create metrics namespace
  const metricsNamespace = io.of('/metrics')
  
  metricsNamespace.on('connection', (socket) => {
    console.log('Client connected to metrics namespace:', socket.id)
    
    // Join container-specific rooms for real-time updates
    socket.on('subscribe_container', (containerId: string) => {
      socket.join(`container_${containerId}`)
      console.log(`Client ${socket.id} subscribed to container ${containerId}`)
    })

    // Unsubscribe from container updates
    socket.on('unsubscribe_container', (containerId: string) => {
      socket.leave(`container_${containerId}`)
      console.log(`Client ${socket.id} unsubscribed from container ${containerId}`)
    })

    // Subscribe to all alerts
    socket.on('subscribe_alerts', () => {
      socket.join('alerts')
      console.log(`Client ${socket.id} subscribed to alerts`)
    })

    // Subscribe to all scan results
    socket.on('subscribe_scans', () => {
      socket.join('scans')
      console.log(`Client ${socket.id} subscribed to scans`)
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected from metrics namespace:', socket.id)
    })

    // Send initial connection confirmation
    socket.emit('connected', {
      message: 'Connected to EclipGuardX metrics namespace',
      timestamp: new Date().toISOString()
    })
  })

  // Main namespace for general events
  io.on('connection', (socket) => {
    console.log('Client connected to main namespace:', socket.id)

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected from main namespace:', socket.id)
    })

    // Send welcome message
    socket.emit('connected', {
      message: 'Welcome to EclipGuardX WebSocket Server!',
      timestamp: new Date().toISOString()
    })
  })

  // Utility functions to broadcast events
  return {
    // Broadcast metric update to specific container room
    broadcastMetricUpdate: (containerId: string, metric: ContainerMetric) => {
      metricsNamespace.to(`container_${containerId}`).emit('metric_update', metric)
    },

    // Broadcast metric update to all subscribers
    broadcastGlobalMetricUpdate: (metric: ContainerMetric) => {
      metricsNamespace.emit('global_metric_update', metric)
    },

    // Broadcast new alert to all alert subscribers
    broadcastAlert: (alert: AlertData) => {
      metricsNamespace.to('alerts').emit('alert_push', alert)
      io.emit('alert_broadcast', alert) // Also broadcast to main namespace
    },

    // Broadcast scan result to all scan subscribers
    broadcastScanResult: (scan: ScanResult) => {
      metricsNamespace.to('scans').emit('scan_result', scan)
      io.emit('scan_broadcast', scan) // Also broadcast to main namespace
    },

    // Broadcast container status change
    broadcastContainerStatusChange: (status: ContainerStatus) => {
      metricsNamespace.emit('container_status_change', status)
      io.emit('container_status_change', status) // Also broadcast to main namespace
    },

    // Broadcast system notification
    broadcastSystemNotification: (notification: {
      type: 'info' | 'warning' | 'error' | 'success'
      message: string
      timestamp: string
    }) => {
      io.emit('system_notification', notification)
    }
  }
}

// Type definitions for TypeScript
export type { ContainerMetric, AlertData, ScanResult, ContainerStatus }
