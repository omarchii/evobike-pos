import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "./prisma";

import bcrypt from "bcryptjs";

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
                    branchId: user.branchId,
                    branch: user.branch,
                } as any;
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
                token.branchId = (user as any).branchId;
                token.branchName = (user as any).branch?.name;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.sub;
                (session.user as any).role = token.role;
                (session.user as any).branchId = token.branchId;
                (session.user as any).branchName = token.branchName;
            }
            return session;
        },
    },
    debug: process.env.NODE_ENV === "development",
};
