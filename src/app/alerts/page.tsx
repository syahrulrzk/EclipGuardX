"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { 
  AlertTriangle, 
  Search, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Download,
  Eye,
  Container,
  Shield,
  Settings,
  Bell,
  Trash2,
  RotateCcw
} from 'lucide-react'
import { toast } from 'sonner'

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
    image: string
  }
  resolved: boolean
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAlert, setSelectedAlert] = useState<AlertInfo | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/alerts')
      const data = await response.json()
      setAlerts(data)
    } catch (error) {
      console.error('Error fetching alerts:', error)
      toast.error('Failed to fetch alerts')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAlertAction = async (alertId: string, action: 'resolve' | 'reopen') => {
    try {
      const response = await fetch('/api/alerts/manage', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alertId,
          action
        })
      })

      if (response.ok) {
        const updatedAlert = await response.json()
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? updatedAlert : alert
        ))
        toast.success(`Alert ${action}d successfully`)
      } else {
        throw new Error('Failed to update alert')
      }
    } catch (error) {
      console.error(`Error ${action}ing alert:`, error)
      toast.error(`Failed to ${action} alert`)
    }
  }

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/manage?alertId=${alertId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId))
        toast.success('Alert deleted successfully')
      } else {
        throw new Error('Failed to delete alert')
      }
    } catch (error) {
      console.error('Error deleting alert:', error)
      toast.error('Failed to delete alert')
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <AlertTriangle className="h-4 w-4 text-red-400" />
      case 'HIGH': return <AlertTriangle className="h-4 w-4 text-orange-400" />
      case 'MEDIUM': return <AlertTriangle className="h-4 w-4 text-yellow-400" />
      case 'LOW': return <AlertTriangle className="h-4 w-4 text-blue-400" />
      default: return <AlertTriangle className="h-4 w-4 text-gray-400" />
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

  const getStatusIcon = (resolved: boolean) => {
    return resolved ? 
      <CheckCircle className="h-4 w-4 text-green-400" /> : 
      <XCircle className="h-4 w-4 text-red-400" />
  }

  const getStatusBadge = (resolved: boolean) => {
    return resolved ? 'default' : 'destructive'
  }

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.container?.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'resolved' && alert.resolved) ||
                         (statusFilter === 'unresolved' && !alert.resolved)
    const matchesSource = sourceFilter === 'all' || alert.source === sourceFilter
    
    return matchesSearch && matchesSeverity && matchesStatus && matchesSource
  })

  const exportToCSV = () => {
    if (filteredAlerts.length === 0) {
      toast.error('No data to export')
      return
    }

    const headers = ['Timestamp', 'Severity', 'Source', 'Container', 'Message', 'Status']
    const csvContent = [
      headers.join(','),
      ...filteredAlerts.map(alert => [
        alert.timestamp,
        alert.severity,
        alert.source,
        alert.container?.name || 'Unknown',
        `"${alert.message.replace(/"/g, '""')}"`,
        alert.resolved ? 'Resolved' : 'Unresolved'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    if (isClient) {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eclipguardx-alerts-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    }
    
    toast.success('Alerts exported successfully')
  }

  const getUniqueSources = () => {
    const sources = [...new Set(alerts.map(alert => alert.source))]
    return sources.sort()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-cyan-400" />
          <p className="text-gray-400">Loading alerts...</p>
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
              <AlertTriangle className="h-8 w-8 text-cyan-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Alert Management
              </h1>
            </div>
            <Badge variant="outline" className="text-xs">
              Security Alert Center
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAlerts}>
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
            <Button variant="secondary" className="w-full justify-start">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Bell className="h-4 w-4 mr-2" />
              Analytics
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Total Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-cyan-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{alerts.length}</div>
                <p className="text-xs text-gray-500">All time alerts</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Unresolved</CardTitle>
                <XCircle className="h-4 w-4 text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">
                  {alerts.filter(a => !a.resolved).length}
                </div>
                <p className="text-xs text-gray-500">Requires attention</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Critical</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">
                  {alerts.filter(a => a.severity === 'CRITICAL' && !a.resolved).length}
                </div>
                <p className="text-xs text-gray-500">High priority</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Resolved</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  {alerts.filter(a => a.resolved).length}
                </div>
                <p className="text-xs text-gray-500">Handled alerts</p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search alerts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800/50 border-gray-700 text-gray-100 placeholder-gray-400 w-64"
                />
              </div>
              
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-100 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-100 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unresolved">Unresolved</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-100 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {getUniqueSources().map(source => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Badge variant="outline" className="text-sm">
              {filteredAlerts.length} alerts
            </Badge>
          </div>

          {/* Alerts Table */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100">Security Alerts</CardTitle>
              <CardDescription className="text-gray-400">
                Monitor and manage security alerts across your containers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Severity</TableHead>
                    <TableHead className="text-gray-400">Source</TableHead>
                    <TableHead className="text-gray-400">Container</TableHead>
                    <TableHead className="text-gray-400">Message</TableHead>
                    <TableHead className="text-gray-400">Timestamp</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.map((alert) => (
                    <TableRow key={alert.id} className="border-gray-700 hover:bg-gray-700/30">
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(alert.resolved)}
                          <Badge variant={getStatusBadge(alert.resolved)} className="text-xs">
                            {alert.resolved ? 'Resolved' : 'Unresolved'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getSeverityIcon(alert.severity)}
                          <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                            {alert.severity}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {alert.source}
                      </TableCell>
                      <TableCell className="font-medium text-gray-100">
                        {alert.container?.name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-gray-400 max-w-xs truncate">
                        {alert.message}
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {isClient ? new Date(alert.timestamp).toLocaleString() : ''}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Eye className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-gray-800 border-gray-700 text-gray-100">
                              <DialogHeader>
                                <DialogTitle className="flex items-center space-x-2">
                                  {getSeverityIcon(alert.severity)}
                                  <span>{alert.severity} Alert Details</span>
                                </DialogTitle>
                                <DialogDescription className="text-gray-400">
                                  Full alert information and context
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm text-gray-400">Message</p>
                                  <p className="text-gray-100">{alert.message}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-400">Source</p>
                                    <p className="text-gray-100">{alert.source}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-400">Severity</p>
                                    <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                                      {alert.severity}
                                    </Badge>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-400">Container</p>
                                    <p className="text-gray-100">{alert.container?.name || 'Unknown'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-400">Status</p>
                                    <Badge variant={getStatusBadge(alert.resolved)} className="text-xs">
                                      {alert.resolved ? 'Resolved' : 'Unresolved'}
                                    </Badge>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-400">Timestamp</p>
                                  <p className="text-gray-100">
                                    {isClient ? new Date(alert.timestamp).toLocaleString() : ''}
                                  </p>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          {!alert.resolved ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAlertAction(alert.id, 'resolve')}
                              title="Resolve alert"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAlertAction(alert.id, 'reopen')}
                              title="Reopen alert"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" title="Delete alert">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-gray-800 border-gray-700 text-gray-100">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Alert</AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-400">
                                  Are you sure you want to delete this alert? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-gray-700 border-gray-600 text-gray-100 hover:bg-gray-600">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction 
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={() => handleDeleteAlert(alert.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredAlerts.length === 0 && (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-400">No alerts found</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {searchTerm || severityFilter !== 'all' || statusFilter !== 'all' || sourceFilter !== 'all' 
                      ? 'Try adjusting your filters' 
                      : 'Great! No security alerts detected'
                    }
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}