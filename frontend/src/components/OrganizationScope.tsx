import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { goErrorInfo } from "@/lib/go/errors";
import { getMyMembership } from "@/lib/go/organization";
import { hasSession } from "@/lib/session";

/**
 * Busca o membership do usuário (GET /api/v1/organizations/me/membership) e o entrega ao
 * OrganizationProvider. Sem sessão, ou sem organização, o provider recebe null.
 */
export default async function OrganizationScope({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  if (!hasSession(cookieStore)) {
    return <OrganizationProvider membership={null}>{children}</OrganizationProvider>;
  }

  const membership = await getMyMembership().catch((err: unknown) => {
    // Usuário sem organização é esperado (NO_ORG ou 404); qualquer outra falha fica registrada.
    const { code, status } = goErrorInfo(err);
    const noOrg = code === "NO_ORG" || (code === "NOT_FOUND" && status === 404);
    if (!noOrg) {
      console.error("OrganizationScope: falha ao carregar membership", err);
    }
    return null;
  });

  return <OrganizationProvider membership={membership}>{children}</OrganizationProvider>;
}
