"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  FileText, 
  Download, 
  RefreshCw,
  Shield,
  CheckCircle,
  AlertTriangle,
  Activity,
  BarChart3,
  Clock,
  Calendar,
  Database,
  Container,
  TrendingUp,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'

interface ReportData {
  reportType: string
  timeRange: string
  generatedAt: string
  period: {
    from: string
    to: string
  }
  summary: any
  [key: string]: any
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [reportType, setReportType] = useState('security')
  const [timeRange, setTimeRange] = useState('24h')
  const [format, setFormat] = useState('json')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const generateReport = async () => {
    try {
      setIsGenerating(true)
      
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType,
          timeRange,
          format
        })
      })

      if (response.ok) {
        if (format === 'csv') {
          // Handle CSV download
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'report.csv'
          a.click()
          window.URL.revokeObjectURL(url)
          toast.success('Report downloaded successfully')
        } else {
          const data = await response.json()
          setReportData(data)
          toast.success('Report generated successfully')
        }
      } else {
        throw new Error('Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadReport = () => {
    if (!reportData) return

    const dataStr = JSON.stringify(reportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    
    if (isClient) {
      const url = window.URL.createObjectURL(dataBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eclipguardx-${reportType}-report-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      window.URL.revokeObjectURL(url)
    }
    
    toast.success('Report downloaded successfully')
  }

  const reportTypes = [
    {
      value: 'security',
      label: 'Security Summary',
      description: 'Comprehensive security overview with alerts, scans, and compliance status',
      icon: Shield
    },
    {
      value: 'compliance',
      label: 'Compliance Report',
      description: 'Detailed compliance analysis and regulatory adherence status',
      icon: CheckCircle
    },
    {
      value: 'performance',
      label: 'Performance Report',
      description: 'Container performance metrics and resource utilization analysis',
      icon: Activity
    }
  ]

  const timeRanges = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ]

  const formats = [
    { value: 'json', label: 'JSON' },
    { value: 'csv', label: 'CSV' }
  ]

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'security': return Shield
      case 'compliance': return CheckCircle
      case 'performance': return Activity
      default: return FileText
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-cyan-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Security Reports
              </h1>
            </div>
            <Badge variant="outline" className="text-xs">
              Generate and download comprehensive security reports
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            {reportData && (
              <Button variant="outline" size="sm" onClick={downloadReport}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={generateReport} disabled={isGenerating}>
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              {isGenerating ? 'Generating...' : 'Generate Report'}
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
            <Button variant="ghost" className="w-full justify-start">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Button variant="secondary" className="w-full justify-start">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Report Configuration */}
          <Card className="bg-gray-800/50 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-gray-100">Report Configuration</CardTitle>
              <CardDescription className="text-gray-400">
                Configure your security report parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Report Type</label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {reportTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center space-x-2">
                            <type.icon className="h-4 w-4" />
                            <span>{type.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {reportTypes.find(t => t.value === reportType)?.description}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Time Range</label>
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeRanges.map(range => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Format</label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formats.map(fmt => (
                        <SelectItem key={fmt.value} value={fmt.value}>
                          {fmt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report Results */}
          {reportData && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-100 flex items-center space-x-2">
                  {(() => {
                    const Icon = getReportIcon(reportData.reportType.toLowerCase())
                    return <Icon className="h-5 w-5" />
                  })()}
                  <span>{reportData.reportType}</span>
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Generated on {isClient ? new Date(reportData.generatedAt).toLocaleString() : ''} 
                  for {timeRanges.find(r => r.value === timeRange)?.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="summary" className="space-y-4">
                  <TabsList className="bg-gray-700">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="raw">Raw Data</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {Object.entries(reportData.summary).map(([key, value]: [string, any]) => {
                        if (typeof value === 'number') {
                          let icon = Database
                          let color = 'text-cyan-400'
                          
                          if (key.includes('score') || key.includes('rate')) {
                            icon = TrendingUp
                            color = value >= 80 ? 'text-green-400' : value >= 60 ? 'text-yellow-400' : 'text-red-400'
                          } else if (key.includes('alert') || key.includes('issue')) {
                            icon = AlertTriangle
                            color = value > 0 ? 'text-red-400' : 'text-green-400'
                          } else if (key.includes('scan') || key.includes('container')) {
                            icon = Container
                            color = 'text-blue-400'
                          }

                          return (
                            <Card key={key} className="bg-gray-700/30 border-gray-600">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-gray-400">
                                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                </CardTitle>
                                <icon className={`h-4 w-4 ${color}`} />
                              </CardHeader>
                              <CardContent>
                                <div className={`text-2xl font-bold ${color}`}>
                                  {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(1) : value}
                                </div>
                                {key.includes('score') && (
                                  <Progress value={value} className="mt-2" />
                                )}
                              </CardContent>
                            </Card>
                          )
                        }
                        return null
                      })}
                    </div>

                    {/* Key Metrics */}
                    <Card className="bg-gray-700/30 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-gray-100">Key Insights</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {reportType === 'security' && (
                            <>
                              <div className="flex items-center space-x-3">
                                <Shield className="h-5 w-5 text-cyan-400" />
                                <div>
                                  <p className="text-sm text-gray-400">Security Posture</p>
                                  <p className="font-medium text-gray-100">
                                    {reportData.summary.securityScore >= 90 ? 'Excellent' : 
                                     reportData.summary.securityScore >= 70 ? 'Good' : 
                                     reportData.summary.securityScore >= 50 ? 'Fair' : 'Poor'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <AlertTriangle className="h-5 w-5 text-red-400" />
                                <div>
                                  <p className="text-sm text-gray-400">Critical Issues</p>
                                  <p className="font-medium text-gray-100">
                                    {reportData.summary.criticalAlerts} unresolved
                                  </p>
                                </div>
                              </div>
                            </>
                          )}
                          {reportType === 'compliance' && (
                            <>
                              <div className="flex items-center space-x-3">
                                <CheckCircle className="h-5 w-5 text-green-400" />
                                <div>
                                  <p className="text-sm text-gray-400">Compliance Rate</p>
                                  <p className="font-medium text-gray-100">
                                    {reportData.summary.complianceRate}%
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <AlertTriangle className="h-5 w-5 text-red-400" />
                                <div>
                                  <p className="text-sm text-gray-400">Non-Compliant</p>
                                  <p className="font-medium text-gray-100">
                                    {reportData.summary.nonCompliantContainers} containers
                                  </p>
                                </div>
                              </div>
                            </>
                          )}
                          {reportType === 'performance' && (
                            <>
                              <div className="flex items-center space-x-3">
                                <Activity className="h-5 w-5 text-blue-400" />
                                <div>
                                  <p className="text-sm text-gray-400">Average CPU Usage</p>
                                  <p className="font-medium text-gray-100">
                                    {reportData.summary.avgCpuUsage.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <Database className="h-5 w-5 text-purple-400" />
                                <div>
                                  <p className="text-sm text-gray-400">Average Memory Usage</p>
                                  <p className="font-medium text-gray-100">
                                    {reportData.summary.avgMemoryUsage.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="details" className="space-y-6">
                    {reportType === 'security' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Recent Alerts */}
                        <Card className="bg-gray-700/30 border-gray-600">
                          <CardHeader>
                            <CardTitle className="text-gray-100">Recent Alerts</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {reportData.alerts?.slice(0, 10).map((alert: any) => (
                                <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <AlertTriangle className={`h-4 w-4 ${
                                      alert.severity === 'CRITICAL' ? 'text-red-400' :
                                      alert.severity === 'HIGH' ? 'text-orange-400' :
                                      alert.severity === 'MEDIUM' ? 'text-yellow-400' : 'text-blue-400'
                                    }`} />
                                    <div>
                                      <p className="text-sm font-medium text-gray-100">{alert.message}</p>
                                      <p className="text-xs text-gray-400">{alert.container}</p>
                                    </div>
                                  </div>
                                  <Badge variant={alert.resolved ? 'default' : 'destructive'} className="text-xs">
                                    {alert.resolved ? 'Resolved' : 'Unresolved'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Recent Scans */}
                        <Card className="bg-gray-700/30 border-gray-600">
                          <CardHeader>
                            <CardTitle className="text-gray-100">Recent Scans</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {reportData.scans?.slice(0, 10).map((scan: any) => (
                                <div key={scan.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <Shield className={`h-4 w-4 ${
                                      scan.status === 'completed' ? 'text-green-400' :
                                      scan.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                                    }`} />
                                    <div>
                                      <p className="text-sm font-medium text-gray-100">{scan.scanType}</p>
                                      <p className="text-xs text-gray-400">{scan.container}</p>
                                    </div>
                                  </div>
                                  <Badge variant={
                                    scan.status === 'completed' ? 'default' :
                                    scan.status === 'failed' ? 'destructive' : 'secondary'
                                  } className="text-xs">
                                    {scan.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {reportType === 'compliance' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Compliance Issues */}
                        <Card className="bg-gray-700/30 border-gray-600">
                          <CardHeader>
                            <CardTitle className="text-gray-100">Compliance Issues</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {reportData.complianceIssues?.map((issue: any, index: number) => (
                                <div key={index} className="p-3 bg-gray-800/50 rounded-lg">
                                  <p className="text-sm font-medium text-gray-100 mb-2">{issue.container}</p>
                                  <div className="space-y-1">
                                    {issue.issues.map((issueText: string, idx: number) => (
                                      <div key={idx} className="flex items-center space-x-2">
                                        <AlertTriangle className="h-3 w-3 text-red-400" />
                                        <p className="text-xs text-gray-400">{issueText}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Compliant Containers */}
                        <Card className="bg-gray-700/30 border-gray-600">
                          <CardHeader>
                            <CardTitle className="text-gray-100">Compliant Containers</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {reportData.compliantContainers?.map((container: string, index: number) => (
                                <div key={index} className="flex items-center space-x-2 p-2 bg-gray-800/50 rounded-lg">
                                  <CheckCircle className="h-4 w-4 text-green-400" />
                                  <p className="text-sm text-gray-100">{container}</p>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {reportType === 'performance' && (
                      <Card className="bg-gray-700/30 border-gray-600">
                        <CardHeader>
                          <CardTitle className="text-gray-100">Container Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {reportData.containerPerformance?.map((perf: any, index: number) => (
                              <div key={index} className="p-4 bg-gray-800/50 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-medium text-gray-100">{perf.container}</p>
                                  <Badge variant="outline" className="text-xs">
                                    {perf.dataPoints} data points
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-gray-400">CPU Usage</p>
                                    <p className="text-gray-100">Avg: {perf.avgCpu.toFixed(1)}% | Max: {perf.maxCpu.toFixed(1)}%</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400">Memory Usage</p>
                                    <p className="text-gray-100">Avg: {perf.avgMemory.toFixed(1)}% | Max: {perf.maxMemory.toFixed(1)}%</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400">Network In</p>
                                    <p className="text-gray-100">{formatBytes(perf.totalNetworkIn)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400">Network Out</p>
                                    <p className="text-gray-100">{formatBytes(perf.totalNetworkOut)}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="raw" className="space-y-4">
                    <Card className="bg-gray-700/30 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-gray-100">Raw Report Data</CardTitle>
                        <CardDescription className="text-gray-400">
                          Complete report data in JSON format
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-300 max-h-96">
                          {JSON.stringify(reportData, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {!reportData && (
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-400 mb-2">No report generated yet</p>
                  <p className="text-sm text-gray-500 mb-4">
                    Configure your report parameters and click "Generate Report" to create a comprehensive security report
                  </p>
                  <Button onClick={generateReport} disabled={isGenerating}>
                    {isGenerating ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Generate First Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}