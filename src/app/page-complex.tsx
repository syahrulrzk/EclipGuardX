"use client"

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Activity, 
  AlertTriangle, 
  Container, 
  Shield, 
  TrendingUp,
  Settings,
  BarChart3,
  Search,
  Bell,
  Wifi,
  WifiOff,
  Play,
  Pause,
  Square,
  RefreshCw
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { toast } from 'sonner'

interface ContainerInfo {
  id: string
  containerId: string
  name: string
  image: string
  status: string
  ports?: string
  createdAt: string
  updatedAt: string
  metrics?: ContainerMetric[]
  _count: {
    alerts: number
    scans: number
  }
}

interface AlertInfo {
  id: string
  severity: string
  message: string
  source: string
  timestamp: string
  containerId?: string
  container?: {
    name: string
    containerId: string
  }
  resolved: boolean
}

interface ScanInfo {
  id: string
  containerId: string
  scanType: string
  status: string
  result?: string
  summary?: string
  duration?: number
  timestamp: string
  container?: {
    name: string
    containerId: string
    image: string
  }
}

interface ContainerMetric {
  id: string
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

interface DashboardData {
  containers: {
    total: number
    running: number
    stopped: number
  }
  alerts: {
    critical: number
    total: number
    recent: AlertInfo[]
  }
  scans: {
    recent: ScanInfo[]
    completed: number
    failed: number
  }
  metrics: ContainerMetric[]
  securityScore: number
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Simple test to see if React works
  const [test, setTest] = useState('test')
  
  console.log('Component rendering, test:', test)
  
  // Test useEffect
  useEffect(() => {
    console.log('Simple useEffect running!')
    setTest('updated')
  }, [])
  
  // Fetch initial data
  useEffect(() => {
    console.log('useEffect running - fetching data...')
    const fetchData = async () => {
      try {
        console.log('Starting data fetch...')
        setIsLoading(true)
        
        // Fetch dashboard data
        console.log('Fetching dashboard data...')
        const dashboardResponse = await fetch('/api/dashboard?hours=24')
        console.log('Dashboard response status:', dashboardResponse.status)
        if (!dashboardResponse.ok) {
          throw new Error(`Failed to fetch dashboard data: ${dashboardResponse.status}`)
        }
        const dashboardData = await dashboardResponse.json()
        console.log('Dashboard data received:', dashboardData)
        setDashboardData(dashboardData)
        
        console.log('Data fetch completed, setting isLoading to false')
        
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to fetch dashboard data')
      } finally {
        console.log('Finally block - setting isLoading to false')
        setIsLoading(false)
      }
    }

    fetchData()
  }, []) // Run once on mount

  // Set up real-time event listeners (disabled for now)
  useEffect(() => {
    // TODO: Re-enable socket connection when basic functionality is working
    console.log('Socket connection disabled for debugging')
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'stopped': return 'bg-red-500'
      case 'paused': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'destructive'
      case 'HIGH': return 'destructive'
      case 'MEDIUM': return 'secondary'
      case 'LOW': return 'outline'
      default: return 'outline'
    }
  }

  // Format metrics for charts
  const formatMetricsForChart = (metrics: ContainerMetric[] = []) => {
    if (!metrics || metrics.length === 0) {
      return []
    }
    return metrics.map(metric => ({
      timestamp: isClient ? new Date(metric.timestamp).toLocaleTimeString() : '',
      cpu: metric.cpuUsage,
      memory: metric.memUsage,
      networkIn: metric.netIn / 1024 / 1024, // Convert to MB
      networkOut: metric.netOut / 1024 / 1024, // Convert to MB
    }))
  }

  // Get safe dashboard data with defaults
  const getSafeDashboardData = (data: DashboardData | null) => {
    if (!data) {
      return {
        containers: { total: 0, running: 0, stopped: 0 },
        alerts: { critical: 0, total: 0, recent: [] },
        scans: { recent: [], completed: 0, failed: 0 },
        metrics: [],
        securityScore: 0
      }
    }
    return {
      containers: data.containers || { total: 0, running: 0, stopped: 0 },
      alerts: data.alerts || { critical: 0, total: 0, recent: [] },
      scans: data.scans || { recent: [], completed: 0, failed: 0 },
      metrics: data.metrics || [],
      securityScore: data.securityScore || 0
    }
  }

  const safeDashboardData = getSafeDashboardData(dashboardData)
  const chartData = formatMetricsForChart(safeDashboardData.metrics)
  
  // Debug logging
  console.log('Safe dashboard data:', safeDashboardData)
  console.log('Chart data:', chartData)
  console.log('Is loading:', isLoading)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-cyan-400" />
          <p className="text-gray-400">Loading EclipGuardX Dashboard...</p>
          <p className="text-sm text-gray-500 mt-2">Fetching security data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-cyan-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                EclipGuardX
              </h1>
            </div>
            <Badge variant="outline" className="text-xs">
              Container Security Dashboard
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <WifiOff className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-400">Socket Disabled</span>
            </div>
            <Button variant="outline" size="sm">
              <Bell className="h-4 w-4 mr-2" />
              Alerts ({safeDashboardData.alerts.critical})
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800/30 border-r border-gray-700 min-h-screen">
          <nav className="p-4 space-y-2">
            <Button variant="secondary" className="w-full justify-start">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
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
            <Button variant="ghost" className="w-full justify-start">
              <TrendingUp className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Activity className="h-4 w-4 mr-2" />
              Logs
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Total Containers</CardTitle>
                <Container className="h-4 w-4 text-cyan-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{safeDashboardData.containers.total}</div>
                <p className="text-xs text-gray-500">
                  {safeDashboardData.containers.running} running, {safeDashboardData.containers.stopped} stopped
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Running</CardTitle>
                <Activity className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">{safeDashboardData.containers.running}</div>
                <p className="text-xs text-gray-500">All systems operational</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Critical Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">{safeDashboardData.alerts.critical}</div>
                <p className="text-xs text-gray-500">Requires immediate attention</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Security Score</CardTitle>
                <Shield className="h-4 w-4 text-cyan-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-400">{safeDashboardData.securityScore}%</div>
                <p className="text-xs text-gray-500">
                  {safeDashboardData.securityScore >= 90 ? 'Excellent' : 
                   safeDashboardData.securityScore >= 70 ? 'Good' : 
                   safeDashboardData.securityScore >= 50 ? 'Fair' : 'Poor'} security posture
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* CPU & Memory Chart */}
            <div className="lg:col-span-2">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-100">Resource Usage</CardTitle>
                  <CardDescription className="text-gray-400">Real-time CPU and Memory consumption</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="cpu" className="space-y-4">
                    <TabsList className="bg-gray-700">
                      <TabsTrigger value="cpu">CPU Usage</TabsTrigger>
                      <TabsTrigger value="memory">Memory Usage</TabsTrigger>
                      <TabsTrigger value="network">Network I/O</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="cpu" className="space-y-4">
                      <ResponsiveContainer width="100%" height={200}>
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
                            dataKey="cpu" 
                            stroke="#06B6D4" 
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </TabsContent>
                    
                    <TabsContent value="memory" className="space-y-4">
                      <ResponsiveContainer width="100%" height={200}>
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
                      <ResponsiveContainer width="100%" height={200}>
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
            </div>

            {/* Recent Alerts */}
            <div>
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-100">Recent Alerts</CardTitle>
                  <CardDescription className="text-gray-400">Latest security and system alerts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                  {dashboardData?.alerts.recent?.map((alert) => (
                    <div key={alert.id} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-700/30">
                      <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                        {alert.severity}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {alert.message}
                        </p>
                        <p className="text-xs text-gray-400">
                          {alert.container?.name && `${alert.container.name} • `}
                          {isClient ? new Date(alert.timestamp).toLocaleString() : ''}
                        </p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-sm text-gray-500 text-center py-4">No recent alerts</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Container List */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100">Active Containers</CardTitle>
              <CardDescription className="text-gray-400">Monitor and manage your container fleet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {containers.map((container) => (
                  <div key={container.id} className="flex items-center justify-between p-4 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(container.status)}`} />
                      <div>
                        <h3 className="font-medium text-gray-100">{container.name}</h3>
                        <p className="text-sm text-gray-400">{container.image}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {container._count.alerts} alerts
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {container._count.scans} scans
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      {container.metrics && container.metrics.length > 0 && (
                        <>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">CPU</p>
                            <p className="font-medium text-cyan-400">
                              {container.metrics[0].cpuUsage.toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">Memory</p>
                            <p className="font-medium text-blue-400">
                              {container.metrics[0].memUsage.toFixed(1)}%
                            </p>
                          </div>
                        </>
                      )}
                      <div className="flex items-center space-x-2">
                        {container.status === 'running' ? (
                          <>
                            <Button size="sm" variant="outline">
                              <Pause className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Square className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline">
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <Search className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-gray-500 text-center py-4">No containers found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}