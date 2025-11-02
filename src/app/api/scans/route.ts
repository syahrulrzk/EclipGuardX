import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const containerId = searchParams.get('containerId')
    const scanType = searchParams.get('scanType')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const whereClause: any = {}

    if (containerId) whereClause.containerId = containerId
    if (scanType) whereClause.scanType = scanType
    if (status) whereClause.status = status

    const scans = await db.scan.findMany({
      where: whereClause,
      include: {
        container: {
          select: {
            name: true,
            containerId: true,
            image: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    })

    return NextResponse.json(scans)
  } catch (error) {
    console.error('Error fetching scans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scans' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { containerId, scanType } = await request.json()

    // Create scan record with running status
    const scan = await db.scan.create({
      data: {
        containerId,
        scanType,
        status: 'running'
      },
      include: {
        container: {
          select: {
            name: true,
            containerId: true,
            image: true
          }
        }
      }
    })

    // TODO: Implement actual Trivy/YARA scanning logic here
    // For now, we'll simulate a scan result after a delay
    setTimeout(async () => {
      try {
        let mockResult: any
        let mockSummary: string

        if (scanType === 'trivy') {
          mockResult = {
            vulnerabilities: [
              {
                id: 'CVE-2023-1234',
                severity: 'HIGH',
                package: 'nginx',
                version: '1.21.0',
                fixedVersion: '1.21.1',
                description: 'NGINX before 1.21.1 allows a buffer overflow.',
                publishedDate: '2023-01-15',
                lastModifiedDate: '2023-01-20'
              },
              {
                id: 'CVE-2023-5678',
                severity: 'MEDIUM',
                package: 'openssl',
                version: '1.1.1',
                fixedVersion: '1.1.1n',
                description: 'OpenSSL has a timing side-channel in ECDSA signature generation.',
                publishedDate: '2023-02-10',
                lastModifiedDate: '2023-02-15'
              }
            ],
            metadata: {
              scanner: 'Trivy v0.45.1',
              timestamp: new Date().toISOString(),
              targetImage: scan.container?.image || 'unknown'
            }
          }
          mockSummary = `${mockResult.vulnerabilities.length} vulnerabilities found (${mockResult.vulnerabilities.filter((v: any) => v.severity === 'HIGH').length} high, ${mockResult.vulnerabilities.filter((v: any) => v.severity === 'MEDIUM').length} medium)`
        } else if (scanType === 'yara') {
          mockResult = {
            detections: [
              {
                id: 'MALWARE-001',
                name: 'Trojan.Generic',
                type: 'trojan',
                severity: 'HIGH',
                description: 'Generic trojan detected in binary file',
                file: '/usr/local/bin/suspicious-binary',
                matchedRule: 'trojan_generic_rule'
              }
            ],
            metadata: {
              scanner: 'YARA v4.3.0',
              timestamp: new Date().toISOString(),
              filesScanned: 1250,
              rulesUsed: 4500
            }
          }
          mockSummary = `${mockResult.detections.length} malware detections found`
        } else {
          throw new Error('Unknown scan type')
        }

        await db.scan.update({
          where: { id: scan.id },
          data: {
            status: 'completed',
            result: JSON.stringify(mockResult),
            summary: mockSummary,
            duration: Math.floor(Math.random() * 10000) + 5000 // Random duration between 5-15 seconds
          }
        })

        // Create alerts for high/critical findings
        if (scanType === 'trivy') {
          for (const vuln of mockResult.vulnerabilities) {
            if (vuln.severity === 'HIGH' || vuln.severity === 'CRITICAL') {
              await db.alert.create({
                data: {
                  severity: vuln.severity,
                  message: `${vuln.severity} severity vulnerability detected in ${vuln.package}: ${vuln.description}`,
                  source: 'trivy',
                  containerId: containerId
                }
              })
            }
          }
        } else if (scanType === 'yara') {
          for (const detection of mockResult.detections) {
            if (detection.severity === 'HIGH' || detection.severity === 'CRITICAL') {
              await db.alert.create({
                data: {
                  severity: detection.severity,
                  message: `${detection.severity} severity malware detected: ${detection.name} in ${detection.file}`,
                  source: 'yara',
                  containerId: containerId
                }
              })
            }
          }
        }

      } catch (error) {
        console.error('Error updating scan result:', error)
        await db.scan.update({
          where: { id: scan.id },
          data: {
            status: 'failed',
            summary: 'Scan failed to complete'
          }
        })
      }
    }, 5000)

    return NextResponse.json(scan, { status: 201 })
  } catch (error) {
    console.error('Error creating scan:', error)
    return NextResponse.json(
      { error: 'Failed to create scan' },
      { status: 500 }
    )
  }
}