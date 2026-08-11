import Link from 'next/link';

const QUICK_LINKS = [
  { href: '/courses', label: 'Courses' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

const LEGAL_LINKS = [
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/refunds', label: 'Refund Policy' },
];

export function Footer() {
  return (
    <footer className="bg-surface border-t border-border mt-24">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <p className="text-lg font-bold text-primary mb-2">Grammarcetamol</p>
          <p className="text-sm text-text-secondary">
            Structured English lessons, live classes, and expert instructors to help you learn with confidence.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-text-primary mb-3">Quick Links</p>
          <ul className="flex flex-col gap-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-text-secondary hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-text-primary mb-3">Legal</p>
          <ul className="flex flex-col gap-2">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-text-secondary hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-text-primary mb-3">Get in Touch</p>
          <p className="text-sm text-text-secondary mb-3">Have a question? We&apos;re happy to help.</p>
          <Link href="/contact" className="text-sm font-medium text-primary hover:underline">
            Contact Support →
          </Link>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-text-muted">
          © {new Date().getFullYear()} Grammarcetamol. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
