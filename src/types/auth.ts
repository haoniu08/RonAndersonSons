export type Role = 'framer' | 'admin'

export interface Profile {
  id: string
  email: string | null
  name: string
  role: Role
}