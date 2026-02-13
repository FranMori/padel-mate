import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { fetchPlayers } from "../../lib/playersApi";
import styles from "../../styles/Standings.module.css";

type MatchRow = {
    aScore: number;
    bScore: number;
    teamA: [string, string];
    teamB: [string, string];
};

type PlayersById = Record<string, { name: string }>;

type StandingsRow = {
    playerId: string;
    name: string;
    played: number;
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
    diff: number;
    ratio: number;
};

// --- Helpers ---
function toPlayersById(players: Array<{ id: string; name: string }>): PlayersById {
    const map: PlayersById = {};
    for (const p of players) map[p.id] = { name: p.name };
    return map;
}

export default function StandingsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [playersById, setPlayersById] = useState<PlayersById>({});
    const [matches, setMatches] = useState<MatchRow[]>([]);

    const computeStandings = (playersByIdInput: PlayersById, matchesInput: MatchRow[]) => {
        const stats: Record<string, StandingsRow> = {};

        // init
        for (const playerId of Object.keys(playersByIdInput)) {
            const player = playersByIdInput[playerId];
            stats[playerId] = {
                playerId,
                name: player.name,
                played: 0,
                wins: 0,
                losses: 0,
                pointsFor: 0,
                pointsAgainst: 0,
                diff: 0,
                ratio: 0,
            };
        }

        function applyResult(playerIds: string[], forScore: number, againstScore: number, isWin: boolean) {
            for (const id of playerIds) {
                const s = stats[id];
                if (!s) continue; // sécurité si un id n'existe pas dans playersById (ou joueur supprimé)
                s.played += 1;
                s.pointsFor += forScore;
                s.pointsAgainst += againstScore;
                if (isWin) s.wins += 1;
                else s.losses += 1;
            }
        }

        // accumulate
        for (const match of matchesInput) {
            const aWon = match.aScore > match.bScore;
            applyResult(match.teamA, match.aScore, match.bScore, aWon);
            applyResult(match.teamB, match.bScore, match.aScore, !aWon);
        }

        // finalize + sort
        const rows = Object.values(stats);
        for (const row of rows) {
            row.diff = row.pointsFor - row.pointsAgainst;
            row.ratio = row.played === 0 ? 0 : row.wins / row.played;
        }

        rows.sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.diff !== a.diff) return b.diff - a.diff;
            return b.pointsFor - a.pointsFor;
        });

        return rows;
    };

    // Load players + matches from Supabase
    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);

            try {
                // Players
                const players = await fetchPlayers();
                if (cancelled) return;
                setPlayersById(toPlayersById(players));

                // Matches + participants (based on your schema)
                const { data, error } = await supabase
                    .from("matches")
                    .select(
                        `
            id,
            played_at,
            team_a_games,
            team_b_games,
            match_participants (
              player_id,
              team,
              side
            )
          `
                    )
                    .order("played_at", { ascending: false });

                if (error) throw error;
                if (cancelled) return;

                const built: MatchRow[] = [];

                for (const m of data ?? []) {
                    const aScore = Number((m as any).team_a_games);
                    const bScore = Number((m as any).team_b_games);

                    const participants = ((m as any).match_participants ?? []) as Array<{
                        player_id: string;
                        team: "A" | "B";
                        side: "LEFT" | "RIGHT";
                    }>;

                    const teamAIds = participants.filter((p) => p.team === "A").map((p) => p.player_id);
                    const teamBIds = participants.filter((p) => p.team === "B").map((p) => p.player_id);

                    if (teamAIds.length !== 2 || teamBIds.length !== 2) continue;

                    built.push({
                        aScore,
                        bScore,
                        teamA: [teamAIds[0], teamAIds[1]],
                        teamB: [teamBIds[0], teamBIds[1]],
                    });
                }

                setMatches(built);
            } catch (e: any) {
                if (!cancelled) setError(e?.message ?? "Erreur inconnue");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const standings = useMemo(() => {
        if (Object.keys(playersById).length === 0) return [];
        return computeStandings(playersById, matches);
    }, [playersById, matches]);

    return (
        <main className={styles.page}>
            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.titleWrap}>
                        <h1 className={styles.title}>Classement</h1>
                        <p className={styles.subtitle}>
                            {standings.length} joueur{standings.length > 1 ? "s" : ""} · tri par V / Diff Points / PG
                        </p>
                    </div>

                    <span className={styles.badge}>
                        <span className={styles.countDot} />
                        Classement joueurs
                    </span>
                </header>

                <section className={styles.card}>
                    <div className={styles.cardBody}>
                        {loading && <div className={styles.state}>Chargement…</div>}
                        {error && <div className={styles.error}>Erreur : {error}</div>}

                        {!loading && !error && (
                            <>
                                <div className={styles.tableWrap}>
                                    <table className={styles.table}>
                                        <colgroup>
                                            <col className={styles.colPlayer} />
                                            <col className={styles.colSmall} />
                                            <col className={styles.colSmall} />
                                            <col className={styles.colSmall} />
                                            <col className={styles.colSmall} />
                                            <col className={styles.colSmall} />
                                            <col className={styles.colDiff} />
                                            <col className={styles.colRatio} />
                                        </colgroup>
                                        <thead className={styles.thead}>
                                            <tr>
                                                <th className={styles.colPlayer}>JOUEUR</th>
                                                <th className={`${styles.num} ${styles.colSmall}`}>MJ</th>
                                                <th className={`${styles.num} ${styles.colSmall}`}>V</th>
                                                <th className={`${styles.num} ${styles.colSmall}`}>D</th>
                                                <th className={`${styles.num} ${styles.colSmall}`}>PG</th>
                                                <th className={`${styles.num} ${styles.colSmall}`}>PP</th>
                                                <th className={`${styles.num} ${styles.colDiff}`}>DIFF POINTS</th>
                                                <th className={`${styles.num} ${styles.colRatio}`}>TAUX VICTOIRE</th>
                                            </tr>
                                        </thead>

                                        <tbody className={styles.tbody}>
                                            {standings.map((row, idx) => {
                                                const diffClass =
                                                    row.diff > 0 ? styles.pillGood : row.diff < 0 ? styles.pillBad : styles.pillNeutral;

                                                return (
                                                    <tr key={row.playerId}>
                                                        <td>
                                                            <div className={styles.nameCell}>
                                                                <div className={styles.rank}>{idx + 1}</div>
                                                                <div>{row.name}</div>
                                                            </div>
                                                        </td>

                                                        <td className={styles.num}>{row.played}</td>
                                                        <td className={styles.num}>{row.wins}</td>
                                                        <td className={styles.num}>{row.losses}</td>
                                                        <td className={`${styles.num} ${styles.colSmall}`}>{row.pointsFor}</td>
                                                        <td className={`${styles.num} ${styles.colSmall}`}>{row.pointsAgainst}</td>

                                                        <td className={`${styles.pillCell} ${styles.colDiff}`}>
                                                            <span className={`${styles.pill} ${diffClass}`}>{row.diff}</span>
                                                        </td>

                                                        <td className={`${styles.pillCell} ${styles.colRatio}`}>
                                                            <span className={`${styles.pill} ${styles.pillNeutral}`}>{row.ratio.toFixed(2)}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    {standings.length === 0 && (
                                        <div className={styles.state} style={{ marginTop: 12 }}>
                                            Aucun match complet à afficher.
                                        </div>
                                    )}
                                </div>
                                <div className={styles.mobileList}>
                                    {standings.map((row, idx) => {
                                        const diffClass =
                                            row.diff > 0 ? styles.pillGood : row.diff < 0 ? styles.pillBad : styles.pillNeutral;

                                        return (
                                            <div key={row.playerId} className={styles.mobileCard}>
                                                <div className={styles.mobileTop}>
                                                    <div className={styles.mobileName}>
                                                        <div className={styles.rank}>{idx + 1}</div>
                                                        <div className={styles.mobileNameText}>{row.name}</div>
                                                    </div>

                                                    <span className={`${styles.pill} ${diffClass}`}>{row.diff}</span>
                                                </div>

                                                <div className={styles.mobileMeta}>
                                                    <div className={styles.kpi}>
                                                        <div className={styles.kpiLabel}>MJ</div>
                                                        <div className={styles.kpiValue}>{row.played}</div>
                                                    </div>
                                                    <div className={styles.kpi}>
                                                        <div className={styles.kpiLabel}>V</div>
                                                        <div className={styles.kpiValue}>{row.wins}</div>
                                                    </div>
                                                    <div className={styles.kpi}>
                                                        <div className={styles.kpiLabel}>D</div>
                                                        <div className={styles.kpiValue}>{row.losses}</div>
                                                    </div>
                                                    <div className={styles.kpi}>
                                                        <div className={styles.kpiLabel}>TV</div>
                                                        <div className={styles.kpiValue}>{row.ratio.toFixed(2)}</div>
                                                    </div>

                                                    <div className={styles.kpi}>
                                                        <div className={styles.kpiLabel}>PG</div>
                                                        <div className={styles.kpiValue}>{row.pointsFor}</div>
                                                    </div>
                                                    <div className={styles.kpi}>
                                                        <div className={styles.kpiLabel}>PP</div>
                                                        <div className={styles.kpiValue}>{row.pointsAgainst}</div>
                                                    </div>
                                                    <div className={styles.kpi}>
                                                        <div className={styles.kpiLabel}>DIFF</div>
                                                        <div className={styles.kpiValue}>{row.diff}</div>
                                                    </div>
                                                    <div className={styles.kpi}>
                                                        <div className={styles.kpiLabel}>TAUX</div>
                                                        <div className={styles.kpiValue}>{(row.ratio * 100).toFixed(0)}%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div></>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}