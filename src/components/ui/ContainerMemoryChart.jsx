"use client"

import { useState, useEffect, memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bug } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useSocket } from '@/hooks/use-socket'

const ContainerMemoryChart = memo(() => {
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { socket } = useSocket()

  useEffect(() => {
    const fetchContainerMemoryData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all containers
        const containersResponse = await fetch('/api/containers')
        if (!containersResponse.ok) {
          throw new Error('Failed to fetch containers')
        }
        const containers = await containersResponse.json()

        // Filter running containers
        const runningContainers = containers.filter(container => container.status === 'running')

        if (runningContainers.length === 0) {
          setChartData([])
          setLoading(false)
          return
        }

        // Fetch metrics for each running container
        const allMetricsPromises = runningContainers.map(async (container) => {
          try {
            const metricsResponse = await fetch(`/api/containers/${container.containerId}/metrics?limit=100`)
            if (metricsResponse.ok) {
              const metrics = await metricsResponse.json()
              return { container, metrics }
            }
            return { container, metrics: [] }
          } catch (error) {
            console.error(`Error fetching metrics for ${container.name}:`, error)
            return { container, metrics: [] }
          }
        })

        const allMetricsResults = await Promise.all(allMetricsPromises)

        // Transform data to multi-line format
        const timeMap = new Map()

        allMetricsResults.forEach(({ container, metrics }) => {
          const containerName = container.name

          // For each metric point, add to timeMap
          metrics.forEach(metric => {
            const time = new Date(metric.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })

            if (!timeMap.has(time)) {
              timeMap.set(time, { time })
            }

            const timeData = timeMap.get(time)
            // Only add memory usage
            timeData[containerName] = Math.round(metric.memUsage * 100) / 100
          })
        })

        // Sort by time and convert to array
        const sortedData = Array.from(timeMap.values()).sort((a, b) => {
          const timeA = new Date(`2024-01-01 ${a.time}`)
          const timeB = new Date(`2024-01-01 ${b.time}`)
          return timeA - timeB
        })

        setChartData(sortedData.reverse()) // Reverse to show latest first
      } catch (error) {
        console.error('Error fetching container memory data:', error)
        setError('Failed to load container memory metrics')
      } finally {
        setLoading(false)
      }
    }

    // Listen for container status changes
    if (socket) {
      socket.on('container_status_change', (containerUpdate) => {
        console.log('ContainerMemoryChart: Container status changed, refreshing data')
        fetchContainerMemoryData()
      })
    }

    // Initial fetch
    fetchContainerMemoryData()

    // Refresh every 5 seconds for faster container detection
    const interval = setInterval(fetchContainerMemoryData, 5000)

    return () => {
      clearInterval(interval)
      if (socket) {
        socket.off('container_status_change')
      }
    }
  }, [socket])

  // Define colors for containers
  const getContainerColor = (containerName) => {
    const colors = ['#22c55e', '#a855f7', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    const names = ['nginx', 'redis', 'postgres', 'mysql', 'mongo', 'node', 'python']
    const index = names.indexOf(containerName.toLowerCase())
    return index >= 0 ? colors[index] : colors[Math.abs(containerName.length % colors.length)]
  }

  if (loading) {
    return (
      <Card className="bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bug className="h-5 w-5 text-emerald-400" />
            <span>Container Memory Usage</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Container memory utilization over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Bug className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bug className="h-5 w-5 text-emerald-400" />
            <span>Container Memory Usage</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Container memory utilization over time
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

  if (chartData.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bug className="h-5 w-5 text-emerald-400" />
            <span>Container Memory Usage</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Container memory utilization over time
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

  // Get unique container names for legend
  const containerNames = Object.keys(chartData[0]).filter(key => key !== 'time')

  return (
    <Card className="bg-gray-800 border-gray-700 text-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bug className="h-5 w-5 text-emerald-400" />
          <span>Container Memory Usage</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Container memory utilization over time (multiple containers)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={{ stroke: '#4b5563' }}
              tickLine={{ stroke: '#4b5563' }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={{ stroke: '#4b5563' }}
              tickLine={{ stroke: '#4b5563' }}
              domain={[0, 'dataMax + 10']}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f3f4f6'
              }}
              labelFormatter={(value) => `${value}`}
              formatter={(value, name) => [`${value}%`, name]}
            />
            <Legend
              wrapperStyle={{ color: '#f3f4f6' }}
              iconType="line"
            />
            {containerNames.map((containerName, index) => (
              <Line
                key={containerName}
                type="monotone"
                dataKey={containerName}
                stroke={getContainerColor(containerName)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: getContainerColor(containerName), stroke: "#1f2937", strokeWidth: 2 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
})

ContainerMemoryChart.displayName = 'ContainerMemoryChart'

export { ContainerMemoryChart }
