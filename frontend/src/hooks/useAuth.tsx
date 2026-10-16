import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { services } from '@/services'
import type { LoginPayload, Role, User } from '@/types'

interface AuthContextValue {
  user: User | null
  dangTai: boolean
  daDangNhap: boolean
  login: (payload: LoginPayload) => Promise<User>
  quickLogin: (role: Role) => Promise<User>
  logout: () => Promise<void>
  updateProfile: (patch: Partial<User>) => Promise<User>
  refresh: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [dangTai, setDangTai] = React.useState(true)
  const queryClient = useQueryClient()

  React.useEffect(() => {
    let mounted = true
    services.auth
      .me()
      .then((u) => {
        if (mounted) setUser(u)
      })
      .catch(() => {
        if (mounted) setUser(null)
      })
      .finally(() => {
        if (mounted) setDangTai(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      dangTai,
      daDangNhap: !!user,
      async login(payload) {
        const session = await services.auth.login(payload)
        setUser(session.user)
        return session.user
      },
      async quickLogin(role) {
        const session = await services.auth.quickLogin(role)
        setUser(session.user)
        return session.user
      },
      async logout() {
        await services.auth.logout()
        setUser(null)
        queryClient.clear()
      },
      async updateProfile(patch) {
        const updated = await services.auth.updateProfile(patch)
        setUser(updated)
        return updated
      },
      async refresh() {
        const u = await services.auth.me()
        setUser(u)
      },
    }),
    [user, dangTai, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>')
  return ctx
}
