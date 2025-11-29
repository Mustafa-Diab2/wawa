import { redirect } from 'next/navigation';

export default function Home() {
  // For this application, we are redirecting the root to the dashboard.
  // In a real app, you might have a landing page here and redirect if the user is already logged in.
  redirect('/dashboard');
}
