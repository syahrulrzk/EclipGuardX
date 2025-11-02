// Database Cleanup Scheduler for EclipGuardX
// This file can be run as a cron job or scheduled task

import { db } from '../src/lib/db.js'

class CleanupScheduler {
  constructor() {
    this.defaultRetentionDays = 30
    this.cleanupInterval = 24 * 60 * 60 * 1000 // 24 hours
  }

  async performCleanup(days = this.defaultRetentionDays, dryRun = false) {
    try {
      console.log(`[${new Date().toISOString()}] Starting cleanup process...`)
      
      const response = await fetch('http://localhost:3000/api/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          days,
          dryRun
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log(`[${new Date().toISOString()}] Cleanup result:`, result)
      
      return result
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Cleanup failed:`, error)
      throw error
    }
  }

  async startScheduledCleanup() {
    console.log(`[${new Date().toISOString()}] Starting scheduled cleanup (every 24 hours)`)
    
    // Perform initial cleanup
    await this.performCleanup()
    
    // Schedule regular cleanup
    setInterval(async () => {
      try {
        await this.performCleanup()
      } catch (error) {
        console.error('Scheduled cleanup failed:', error)
      }
    }, this.cleanupInterval)
  }

  async getCleanupStats() {
    try {
      const response = await fetch('http://localhost:3000/api/cleanup')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const stats = await response.json()
      console.log(`[${new Date().toISOString()}] Cleanup stats:`, stats)
      
      return stats
    } catch (error) {
      console.error('Failed to get cleanup stats:', error)
      throw error
    }
  }
}

// Export for use as module
export default CleanupScheduler

// If run directly, perform cleanup once
if (import.meta.url === `file://${process.argv[1]}`) {
  const scheduler = new CleanupScheduler()
  
  // Check command line arguments
  const dryRun = process.argv.includes('--dry-run')
  const schedule = process.argv.includes('--schedule')
  const days = parseInt(process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1]) || 30
  
  if (schedule) {
    console.log('Starting scheduled cleanup service...')
    scheduler.startScheduledCleanup()
  } else {
    console.log(`Running cleanup with: days=${days}, dryRun=${dryRun}`)
    
    scheduler.performCleanup(days, dryRun)
      .then((result) => {
        console.log('Cleanup completed successfully')
        process.exit(0)
      })
      .catch((error) => {
        console.error('Cleanup failed:', error)
        process.exit(1)
      })
  }
}