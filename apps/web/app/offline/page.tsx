import Link from 'next/link';
import {WifiOff} from 'lucide-react';
export default function Offline(){return <main className="platform-page"><section className="panel empty"><WifiOff size={36}/><h1>You are offline.</h1><p>Reconnect to place an order or get the latest tracking updates. Orders and payments are never confirmed offline.</p><Link href="/" className="button primary">Try the menu again</Link></section></main>;}
