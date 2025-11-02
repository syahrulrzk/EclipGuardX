import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(request: NextRequest) {
  try {
    const { alertId, action } = await request.json()
    
    if (!alertId || !action) {
      return NextResponse.json(
        { error: 'Alert ID and action are required' },
        { status: 400 }
      )
    }

    if (action === 'resolve') {
      const updatedAlert = await db.alert.update({
        where: { id: alertId },
        data: { resolved: true }
      })
      return NextResponse.json(updatedAlert)
    } else if (action === 'reopen') {
      const updatedAlert = await db.alert.update({
        where: { id: alertId },
        data: { resolved: false }
      })
      return NextResponse.json(updatedAlert)
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "resolve" or "reopen"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error managing alert:', error)
    return NextResponse.json(
      { error: 'Failed to manage alert' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const alertId = searchParams.get('alertId')
    
    if (!alertId) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      )
    }

    await db.alert.delete({
      where: { id: alertId }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting alert:', error)
    return NextResponse.json(
      { error: 'Failed to delete alert' },
      { status: 500 }
    )
  }
}