"use client"

import { useState, useEffect, useRef, memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useSocket } from '@/hooks/use-socket'

const ContainerCPUChart = memo(() => {
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [containers, setContainers] = useState([])
  const { socket } = useSocket()
  const isMounted = useRef(true)
  const fetchTimeoutRef = useRef(null)
  const socketListenersActive = useRef(false)
  const metricTimeoutsRef = useRef([])
  const controllersRef = useRef([])
  const fetchAttemptRef = useRef(0)
  const MAX_POINTS = 20

  // Clear all timeouts
  const clearAllTimeouts = () => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
      fetchTimeoutRef.current = null
    }
    
    if (metricTimeoutsRef.current.length > 0) {
      metricTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      metricTimeoutsRef.current = []
    }
    // Abort any in-flight fetch controllers
    if (controllersRef.current.length > 0) {
      controllersRef.current.forEach(ctrl => {
        try {
          ctrl.abort()
        } catch (e) {
          // ignore
        }
      })
      controllersRef.current = []
    }
  }

  // Setup socket listeners
  const setupSocketListeners = () => {
    if (!socket || socketListenersActive.current) return
    
    socketListenersActive.current = true
    
    socket.on('container_status_change', () => {
      if (isMounted.current) {
        console.log('ContainerCPUChart: Container status changed, refreshing data')
        fetchContainers()
      }
    })

    socket.on('metric_update', () => {
      if (isMounted.current) {
        console.log('ContainerCPUChart: Metric update received, refreshing data')
        fetchContainerCPUData()
      }
    })
  }

  // Cleanup socket listeners
  const cleanupSocketListeners = () => {
    if (!socket || !socketListenersActive.current) return
    
    socket.off('container_status_change')
    socket.off('metric_update')
    socketListenersActive.current = false
  }

  // Fetch all containers first
  const fetchContainers = async () => {
    try {
      if (!isMounted.current) return
      
      const containerController = new AbortController()
      // track controller so we can abort on unmount
      controllersRef.current.push(containerController)
      fetchTimeoutRef.current = setTimeout(() => {
        if (containerController && !containerController.signal.aborted) {
          containerController.abort()
          console.log('Container fetch aborted due to timeout')
        }
      }, 10000)
      
      const containersResponse = await fetch('/api/containers', {
        signal: containerController.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      
      // clear the timeout for container fetch (it succeeded)
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
        fetchTimeoutRef.current = null
      }

      // remove this controller from tracking
      controllersRef.current = controllersRef.current.filter(c => c !== containerController)

      if (!isMounted.current) return
      
      if (!containersResponse.ok) {
        throw new Error(`Failed to fetch containers: ${containersResponse.status} ${containersResponse.statusText}`)
      }
      
      const containersData = await containersResponse.json()
      setContainers(containersData)
      
      // After getting containers, fetch metrics
      fetchContainerCPUData(containersData)
    } catch (error) {
      // If abort, it may be intentional (timeout/unmount) — don't surface as error to console
      if (error && error.name === 'AbortError') {
        // Optionally set a lightweight message or just ignore
        if (isMounted.current) {
          setError(`Failed to fetch containers: Request aborted`)
          setLoading(false)
        }
      } else {
        console.error('Error fetching containers:', error?.name, error?.message)
        if (isMounted.current) {
          setError(`Failed to fetch containers: ${error?.message || 'Unknown error'}`)
          setLoading(false)
        }
      }
    }
  }

  const fetchContainerCPUData = async (containersList = null) => {
    // Clear any existing timeouts
    clearAllTimeouts()
    
    try {
      if (!isMounted.current) return
      
      setError(null)
      fetchAttemptRef.current += 1
      
      // Use provided containers list or the state
      const allContainers = containersList || containers
      
      if (allContainers.length === 0) {
        // keep existing chartData when there are temporarily no containers to avoid axes disappearing
        setLoading(false)
        return
      }
      
      // Fetch metrics for each running container with increased timeout
      const allMetricsPromises = allContainers.map(async (container) => {
        // For stopped containers, return container with empty metrics
        if (container.status !== 'running') {
          return { container, metrics: [] }
        }
        
        const metricController = new AbortController()
        // track metric controllers so we can abort them on unmount
        controllersRef.current.push(metricController)
        const metricTimeout = setTimeout(() => {
          if (metricController && !metricController.signal.aborted) {
            metricController.abort()
          }
        }, 10000) // Increased to 10 seconds
        
        metricTimeoutsRef.current.push(metricTimeout)
        
        try {
          const metricsResponse = await fetch(`/api/containers/${container.containerId}/metrics?limit=100`, {
            signal: metricController.signal,
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          })
          
          if (!isMounted.current) return { container, metrics: [] }
          
          if (metricsResponse.ok) {
            const metrics = await metricsResponse.json()
            // clear this metric timeout (we got a response)
            try { clearTimeout(metricTimeout) } catch (e) {}
            // remove the timeout id from the ref list
            metricTimeoutsRef.current = metricTimeoutsRef.current.filter(t => t !== metricTimeout)
            // remove controller from tracking
            controllersRef.current = controllersRef.current.filter(c => c !== metricController)
            return { container, metrics }
          }
          // clear timeout and controller in non-ok case too
          try { clearTimeout(metricTimeout) } catch (e) {}
          metricTimeoutsRef.current = metricTimeoutsRef.current.filter(t => t !== metricTimeout)
          controllersRef.current = controllersRef.current.filter(c => c !== metricController)
          return { container, metrics: [] }
        } catch (error) {
          // If aborted, it's likely due to timeout/unmount; don't spam console
          if (error && error.name === 'AbortError') {
            // ensure timeout cleared and controller removed on abort
            try { clearTimeout(metricTimeout) } catch (e) {}
            metricTimeoutsRef.current = metricTimeoutsRef.current.filter(t => t !== metricTimeout)
            controllersRef.current = controllersRef.current.filter(c => c !== metricController)
            return { container, metrics: [] }
          }

          console.error(`Error fetching metrics for ${container.name}:`, error)
          // ensure timeout cleared and controller removed on error
          try { clearTimeout(metricTimeout) } catch (e) {}
          metricTimeoutsRef.current = metricTimeoutsRef.current.filter(t => t !== metricTimeout)
          controllersRef.current = controllersRef.current.filter(c => c !== metricController)
          return { container, metrics: [] }
        }
      })
      
      try {
        const allMetricsResults = await Promise.all(allMetricsPromises)
        
        if (!isMounted.current) return
        
        // Transform data to multi-line format
        const timeMap = new Map()
        
        // Get current time (rounded to minute) for containers with no metrics
        const now = new Date()
        now.setSeconds(0, 0)
        const currentTime = now.getTime()

        // Initialize with all containers at 0%
        const initialTimeData = { time: currentTime }
        allContainers.forEach(container => {
          initialTimeData[container.name] = 0
        })
        timeMap.set(currentTime, initialTimeData)
        
        // Add metrics for containers that have them
        allMetricsResults.forEach(({ container, metrics }) => {
          if (!container) return
          const containerName = container.name
          
          // If container has no metrics (stopped), it stays at 0%
          if (metrics.length === 0) return
          
          // For each metric point, add to timeMap (use numeric timestamp rounded to minute)
          metrics.forEach(metric => {
            const ts = new Date(metric.timestamp)
            ts.setSeconds(0, 0)
            const time = ts.getTime()

            if (!timeMap.has(time)) {
              const newTimeData = { time }
              // Initialize all containers to 0 for this timestamp
              allContainers.forEach(c => {
                newTimeData[c.name] = 0
              })
              timeMap.set(time, newTimeData)
            }

            const timeData = timeMap.get(time)
            // Only add CPU usage
            timeData[containerName] = metric.cpuPercentage || 0
          })
        })
        
        // Sort by numeric timestamp
        const sortedData = Array.from(timeMap.values()).sort((a, b) => a.time - b.time)
        const finalData = sortedData.reverse() // newest first

        // Merge with previous data to create a sliding window and avoid axis reset
        setChartData(prev => {
          // keep newest-first order, dedupe by time (keep newest)
          const map = new Map()
          ;[...finalData, ...prev].forEach(item => {
            if (item && item.time && !map.has(item.time)) {
              map.set(item.time, item)
            }
          })
          return Array.from(map.values()).slice(0, MAX_POINTS)
        })
        setLoading(false)
      } catch (error) {
        console.error('Error processing metrics:', error)
        
        if (!isMounted.current) return
        
        // Create basic data with all containers at 0%
        const basicData = [{ time: currentTime }]
        allContainers.forEach(container => {
          basicData[0][container.name] = 0
        })
        
        setChartData(basicData)
        setLoading(false)
      }
    } catch (error) {
      if (error && error.name === 'AbortError') {
        // Ignore AbortError caused by intentional aborts/timeouts
        if (isMounted.current) {
          setError(`Failed to load container CPU metrics: Request aborted`)
          setLoading(false)
        }
      } else {
        console.error('Error in fetchContainerCPUData:', error?.name, error?.message)
        if (isMounted.current) {
          setError(`Failed to load container CPU metrics: ${error?.message || 'Unknown error'}`)
          setLoading(false)
        }
      }
    } finally {
      if (isMounted.current) {
        // Always stop loading after 3 attempts
        if (fetchAttemptRef.current >= 3) {
          setLoading(false)
          console.log('Max fetch attempts reached, stopping loading state')
        }
      }
      clearAllTimeouts()
    }
  }

  useEffect(() => {
    isMounted.current = true
    fetchAttemptRef.current = 0
    
    // Initial fetch of containers
    fetchContainers()
    
    // Set up socket listeners
    setupSocketListeners()
    
    // Refresh every 20 seconds instead of 15
    const interval = setInterval(() => {
      fetchContainerCPUData()
    }, 20000)
    
    return () => {
      isMounted.current = false
      clearInterval(interval)
      clearAllTimeouts()
      cleanupSocketListeners()
    }
  }, [socket])

  // Define colors for containers
  const getContainerColor = (containerName, containerStatus) => {
    const colors = ['#22c55e', '#a855f7', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    const names = ['nginx', 'redis', 'postgres', 'mysql', 'mongo', 'node', 'python']
    const index = names.indexOf(containerName.toLowerCase())
    
    // If container is stopped, use a muted color
    if (containerStatus === 'stopped' || containerStatus === 'exited') {
      return '#6b7280' // gray-500
    }
    
    return index >= 0 ? colors[index] : colors[Math.abs(containerName.length % colors.length)]
  }

  // Get container names for legend
  const getContainerNames = () => {
    if (containers.length > 0) {
      return containers.map(container => container.name)
    }
    if (chartData.length > 0) {
      return Object.keys(chartData[0]).filter(key => key !== 'time')
    }
    return []
  }

  const containerNames = getContainerNames()
  const displayData = chartData

  if (error && chartData.length === 0 && containers.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span>Container CPU Usage</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Container CPU utilization over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-400">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0 && !loading && containers.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span>Container CPU Usage</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Container CPU utilization over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-400">No container metrics available</p>
            <p className="text-sm text-gray-500 mt-1">Container metrics will appear when available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gray-800 border-gray-700 text-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-blue-400" />
          <span>Container CPU Usage</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Container CPU utilization over time ({containerNames.length} containers)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative w-full h-[300px]">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={displayData} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={{ stroke: '#4b5563' }}
                tickLine={{ stroke: '#4b5563' }}
                interval="preserveStartEnd"
                minTickGap={40}
                tickFormatter={(value) => {
                  try {
                    return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                  } catch (e) {
                    return value
                  }
                }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={{ stroke: '#4b5563' }}
                tickLine={{ stroke: '#4b5563' }}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
                labelFormatter={(value) => {
                  try { return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) } catch (e) { return value }
                }}
                formatter={(value, name) => [`${value}%`, name]}
              />
              <Legend
                wrapperStyle={{ color: '#f3f4f6' }}
                iconType="line"
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
                height={36}
                formatter={(value) => value}
              />
              {containerNames.map((containerName) => {
                const container = containers.find(c => c.name === containerName) || { status: 'unknown' }
                return (
                  <Line
                    key={containerName}
                    type="monotone"
                    dataKey={containerName}
                    stroke={getContainerColor(containerName, container.status)}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: getContainerColor(containerName, container.status), stroke: "#1f2937", strokeWidth: 2 }}
                    connectNulls={true}
                    strokeOpacity={container.status !== 'running' ? 0.5 : 1}
                    strokeDasharray={container.status !== 'running' ? '5 5' : null}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
          
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
              <Activity className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

ContainerCPUChart.displayName = 'ContainerCPUChart'

export { ContainerCPUChart }