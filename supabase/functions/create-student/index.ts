import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function findUserByEmail(supabaseAdmin: any, email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) {
    console.error('List users error:', error)
    return null
  }

  const lower = email.toLowerCase()
  return data.users.find((u: any) => (u.email ?? '').toLowerCase() === lower) ?? null
}

function isValidStudentId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9]+$/.test(value) && value.length >= 1 && value.length <= 32
}

function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 120
}

function isValidMobile(value: unknown): value is string {
  return typeof value === 'string' && /^\d{10}$/.test(value)
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 6 && value.length <= 72
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Admin client (service role)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify the request is from an authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse(401, { error: 'Missing authorization header' })
    }

    const token = authHeader.replace('Bearer ', '')

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return jsonResponse(401, { error: 'Unauthorized' })
    }

    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || adminProfile?.role !== 'admin') {
      console.error('Profile error or not admin:', profileError)
      return jsonResponse(403, { error: 'Only admins can create students' })
    }

    const body = await req.json().catch(() => null)

    const student_id_raw = body?.student_id
    const name_raw = body?.name
    const mobile_raw = body?.mobile
    const password_raw = body?.password

    if (!isValidStudentId(student_id_raw)) {
      return jsonResponse(400, { error: 'Invalid student_id. Use uppercase letters/numbers only.' })
    }
    if (!isValidName(name_raw)) {
      return jsonResponse(400, { error: 'Invalid name.' })
    }
    if (!isValidMobile(mobile_raw)) {
      return jsonResponse(400, { error: 'Invalid mobile. Must be 10 digits.' })
    }
    if (!isValidPassword(password_raw)) {
      return jsonResponse(400, { error: 'Invalid password. Must be at least 6 characters.' })
    }

    const student_id = student_id_raw.toUpperCase()
    const name = name_raw.trim()
    const mobile = mobile_raw
    const password = password_raw

    const email = `${student_id.toLowerCase()}@student.local`

    // Create auth user WITHOUT affecting current admin session
    const { data: createUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        student_id,
      },
    })

    if (createUserError || !createUserData.user) {
      console.error('Create user error:', createUserError)
      const message = createUserError?.message ?? 'Failed to create student auth user'

      // Common duplicate case: user already exists in the login system.
      // If the database rows are missing (e.g., someone cleared tables), we "repair" by recreating profile/role.
      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('exists')) {
        const existingUser = await findUserByEmail(supabaseAdmin, email)
        if (!existingUser) {
          return jsonResponse(409, { error: 'Student already exists (same ID/email).' })
        }

        const existingUserId = existingUser.id

        const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('id', existingUserId)
          .maybeSingle()

        if (existingProfileError) {
          console.error('Profile lookup error:', existingProfileError)
          return jsonResponse(500, { error: 'Failed to look up existing student profile: ' + existingProfileError.message })
        }

        // If profile exists, this is a real duplicate.
        if (existingProfile) {
          return jsonResponse(409, {
            error:
              'Student already exists (same ID/email). If you need a new password, use Reset Password.',
          })
        }

        // Best-effort: ensure the password/metadata matches the admin-provided values
        const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
          password,
          user_metadata: {
            name,
            student_id,
          },
        })
        if (updateUserError) {
          console.error('Update existing user error:', updateUserError)
        }

      const { error: repairedProfileError } = await supabaseAdmin.from('profiles').insert({
          id: existingUserId,
          partner_id: student_id,
          name,
          mobile,
          role: 'student',
          is_active: true,
        })

        if (repairedProfileError) {
          console.error('Repair profile insert error:', repairedProfileError)
          return jsonResponse(500, { error: 'Failed to repair student profile: ' + repairedProfileError.message })
        }

        const { data: existingRole, error: roleLookupError } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', existingUserId)
          .eq('role', 'student')
          .maybeSingle()

        if (roleLookupError) {
          console.error('Role lookup error:', roleLookupError)
          await supabaseAdmin.from('profiles').delete().eq('id', existingUserId)
          return jsonResponse(500, { error: 'Failed to look up student role: ' + roleLookupError.message })
        }

        if (!existingRole) {
          const { error: repairedRoleError } = await supabaseAdmin.from('user_roles').insert({
            user_id: existingUserId,
            role: 'student',
          })

          if (repairedRoleError) {
            console.error('Repair role insert error:', repairedRoleError)
            await supabaseAdmin.from('profiles').delete().eq('id', existingUserId)
            return jsonResponse(500, { error: 'Failed to assign student role: ' + repairedRoleError.message })
          }
        }

        return jsonResponse(200, {
          success: true,
          user_id: existingUserId,
          email,
          student_id,
          name,
          repaired: true,
        })
      }

      return jsonResponse(500, { error: message })
    }

    const newUserId = createUserData.user.id

    const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
      id: newUserId,
      partner_id: student_id,
      name,
      mobile,
      role: 'student',
      is_active: true,
    })

    if (profileInsertError) {
      console.error('Profile insert error:', profileInsertError)
      // Rollback auth user (best-effort)
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      return jsonResponse(500, { error: 'Failed to create student profile: ' + profileInsertError.message })
    }

    const { error: roleInsertError } = await supabaseAdmin.from('user_roles').insert({
      user_id: newUserId,
      role: 'student',
    })

    if (roleInsertError) {
      console.error('Role insert error:', roleInsertError)
      // Rollback (best-effort)
      await supabaseAdmin.from('profiles').delete().eq('id', newUserId)
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      return jsonResponse(500, { error: 'Failed to assign student role: ' + roleInsertError.message })
    }

    return jsonResponse(200, {
      success: true,
      user_id: newUserId,
      email,
      student_id,
      name,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Internal server error' })
  }
})
