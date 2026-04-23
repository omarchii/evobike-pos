interface HeaderProps {
  userName: string;
  branchName: string;
  initials: string;
}

// Header sticky superior. El tap al avatar para abrir el sheet de
// "Cerrar sesión" se cablea en G.3 — aquí queda como elemento
// presentacional para consolidar el layout.
export default function Header({ userName, branchName, initials }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--outline-var)]/30 bg-[var(--surface)]/90 px-4 py-3 backdrop-blur">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-2 ring-[var(--surf-high)]"
        style={{ background: "var(--p-container)", color: "var(--on-p-container)" }}
        aria-hidden
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight text-[var(--on-surf)]">
          {userName}
        </h1>
        <p className="truncate text-xs text-[var(--on-surf-var)]">EvoBike {branchName}</p>
      </div>
    </header>
  );
}
