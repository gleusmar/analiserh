import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: false }))
app.use(express.json())

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in environment')
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Create user (admin only; for now we trust local dev). In production, add auth/checks.
app.post('/api/admin/users', async (req, res) => {
  try {
    const { email, password, role = 'user' } = req.body || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'invalid role' })
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role },
    })
    if (error) throw error

    const user = data.user
    if (!user) throw new Error('User creation returned no user')

    // Ensure profile with desired role & status
    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert({ id: user.id, email: user.email, role, status: 'active' }, { onConflict: 'id' })
    if (upsertErr) throw upsertErr

    // Audit log: user:create
    try {
      const actorId = req.header('x-actor-id') || null
      const actorEmail = req.header('x-actor-email') || null
      await admin.from('audit_logs').insert({
        action: 'user:create',
        actor_id: actorId,
        actor_email: actorEmail,
        target_id: user.id,
        target_email: user.email,
        details: { role },
      })
    } catch (logErr) {
      console.warn('audit log failed', logErr)
    }

    res.json({ id: user.id, email: user.email, role })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || 'internal error' })
  }
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => {
  console.log(`Admin API listening on http://localhost:${port}`)
})
