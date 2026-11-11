"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import type { MyMembership, Organization } from "@/lib/go/organization"

export interface OrganizationState {
  organization: Organization
  role: string
  branchId: string | null
  permissions: string[]
  can: (permission: string) => boolean
}

const OrganizationContext = createContext<OrganizationState | null>(null)

/**
 * Expõe a organização do usuário logado (membership) para a árvore cliente.
 * `membership` é null quando não há sessão ou o usuário ainda não tem organização.
 */
export function OrganizationProvider({
  membership,
  children,
}: Readonly<{
  membership: MyMembership | null
  children: ReactNode
}>) {
  const value = useMemo<OrganizationState | null>(() => {
    if (!membership) return null
    const permissions = membership.permissions
    return {
      organization: membership.organization,
      role: membership.role,
      branchId: membership.branch_id ?? null,
      permissions,
      can: (permission) => permissions.includes(permission),
    }
  }, [membership])

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

/** Organização, papel, filial e permissões do usuário. Retorna null sem organização. */
export function useOrganization(): OrganizationState | null {
  return useContext(OrganizationContext)
}
