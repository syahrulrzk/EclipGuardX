"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3, 
  TrendingUp, 
  Download, 
  Calendar as CalendarIcon,
  RefreshCw,
  Filter,
  Activity,
  AlertTriangle,
  Shield,
  Clock,
  FileText,
  Database,
  Container
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { toast } from 'sonner'

interface AnalyticsData {
  metrics: ContainerMetric[]
  alerts: AlertInfo[]
  scans: ScanInfo[]
  summary: {
    totalContainers: number
    totalAlerts: number
    totalScans: number
    avgCpuUsage: number
    avgMemUsage: number
    securityScore: number
  }
}

interface ContainerMetric {
  id: string
  containerId: string
  cpuUsage: number
  memUsage: number
  netIn: number
  netOut: number
  timestamp: string
  container?: {
    name: string
    image: string
  }
}

interface AlertInfo {
  id: string
  severity: string
  message: string
  source: string
  timestamp: string
  container?: {
    name: string
  }
}

interface ScanInfo {
  id: string
  scanType: string
  status: string
  summary?: string
  duration?: number
  timestamp: string
  container?: {
    name: string
    image: string
  }
}

const timeRangeOptions = [
  { value: '1h', label: 'Last Hour', hours: 1 },
  { value: '24h', label: 'Last 24 Hours', hours: 24 },
  { value: '7d', label: 'Last 7 Days', hours: 168 },
  { value: '30d', label: 'Last 30 Days', hours: 720 },
  { value: 'custom', label: 'Custom Range', hours: null }
]

const COLORS = ['#06B6D4', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('24h')
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: undefined,
    to: undefined
  })
  const [showCalendar, setShowCalendar] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    fetchAnalyticsData()
  }, [timeRange, customDateRange])

  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true)
      
      // Calculate date range
      let from = new Date()
      let to = new Date()
      
      if (timeRange !== 'custom') {
        const option = timeRangeOptions.find(opt => opt.value === timeRange)
        if (option?.hours) {
          from.setHours(from.getHours() - option.hours)
        }
      } else {
        if (customDateRange.from) from = customDateRange.from
        if (customDateRange.to) to = customDateRange.to
      }

      // Fetch data from multiple endpoints
      const [metricsRes, alertsRes, scansRes] = await Promise.all([
        fetch(`/api/containers/metrics?from=${from.toISOString()}&to=${to.toISOString()}&limit=1000`),
        fetch(`/api/alerts?from=${from.toISOString()}&to=${to.toISOString()}&limit=1000`),
        fetch(`/api/scans?from=${from.toISOString()}&to=${to.toISOString()}&limit=1000`)
      ])

      const metrics = await metricsRes.json()
      const alerts = await alertsRes.json()
      const scans = await scansRes.json()

      // Calculate summary statistics
      const avgCpuUsage = metrics.length > 0 
        ? metrics.reduce((sum: number, m: ContainerMetric) => sum + m.cpuUsage, 0) / metrics.length 
        : 0
      const avgMemUsage = metrics.length > 0 
        ? metrics.reduce((sum: number, m: ContainerMetric) => sum + m.memUsage, 0) / metrics.length 
        : 0

      const securityScore = Math.max(0, Math.min(100, 
        100 - (alerts.filter((a: AlertInfo) => a.severity === 'CRITICAL').length * 10) - 
        (alerts.filter((a: AlertInfo) => a.severity === 'HIGH').length * 5)
      ))

      setAnalyticsData({
        metrics,
        alerts,
        scans,
        summary: {
          totalContainers: new Set(metrics.map((m: ContainerMetric) => m.containerId)).size,
          totalAlerts: alerts.length,
          totalScans: scans.length,
          avgCpuUsage,
          avgMemUsage,
          securityScore
        }
      })
    } catch (error) {
      console.error('Error fetching analytics data:', error)
      toast.error('Failed to fetch analytics data')
    } finally {
      setIsLoading(false)
    }
  }

  const formatMetricsForChart = (metrics: ContainerMetric[]) => {
    // Group metrics by hour and calculate averages
    const grouped = metrics.reduce((acc: any, metric) => {
      const hour = isClient ? new Date(metric.timestamp).getHours() : 0
      const key = `${hour}:00`
      
      if (!acc[key]) {
        acc[key] = {
          timestamp: key,
          cpu: [],
          memory: [],
          networkIn: [],
          networkOut: []
        }
      }
      
      acc[key].cpu.push(metric.cpuUsage)
      acc[key].memory.push(metric.memUsage)
      acc[key].networkIn.push(metric.netIn / 1024 / 1024) // Convert to MB
      acc[key].networkOut.push(metric.netOut / 1024 / 1024) // Convert to MB
      
      return acc
    }, {})

    return Object.values(grouped).map((group: any) => ({
      timestamp: group.timestamp,
      cpu: group.cpu.reduce((a: number, b: number) => a + b, 0) / group.cpu.length,
      memory: group.memory.reduce((a: number, b: number) => a + b, 0) / group.memory.length,
      networkIn: group.networkIn.reduce((a: number, b: number) => a + b, 0) / group.networkIn.length,
      networkOut: group.networkOut.reduce((a: number, b: number) => a + b, 0) / group.networkOut.length
    }))
  }

  const getAlertSeverityData = (alerts: AlertInfo[]) => {
    const severityCounts = alerts.reduce((acc: any, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1
      return acc
    }, {})

    return Object.entries(severityCounts).map(([severity, count]) => ({
      name: severity,
      value: count as number
    }))
  }

  const getScanTypeData = (scans: ScanInfo[]) => {
    const typeCounts = scans.reduce((acc: any, scan) => {
      acc[scan.scanType] = (acc[scan.scanType] || 0) + 1
      return acc
    }, {})

    return Object.entries(typeCounts).map(([type, count]) => ({
      name: type,
      value: count as number
    }))
  }

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast.error('No data to export')
      return
    }

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    if (isClient) {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    }
    
    toast.success(`Data exported to ${filename}.csv`)
  }

  const exportReport = () => {
    if (!analyticsData) return

    // Create comprehensive report data
    const reportData = {
      summary: analyticsData.summary,
      timeRange: timeRangeOptions.find(opt => opt.value === timeRange)?.label || 'Custom Range',
      generatedAt: isClient ? new Date().toISOString() : '',
      metrics: analyticsData.metrics.map(m => ({
        timestamp: m.timestamp,
        container: m.container?.name || 'Unknown',
        cpuUsage: m.cpuUsage,
        memUsage: m.memUsage,
        networkInMB: m.netIn / 1024 / 1024,
        networkOutMB: m.netOut / 1024 / 1024
      })),
      alerts: analyticsData.alerts.map(a => ({
        timestamp: a.timestamp,
        severity: a.severity,
        source: a.source,
        container: a.container?.name || 'Unknown',
        message: a.message
      })),
      scans: analyticsData.scans.map(s => ({
        timestamp: s.timestamp,
        scanType: s.scanType,
        status: s.status,
        duration: s.duration,
        container: s.container?.name || 'Unknown',
        summary: s.summary
      }))
    }

    exportToCSV([reportData], `eclipguardx-analytics-${timeRange}-${isClient ? new Date().toISOString().split('T')[0] : ''}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-cyan-400" />
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400">No analytics data available</p>
        </div>
      </div>
    )
  }

  const chartData = formatMetricsForChart(analyticsData.metrics)
  const alertSeverityData = getAlertSeverityData(analyticsData.alerts)
  const scanTypeData = getScanTypeData(analyticsData.scans)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-cyan-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Analytics & Reports
              </h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={exportReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAnalyticsData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800/30 border-r border-gray-700 min-h-screen">
          <nav className="p-4 space-y-2">
            <Button variant="ghost" className="w-full justify-start">
              <Container className="h-4 w-4 mr-2" />
              Containers
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Shield className="h-4 w-4 mr-2" />
              Security Scans
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts
            </Button>
            <Button variant="secondary" className="w-full justify-start">
              <TrendingUp className="h-4 w-4 mr-2" />
              Analytics
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Time Range Selector */}
          <Card className="bg-gray-800/50 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-gray-100 flex items-center space-x-2">
                <Filter className="h-5 w-5" />
                <span>Time Range Filter</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-100 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeRangeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {timeRange === 'custom' && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={() => setShowCalendar(!showCalendar)}
                      className="bg-gray-800/50 border-gray-700 text-gray-100"
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {customDateRange.from && customDateRange.to
                        ? `${isClient ? customDateRange.from.toLocaleDateString() : ''} - ${isClient ? customDateRange.to.toLocaleDateString() : ''}`
                        : 'Select date range'
                      }
                    </Button>
                    
                    {showCalendar && (
                      <div className="absolute top-full left-0 mt-2 z-50 bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-400 mb-2">From</p>
                            <Calendar
                              mode="single"
                              selected={customDateRange.from}
                              onSelect={(date) => setCustomDateRange(prev => ({ ...prev, from: date }))}
                              className="bg-gray-800 text-gray-100"
                            />
                          </div>
                          <div>
                            <p className="text-sm text-gray-400 mb-2">To</p>
                            <Calendar
                              mode="single"
                              selected={customDateRange.to}
                              onSelect={(date) => setCustomDateRange(prev => ({ ...prev, to: date }))}
                              className="bg-gray-800 text-gray-100"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end mt-4">
                          <Button size="sm" onClick={() => setShowCalendar(false)}>
                            Apply
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-4 ml-auto">
                  <Badge variant="outline" className="text-sm">
                    {analyticsData.summary.totalContainers} containers
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    {analyticsData.metrics.length} data points
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Avg CPU Usage</CardTitle>
                <Activity className="h-4 w-4 text-cyan-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-400">
                  {analyticsData.summary.avgCpuUsage.toFixed(1)}%
                </div>
                <p className="text-xs text-gray-500">Across all containers</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Avg Memory Usage</CardTitle>
                <Database className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">
                  {analyticsData.summary.avgMemUsage.toFixed(1)}%
                </div>
                <p className="text-xs text-gray-500">Across all containers</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Total Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">
                  {analyticsData.summary.totalAlerts}
                </div>
                <p className="text-xs text-gray-500">In selected time range</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Security Score</CardTitle>
                <Shield className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  {analyticsData.summary.securityScore}%
                </div>
                <p className="text-xs text-gray-500">Based on alerts & scans</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Resource Usage Over Time */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-100">Resource Usage Over Time</CardTitle>
                <CardDescription className="text-gray-400">Average CPU and Memory usage trends</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="cpu" className="space-y-4">
                  <TabsList className="bg-gray-700">
                    <TabsTrigger value="cpu">CPU Usage</TabsTrigger>
                    <TabsTrigger value="memory">Memory Usage</TabsTrigger>
                    <TabsTrigger value="network">Network I/O</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="cpu" className="space-y-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="timestamp" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151' }}
                          labelStyle={{ color: '#F9FAFB' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="cpu" 
                          stroke="#06B6D4" 
                          fill="url(#colorCpu)"
                          strokeWidth={2}
                        />
                        <defs>
                          <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </TabsContent>
                  
                  <TabsContent value="memory" className="space-y-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="timestamp" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151' }}
                          labelStyle={{ color: '#F9FAFB' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="memory" 
                          stroke="#3B82F6" 
                          fill="url(#colorMemory)"
                          strokeWidth={2}
                        />
                        <defs>
                          <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </TabsContent>

                  <TabsContent value="network" className="space-y-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="timestamp" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151' }}
                          labelStyle={{ color: '#F9FAFB' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="networkIn" 
                          stroke="#10B981" 
                          strokeWidth={2}
                          dot={false}
                          name="Network In (MB)"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="networkOut" 
                          stroke="#F59E0B" 
                          strokeWidth={2}
                          dot={false}
                          name="Network Out (MB)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Alert Distribution */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-100">Alert Distribution</CardTitle>
                <CardDescription className="text-gray-400">Breakdown by severity and source</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="severity" className="space-y-4">
                  <TabsList className="bg-gray-700">
                    <TabsTrigger value="severity">By Severity</TabsTrigger>
                    <TabsTrigger value="type">Scan Types</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="severity" className="space-y-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={alertSeverityData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {alertSeverityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151' }}
                          labelStyle={{ color: '#F9FAFB' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </TabsContent>
                  
                  <TabsContent value="type" className="space-y-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={scanTypeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151' }}
                          labelStyle={{ color: '#F9FAFB' }}
                        />
                        <Bar dataKey="value" fill="#06B6D4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Data Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Alerts */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-gray-100">Recent Alerts</CardTitle>
                    <CardDescription className="text-gray-400">Latest security alerts</CardDescription>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => exportToCSV(analyticsData.alerts, 'alerts')}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {analyticsData.alerts.slice(0, 10).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant={
                            alert.severity === 'CRITICAL' || alert.severity === 'HIGH' 
                              ? 'destructive' 
                              : 'secondary'
                          } className="text-xs">
                            {alert.severity}
                          </Badge>
                          <span className="text-xs text-gray-400">{alert.source}</span>
                        </div>
                        <p className="text-sm text-gray-100 truncate">{alert.message}</p>
                        <p className="text-xs text-gray-500">
                          {alert.container?.name} • {isClient ? new Date(alert.timestamp).toLocaleString() : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Scans */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-gray-100">Recent Scans</CardTitle>
                    <CardDescription className="text-gray-400">Latest security scans</CardDescription>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => exportToCSV(analyticsData.scans, 'scans')}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {analyticsData.scans.slice(0, 10).map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant={
                            scan.status === 'completed' ? 'default' :
                            scan.status === 'failed' ? 'destructive' : 'secondary'
                          } className="text-xs">
                            {scan.status}
                          </Badge>
                          <span className="text-xs text-gray-400 capitalize">{scan.scanType}</span>
                          {scan.duration && (
                            <span className="text-xs text-gray-400">
                              {(scan.duration / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-100">{scan.summary || 'No summary'}</p>
                        <p className="text-xs text-gray-500">
                          {scan.container?.name} • {isClient ? new Date(scan.timestamp).toLocaleString() : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}