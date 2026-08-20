"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { apiClient } from "@/lib/api/client"
import type { ManagedUser, UserRole } from "@/lib/types/api"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UserFormDialogProps {
  open: boolean
  user?: ManagedUser | null
  onOpenChange: (open: boolean) => void
  onSuccess: (user: ManagedUser) => void
}

export function UserFormDialog({ open, user, onOpenChange, onSuccess }: UserFormDialogProps) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>("vendedor")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setFirstName(user?.firstName ?? "")
    setLastName(user?.lastName ?? "")
    setEmail(user?.email ?? "")
    setRole(user?.role ?? "vendedor")
    setError("")
  }, [open, user])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    const cleanFirstName = firstName.trim()
    const cleanLastName = lastName.trim()
    const cleanEmail = email.trim().toLowerCase()
    if (cleanFirstName.length < 2 || cleanLastName.length < 2) {
      setError("Nombre y apellido deben tener al menos 2 caracteres")
      return
    }
    if (!user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Ingresá un email válido")
      return
    }
    setLoading(true)
    try {
      const saved = user
        ? await apiClient.updateUser(user.userId, { firstName: cleanFirstName, lastName: cleanLastName, role })
        : await apiClient.createUser({ firstName: cleanFirstName, lastName: cleanLastName, email: cleanEmail, role })
      onSuccess(saved)
      onOpenChange(false)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No se pudo guardar el usuario")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? "Modificar usuario" : "Agregar usuario"}</DialogTitle>
          <DialogDescription>
            {user ? "Actualizá los datos permitidos y el rol." : "Cognito enviará una contraseña temporal al email indicado."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? <Alert className="border-red-200 bg-red-50"><AlertDescription className="text-red-700">{error}</AlertDescription></Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-first-name">Nombre</Label>
              <Input id="user-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={80} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-last-name">Apellido</Label>
              <Input id="user-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={80} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} readOnly={!!user} className={user ? "bg-gray-100" : ""} required />
            {user ? <p className="text-xs text-gray-500">El email no puede modificarse.</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role">Rol</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger id="user-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vendedor">Vendedor</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</> : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
