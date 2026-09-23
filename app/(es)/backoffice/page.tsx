import type { Metadata } from 'next';
import { BackofficeApp } from '@/components/backoffice/backoffice-app';

export const metadata: Metadata = { title: 'Backoffice — Entreclases', robots: { index: false, follow: false, noarchive: true } };

export default function BackofficePage() { return <BackofficeApp locale='es' />; }
