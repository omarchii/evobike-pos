import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { AuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";
import bcrypt from "bcryptjs";

declare module "next-auth" {
    interface User {
        role: string;
        branchId: string;
        branch: { name: string } | null;
    }
    interface Session {
        user: {
            id: string;
            role: string;
            branchId: string;
            branchName: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: string;
        branchId?: string;
        branchName?: string;
    }
}

export const authOptions: AuthOptions = {
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email", placeholder: "admin@evobike.mx" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Credenciales incompletas");
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                    include: { branch: true },
                });

                if (!user) {
                    throw new Error("Usuario no encontrado");
                }

                if (user.isActive === false) {
                    throw new Error("Usuario desactivado");
                }

                // Compare hashed password
                const isPasswordValid = bcrypt.compareSync(credentials.password, user.password);

                if (!isPasswordValid) {
                    throw new Error("Contraseña incorrecta");
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    branchId: user.branchId ?? "",
                    branch: user.branch,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as User).role;
                token.branchId = (user as User).branchId;
                token.branchName = (user as User).branch?.name;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub!;
                session.user.role = token.role!;
                session.user.branchId = token.branchId!;
                session.user.branchName = token.branchName!;
            }
            return session;
        },
    },
    debug: process.env.NODE_ENV === "development",
};
