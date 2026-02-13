import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./BottomNav.module.css";

type Item = {
    href: string;
    label: string;
    icon: React.ReactNode;
};

function IconUsers() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z"
                stroke="currentColor"
                strokeWidth="1.8"
            />
            <path
                d="M4 20c1.7-3.6 5-5 8-5s6.3 1.4 8 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

function IconMatches() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.8"
            />
            <path
                d="M8 8h8M8 12h8M8 16h5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

function IconTrophy() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M8 4h8v3a4 4 0 0 1-8 0V4Z"
                stroke="currentColor"
                strokeWidth="1.8"
            />
            <path
                d="M7 7H5a2 2 0 0 0 2 2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
            <path
                d="M17 7h2a2 2 0 0 1-2 2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
            <path
                d="M12 11v3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
            <path
                d="M9 20h6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
            <path
                d="M10 14h4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

export default function BottomNav() {
    const router = useRouter();

    const items: Item[] = [
        { href: "/players", label: "Joueurs", icon: <IconUsers /> },
        { href: "/matches/new", label: "Matchs", icon: <IconMatches /> },
        { href: "/matches/standings", label: "Classement", icon: <IconTrophy /> },
    ];

    return (
        <nav className={styles.nav} role="navigation" aria-label="Navigation principale">
            <div className={styles.inner}>
                {items.map((it) => {
                    const active = router.pathname === it.href;
                    return (
                        <Link
                            key={it.href}
                            href={it.href}
                            className={`${styles.item} ${active ? styles.active : ""}`}
                        >
                            <span className={styles.icon}>{it.icon}</span>
                            <span className={styles.label}>{it.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}