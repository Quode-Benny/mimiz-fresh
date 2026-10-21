import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import credits from '../image-credits.json';
export const metadata = { title: 'Food photo credits | Mimiz' };
export default function PhotoCredits() { return <main className="credits-page"><Link className="button" href="/"><ArrowLeft size={18} />Back to the menu</Link><p className="eyebrow">THE PEOPLE BEHIND THE PHOTOS</p><h1>Food photo credits</h1><p>These photos illustrate Ghanaian food. They are not photos of meals prepared by this restaurant. Images are converted to WebP and cropped in the interface. Each image and its derivative retain the licence shown below.</p><ul>{credits.map(photo => <li key={photo.id}><h2>{photo.id.replaceAll('-', ' ')}</h2><p><a href={photo.source} target="_blank" rel="noreferrer">{photo.title}</a> by {photo.author}.</p><a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a></li>)}</ul></main>; }
