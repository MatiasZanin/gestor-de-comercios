"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserFormDialog } from "@/components/users/user-form-dialog"
import { apiClient } from "@/lib/api/client"
import { useAuth } from "@/lib/hooks/use-auth"
import type { ManagedUser } from "@/lib/types/api"
import { Edit, KeyRound, Loader2, Plus, RefreshCw, Search, Trash2, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type Confirmation = { kind: "reset" | "disable"; user: ManagedUser } | null

const statusLabels = {
  active: "Activo",
  invited: "Invitación pendiente",
  password_reset_required: "Cambio de contraseña pendiente",
}

export default function UsersPage() {
  const router = useRouter()
  const { user: currentUser, role } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setUsers((await apiClient.listUsers()).items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los usuarios")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role && role !== "admin") {
      router.replace("/dashboard")
      return
    }
    if (role === "admin") void loadUsers()
  }, [loadUsers, role, router])

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter((managedUser) => managedUser.fullName.toLowerCase().includes(term) || managedUser.email.toLowerCase().includes(term))
  }, [search, users])

  const handleSaved = (saved: ManagedUser) => {
    setUsers((current) => {
      const exists = current.some((item) => item.userId === saved.userId)
      return exists ? current.map((item) => item.userId === saved.userId ? saved : item) : [...current, saved]
    })
    toast.success(editingUser ? "Usuario actualizado" : "Usuario creado", {
      description: editingUser ? undefined : "Cognito envió la invitación con una contraseña temporal.",
    })
    setEditingUser(null)
  }

  const handleConfirmedAction = async () => {
    if (!confirmation) return
    setActionLoading(true)
    try {
      if (confirmation.kind === "reset") {
        const result = await apiClient.resetUserPassword(confirmation.user.userId)
        toast.success("Restablecimiento iniciado", { description: result.message })
        await loadUsers()
      } else {
        await apiClient.disableUser(confirmation.user.userId)
        setUsers((current) => current.filter((item) => item.userId !== confirmation.user.userId))
        toast.success("Usuario deshabilitado")
      }
      setConfirmation(null)
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "No se pudo completar la acción")
    } finally {
      setActionLoading(false)
    }
  }

  if (role && role !== "admin") return null

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Gestor de usuarios</h1>
            <p className="text-sm text-gray-600 sm:text-base">Administrá el equipo de tu comercio y sus permisos.</p>
          </div>
          <Button onClick={() => { setEditingUser(null); setFormOpen(true) }} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-lg hover:from-emerald-700 hover:to-emerald-800 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />Agregar usuario
          </Button>
        </div>

        <Card className="border-0 bg-white/80 pt-0 shadow-lg backdrop-blur-sm">
          <CardHeader className="border-b pt-6">
            <CardTitle className="flex items-center gap-2 text-gray-800"><Users className="h-5 w-5 text-emerald-600" />Usuarios del comercio</CardTitle>
            <div className="relative mt-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input aria-label="Buscar usuarios" placeholder="Buscar por nombre o email..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" />
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {error ? (
              <Alert className="border-red-200 bg-red-50"><AlertDescription className="flex items-center justify-between gap-3 text-red-700"><span>{error}</span><Button size="sm" variant="outline" onClick={() => void loadUsers()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></AlertDescription></Alert>
            ) : loading ? (
              <div className="py-12 text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600" /><p className="mt-4 text-gray-500">Cargando usuarios...</p></div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center"><Users className="mx-auto mb-4 h-16 w-16 text-gray-300" /><p className="text-lg text-gray-500">{search ? "No se encontraron usuarios" : "Todavía no hay usuarios"}</p><p className="text-gray-400">{search ? "Probá con otros términos." : "Agregá el primer integrante de tu equipo."}</p></div>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Rol</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                    <TableBody>{filteredUsers.map((managedUser) => <UserRow key={managedUser.userId} managedUser={managedUser} currentSub={currentUser?.sub} onEdit={() => { setEditingUser(managedUser); setFormOpen(true) }} onConfirm={setConfirmation} />)}</TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">{filteredUsers.map((managedUser) => <UserCard key={managedUser.userId} managedUser={managedUser} currentSub={currentUser?.sub} onEdit={() => { setEditingUser(managedUser); setFormOpen(true) }} onConfirm={setConfirmation} />)}</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <UserFormDialog open={formOpen} user={editingUser} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingUser(null) }} onSuccess={handleSaved} />
      <AlertDialog open={!!confirmation} onOpenChange={(open) => !open && !actionLoading && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.kind === "reset" ? "Restablecer contraseña" : "Eliminar usuario"}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation?.kind === "reset" ? `Se enviará un código a ${confirmation.user.email}. Revise la casilla de spam si no encuentra el mail.` : `Se eliminará el usuario ${confirmation?.user.fullName}. Ésta acción no tiene vuelta atrás.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={actionLoading} onClick={(event) => { event.preventDefault(); void handleConfirmedAction() }} className={confirmation?.kind === "disable" ? "bg-red-600 hover:bg-red-700" : ""}>{actionLoading ? "Procesando..." : "Confirmar"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

interface UserActionsProps { managedUser: ManagedUser; currentSub?: string; onEdit: () => void; onConfirm: (value: Confirmation) => void }

function Actions({ managedUser, currentSub, onEdit, onConfirm }: UserActionsProps) {
  const isCurrentOwner = managedUser.isOwner && managedUser.userId === currentSub
  if (managedUser.isOwner && !isCurrentOwner) return <span className="text-xs text-gray-400">Protegido</span>
  return <div className="flex justify-end gap-2">
    {!managedUser.isOwner ? <Button size="icon" variant="outline" aria-label={`Modificar ${managedUser.fullName}`} onClick={onEdit}><Edit className="h-4 w-4" /></Button> : null}
    <Button size="icon" variant="outline" aria-label={`Restablecer contraseña de ${managedUser.fullName}`} onClick={() => onConfirm({ kind: "reset", user: managedUser })}><KeyRound className="h-4 w-4" /></Button>
    {!managedUser.isOwner ? <Button size="icon" variant="outline" aria-label={`Eliminar ${managedUser.fullName}`} onClick={() => onConfirm({ kind: "disable", user: managedUser })} className="text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button> : null}
  </div>
}

function EmailStatus({ managedUser }: { managedUser: ManagedUser }) { return <div><div className="font-medium text-gray-900">{managedUser.email}</div><div className={managedUser.emailVerified ? "text-xs text-emerald-700" : "text-xs text-amber-700"}>{managedUser.emailVerified ? "Email confirmado" : "Email sin confirmar"}</div></div> }

function UserRow(props: UserActionsProps) { const { managedUser } = props; return <TableRow><TableCell><div className="font-medium">{managedUser.fullName}</div>{managedUser.isOwner ? <Badge variant="outline" className="mt-1">Creador</Badge> : null}</TableCell><TableCell><EmailStatus managedUser={managedUser} /></TableCell><TableCell><Badge className={managedUser.role === "admin" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}>{managedUser.role === "admin" ? "Administrador" : "Vendedor"}</Badge></TableCell><TableCell><Badge variant="outline">{statusLabels[managedUser.status]}</Badge></TableCell><TableCell className="text-right"><Actions {...props} /></TableCell></TableRow> }

function UserCard(props: UserActionsProps) { const { managedUser } = props; return <div className="space-y-3 rounded-xl border border-gray-100 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{managedUser.fullName}</h3><EmailStatus managedUser={managedUser} /></div>{managedUser.isOwner ? <Badge variant="outline">Creador</Badge> : null}</div><div className="flex flex-wrap gap-2"><Badge>{managedUser.role === "admin" ? "Administrador" : "Vendedor"}</Badge><Badge variant="outline">{statusLabels[managedUser.status]}</Badge></div><Actions {...props} /></div> }
