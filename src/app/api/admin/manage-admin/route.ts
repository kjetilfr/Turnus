// src/app/api/admin/manage-admin/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/service'
import { checkIsAdmin } from '@/lib/admin/checkAdmin'

export async function POST(request: Request) {
  try {
    // Check if requester is admin
    const { isAdmin, user: adminUser } = await checkIsAdmin()
    
    if (!isAdmin || !adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    const { userId, isAdmin: targetIsAdmin } = await request.json()

    if (!userId || typeof targetIsAdmin !== 'boolean') {
      return NextResponse.json(
        { error: 'userId and isAdmin (boolean) are required' },
        { status: 400 }
      )
    }

    // Prevent admin from removing their own admin access
    if (userId === adminUser.id && !targetIsAdmin) {
      return NextResponse.json(
        { error: 'You cannot remove your own admin access' },
        { status: 400 }
      )
    }

    console.log(`Admin ${adminUser.email} ${targetIsAdmin ? 'granting' : 'revoking'} admin access for user ${userId}`)

    // Get the target user
    const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (getUserError || !targetUser) {
      console.error('Error getting target user:', getUserError)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update the user's metadata
    const currentMetadata = targetUser.user.user_metadata || {}
    const updatedMetadata = targetIsAdmin
      ? { ...currentMetadata, is_admin: true }
      : Object.fromEntries(
          Object.entries(currentMetadata).filter(([key]) => key !== 'is_admin')
        )

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: updatedMetadata
      }
    )

    if (updateError) {
      console.error('Error updating user metadata:', updateError)
      return NextResponse.json(
        { error: 'Failed to update admin status' },
        { status: 500 }
      )
    }

    console.log(`✅ Successfully ${targetIsAdmin ? 'granted' : 'revoked'} admin access for user ${userId}`)

    return NextResponse.json({
      success: true,
      message: `Admin access ${targetIsAdmin ? 'granted' : 'revoked'} successfully`,
      user_email: targetUser.user.email,
    })
  } catch (error) {
    console.error('Manage admin error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}