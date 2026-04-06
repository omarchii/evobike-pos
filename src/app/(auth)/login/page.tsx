"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, Mail } from "lucide-react";

const loginSchema = z.object({
    email: z.string().email({ message: "Ingresa un email válido" }),
    password: z.string().min(1, { message: "La contraseña es requerida" }),
});

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    async function onSubmit(values: z.infer<typeof loginSchema>) {
        setIsLoading(true);

        try {
            const response = await signIn("credentials", {
                redirect: false,
                email: values.email,
                password: values.password,
            });

            if (response?.error) {
                toast.error("Error al iniciar sesión", {
                    description: response.error,
                });
                return;
            }

            toast.success("¡Bienvenido a EVOBIKE POS!");
            router.push("/dashboard");
            router.refresh();
        } catch {
            toast.error("Error del sistema. Intenta nuevamente.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-900">
            {/* HER0 / BRANDING SIDE (Hidden on mobile) */}
            <div className="hidden lg:flex flex-col relative w-1/2 bg-emerald-950 overflow-hidden items-center justify-center">
                {/* Background Image overlaid with Emerald Tint */}
                <Image
                    src="/login-hero.png"
                    fill
                    className="object-cover absolute inset-0 opacity-40 mix-blend-luminosity"
                    alt="EVOBIKE Hero"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 to-transparent z-0"></div>

                {/* Decorative Leaves */}
                <Image
                    src="/leaves.png"
                    width={400}
                    height={400}
                    className="absolute -top-10 -right-20 opacity-30 invert drop-shadow-2xl"
                    alt="Leaves"
                />

                <div className="z-10 text-center text-white px-12 max-w-lg">
                    <div className="bg-white/10 p-8 rounded-3xl backdrop-blur-md border border-white/20 shadow-2xl">
                        <Image
                            src="/evobike-logo.webp"
                            width={320}
                            height={120}
                            className="mx-auto drop-shadow-lg"
                            alt="EVOBIKE Logo"
                        />
                        <div className="w-16 h-1 bg-emerald-500 mx-auto my-8 rounded-full"></div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Punto de Venta y Control</h1>
                        <p className="text-emerald-100 text-lg">
                            Gestión integral de tu taller mecánico, inventario y experiencia del cliente.
                        </p>
                    </div>
                </div>
            </div>

            {/* LOGIN FORM SIDE */}
            <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-slate-950 relative">

                {/* Mobile Logo Fallback */}
                <div className="absolute top-8 left-8 lg:hidden">
                    <Image src="/evobike-logo.webp" width={150} height={50} alt="Logo" className="dark:invert" />
                </div>

                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Iniciar Sesión
                        </h2>
                        <p className="text-sm text-slate-500 mt-2">
                            Ingresa tus credenciales para acceder al sistema operativo.
                        </p>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-8">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-slate-700 dark:text-slate-300">Correo Electrónico</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Mail className="h-5 w-5 text-slate-400" />
                                                </div>
                                                <Input
                                                    placeholder="admin@evobike.mx"
                                                    type="email"
                                                    autoCapitalize="none"
                                                    autoComplete="email"
                                                    autoCorrect="off"
                                                    disabled={isLoading}
                                                    className="pl-10 h-12 bg-slate-50 dark:bg-slate-900 border-none ring-1 ring-slate-200 dark:ring-slate-800 focus-visible:ring-emerald-500 text-md"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center justify-between">
                                            <FormLabel className="text-slate-700 dark:text-slate-300">Contraseña</FormLabel>
                                            <a href="#" className="text-xs text-emerald-600 hover:text-emerald-500 font-medium">
                                                ¿Olvidaste tu contraseña?
                                            </a>
                                        </div>
                                        <FormControl>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Lock className="h-5 w-5 text-slate-400" />
                                                </div>
                                                <Input
                                                    placeholder="••••••••"
                                                    type="password"
                                                    autoComplete="current-password"
                                                    disabled={isLoading}
                                                    className="pl-10 h-12 bg-slate-50 dark:bg-slate-900 border-none ring-1 ring-slate-200 dark:ring-slate-800 focus-visible:ring-emerald-500 text-md"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button
                                className="w-full h-12 text-md font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5"
                                type="submit"
                                disabled={isLoading}
                            >
                                {isLoading ? "Autenticando..." : "Entrar al Sistema"}
                            </Button>
                        </form>
                    </Form>

                    <div className="text-center text-xs text-slate-400 mt-12">
                        &copy; {new Date().getFullYear()} EVOBIKE México. Todos los derechos reservados.
                    </div>
                </div>
            </div>
        </div>
    );
}
