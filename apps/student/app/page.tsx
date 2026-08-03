import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-lg">
        <h1 className="text-4xl font-bold text-primary mb-4">Grammarcetamol</h1>
        <p className="text-[#64748B] text-lg mb-8">
          Master English with structured lessons, live classes, and expert instructors.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/login"
            className="px-6 py-3 bg-primary text-white rounded-md font-medium hover:bg-primary-light transition-colors duration-150">
            Sign In
          </Link>
          <Link href="/register"
            className="px-6 py-3 bg-surface border border-primary text-primary rounded-md font-medium hover:bg-background transition-colors duration-150">
            Get Started
          </Link>
        </div>
      </div>
    </main>
  );
}
