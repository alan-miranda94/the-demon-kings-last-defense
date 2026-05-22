import "@/styles/globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "A Ultima Defesa do Rei Demonio",
    description:
        "Invoque criaturas, obstaculos e magia para impedir o heroi de chegar ao castelo.",
    icons: {
        icon: "/favicon.ico",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <html lang="pt-BR">
            <header>
                <script
                    defer
                    src="https://code.responsivevoice.org/responsivevoice.js?key=HTJg0jte"
                ></script>
            </header>
            <body>{children}</body>
        </html>
    );
}

