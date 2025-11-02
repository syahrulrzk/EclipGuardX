"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Shield, 
  Search, 
  RefreshCw,
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Download,
  Eye,
  Container,
  Bug,
  Virus
} from 'lucide-react'
import { toast } from 'sonner'

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

interface Vulnerability {
  id: string
  severity: string
  package: string
  version: string
  fixedVersion?: string
  description: string
  publishedDate: string
  lastModifiedDate: string
}

interface MalwareDetection {
  id: string
  name: string
  type: string
  severity: string
  description: string
  file: string
  matchedRule: string
}

export default function ScansPage() {
  const [scans, setScans] = useState<ScanInfo[]>([])
  const [containers, setContainers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedScan, setSelectedScan] = useState<ScanInfo | null>(null)
  const [scanType, setScanType] = useState<string>('trivy')
  const [selectedContainer, setSelectedContainer] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      
      const [scansResponse, containersResponse] = await Promise.all([
        fetch('/api/scans'),
        fetch('/api/containers')
      ])
      
      const scansData = await scansResponse.json()
      const containersData = await containersResponse.json()
      
      setScans(scansData)
      setContainers(containersData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch scan data')
    } finally {
      setIsLoading(false)
    }
  }

  const startScan = async () => {
    if (!selectedContainer) {
      toast.error('Please select a container to scan')
      return
    }

    try {
      toast.info(`Starting ${scanType} scan...`)
      
      const response = await fetch('/api/scans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          containerId: selectedContainer,
          scanType: scanType
        })
      })

      if (response.ok) {
        const newScan = await response.json()
        setScans(prev => [newScan, ...prev])
        toast.success(`${scanType} scan started successfully`)
        
        // Poll for scan completion
        pollScanCompletion(newScan.id)
      } else {
        throw new Error('Failed to start scan')
      }
    } catch (error) {
      console.error('Error starting scan:', error)
      toast.error('Failed to start scan')
    }
  }

  const pollScanCompletion = (scanId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/scans?scanType=${scanType}`)
        const scansData = await response.json()
        const updatedScan = scansData.find((s: ScanInfo) => s.id === scanId)
        
        if (updatedScan && updatedScan.status !== 'running') {
          clearInterval(interval)
          setScans(prev => prev.map(s => s.id === scanId ? updatedScan : s))
          
          if (updatedScan.status === 'completed') {
            toast.success('Scan completed successfully')
          } else {
            toast.error('Scan failed')
          }
        }
      } catch (error) {
        console.error('Error polling scan status:', error)
        clearInterval(interval)
      }
    }, 2000)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-400" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-400" />
      case 'running': return <Clock className="h-4 w-4 text-yellow-400 animate-spin" />
      default: return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default'
      case 'failed': return 'destructive'
      case 'running': return 'secondary'
      default: return 'outline'
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

  const filteredScans = scans.filter(scan => {
    const matchesSearch = scan.container?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         scan.scanType.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || scan.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const parseVulnerabilities = (result?: string): Vulnerability[] => {
    if (!result) return []
    
    try {
      const parsed = JSON.parse(result)
      return parsed.vulnerabilities || []
    } catch {
      return []
    }
  }

  const parseMalwareDetections = (result?: string): MalwareDetection[] => {
    if (!result) return []
    
    try {
      const parsed = JSON.parse(result)
      return parsed.detections || []
    } catch {
      return []
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-cyan-400" />
          <p className="text-gray-400">Loading security scans...</p>
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
                Security Scanning
              </h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={fetchData}>
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
            <Button variant="secondary" className="w-full justify-start">
              <Shield className="h-4 w-4 mr-2" />
              Security Scans
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* New Scan Section */}
          <Card className="bg-gray-800/50 border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-gray-100">Start New Security Scan</CardTitle>
              <CardDescription className="text-gray-400">
                Run vulnerability or malware detection scans on your containers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end space-x-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Container</label>
                  <Select value={selectedContainer} onValueChange={setSelectedContainer}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-100">
                      <SelectValue placeholder="Select a container" />
                    </SelectTrigger>
                    <SelectContent>
                      {containers.map((container) => (
                        <SelectItem key={container.id} value={container.id}>
                          {container.name} - {container.image}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Scan Type</label>
                  <Select value={scanType} onValueChange={setScanType}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trivy">
                        <div className="flex items-center space-x-2">
                          <Bug className="h-4 w-4" />
                          <span>Trivy (Vulnerability Scan)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="yara">
                        <div className="flex items-center space-x-2">
                          <Virus className="h-4 w-4" />
                          <span>YARA (Malware Detection)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button onClick={startScan} disabled={!selectedContainer}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Scan
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Search and Filters */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search scans..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800/50 border-gray-700 text-gray-100 placeholder-gray-400 w-64"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-gray-800/50 border-gray-700 text-gray-100 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Badge variant="outline" className="text-sm">
              {filteredScans.length} scans
            </Badge>
          </div>

          {/* Scan Results Table */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100">Scan History</CardTitle>
              <CardDescription className="text-gray-400">
                View results of previous security scans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-400">Status</TableHead>
                    <TableHead className="text-gray-400">Container</TableHead>
                    <TableHead className="text-gray-400">Scan Type</TableHead>
                    <TableHead className="text-gray-400">Summary</TableHead>
                    <TableHead className="text-gray-400">Duration</TableHead>
                    <TableHead className="text-gray-400">Timestamp</TableHead>
                    <TableHead className="text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScans.map((scan) => (
                    <TableRow key={scan.id} className="border-gray-700 hover:bg-gray-700/30">
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(scan.status)}
                          <Badge variant={getStatusColor(scan.status)} className="text-xs">
                            {scan.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-gray-100">
                        {scan.container?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {scan.scanType === 'trivy' ? (
                            <Bug className="h-4 w-4 text-blue-400" />
                          ) : (
                            <Virus className="h-4 w-4 text-purple-400" />
                          )}
                          <span className="capitalize">{scan.scanType}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {scan.summary || '-'}
                      </TableCell>
                      <TableCell>
                        {scan.duration ? (
                          <span className="text-gray-100">
                            {(scan.duration / 1000).toFixed(1)}s
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {isClient ? new Date(scan.timestamp).toLocaleString() : ''}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedScan(scan)}
                            disabled={scan.status !== 'completed'}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={scan.status !== 'completed'}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredScans.length === 0 && (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-400">No scans found</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Start a new security scan to see results here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scan Detail Modal */}
          {selectedScan && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <Card className="bg-gray-800 border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-gray-100 flex items-center space-x-2">
                        {getStatusIcon(selectedScan.status)}
                        <span>Scan Results - {selectedScan.container?.name}</span>
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        {selectedScan.scanType} scan completed on {isClient ? new Date(selectedScan.timestamp).toLocaleString() : ''}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedScan(null)}
                    >
                      ×
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="summary" className="space-y-4">
                    <TabsList className="bg-gray-700">
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      <TabsTrigger value="details">Detailed Results</TabsTrigger>
                      <TabsTrigger value="raw">Raw Data</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="summary" className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-700/30 p-4 rounded-lg">
                          <p className="text-sm text-gray-400">Status</p>
                          <div className="flex items-center space-x-2 mt-1">
                            {getStatusIcon(selectedScan.status)}
                            <Badge variant={getStatusColor(selectedScan.status)} className="text-xs">
                              {selectedScan.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="bg-gray-700/30 p-4 rounded-lg">
                          <p className="text-sm text-gray-400">Duration</p>
                          <p className="text-xl font-bold text-cyan-400">
                            {selectedScan.duration ? `${(selectedScan.duration / 1000).toFixed(1)}s` : '-'}
                          </p>
                        </div>
                        <div className="bg-gray-700/30 p-4 rounded-lg">
                          <p className="text-sm text-gray-400">Scan Type</p>
                          <p className="text-xl font-bold text-purple-400 capitalize">
                            {selectedScan.scanType}
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-gray-700/30 p-4 rounded-lg">
                        <p className="text-sm text-gray-400 mb-2">Summary</p>
                        <p className="text-gray-100">{selectedScan.summary || 'No summary available'}</p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="details" className="space-y-4">
                      {selectedScan.scanType === 'trivy' && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-100 mb-4">Vulnerabilities Found</h3>
                          {parseVulnerabilities(selectedScan.result).length > 0 ? (
                            <div className="space-y-3">
                              {parseVulnerabilities(selectedScan.result).map((vuln, index) => (
                                <div key={index} className="bg-gray-700/30 p-4 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                      <Badge variant={getSeverityColor(vuln.severity)} className="text-xs">
                                        {vuln.severity}
                                      </Badge>
                                      <span className="font-medium text-gray-100">{vuln.package}</span>
                                      <span className="text-sm text-gray-400">v{vuln.version}</span>
                                    </div>
                                    {vuln.fixedVersion && (
                                      <span className="text-sm text-green-400">
                                        Fixed in v{vuln.fixedVersion}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-400">{vuln.description}</p>
                                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                    <span>ID: {vuln.id}</span>
                                    <span>Published: {isClient ? new Date(vuln.publishedDate).toLocaleDateString() : ''}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400">No vulnerabilities found</p>
                          )}
                        </div>
                      )}
                      
                      {selectedScan.scanType === 'yara' && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-100 mb-4">Malware Detections</h3>
                          {parseMalwareDetections(selectedScan.result).length > 0 ? (
                            <div className="space-y-3">
                              {parseMalwareDetections(selectedScan.result).map((detection, index) => (
                                <div key={index} className="bg-gray-700/30 p-4 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                      <Badge variant={getSeverityColor(detection.severity)} className="text-xs">
                                        {detection.severity}
                                      </Badge>
                                      <span className="font-medium text-gray-100">{detection.name}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {detection.type}
                                      </Badge>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-400 mb-2">{detection.description}</p>
                                  <div className="text-xs text-gray-500">
                                    <p>File: {detection.file}</p>
                                    <p>Rule: {detection.matchedRule}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400">No malware detected</p>
                          )}
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="raw" className="space-y-4">
                      <div className="bg-gray-900 p-4 rounded-lg">
                        <pre className="text-sm text-gray-300 overflow-x-auto">
                          {JSON.stringify(JSON.parse(selectedScan.result || '{}'), null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-700">
                    <Button variant="outline" onClick={() => setSelectedScan(null)}>
                      Close
                    </Button>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}