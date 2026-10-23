import type { Metadata } from 'next';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './globals.css';
import './platform.css';
import './refresh.css';
import './modern.css';
import {ThemeProvider} from './theme';
import { Providers } from './providers';
export const metadata: Metadata = { title: 'Mimiz | Ghanaian favourites, made with love', description: 'Discover a fresh take on your Ghanaian favourites.' };
export default function Layout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:"try{var m=localStorage.getItem('mimiz-theme');var d=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}"}}/></head><body><ThemeProvider><Providers>{children}</Providers></ThemeProvider></body></html>}
