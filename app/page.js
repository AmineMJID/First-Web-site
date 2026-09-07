// Root: proxy.js redirects authenticated users to their dashboard; others land on /login.
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}
