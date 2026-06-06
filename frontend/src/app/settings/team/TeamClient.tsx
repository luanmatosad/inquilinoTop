'use client'

import { useState } from 'react'
import { Organization, OrganizationMember, OrganizationInvite } from '@/lib/go/organization'
import { handleInviteMember, handleRemoveMember, handleUpdateRole, handleCancelInvite } from './actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface TeamClientProps {
  organization: Organization
  members: OrganizationMember[]
  invites: OrganizationInvite[]
}

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  manager: 'bg-green-100 text-green-800',
  employee: 'bg-amber-100 text-amber-800',
  viewer: 'bg-gray-100 text-gray-800',
}

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  employee: 'Funcionário',
  viewer: 'Visualizador',
}

export function TeamClient({ organization, members, invites }: TeamClientProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    const result = await handleInviteMember(formData)
    
    if (result.error) {
      setError(result.error)
    } else {
      setIsOpen(false)
    }
    setLoading(false)
  }

  async function onRemove(id: string) {
    if (confirm('Tem certeza que deseja remover este membro?')) {
      await handleRemoveMember(id)
    }
  }

  async function onCancelInvite(id: string) {
    if (confirm('Tem certeza que deseja cancelar este convite?')) {
      await handleCancelInvite(id)
    }
  }

  async function onRoleChange(id: string, role: string) {
    await handleUpdateRole(id, role)
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Equipe</h1>
          <p className="text-on-surface-variant mt-2">
            Gerencie os membros da organização: <strong>{organization.name}</strong>
          </p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Convidar Membro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar novo membro</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 mt-4">
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input name="email" type="email" required placeholder="email@exemplo.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Perfil</label>
                <Select name="role" defaultValue="viewer">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="employee">Funcionário</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar Convite'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-8">
        <div className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h2 className="text-lg font-semibold">Membros Ativos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-variant text-on-surface-variant">
                <tr>
                  <th className="px-6 py-3 font-medium">Email / Usuário</th>
                  <th className="px-6 py-3 font-medium">Perfil</th>
                  <th className="px-6 py-3 font-medium">Data de Entrada</th>
                  <th className="px-6 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {members.map(member => (
                  <tr key={member.id} className="hover:bg-surface-variant/50">
                    <td className="px-6 py-4">{member.user_email || 'Usuário ' + member.user_id.substring(0,8)}</td>
                    <td className="px-6 py-4">
                      <Select 
                        defaultValue={member.role} 
                        onValueChange={(val) => onRoleChange(member.id, val)}
                        disabled={member.role === 'owner'}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[member.role] || roleColors.viewer}`}>
                              {roleLabels[member.role] || member.role}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {member.role === 'owner' && <SelectItem value="owner">Proprietário</SelectItem>}
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="manager">Gerente</SelectItem>
                          <SelectItem value="employee">Funcionário</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {new Date(member.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {member.role !== 'owner' && (
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => onRemove(member.id)}>
                          Remover
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-on-surface-variant">
                      Nenhum membro encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {invites.length > 0 && (
          <div className="bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h2 className="text-lg font-semibold">Convites Pendentes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-variant text-on-surface-variant">
                  <tr>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Perfil</th>
                    <th className="px-6 py-3 font-medium">Expira em</th>
                    <th className="px-6 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {invites.map(invite => (
                    <tr key={invite.id} className="hover:bg-surface-variant/50">
                      <td className="px-6 py-4">{invite.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[invite.role] || roleColors.viewer}`}>
                          {roleLabels[invite.role] || invite.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">
                        {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => onCancelInvite(invite.id)}>
                          Cancelar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
