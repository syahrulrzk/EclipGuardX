"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { ContainerMetric, AlertData, ScanResult, ContainerStatus } from '@/lib/socket'

interface UseSocketOptions {
  namespace?: string
  autoConnect?: boolean
}

export const useSocket = (options: UseSocketOptions = {}) => {
  const { namespace = '', autoConnect = true } = options
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin
    const socket = io(socketUrl + (namespace || ''), {
      path: '/api/socketio',
      autoConnect,
      transports: ['websocket', 'polling']
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
    })

    socket.on('connected', (data) => {
      console.log('Connection confirmed:', data)
      setLastMessage(data)
    })

    return () => {
      socket.disconnect()
    }
  }, [namespace, autoConnect])

  // Subscribe to container metrics
  const subscribeToContainer = useCallback((containerId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('subscribe_container', containerId)
    }
  }, [])

  const unsubscribeFromContainer = useCallback((containerId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe_container', containerId)
    }
  }, [])

  // Subscribe to alerts
  const subscribeAlerts = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('subscribe_alerts')
    }
  }, [])

  // Subscribe to scans
  const subscribeScanResults = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('subscribe_scans')
    }
  }, [])

  // Event listeners for real-time updates
  const onMetricUpdate = useCallback((callback: (metric: ContainerMetric) => void) => {
    if (socketRef.current) {
      socketRef.current.on('metric_update', callback)
    }
  }, [])

  const onGlobalMetricUpdate = useCallback((callback: (metric: ContainerMetric) => void) => {
    if (socketRef.current) {
      socketRef.current.on('global_metric_update', callback)
    }
  }, [])

  const onAlertPush = useCallback((callback: (alert: AlertData) => void) => {
    if (socketRef.current) {
      socketRef.current.on('alert_push', callback)
    }
  }, [])

  const onScanResult = useCallback((callback: (scan: ScanResult) => void) => {
    if (socketRef.current) {
      socketRef.current.on('scan_result', callback)
    }
  }, [])

  const onContainerStatusChange = useCallback((callback: (status: ContainerStatus) => void) => {
    if (socketRef.current) {
      socketRef.current.on('container_status_change', callback)
    }
  }, [])

  const onSystemNotification = useCallback((callback: (notification: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on('system_notification', callback)
    }
  }, [])

  // Remove event listeners
  const offMetricUpdate = useCallback((callback: (metric: ContainerMetric) => void) => {
    if (socketRef.current) {
      socketRef.current.off('metric_update', callback)
    }
  }, [])

  const offAlertPush = useCallback((callback: (alert: AlertData) => void) => {
    if (socketRef.current) {
      socketRef.current.off('alert_push', callback)
    }
  }, [])

  const offScanResult = useCallback((callback: (scan: ScanResult) => void) => {
    if (socketRef.current) {
      socketRef.current.off('scan_result', callback)
    }
  }, [])

  return {
    socket: socketRef.current,
    isConnected,
    lastMessage,
    subscribeToContainer,
    unsubscribeFromContainer,
    subscribeAlerts,
    subscribeScanResults,
    onMetricUpdate,
    onGlobalMetricUpdate,
    onAlertPush,
    onScanResult,
    onContainerStatusChange,
    onSystemNotification,
    offMetricUpdate,
    offAlertPush,
    offScanResult
  }
}