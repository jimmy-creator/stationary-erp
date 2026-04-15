import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Eye, EyeOff, UserPlus } from 'lucide-react'

export function UserForm() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'employee',
  })

  // Redirect non-admins
  if (!isAdmin) {
    navigate('/unauthorized')
    return null
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const validateForm = () => {
    if (!formData.email) {
      setError('Email is required')
      return false
    }
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address')
      return false
    }
    if (!formData.password) {
      setError('Password is required')
      return false
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!validateForm()) return

    setLoading(true)

    try {
      // Store current admin session before creating new user
      const { data: sessionData } = await supabase.auth.getSession()
      const adminSession = sessionData?.session

      if (!adminSession) {
        throw new Error('Admin session not found. Please log in again.')
      }

      // Create new user via signUp
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (signUpError) {
        console.error('SignUp error:', signUpError)
        throw signUpError
      }

      if (!signUpData.user) {
        throw new Error('Failed to create user - no user returned')
      }

      const newUserId = signUpData.user.id

      // Restore admin session — keep retrying until it works
      let restored = false
      for (let i = 0; i < 3; i++) {
        const { error: restoreError } = await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        })
        if (!restoreError) {
          restored = true
          break
        }
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      if (!restored) {
        console.error('Could not restore admin session')
      }

      // Verify we're back as admin
      const { data: currentSession } = await supabase.auth.getSession()
      if (currentSession?.session?.user?.id !== adminSession.user.id) {
        // Force restore
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        })
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      // Insert profile directly
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: newUserId,
          email: formData.email,
          role: formData.role,
        }, { onConflict: 'id' })

      if (profileError) {
        console.error('Profile insert error:', profileError)
        // Retry once more
        await new Promise(resolve => setTimeout(resolve, 500))
        const { error: retryError } = await supabase
          .from('profiles')
          .upsert({
            id: newUserId,
            email: formData.email,
            role: formData.role,
          }, { onConflict: 'id' })

        if (retryError) {
          console.error('Profile retry error:', retryError)
          setSuccess(`User ${formData.email} auth created, but profile insert failed. Run in SQL: INSERT INTO profiles (id, email, role) VALUES ('${newUserId}', '${formData.email}', '${formData.role}');`)
        } else {
          setSuccess(`User ${formData.email} created successfully as ${formData.role}!`)
        }
      } else {
        setSuccess(`User ${formData.email} created successfully as ${formData.role}!`)
      }

      // Reset form
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        role: 'employee',
      })

      // Ensure admin session is fully restored before navigating
      setTimeout(async () => {
        // Double-check we're still the admin
        const { data: check } = await supabase.auth.getSession()
        if (check?.session?.user?.id !== adminSession.user.id) {
          await supabase.auth.setSession({
            access_token: adminSession.access_token,
            refresh_token: adminSession.refresh_token,
          })
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        navigate('/users')
      }, 2000)

    } catch (err) {
      console.error('Error creating user:', err)

      // Restore admin session on error
      try {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        })
      } catch (e) {
        console.error('Session recovery error:', e)
      }

      // Handle specific errors
      if (err.message?.includes('already registered') || err.message?.includes('already been registered')) {
        setError('A user with this email already exists')
      } else if (err.message?.includes('invalid')) {
        setError('Invalid email format')
      } else if (err.message?.includes('weak_password')) {
        setError('Password is too weak. Use at least 6 characters.')
      } else if (err.message?.includes('rate_limit')) {
        setError('Too many requests. Please wait a moment and try again.')
      } else if (err.message?.includes('Database error')) {
        setError('Database trigger error. Run this in Supabase SQL Editor: DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;')
      } else {
        setError(err.message || 'Failed to create user. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData((prev) => ({
      ...prev,
      password,
      confirmPassword: password
    }))
    setShowPassword(true)
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/users"
          className="text-teal-600 hover:underline text-sm mb-2 inline-block"
        >
          &larr; Back to users
        </Link>
        <h1 className="text-xl lg:text-2xl font-bold text-white">
          Create New User
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Add a new user to the system
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          {/* Email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="user@example.com"
              className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-zinc-300">
                Password *
              </label>
              <button
                type="button"
                onClick={generatePassword}
                className="text-xs text-teal-400 hover:text-teal-300"
              >
                Generate Password
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Confirm Password *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter password"
              className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-zinc-500 mt-1">
              Admins have full access. Employee access can be customized after creation.
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
          <p className="text-sm text-teal-300">
            <strong>Note:</strong> After creating the user, share their email and password securely.
            They can sign in and start using the system immediately.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white px-6 py-2.5 rounded-xl hover:from-teal-500 hover:to-teal-400 disabled:opacity-50 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            {loading ? 'Creating...' : 'Create User'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/users')}
            className="w-full sm:w-auto border border-zinc-700 text-zinc-300 px-6 py-2.5 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
