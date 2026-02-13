import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import styles from "../styles/Players.page.module.css";
import { fetchPlayers } from "../lib/playersApi"

type Player = {
    id: string;
    name: string;
};

export default function PlayersPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [newPlayer, setNewPlayer] = useState("");

    useEffect(() => {
        const loadPlayers = async () => {
            setLoading(true);

            try {
                const data = await fetchPlayers();
                setPlayers(data);
            }
            catch (e) {
                setError("Erreur")
            }

            setLoading(false);
        };

        loadPlayers();
    }, []);

    const addPlayerToDb = async (name: string) => {
        const { data, error } = await supabase
            .from("players")
            .insert({ name })
            .select()
            .single();

        if (error) {
            setError(error.message);
            return null;
        }

        return data as Player;
    };

    const initials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        const a = parts[0]?.[0] ?? "";
        const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
        return (a + b).toUpperCase();
    };

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <header className={styles.header}>
                    <h1 className={styles.title}>Joueurs</h1>
                </header>

                <section className={styles.card}>
                    <div className={styles.cardBody}>
                        <div className={styles.topRow}>
                            <span className={styles.badge}>
                                <span className={styles.countDot} />
                                {players.length} joueur{players.length > 1 ? "s" : ""}
                            </span>
                        </div>

                        {loading ? (
                            <div className={styles.loading}>Chargement…</div>
                        ) : (
                            <>
                                <ul className={styles.list}>
                                    {players.map((player) => (
                                        <li key={player.id} className={styles.listItem}>
                                            <div className={styles.playerLeft}>
                                                <div className={styles.avatar}>
                                                    {initials(player.name)}
                                                </div>
                                                <div className={styles.playerName}>{player.name}</div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>

                                <div className={styles.form}>
                                    <div className={styles.formRow}>
                                        <input
                                            className={styles.input}
                                            type="text"
                                            value={newPlayer}
                                            placeholder="Ajouter un joueur…"
                                            onChange={(e) => setNewPlayer(e.target.value)}
                                            onKeyDown={async (e) => {
                                                if (e.key !== "Enter") return;

                                                const name = newPlayer.trim();
                                                const normalized = name.toLowerCase();
                                                if (name === "") return;

                                                if (
                                                    players.some(
                                                        (p) => p.name.toLowerCase() === normalized
                                                    )
                                                ) {
                                                    alert("Ce nom existe déjà");
                                                    setNewPlayer("");
                                                    return;
                                                }

                                                const created = await addPlayerToDb(name);
                                                if (created) {
                                                    setPlayers((prev) =>
                                                        [...prev, created].sort((a, b) =>
                                                            a.name.localeCompare(b.name)
                                                        )
                                                    );
                                                    setError(null);
                                                }
                                                setNewPlayer("");
                                            }}
                                        />

                                        <button
                                            className={styles.button}
                                            onClick={async () => {
                                                const name = newPlayer.trim();
                                                const normalized = name.toLowerCase();
                                                if (name === "") return;

                                                if (players.some((p) => p.name.toLowerCase() === normalized)) {
                                                    alert("Ce nom existe déjà");
                                                    setNewPlayer("");
                                                    return;
                                                }

                                                const created = await addPlayerToDb(name);
                                                if (created) {
                                                    setPlayers((prev) =>
                                                        [...prev, created].sort((a, b) =>
                                                            a.name.localeCompare(b.name)
                                                        )
                                                    );
                                                    setError(null);
                                                }
                                                setNewPlayer("");
                                            }}
                                        >
                                            Ajouter
                                        </button>
                                    </div>

                                    {error && <div className={styles.errorBox}>Erreur : {error}</div>}
                                </div>
                            </>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}