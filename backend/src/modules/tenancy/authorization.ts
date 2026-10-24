export type Action = 'read' | 'create' | 'update' | 'approve' | 'delete';
export type Scope = { tenantId: string; projectId?: string; lotId?: string; zoneId?: string };
export type Grant = Scope & { moduleCode: string; action: Action };
export type RequestContext = { actorId: string; tenantId: string; isActiveMember: boolean };

/**
 * Pure policy helper only. Never use user-supplied context as proof of identity.
 * Memberships and grants must be loaded and verified server-side.
 */
export function canAccess(ctx: RequestContext, grants: readonly Grant[], target: Scope, moduleCode: string, action: Action): boolean {
  if (!ctx.actorId || !ctx.isActiveMember || ctx.tenantId !== target.tenantId) return false;
  return grants.some(g =>
    g.tenantId === target.tenantId &&
    g.moduleCode === moduleCode &&
    g.action === action &&
    (!g.projectId || g.projectId === target.projectId) &&
    (!g.lotId || g.lotId === target.lotId) &&
    (!g.zoneId || g.zoneId === target.zoneId)
  );
}
