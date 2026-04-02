import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { TestModeBanner } from '@/components/layout/test-mode-banner';

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <TestModeBanner />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
