"use client"

import { useState, useEffect, Suspense, memo, useMemo, useCallback, lazy } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { AlertTriangle, Shield, Container, Activity, TrendingUp, Clock, FileText, Eye, AlertCircle, Info, Bug, Search, RefreshCw, Calendar } from 'lucide-react'
import dynamic from 'next/dynamic'

// Lazy load only truly heavy components
const ContainerLogViewer = dynamic(() => import('@/components/ui/container-log-viewer').then(mod => mod.ContainerLogViewer), { ssr: false })
const DashboardGraphs = lazy(() => import('./dashboard-graphs'))
const DashboardContainerList = lazy(() => import('./dashboard-container-list'))

// Import new container charts
const ContainerCPUChart = dynamic(() => import('@/components/ui/ContainerCPUChart').then(mod => mod.ContainerCPUChart), { ssr: false })
const ContainerMemoryChart = dynamic(() => import('@/components/ui/ContainerMemoryChart').then(mod => mod.ContainerMemoryChart), { ssr: false })

// Static imports for recharts (they're not that heavy)
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'

import { useSocket } from '@/hooks/use-socket'
import { useRouter, useSearchParams } from 'next/navigation'

interface DashboardData {
  containers: {
    total: number
    running: number
    stopped: number
    list: any[]
  }
  alerts: {
    critical: number
    total: number
    recent: any[]
  }
  scans: {
    recent: any[]
    completed: number
    failed: number
  }
  metrics: any[]
  systemMetrics: any[]
  securityScore: number
}

const Dashboard = memo(function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [activeTab, setActiveTab] = useState('containers')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Logs state
  const [containersWithLogs, setContainersWithLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsSearchTerm, setLogsSearchTerm] = useState('')
  const [logsDateRange, setLogsDateRange] = useState<{
    startDate: string
    endDate: string
  }>({
    startDate: '',
    endDate: ''
  })

  // Container metrics state
  const [containerMetrics, setContainerMetrics] = useState<any[]>([])
  const [containerMetricsLoading, setContainerMetricsLoading] = useState(false)

  // System metrics state for graphs
  const [systemMetricsData, setSystemMetricsData] = useState<any[]>([])
  const [systemMetricsLoading, setSystemMetricsLoading] = useState(false)

  // Current system metrics display
  const [currentSystemMetrics, setCurrentSystemMetrics] = useState({
    cpuUsage: 15,
    ramUsed: 6.4,
    ramFree: 9.6,
    ramUsagePercent: 40,
    ramTotal: 16,
    networkIn: 1.8,
    networkOut: 1.4,
    networkTotal: 3.2,
    diskUsed: 140,
    diskFree: 360,
    diskUsagePercent: 28,
    diskTotal: 500,
    loadAverage1: 0.8,
    loadAverage5: 0.7
  })

  // Container list search state
  const [containerListSearchTerm, setContainerListSearchTerm] = useState('')

  // Modal state for container logs
  const [selectedContainer, setSelectedContainer] = useState<any>(null)
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false)

  const { socket, subscribeAlerts, subscribeScanResults } = useSocket()
  
  useEffect(() => {
    if (socket) {
      socket.on('alert_push', (newAlert) => {
        setDashboardData((prev) => prev ? {
          ...prev,
          alerts: {
            ...prev.alerts,
            total: prev.alerts.total + 1,
            critical: newAlert.severity === 'critical' ? prev.alerts.critical + 1 : prev.alerts.critical,
            recent: [newAlert, ...prev.alerts.recent].slice(0, 10)
          }
        } : prev)
        setLastUpdated(new Date())
      })

      socket.on('scan_result', (newScan) => {
        setDashboardData((prev) => prev ? {
          ...prev,
          scans: {
            ...prev.scans,
            completed: newScan.status === 'completed' ? prev.scans.completed + 1 : prev.scans.completed,
            failed: newScan.status === 'failed' ? prev.scans.failed + 1 : prev.scans.failed,
            recent: [newScan, ...prev.scans.recent].slice(0, 10)
          }
        } : prev)
        setLastUpdated(new Date())
      })

      socket.on('container_status_change', (containerUpdate) => {
        setDashboardData((prev) => prev ? {
          ...prev,
          containers: {
            ...prev.containers,
            running: containerUpdate.running,
            stopped: containerUpdate.stopped,
            total: containerUpdate.total,
            list: containerUpdate.list || prev.containers.list
          }
        } : prev)
        setLastUpdated(new Date())
      })

      subscribeAlerts()
      subscribeScanResults()
    }

    return () => {
      if (socket) {
        socket.off('alert_push')
        socket.off('scan_result')
        socket.off('container_status_change')
      }
    }
  }, [socket, subscribeAlerts, subscribeScanResults])
  

  
  // Simplified data fetching
  const fetchData = async () => {
    try {
      setIsLoading(true)
      console.log('Fetching data...')

      // Fetch dashboard data
      const [dashboardResponse, containersResponse] = await Promise.all([
        fetch('/api/dashboard?hours=24').catch(() => new Response(JSON.stringify({
          containers: { total: 0, running: 0, stopped: 0, list: [] },
          alerts: { critical: 0, total: 0, recent: [] },
          scans: { recent: [], completed: 0, failed: 0 },
          metrics: [],
          securityScore: 0
        }))),
        fetch('/api/containers').catch(() => new Response(JSON.stringify([])))
      ])

      const dashboardData = await dashboardResponse.json()
      const containersArray = await containersResponse.json()

      console.log('Dashboard data received:', dashboardData)
      console.log('Containers data received:', containersArray)

      // Calculate counts from containers array
      const total = containersArray.length
      const running = containersArray.filter(c => c.status === 'running').length
      const stopped = containersArray.filter(c => c.status === 'stopped').length

      // Merge the data
      setDashboardData({
        ...dashboardData,
        containers: {
          total,
          running,
          stopped,
          list: containersArray
        }
      })

      setLastUpdated(new Date())
      setIsLoading(false)
      setIsInitialLoad(false)
    } catch (error) {
      console.error('Error fetching data:', error)
      // Set fallback data
      setDashboardData({
        containers: { total: 0, running: 0, stopped: 0, list: [] },
        alerts: { critical: 0, total: 0, recent: [] },
        scans: { recent: [], completed: 0, failed: 0 },
        metrics: [],
        systemMetrics: [],
        securityScore: 0
      })
      setIsLoading(false)
      setIsInitialLoad(false)
    }
  }
  
  // Controlled auto-refresh
  const startAutoRefresh = () => {
    // Only schedule refresh if not already loading
    if (!isLoading) {
      setTimeout(fetchData, 30000) // Refresh after 30 seconds
    }
  }
  
  // Fetch container metrics for graphs with retry logic
  const fetchContainerMetrics = async (retryCount = 0) => {
    try {
      setContainerMetricsLoading(true)
      const runningContainers = (dashboardData?.containers?.list || []).filter(c => c.status === 'running')

      if (runningContainers.length === 0) {
        setContainerMetrics([])
        return
      }

      // Fetch metrics from the first running container (or could aggregate all)
      const sampleContainer = runningContainers[0]
      const response = await fetch(`/api/containers/${sampleContainer.containerId}/metrics?limit=100`)

      if (response.ok) {
        const data = await response.json()
        setContainerMetrics(data)

        // If we got data on retry, show success feedback
        if (retryCount > 0) {
          console.log(`Successfully loaded container metrics after ${retryCount} retries`)
        }
      } else {
        // API call failed - if this is first attempt, retry after delay
        if (retryCount === 0) {
          console.log(`Metrics API failed (${response.status}), retrying in 5 seconds...`)
          setTimeout(() => fetchContainerMetrics(1), 5000)
          return
        } else if (retryCount < 3) {
          console.log(`Metrics API retry ${retryCount} failed, retrying in ${retryCount * 10} seconds...`)
          setTimeout(() => fetchContainerMetrics(retryCount + 1), retryCount * 10000)
          return
        }

        // All retries failed
        console.error(`Failed to fetch container metrics after ${retryCount} retries`)
        setContainerMetrics([])
      }
    } catch (error) {
      console.error(`Error fetching container metrics (attempt ${retryCount + 1}):`, error)

      // Retry logic for network errors
      if (retryCount < 3) {
        const delay = (retryCount + 1) * 3000 // 3s, 6s, 9s delays
        console.log(`Network error, retrying in ${delay / 1000} seconds...`)
        setTimeout(() => fetchContainerMetrics(retryCount + 1), delay)
      } else {
        setContainerMetrics([])
      }
    } finally {
      setContainerMetricsLoading(false)
    }
  }

  // Handle fetch data
  const handleFetchData = async () => {
    if (!isLoading) {
      await fetchData()
      await fetchContainersWithLogs()
      await fetchContainerMetrics()
      startAutoRefresh()
    }
  }

  // Fetch containers with logs data
  const fetchContainersWithLogs = async () => {
    try {
      setLogsLoading(true)
      const response = await fetch('/api/containers')
      const data = await response.json()
      // Accept various shapes: array, { all: [] }, or { containers: { list: [] } }
      const normalized = Array.isArray(data)
        ? data
        : (data?.all || data?.containers?.list || [])

      // For each container, get log statistics (with increased timeout and rate limiting)
      const containersWithLogData = await Promise.allSettled(
        normalized.map(async (container: any, index: number) => {
          // Add a small delay between requests to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, index * 50))

          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000) // Increased to 30 seconds

            const logsResponse = await fetch(`/api/containers/${container.id}/logs?summaryOnly=true`, {
              signal: controller.signal
            }).finally(() => clearTimeout(timeoutId))

            if (logsResponse.ok) {
              const logsData = await logsResponse.json()
              return {
                ...container,
                logsCount: logsData.total || 0,
                errorCount: logsData.stats?.ERROR || 0,
                warningCount: logsData.stats?.WARN || 0
              }
            }
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              console.error('Timeout fetching logs for container:', container.id, 'after 30 seconds')
            } else {
              console.error('Error fetching logs for container:', container.id, error)
            }
          }
          return container
        })
      )

      // Filter out rejected promises and get fulfilled values
      const successfulResults = containersWithLogData
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<any>).value)

      setContainersWithLogs(successfulResults)
    } catch (error) {
      console.error('Error fetching containers with logs:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  // Auto-load data on mount
  const loadInitialData = async () => {
    if (typeof window !== 'undefined' && isInitialLoad) {
      // Auto-load but give user control
      const timer = setTimeout(() => {
        if (isInitialLoad) {
          console.log('Auto-loading dashboard data...')
          handleFetchData()
        }
      }, 3000)

      // Cleanup timer if component unmounts
      return () => clearTimeout(timer)
    }
  }

  // Load initial data automatically
  useEffect(() => {
    handleFetchData()
  }, [])

  // Handle URL tab parameter
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['containers', 'logs', 'alerts'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'stopped': return 'bg-red-500'
      case 'paused': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return 'default'
      case 'stopped': return 'destructive'
      case 'paused': return 'secondary'
      default: return 'outline'
    }
  }

  const filteredContainersWithLogs = containersWithLogs.filter(container => {
    const name = (container?.name || '').toLowerCase()
    const image = (container?.image || '').toLowerCase()
    const q = logsSearchTerm.toLowerCase()
    return name.includes(q) || image.includes(q)
  })

  // Skip the initial loading screen for direct load

  const safeData = dashboardData || {
    containers: { total: 0, running: 0, stopped: 0, list: [] },
    alerts: { critical: 0, total: 0, recent: [] },
    scans: { recent: [], completed: 0, failed: 0 },
    metrics: [],
    securityScore: 0
  }

  // Safeguard alerts if it's undefined
  const safeAlerts = safeData.alerts || { critical: 0, total: 0, recent: [] }
  const safeScans = safeData.scans || { recent: [], completed: 0, failed: 0 }

  const getSecurityScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  // System metrics simulation
  const getSystemMetrics = () => {
    const now = Date.now() / 1000 // Unix timestamp

    // Simulate CPU usage with some variation based on time
    const cpuBaseLoad = 15 + Math.sin(now * 0.001) * 8 + Math.random() * 3
    const cpuUsage = Math.max(5, Math.min(90, cpuBaseLoad))

    // Simulate RAM usage (assume 16GB total)
    const totalRAM = 16
    const ramBaseUsage = 25 + Math.sin(now * 0.0005) * 6 + Math.random() * 2
    const ramUsagePercent = Math.max(10, Math.min(85, ramBaseUsage))
    const ramUsed = (totalRAM * ramUsagePercent) / 100
    const ramFree = totalRAM - ramUsed

    // Simulate network traffic
    const networkBase = 1.5 + Math.sin(now * 0.002) * 0.8 + Math.random() * 0.3
    const networkIn = Math.max(0.5, Math.min(4.5, networkBase))
    const networkOut = networkIn * (0.7 + Math.random() * 0.3)

    // Simulate disk usage (assume 500GB total)
    const totalDisk = 500
    const baseDisk = 140 + Math.sin(now * 0.0003) * 20 + Math.random() * 5
    const diskUsed = Math.max(120, Math.min(380, baseDisk))
    const diskFree = totalDisk - diskUsed
    const diskUsagePercent = (diskUsed / totalDisk) * 100

    // Load averages simulation
    const load1 = 0.8 + Math.sin(now * 0.01) * 0.3 + Math.random() * 0.1
    const load5 = 0.7 + Math.sin(now * 0.005) * 0.2 + Math.random() * 0.1

    return {
      cpuUsage: Math.round(cpuUsage),
      ramUsed: Math.round(ramUsed * 10) / 10,
      ramFree: Math.round(ramFree * 10) / 10,
      ramUsagePercent: Math.round(ramUsagePercent),
      ramTotal: totalRAM,
      networkIn: Math.round(networkIn * 10) / 10,
      networkOut: Math.round(networkOut * 10) / 10,
      networkTotal: Math.round((networkIn + networkOut) * 10) / 10,
      diskUsed: Math.round(diskUsed),
      diskFree: Math.round(diskFree),
      diskUsagePercent: Math.round(diskUsagePercent),
      diskTotal: totalDisk,
      loadAverage1: Math.round(load1 * 100) / 100,
      loadAverage5: Math.round(load5 * 100) / 100
    }
  }

  const [systemMetrics, setSystemMetrics] = useState({
    cpuUsage: 15,
    ramUsed: 6.4,
    ramFree: 9.6,
    ramUsagePercent: 40,
    ramTotal: 16,
    networkIn: 1.8,
    networkOut: 1.4,
    networkTotal: 3.2,
    diskUsed: 140,
    diskFree: 360,
    diskUsagePercent: 28,
    diskTotal: 500,
    loadAverage1: 0.8,
    loadAverage5: 0.7
  })

  useEffect(() => {
    // Set dynamic system metrics after hydration to avoid SSR mismatch
    setSystemMetrics(getSystemMetrics())
  }, [])

  // Filtered containers for container list search
  const filteredContainerList = safeData.containers.list.filter(container => {
    const name = (container?.name || '').toLowerCase()
    const image = (container?.image || '').toLowerCase()
    const id = (container?.id || '').toLowerCase()
    const q = containerListSearchTerm.toLowerCase()
    return name.includes(q) || image.includes(q) || id.includes(q)
  })

  // Container Graph Components
  const ContainerCPUUsageGraph = memo(() => {
    const processedMetrics = containerMetrics.map(metric => ({
      ...metric,
      time: new Date(metric.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      cpuUsagePercent: Math.round(metric.cpuUsage)
    })).reverse()

    return (
      <Card className="bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-purple-400" />
            <span>Container CPU Usage</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Container CPU utilization over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {containerMetricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Activity className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          ) : processedMetrics.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={processedMetrics}>
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
                    labelFormatter={(value: any) => `${value}`}
                    formatter={(value: any) => `${value}% CPU Usage`}
                  />
                <Line
                  type="monotone"
                  dataKey="cpuUsagePercent"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#a855f7", stroke: "#1f2937", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">No container metrics available</p>
              <p className="text-sm text-gray-500 mt-1">Container metrics will appear when available</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  })

  const ContainerRAMUsageGraph = memo(() => {
    const processedMetrics = containerMetrics.map(metric => ({
      ...metric,
      time: new Date(metric.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      memUsagePercent: Math.round(metric.memUsage)
    })).reverse()

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
          {containerMetricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Bug className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
          ) : processedMetrics.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={processedMetrics}>
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
                  labelFormatter={(value: any) => `${value}`}
                  formatter={(value: any) => `${value}%`}
                />
                <Line
                  type="monotone"
                  dataKey="memUsagePercent"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#10b981", stroke: "#1f2937", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">No container metrics available</p>
              <p className="text-sm text-gray-500 mt-1">Container metrics will appear when available</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  })

  // Performance Graph Components
  const CPUUsageGraph = memo(() => {
    // Generate mock CPU usage data for the last 24 hours (client-side only)
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
      const generateCPUData = () => {
        const newData: any[] = []
        const now = new Date()
        for (let i = 23; i >= 0; i--) {
          const time = new Date(now.getTime() - i * 60 * 60 * 1000)
          const baseUsage = 15 + Math.sin(i / 6) * 10 + Math.random() * 5
          const peakHours = time.getHours() >= 9 && time.getHours() <= 18
          const peakMultiplier = peakHours ? 1.3 : 0.8
          const usage = Math.max(5, Math.min(95, baseUsage * peakMultiplier + Math.random() * 8))
          newData.push({
            time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            usage: Math.round(usage),
            fullTime: time
          })
        }
        return newData
      }

      setData(generateCPUData())
    }, [])

    return (
      <Card className="bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-cyan-400" />
            <span>CPU Usage History</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            CPU utilization over the last 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
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
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
                labelFormatter={(value: any) => {
                  if (value) {
                    return `${value}: ${data.find(point => point.time === value)?.usage || 0}%`;
                  }
                  return value;
                }}
                formatter={() => 'CPU Usage'}
              />
              <Line
                type="monotone"
                dataKey="usage"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#06b6d4", stroke: "#1f2937", strokeWidth: 2 }}
                fill="url(#cpuGradient)"
                animationDuration={2000}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Current CPU stats */}
          <div className="mt-4 flex justify-between items-center text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <span className="text-gray-300">Current: {data[data.length - 1]?.usage || 0}%</span>
            </div>
            <div className="text-gray-400">
              Peak: {data.length > 0 ? Math.max(...data.map(d => d.usage)) : 0}% | Avg: {data.length > 0 ? Math.round(data.reduce((acc, d) => acc + d.usage, 0) / data.length) : 0}%
            </div>
          </div>
        </CardContent>
      </Card>
    )
  })

  const RAMUsageGraph = memo(() => {
    // Generate mock RAM usage data for the last 24 hours (client-side only)
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
      const generateRAMData = () => {
        const newData: any[] = []
        const now = new Date()
        for (let i = 23; i >= 0; i--) {
          const time = new Date(now.getTime() - i * 60 * 60 * 1000)
          const baseUsage = 25 + Math.sin(i / 8) * 8 + Math.random() * 3
          const activityHours = time.getHours() >= 8 && time.getHours() <= 22
          const activityMultiplier = activityHours ? 1.2 : 0.9
          const usage = Math.max(15, Math.min(85, baseUsage * activityMultiplier + Math.random() * 4))
          const usedGB = (usage / 100) * 16 // Assume 16GB total RAM
          newData.push({
            time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            usage: Math.round(usage),
            usedGB: Math.round(usedGB * 10) / 10,
            freeGB: Math.round((16 - usedGB) * 10) / 10,
            fullTime: time
          })
        }
        return newData
      }

      setData(generateRAMData())
    }, [])

    return (
      <Card className="bg-gray-800 border-gray-700 text-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bug className="h-5 w-5 text-green-400" />
            <span>RAM Usage History</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            Memory utilization over the last 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
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
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
              />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f3f4f6'
                  }}
                  labelFormatter={(value: any) => {
                    if (value && data.length > 0) {
                      const point = data.find(p => p.time === value);
                      if (point) {
                        return `${value}: ${point.usage}% (${point.usedGB}GB used)`;
                      }
                    }
                    return value;
                  }}
                  formatter={() => 'RAM Usage'}
                />
              <Line
                type="monotone"
                dataKey="usage"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#10b981", stroke: "#1f2937", strokeWidth: 2 }}
                fill="url(#ramGradient)"
                animationDuration={2500}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Current RAM stats */}
          <div className="mt-4 flex justify-between items-center text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-gray-300">
                Current: {data[data.length - 1]?.usage || 0}% ({data[data.length - 1]?.usedGB || 0}GB)
              </span>
            </div>
            <div className="text-gray-400">
              Peak: {data.length > 0 ? Math.max(...data.map(d => d.usage)) : 0}% | Free: {data[data.length - 1]?.freeGB || 0}GB
            </div>
          </div>
        </CardContent>
      </Card>
    )
  })

  // Enhanced Donut Chart Component
  const DonutChartCard = memo(({ title, value, maxValue, color, icon, description, variant }: {
    title: string
    value: number
    maxValue: number
    color: string
    icon: React.ReactNode
    description: string
    variant?: string
  }) => {
    const getCardStyling = () => {
      switch (variant) {
        case 'alert':
          return 'bg-gradient-to-br from-red-900/20 to-red-800/30 border border-red-500/40 rounded-xl hover:scale-105 transition-transform duration-300 shadow-lg hover:shadow-red-500/20'
        case 'scan':
          return 'bg-gradient-to-br from-green-900/20 to-green-800/30 border border-green-500/40 rounded-xl hover:scale-105 transition-transform duration-300 shadow-lg hover:shadow-green-500/20'
        default:
          return 'bg-gradient-to-br from-cyan-900/20 to-blue-900/30 border border-cyan-500/40 rounded-xl hover:scale-105 transition-transform duration-300 shadow-lg hover:shadow-cyan-500/20'
      }
    }

    const getAccentColor = () => {
      switch (variant) {
        case 'alert': return 'text-red-400 bg-red-400/10 border-red-400/30'
        case 'scan': return 'text-green-400 bg-green-400/10 border-green-400/30'
        default: return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30'
      }
    }
    const percentage = Math.round((value / maxValue) * 100)
    const remaining = 100 - percentage

    const data = [
      { name: 'Used', value: percentage, color: color },
      { name: 'Remaining', value: remaining, color: '#374151' }
    ]

    // Custom tooltip component
    const CustomTooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
            <p className="text-white font-medium">{payload[0].name}</p>
            <p className="text-gray-300 text-sm">{payload[0].value}%</p>
          </div>
        )
      }
      return null
    }

    return (
      <Card className={`${getCardStyling()} text-white`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-6 pt-6">
          <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full ${getAccentColor()}`}>
            {icon}
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{value}</div>
            <div className="text-xs opacity-75">of {maxValue}</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center text showing total value */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{value}</div>
                  <div className="text-xs text-gray-400">Total</div>
                </div>
              </div>
            </div>

            {/* Progress bar below */}
            <div className="mt-4 w-full">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gray-700 rounded-full h-2 relative overflow-hidden"
                  style={{ width: `${percentage}%` }}
                >
                  <div
                    className={`h-full ${color} rounded-full transition-all duration-500`}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span>
                <span>{maxValue}</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-400 mt-2">{description}</p>
          </div>
        </CardContent>
      </Card>
    )

  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-gray-100 relative overflow-hidden">
      {/* Static Background Decorations - Much lighter */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-32 left-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
      </div>
          {/* Header */}
          <header className="backdrop-blur-sm bg-gray-800/10 fixed top-0 left-0 right-0 z-50">
        <div className="px-4 py-2 max-w-screen-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-10 h-10 bg-cyan-500 rounded-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">EclipGuardX</h1>
                <p className="text-sm text-gray-400">Container Security Dashboard</p>
              </div>
            </div>

            {/* Main Navigation Tabs */}
            <nav className="flex space-x-1">
              <Tabs value={activeTab} className="w-full">
                <TabsList className="bg-gray-800 p-1">
                  <TabsTrigger
                    value="containers"
                    className="text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white flex-1 text-sm px-4 py-2 rounded-md transition-colors"
                    onClick={() => setActiveTab('containers')}
                  >
                    Home
                  </TabsTrigger>
                  <TabsTrigger
                    value="logs"
                    className="text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white flex-1 text-sm px-4 py-2 rounded-md transition-colors"
                    onClick={() => setActiveTab('logs')}
                  >
                    Container
                  </TabsTrigger>
                  <TabsTrigger
                    value="alerts"
                    className="text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white flex-1 text-sm px-4 py-2 rounded-md transition-colors"
                    onClick={() => setActiveTab('alerts')}
                  >
                    Security
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </nav>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-screen-2xl mx-auto pt-20">
        {/* Main Content */}
        <Tabs value={activeTab} className="space-y-4">

          <TabsContent value="alerts" className="space-y-4 mt-6">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10 hover:bg-gradient-to-br hover:from-cyan-500/10 hover:to-cyan-400/5 hover:border-cyan-500/50 text-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <span>Recent Security Alerts</span>
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Latest security vulnerabilities and threats detected
                </CardDescription>
              </CardHeader>
              <CardContent>
                {safeAlerts.recent.length > 0 ? (
                  <div className="space-y-4">
                    {safeAlerts.recent.map((alert: any, index: number) => (
                      <div key={index} className="flex items-start space-x-4 p-4 bg-gray-700 rounded-lg">
                        <div className={`w-3 h-3 rounded-full mt-2 ${getSeverityColor(alert.severity)}`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-white">{alert.message}</h4>
                            <Badge variant="outline" className={`${getSeverityColor(alert.severity)} text-white border-none`}>
                              {alert.severity}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-400 mb-2">
                            <div className="flex items-center space-x-1">
                              <Container className="h-4 w-4" />
                              <span>{alert.container?.name || 'Unknown Container'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>{new Date(alert.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                          {alert.container?.containerId && (
                            <p className="text-xs text-gray-500">Container ID: {alert.container.containerId}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <p className="text-gray-400">No security alerts detected</p>
                    <p className="text-sm text-gray-500 mt-2">Your containers are secure</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4 mt-6">



            {/* Container Stats Cards (moved from containers tab) */}
            <h3 className="text-lg font-semibold text-white mb-6">Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 mb-8">
              {/* Total Containers */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10 hover:bg-gradient-to-br hover:from-cyan-500/10 hover:to-cyan-400/5 hover:border-cyan-500/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-cyan-500/10 rounded-lg ring-1 ring-cyan-500/20 group-hover:ring-cyan-500/40 group-hover:bg-cyan-500/20 transition-all duration-300">
                      <Container className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-400 group-hover:text-cyan-300 transition-colors duration-300">Total Containers</p>
                      <p className="text-2xl font-bold text-white">{safeData.containers.total}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 mb-1">Status</div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-xs text-green-400 font-medium">{safeData.containers.running} running</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                        <span className="text-xs text-red-400 font-medium">{safeData.containers.stopped} stopped</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-slate-500 group-hover:text-cyan-400 transition-colors duration-300">Active containers</div>
                  <div className="text-sm font-semibold text-cyan-400">
                    {Math.round((safeData.containers.running / Math.max(safeData.containers.total, 1)) * 100)}% healthy
                  </div>
                </div>
              </div>

              {/* Security Alerts */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-red-500/10 hover:bg-gradient-to-br hover:from-red-500/10 hover:to-red-400/5 hover:border-red-500/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-red-500/10 rounded-lg ring-1 ring-red-500/20 group-hover:ring-red-500/40 group-hover:bg-red-500/20 transition-all duration-300">
                      <AlertTriangle className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-400 group-hover:text-red-300 transition-colors duration-300">Security Alerts</p>
                      <p className="text-2xl font-bold text-white">{safeAlerts.total}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 mb-1">Severity</div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs text-red-400 font-medium">{safeAlerts.critical} critical</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                        <span className="text-xs text-orange-400 font-medium">{safeAlerts.total - safeAlerts.critical} others</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-slate-500 group-hover:text-red-400 transition-colors duration-300">Alert status</div>
                  <div className={`text-sm font-semibold ${safeAlerts.total === 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {safeAlerts.total === 0 ? 'System Secure' : 'Action Required'}
                  </div>
                </div>
              </div>

              {/* Security Scans */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/10 hover:bg-gradient-to-br hover:from-green-500/10 hover:to-green-400/5 hover:border-green-500/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-green-500/10 rounded-lg ring-1 ring-green-500/20 group-hover:ring-green-500/40 group-hover:bg-green-500/20 transition-all duration-300">
                      <Activity className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-400 group-hover:text-green-300 transition-colors duration-300">Security Scans</p>
                      <p className="text-2xl font-bold text-white">{safeScans.completed}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 mb-1">This week</div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-xs text-green-400 font-medium">{safeScans.completed} completed</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                        <span className="text-xs text-yellow-400 font-medium">{safeScans.failed} failed</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-slate-500 group-hover:text-green-400 transition-colors duration-300">Success rate</div>
                  <div className="text-sm font-semibold text-green-400">
                    {Math.round((safeScans.completed / Math.max(safeScans.completed + safeScans.failed, 1)) * 100)}% completed
                  </div>
                </div>
              </div>
            </div>

            {/* Container List (moved from containers tab) */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Container List</h3>
                <div className="flex items-center space-x-2 ml-auto">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search containers..."
                      value={containerListSearchTerm}
                      onChange={(e) => setContainerListSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-1 w-64 bg-gray-800/50 border-gray-700 text-gray-100 placeholder-gray-400 text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={logsLoading}
                    className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all duration-200"
                    onClick={handleFetchData}
                  >
                    <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {safeData.containers.list.length > 0 ? (
                <div className="flex flex-col gap-4 max-h-96 overflow-y-auto">
                  {filteredContainerList
                    .sort((a: any, b: any) => {
                      // Sort running containers to the top
                      if (a.status === 'running' && b.status !== 'running') return -1
                      if (a.status !== 'running' && b.status === 'running') return 1
                      // Then sort by name alphabetically within each status group
                      return a.name.localeCompare(b.name)
                    })
                    .map((container: any, index: number) => (
                    <div key={container.id || index} className="group relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 hover:bg-gradient-to-br hover:from-slate-800 hover:to-slate-900/80 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-300 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`relative flex items-center justify-center w-10 h-10 rounded-full ${
                            container.status === 'running'
                              ? 'bg-green-500/10 ring-2 ring-green-500/30'
                              : 'bg-red-500/10 ring-2 ring-red-500/30'
                          }`}>
                            <Container className={`h-5 w-5 ${
                              container.status === 'running' ? 'text-green-400' : 'text-red-400'
                            }`} />
                            {container.isRunning && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white group-hover:text-cyan-300 transition-colors">{container.name}</h4>
                            <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-1 sm:space-y-0 mt-1">
                              <p className="text-sm text-slate-400">
                                <span className="text-slate-500">ID:</span> {container.id?.slice(0, 12)}...
                              </p>
                              <p className="text-sm text-slate-400">
                                <span className="text-slate-500">Image:</span> {container.image}
                              </p>
                              {container.ports && container.ports !== '-' && (
                                <p className="text-sm text-cyan-400">
                                  <span className="text-cyan-500">Ports:</span> {container.ports}
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Created: {new Date(container.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Badge
                            variant="outline"
                            className={container.status === 'running'
                              ? 'bg-green-500/10 text-green-400 border-green-500/30 ring-1 ring-green-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/30 ring-1 ring-red-500/20'
                            }
                          >
                            {container.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Animated background effect */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-gradient-to-r from-cyan-500/5 via-transparent to-blue-500/5 transition-opacity duration-500" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Container className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No containers found</p>
                  <p className="text-sm text-gray-500 mt-2">Make sure Docker is running and you have containers</p>
                </div>
              )}
            </div>

            {/* Logs Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Bug className="h-5 w-5 text-cyan-400" />
                    <div>
                      <p className="text-sm text-gray-400">Running Containers</p>
                      <p className="text-xl font-bold text-gray-100">
                        {containersWithLogs.filter(c => c.status === 'running').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-700/30 border-gray-600">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-cyan-400" />
                    <div>
                      <p className="text-sm text-gray-400">Total Logs</p>
                      <p className="text-xl font-bold text-gray-100">
                        {containersWithLogs.reduce((sum, c) => sum + (c.logsCount || 0), 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div>
                      <p className="text-sm text-red-400">Total Errors</p>
                      <p className="text-xl font-bold text-red-500">
                        {containersWithLogs.reduce((sum, c) => sum + (c.errorCount || 0), 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-yellow-500/10 border-yellow-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    <div>
                      <p className="text-sm text-yellow-400">Total Warnings (14d)</p>
                      <p className="text-xl font-bold text-yellow-500">
                        {containersWithLogs.reduce((sum, c) => sum + (c.warningCount || 0), 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gray-800 border-gray-700 text-white">
              <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-cyan-400" />
                        <span>Container Logs</span>
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        View log statistics and access detailed logs for each container
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2 ml-auto">
                      <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search containers..."
                          value={logsSearchTerm}
                          onChange={(e) => setLogsSearchTerm(e.target.value)}
                          className="pl-10 pr-4 py-1 w-64 bg-gray-800/50 border-gray-700 text-gray-100 placeholder-gray-400 text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all duration-200"
                        title="Date Range Filter"
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={logsLoading}
                        className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all duration-200"
                        onClick={fetchContainersWithLogs}
                      >
                        <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Containers Table */}
                {logsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                  <TableRow className="border-gray-700">
                        <TableHead className="text-gray-400 hover:bg-gray-700/30 transition-colors">Status</TableHead>
                        <TableHead className="text-gray-400 hover:bg-gray-700/30 transition-colors">Name</TableHead>
                        <TableHead className="text-gray-400 hover:bg-gray-700/30 transition-colors">Image</TableHead>
                        <TableHead className="text-gray-400 hover:bg-gray-700/30 transition-colors">Total Logs</TableHead>
                        <TableHead className="text-gray-400 hover:bg-gray-700/30 transition-colors">Errors</TableHead>
                        <TableHead className="text-gray-400 hover:bg-gray-700/30 transition-colors">Warnings</TableHead>
                        <TableHead className="text-gray-400 text-right hover:bg-gray-700/30 transition-colors">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContainersWithLogs
                        .sort((a, b) => {
                          // Sort running containers to the top
                          if (a.status === 'running' && b.status !== 'running') return -1
                          if (a.status !== 'running' && b.status === 'running') return 1
                          // Then sort by name alphabetically within each status group
                          return a.name.localeCompare(b.name)
                        })
                        .map((container) => (
                        <TableRow key={container.id} className="border-gray-700">
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(container.status)}`} />
                              <Badge variant={getStatusBadge(container.status)} className="text-xs">
                                {container.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-gray-100">
                            {container.name}
                          </TableCell>
                          <TableCell className="text-gray-400">
                            {container.image}
                          </TableCell>
                          <TableCell>
                            <span className="text-cyan-400 font-mono">
                              {container.logsCount || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={(container.errorCount || 0) > 0 ? 'destructive' : 'outline'} className="text-xs">
                              {container.errorCount || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={(container.warningCount || 0) > 0 ? 'secondary' : 'outline'} className="text-xs">
                              {container.warningCount || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedContainer(container)
                                setIsLogsModalOpen(true)
                              }}
                              title="View Detailed Logs"
                              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                            >
                              <Eye className="h-3 w-3 mr-2" />
                              View Logs
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {filteredContainersWithLogs.length === 0 && !logsLoading && (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-gray-500 mb-4" />
                    <p className="text-gray-400">No containers found</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {logsSearchTerm ? 'Try adjusting your search terms' : 'No containers available for log management'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="containers" className="space-y-4">
            {/* System Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-6">
              <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/60 border-slate-700/50 backdrop-blur-sm group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/20 hover:border-cyan-500/30 cursor-pointer relative overflow-hidden">
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-12 h-12 bg-cyan-500/10 rounded-full ring-1 ring-cyan-500/20 group-hover:ring-cyan-500/40 transition-all duration-300 group-hover:bg-cyan-500/20">
                      <Activity className="h-6 w-6 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors duration-300">System Status</p>
                      <p className="text-lg font-semibold text-white group-hover:text-cyan-300 transition-colors duration-300">All Systems Operational</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-xs text-green-400 group-hover:text-green-300 transition-colors duration-300">Healthy</span>
                      </div>
                    </div>
                  </div>
                </CardContent>

                {/* Card-specific bubble effects */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Large card bubbles */}
                  <div className="absolute -top-6 -right-6 w-40 h-40 bg-cyan-500/15 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0s', animationDuration: '4s' }} />
                  <div className="absolute top-1/4 left-1/3 w-24 h-24 bg-cyan-400/12 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s', animationDuration: '6s' }} />
                  <div className="absolute bottom-1/4 right-1/4 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }} />
                  <div className="absolute bottom-2 -left-4 w-32 h-32 bg-cyan-400/8 rounded-full blur-xl animate-pulse" style={{ animationDelay: '3s', animationDuration: '7s' }} />
                  {/* Floating particles */}
                  <div className="absolute top-6 right-8 w-2 h-2 bg-cyan-300/40 rounded-full animate-ping" style={{ animationDelay: '0.5s', animationDuration: '2s' }} />
                  <div className="absolute bottom-8 left-6 w-3 h-3 bg-cyan-300/40 rounded-full animate-ping" style={{ animationDelay: '1.5s', animationDuration: '2.5s' }} />
                  <div className="absolute top-1/2 left-4 w-2.5 h-2.5 bg-cyan-300/40 rounded-full animate-ping" style={{ animationDelay: '2.5s', animationDuration: '1.8s' }} />
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-slate-800/80 to-slate-900/60 border-slate-700/50 backdrop-blur-sm group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-500/30 cursor-pointer relative overflow-hidden">
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-500/10 rounded-full ring-1 ring-blue-500/20 group-hover:ring-blue-500/40 transition-all duration-300 group-hover:bg-blue-500/20">
                      <FileText className="h-6 w-6 text-blue-400 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors duration-300">Uptime</p>
                      <p className="text-lg font-semibold text-white group-hover:text-blue-300 transition-colors duration-300">3d 12h 45m</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                        <span className="text-xs text-blue-400 group-hover:text-blue-300 transition-colors duration-300">Since last restart</span>
                      </div>
                    </div>
                  </div>
                </CardContent>

                {/* Card-specific bubble effects */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Large card bubbles */}
                  <div className="absolute -top-6 -right-4 w-36 h-36 bg-blue-500/15 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s', animationDuration: '4.5s' }} />
                  <div className="absolute top-1/3 right-1/4 w-26 h-26 bg-blue-400/12 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1.2s', animationDuration: '6.5s' }} />
                  <div className="absolute bottom-1/3 right-1/4 w-30 h-30 bg-blue-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2.3s', animationDuration: '5.5s' }} />
                  <div className="absolute bottom-2 -left-2 w-25 h-25 bg-blue-400/8 rounded-full blur-xl animate-pulse" style={{ animationDelay: '3.5s', animationDuration: '7.5s' }} />
                  {/* Floating particles */}
                  <div className="absolute top-8 right-6 w-2.5 h-2.5 bg-blue-300/40 rounded-full animate-ping" style={{ animationDelay: '0.8s', animationDuration: '2.2s' }} />
                  <div className="absolute bottom-6 left-8 w-3 h-3 bg-blue-300/40 rounded-full animate-ping" style={{ animationDelay: '1.8s', animationDuration: '2.8s' }} />
                  <div className="absolute top-3/4 left-6 w-2 h-2 bg-blue-300/40 rounded-full animate-ping" style={{ animationDelay: '2.8s', animationDuration: '1.5s' }} />
                </div>
              </Card>
            </div>

            {/* System Dashboard - CPU, RAM, Traffic Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* CPU Usage */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-cyan-500/10 rounded-lg ring-1 ring-cyan-500/20">
                      <Activity className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-400">CPU Usage</p>
                      <p className="text-2xl font-bold text-white">{systemMetrics.cpuUsage}%</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 mb-1">Load Average</div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <span className="text-xs text-green-400 font-medium">{systemMetrics.loadAverage1}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <span className="text-xs text-green-400 font-medium">{systemMetrics.loadAverage5}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-slate-500">System load</div>
                  <div className="text-sm font-semibold text-cyan-400">Optimal</div>
                </div>
              </div>

              {/* RAM Usage */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-green-500/10 rounded-lg ring-1 ring-green-500/20">
                      <Bug className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-400">RAM Usage</p>
                      <p className="text-2xl font-bold text-white">{systemMetrics.ramUsed}GB</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 mb-1">Of {systemMetrics.ramTotal}GB</div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <span className="text-xs text-green-400 font-medium">{systemMetrics.ramUsagePercent}%</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <span className="text-xs text-green-400 font-medium">{systemMetrics.ramFree}GB free</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-slate-500">Memory usage</div>
                  <div className="text-sm font-semibold text-green-400">Good</div>
                </div>
              </div>

              {/* Network Traffic */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-blue-500/10 rounded-lg ring-1 ring-blue-500/20">
                      <TrendingUp className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-400">Network In</p>
                      <p className="text-2xl font-bold text-white">{systemMetrics.networkIn}MB/s</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 mb-1">Network Out</div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full" />
                        <span className="text-xs text-blue-400 font-medium">{systemMetrics.networkOut}MB/s</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full" />
                        <span className="text-xs text-blue-400 font-medium">{systemMetrics.networkTotal}MB/s total</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-slate-500">Network traffic</div>
                  <div className="text-sm font-semibold text-blue-400">Stable</div>
                </div>
              </div>

              {/* Disk Usage */}
              <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-purple-500/10 rounded-lg ring-1 ring-purple-500/20">
                      <Shield className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-400">Disk Usage</p>
                      <p className="text-2xl font-bold text-white">{systemMetrics.diskUsed}GB</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 mb-1">Of {systemMetrics.diskTotal}GB</div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full" />
                        <span className="text-xs text-purple-400 font-medium">{systemMetrics.diskUsagePercent}%</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full" />
                        <span className="text-xs text-purple-400 font-medium">{systemMetrics.diskFree}GB free</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-slate-500">Storage usage</div>
                  <div className="text-sm font-semibold text-purple-400">Healthy</div>
                </div>
              </div>
            </div>

            {/* Host Performance Graphs */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-6">Host Performance</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CPUUsageGraph />
                <RAMUsageGraph />
              </div>
            </div>

            {/* Container Performance Graphs */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-6">Container Performance</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ContainerCPUChart />
                <ContainerMemoryChart />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Note */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>EclipGuardX Enterprise Container Security Platform</p>
          <p className="mt-1">Real-time monitoring • Vulnerability detection • Threat prevention</p>
        </div>

        {/* Container Logs Modal */}
        <Dialog open={isLogsModalOpen} onOpenChange={setIsLogsModalOpen}>
          <DialogContent
            className="!max-w-none w-[80vw] h-[95vh] max-h-[85vh] bg-gray-900 border border-gray-800 rounded-2xl p-0 flex flex-col"
            showCloseButton={false}>
            <VisuallyHidden.Root>
              <DialogTitle>Container Logs</DialogTitle>
            </VisuallyHidden.Root>
            <div className="flex-1 overflow-hidden">
              {selectedContainer && (
                <ContainerLogViewer
                  containerId={selectedContainer.id}
                  containerName={selectedContainer.name}
                  onClose={() => setIsLogsModalOpen(false)}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
})

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Dashboard />
    </Suspense>
  )
}
