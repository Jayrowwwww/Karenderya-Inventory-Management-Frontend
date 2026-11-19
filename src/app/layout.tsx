import type { Metadata } from "next";import "./globals.css";
import "./admin/menu/menu.css";
export const metadata:Metadata={title:"Smart Karenderya | Business Manager",description:"Sales, inventory and analytics for your karinderya."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}