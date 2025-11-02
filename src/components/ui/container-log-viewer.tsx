"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  FileText,
  RefreshCw,
  Download,
  Filter,
  Search,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Calendar as CalendarIcon
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ContainerLogViewerProps {
  containerId: string
  containerName: string
  onClose?: () => void
}

interface LogEntry {
  id: string
  level: string
  message: string
  timestamp: string
  source?: string
}

interface LogStats {
  ERROR?: number
  WARN?: number
  INFO?: number
  DEBUG?: number
}

interface DateSummary {
  count: number
  sizeMB: number
}

interface LogResponse {
  container: {
    id: string
    name: string
    dockerId: string
  }
  logs: LogEntry[]
  stats: LogStats
  total: number
  limit: number
  filters: {
    logLevel: string
    source: string
    since: string | null
  }
  dateSummaries?: Record<string, DateSummary>
  fetchedAt: string
}

export function ContainerLogViewer({ containerId, containerName, onClose }: ContainerLogViewerProps) {
  const router = useRouter()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<LogStats>({})
  const [dateSummaries, setDateSummaries] = useState<Record<string, DateSummary> | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [isCollecting, setIsCollecting] = useState(false)
  const [logLevel, setLogLevel] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [limit, setLimit] = useState(500)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [containerId, logLevel, limit, selectedDate])

  const fetchLogs = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      if (logLevel !== 'all') {
        params.set('logLevel', logLevel)
      }
      if (selectedDate) {
        params.set('date', selectedDate.toISOString().split('T')[0])
      }

      const response = await fetch(`/api/containers/${containerId}/logs?${params.toString()}`)
      const data = await response.json()

      if (response.ok) {
        setLogs(data.logs || [])
        setStats(data.stats || {})
        if (initialLoad && data.logs.length === 0) {
          collectLogs()
        }
      } else {
        toast.error(data.error || 'Failed to fetch logs')
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
      toast.error('Failed to fetch logs')
    } finally {
      setIsLoading(false)
      setInitialLoad(false)
    }
  }

  const collectLogs = async () => {
    try {
      setIsCollecting(true)
      toast.info('Collecting logs from Docker...')

      const response = await fetch(`/api/containers/${containerId}/logs/collect`, {
        method: 'POST'
      })
      const data = await response.json()

      if (response.ok) {
        toast.success(`Collected ${data.logsCollected} logs from last 14 days`)
        // Refresh the logs display
        await fetchLogs()
      } else {
        toast.error(data.error || 'Failed to collect logs')
      }
    } catch (error) {
      console.error('Error collecting logs:', error)
      toast.error('Failed to collect logs')
    } finally {
      setIsCollecting(false)
    }
  }

  const exportLogs = () => {
    const filteredLogs = logs.filter(log =>
      searchTerm === '' || log.message.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const csvContent = [
      ['Timestamp', 'Level', 'Source', 'Message'].join(','),
      ...filteredLogs.map(log =>
        [
          log.timestamp,
          log.level,
          log.source || 'stdout',
          `"${log.message.replace(/"/g, '""')}"`
        ].join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${containerName}-logs-${new Date().toISOString()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('Logs exported successfully')
  }

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'WARN':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'DEBUG':
        return <Bug className="h-4 w-4 text-purple-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'WARN':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'DEBUG':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    }
  }

  const filteredLogs = logs.filter(log =>
    searchTerm === '' || log.message.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-gray-100 flex items-center space-x-2">
              <FileText className="h-5 w-5 text-cyan-400" />
              <span>Container Logs - {containerName}</span>
            </CardTitle>
            <CardDescription className="text-gray-400 mt-2">
              Displaying logs.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={collectLogs}
              disabled={isCollecting}
              className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white"
            >
              {isCollecting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Collect Logs
            </Button>
            {onClose && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white h-8 w-8 p-0"
                title="Close Modal"
              >
                ×
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statistics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-700/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Total Logs</p>
            <p className="text-2xl font-bold text-gray-100">{logs.length}</p>
          </div>
          <div className="bg-gray-700/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Errors</p>
            <p className="text-2xl font-bold text-red-500">{stats.ERROR || 0}</p>
          </div>
          <div className="bg-gray-700/30 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Warnings</p>
            <p className="text-2xl font-bold text-yellow-500">{stats.WARN || 0}</p>
          </div>
          <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
            <p className="text-sm text-blue-400">Info</p>
            <p className="text-2xl font-bold text-blue-500">{stats.INFO || 0}</p>
          </div>
        </div>

        {/* Date Summaries */}
        {dateSummaries && Object.keys(dateSummaries).length > 0 && (
          <div>
            <h3 className="text-gray-100 font-semibold mb-2">Log Size by Date</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(dateSummaries).sort(([a], [b]) => b.localeCompare(a)).map(([date, summary]) => (
                <div key={date} className="bg-gray-700/30 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-400">{new Date(date).toLocaleDateString()}</span>
                    <Badge variant="outline" className="text-xs">{summary.count} logs</Badge>
                  </div>
                  <p className="text-lg font-bold text-gray-100">{summary.sizeMB} MB</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800/50 border-gray-700 text-gray-100 placeholder-gray-400"
            />
          </div>
          <Select value={logLevel} onValueChange={setLogLevel}>
            <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Log Level" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="all" className="text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white">All Levels</SelectItem>
              <SelectItem value="ERROR" className="text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white">Error</SelectItem>
              <SelectItem value="WARN" className="text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white">Warning</SelectItem>
              <SelectItem value="INFO" className="text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white">Info</SelectItem>
              <SelectItem value="DEBUG" className="text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white">Debug</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(limit)} onValueChange={(v) => setLimit(parseInt(v))}>
            <SelectTrigger className="w-[150px] bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white">
              <SelectValue placeholder="Limit" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="100" className="text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white">100 logs</SelectItem>
              <SelectItem value="500" className="text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white">500 logs</SelectItem>
              <SelectItem value="1000" className="text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white">1000 logs</SelectItem>
              <SelectItem value="5000" className="text-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white">5000 logs</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2 bg-gray-800 text-gray-300">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 text-gray-300",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 ext-gray-300 hover:bg-gray-700 hover:text-white focus:bg-gray-700 focus:text-white" />
                  {selectedDate ? selectedDate.toLocaleDateString() : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-gray-800 text-gray-300 border-gray-700 focus:bg-gray-700 focus:text-white" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date)
                    setIsCalendarOpen(false)
                  }}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              onClick={exportLogs}
              className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

          </div>
        </div>

        {/* Logs Display */}
        <div className="bg-black/60 rounded-md max-h-[550px] overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="divide-y divide-gray-700">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getLogLevelIcon(log.level)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge
                          variant="outline"
                          className={`text-xs ${getLogLevelColor(log.level)}`}
                        >
                          {log.level}
                        </Badge>
                        <span className="text-xs text-cyan-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        {log.source && (
                          <Badge variant="outline" className="text-xs">
                            {log.source}
                          </Badge>
                        )}
                      </div>
                      <pre className="text-sm text-gray-100 whitespace-pre-wrap font-mono break-words">
                        {log.message}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <FileText className="h-12 w-12 mx-auto text-gray-500 mb-4" />
              <p className="text-gray-400">No logs found</p>
              <p className="text-sm text-gray-500 mt-2">
                Click "Collect Logs" to fetch logs from Docker
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
