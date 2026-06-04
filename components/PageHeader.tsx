'use client'

import { usePathname } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

const NAV_LINKS = [
  { href: '/',           label: 'feed' },
  { href: '/opgeslagen', label: 'opgeslagen' },
  { href: '/voorkeuren', label: 'voorkeuren' },
  { href: '/bronnen',    label: 'bronnen' },
]

export default function PageHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <header className="masthead">
      <div className="masthead__inner">
      <div className="masthead__top">
        <div className="masthead__brand">
          <div className="masthead__brand-row">
            <span style={{ color: 'var(--accent)', fontSize: 20 }}>◆</span>
            {title}
          </div>
        </div>
        <nav className="masthead__nav desktop-nav">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className={`masthead__nav-link${pathname === href ? ' masthead__nav-link--active' : ''}`}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="masthead__controls">
          {right}
          <LogoutButton />
        </div>
      </div>
      </div>
    </header>
  )
}
