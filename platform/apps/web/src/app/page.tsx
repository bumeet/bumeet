import { redirect } from 'next/navigation';
import LandingPage from './landing';

export default function RootPage() {
  if (process.env.NEXT_PUBLIC_SITE_MODE === 'app') {
    redirect('/login');
  }
  return <LandingPage />;
}
