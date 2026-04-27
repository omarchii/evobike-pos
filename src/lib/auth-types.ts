/**
 * Forma canónica del usuario en sesión tras `getServerSession(authOptions)`.
 * `branchId` y `branchName` son nullables porque ADMIN puede no estar
 * adscrito a una sucursal específica.
 */
export interface SessionUser {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    branchId: string | null;
    branchName: string | null;
}

/**
 * SessionUser con la garantía runtime de tener sucursal asignada — el
 * caller es responsable de validar (ej. `redirect("/login")` cuando
 * `!branchId`) antes de castearlo. Expresa el invariante de rutas que
 * filtran por sucursal sin recurrir a `string` non-null mentiroso.
 */
export type BranchedSessionUser = SessionUser & {
    branchId: string;
    branchName: string;
};
