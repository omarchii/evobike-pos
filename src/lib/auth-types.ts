/**
 * Forma canónica del usuario en sesión tras `getServerSession(authOptions)`.
 * Cubre los consumers del shell — API routes y pages tienen variantes
 * estrechas (solo campos que usan) declaradas inline por historia; se
 * consolidarán en una sesión dedicada.
 */
export interface SessionUser {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    branchId: string | null;
    branchName: string | null;
}
