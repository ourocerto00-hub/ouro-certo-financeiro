import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Ouro • Gestão Financeira',description:'Gestão financeira da Matriz e filiais.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
