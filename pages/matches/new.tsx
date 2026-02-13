import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import styles from "../../styles/NewMatch.module.css";

type Player = {
    id: string;
    name: string;
};

export default function NewMatchPage() {
    const [playedAt, setPlayedAt] = useState("");
    const [team1Score, setTeam1Score] = useState("");
    const [team2Score, setTeam2Score] = useState("");
    const [t1Left, setT1Left] = useState("");
    const [t1Right, setT1Right] = useState("");
    const [t2Left, setT2Left] = useState("");
    const [t2Right, setT2Right] = useState("");

    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadPlayers = async () => {
            setLoading(true);
            setError(null);

            const { data, error } = await supabase
                .from("players")
                .select("id, name")
                .order("name", { ascending: true });

            if (cancelled) return;

            if (error) {
                setError(error.message);
                setPlayers([]);
            } else {
                setPlayers((data ?? []) as Player[]);
            }

            setLoading(false);
        };

        loadPlayers();

        return () => {
            cancelled = true;
        };
    }, []);

    const pickedPlayers = useMemo(
        () => [t1Left, t1Right, t2Left, t2Right].filter(Boolean),
        [t1Left, t1Right, t2Left, t2Right]
    );

    const validateForm = () => {
        if (playedAt === "") return "La date du match est obligatoire";
        if (team1Score === "" || team2Score === "") return "Les scores du match sont obligatoires";

        const a = Number(team1Score);
        const b = Number(team2Score);

        if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isInteger(a) || !Number.isInteger(b)) {
            return "Les scores doivent être des entiers valides";
        }

        if (a < 0 || b < 0) return "Les scores doivent être >= 0";
        if (a === b) return "Il ne peut pas y avoir d'égalité";

        if (t1Left === "" || t1Right === "" || t2Left === "" || t2Right === "") {
            return "Tous les joueurs doivent être encodés";
        }

        // Sécurité (même si ton UI empêche déjà)
        const uniq = new Set([t1Left, t1Right, t2Left, t2Right]);
        if (uniq.size !== 4) return "Un joueur ne peut pas être sélectionné deux fois";

        return null;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setFormError(null);
        setSuccessMsg(null);

        const msg = validateForm();
        if (msg) {
            setFormError(msg);
            return;
        }

        setSubmitting(true);
        try {
            // 1) Insert match
            const { data: matchData, error: matchError } = await supabase
                .from("matches")
                .insert({
                    played_at: playedAt, // date (YYYY-MM-DD) OK
                    team_a_games: Number(team1Score),
                    team_b_games: Number(team2Score),
                })
                .select("id")
                .single();

            if (matchError) {
                setFormError(matchError.message);
                return;
            }
            if (!matchData?.id) {
                setFormError("Match créé mais id manquant.");
                return;
            }

            const matchId = matchData.id as string;

            // 2) Insert participants
            const participants = [
                { match_id: matchId, player_id: t1Left, team: "A", side: "LEFT" },
                { match_id: matchId, player_id: t1Right, team: "A", side: "RIGHT" },
                { match_id: matchId, player_id: t2Left, team: "B", side: "LEFT" },
                { match_id: matchId, player_id: t2Right, team: "B", side: "RIGHT" },
            ];

            const { error: partError } = await supabase
                .from("match_participants")
                .insert(participants);

            if (partError) {
                // NB: le match est déjà créé. On peut laisser comme ça pour l’instant.
                // Plus tard : RPC/transaction ou suppression du match en cas d’échec.
                setFormError(partError.message);
                return;
            }

            setSuccessMsg("Match enregistré ✅");

            // reset simple
            setPlayedAt("");
            setTeam1Score("");
            setTeam2Score("");
            setT1Left("");
            setT1Right("");
            setT2Left("");
            setT2Right("");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className={styles.page}>
            <div className={styles.shell}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Nouveau match</h1>
                    <span className={styles.pill}>4 joueurs · 2 équipes</span>
                </div>

                <div className={styles.card}>
                    {loading && <div className={styles.state}>Chargement des joueurs…</div>}

                    {!loading && error && (
                        <div className={`${styles.state} ${styles.stateError}`}>{error}</div>
                    )}

                    {!loading && !error && (
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.topGrid}>
                                <div className={styles.field}>
                                    <label className={styles.label}>Date</label>
                                    <input
                                        className={styles.input}
                                        type="date"
                                        name="playedAt"
                                        value={playedAt}
                                        onChange={(e) => setPlayedAt(e.target.value)}
                                        disabled={submitting}
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label className={styles.label}>Équipe A</label>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        inputMode="numeric"
                                        name="team1Score"
                                        value={team1Score}
                                        onChange={(e) => setTeam1Score(e.target.value)}
                                        disabled={submitting}
                                        min={0}
                                    />
                                </div>

                                <div className={styles.field}>
                                    <label className={styles.label}>Équipe B</label>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        inputMode="numeric"
                                        name="team2Score"
                                        value={team2Score}
                                        onChange={(e) => setTeam2Score(e.target.value)}
                                        disabled={submitting}
                                        min={0}
                                    />
                                </div>
                            </div>

                            <div className={styles.teamsGrid}>
                                <div className={styles.teamCard}>
                                    <div className={styles.teamHead}>
                                        <span className={styles.teamTag}>Équipe A</span>
                                    </div>

                                    <div className={styles.row}>
                                        <span className={styles.rowLabel}>Gauche</span>
                                        <select
                                            className={styles.select}
                                            name="t1Left"
                                            value={t1Left}
                                            onChange={(e) => setT1Left(e.target.value)}
                                            disabled={submitting}
                                        >
                                            <option value="">— Choisir —</option>
                                            {players.map((player) => (
                                                <option
                                                    key={player.id}
                                                    value={player.id}
                                                    disabled={pickedPlayers.includes(player.id) && t1Left !== player.id}
                                                >
                                                    {player.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className={styles.row}>
                                        <span className={styles.rowLabel}>Droite</span>
                                        <select
                                            className={styles.select}
                                            name="t1Right"
                                            value={t1Right}
                                            onChange={(e) => setT1Right(e.target.value)}
                                            disabled={submitting}
                                        >
                                            <option value="">— Choisir —</option>
                                            {players.map((player) => (
                                                <option
                                                    key={player.id}
                                                    value={player.id}
                                                    disabled={pickedPlayers.includes(player.id) && t1Right !== player.id}
                                                >
                                                    {player.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className={styles.teamCard}>
                                    <div className={styles.teamHead}>
                                        <span className={styles.teamTag}>Équipe B</span>
                                    </div>

                                    <div className={styles.row}>
                                        <span className={styles.rowLabel}>Gauche</span>
                                        <select
                                            className={styles.select}
                                            name="t2Left"
                                            value={t2Left}
                                            onChange={(e) => setT2Left(e.target.value)}
                                            disabled={submitting}
                                        >
                                            <option value="">— Choisir —</option>
                                            {players.map((player) => (
                                                <option
                                                    key={player.id}
                                                    value={player.id}
                                                    disabled={pickedPlayers.includes(player.id) && t2Left !== player.id}
                                                >
                                                    {player.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className={styles.row}>
                                        <span className={styles.rowLabel}>Droite</span>
                                        <select
                                            className={styles.select}
                                            name="t2Right"
                                            value={t2Right}
                                            onChange={(e) => setT2Right(e.target.value)}
                                            disabled={submitting}
                                        >
                                            <option value="">— Choisir —</option>
                                            {players.map((player) => (
                                                <option
                                                    key={player.id}
                                                    value={player.id}
                                                    disabled={pickedPlayers.includes(player.id) && t2Right !== player.id}
                                                >
                                                    {player.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {(formError || successMsg) && (
                                <div
                                    className={`${styles.notice} ${formError ? styles.noticeError : styles.noticeSuccess
                                        }`}
                                >
                                    {formError ?? successMsg}
                                </div>
                            )}

                            <div className={styles.actions}>
                                <button className={styles.button} type="submit" disabled={submitting}>
                                    {submitting ? "Enregistrement…" : "Créer le match"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
}