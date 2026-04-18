export function roleLabel(role: string): string {
    switch (role) {
        case "SELLER":
            return "Vendedor";
        case "TECHNICIAN":
            return "Técnico";
        case "MANAGER":
            return "Gerente";
        case "ADMIN":
            return "Administrador";
        default:
            return role;
    }
}
