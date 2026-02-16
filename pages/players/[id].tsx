import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import styles from "../../styles/PlayerDetails.module.css";

type Participant = {
    player_id: string;
    team: "A" | "B";
    side: "LEFT" | "RIGHT";
};

type MatchDbRow = {
    id: string;
    played_at: string;
    team_a_games: number;
    team_b_games: number;
    match_participants: Participant[];
};

type Player = { id: string; name: string };

type MatchView = {
    matchId: string;
    date: string;
    mySide: "LEFT" | "RIGHT";
    partnerId: string;
    opponentIds: [string, string];
    win: boolean;
    scoreFor: number;
    scoreAgainst: number;
};

function fmtDate(iso: string) {
    // played_at est un date (YYYY-MM-DD). On garde simple.
    return iso;
}

function pct(rate: number) {
    return `${Math.round(rate * 100)}%`;
}

export default function PlayerDetailsPage() {
    const router = useRouter();
    const playerId = typeof router.query.id === "string" ? router.query.id : null;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [player, setPlayer] = useState<Player | null>(null);
    const [playersById, setPlayersById] = useState<Record<string, Player>>({});
    const [matches, setMatches] = useState<MatchView[]>([]);

    useEffect(() => {
        if (!playerId) return;

        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);

            try {
                // 1) Players map
                const { data: playersData, error: playersErr } = await supabase
                    .from("players")
                    .select("id, name")
                    .order("name");

                if (playersErr) throw playersErr;

                const map: Record<string, Player> = {};
                for (const p of playersData ?? []) map[p.id] = p as Player;

                if (cancelled) return;

                setPlayersById(map);
                setPlayer(map[playerId] ?? null);

                // 2) Match ids where this player participated
                const { data: mpRows, error: mpErr } = await supabase
                    .from("match_participants")
                    .select("match_id")
                    .eq("player_id", playerId);

                if (mpErr) throw mpErr;

                const matchIds = (mpRows ?? []).map((r: any) => r.match_id);

                if (matchIds.length === 0) {
                    if (!cancelled) setMatches([]);
                    return;
                }

                // 3) Matches + all participants
                const { data: matchesData, error: matchesErr } = await supabase
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
                    .in("id", matchIds)
                    .order("played_at", { ascending: false });

                if (matchesErr) throw matchesErr;

                const views: MatchView[] = [];

                for (const m of (matchesData ?? []) as any as MatchDbRow[]) {
                    const participants = m.match_participants ?? [];

                    // need exactly 4 participants (2 per team)
                    const teamA = participants.filter((p) => p.team === "A");
                    const teamB = participants.filter((p) => p.team === "B");
                    if (teamA.length !== 2 || teamB.length !== 2) continue;

                    const me = participants.find((p) => p.player_id === playerId);
                    if (!me) continue;

                    const myTeam = me.team;
                    const mySide = me.side;

                    const partner = participants.find(
                        (p) => p.team === myTeam && p.player_id !== playerId
                    );
                    if (!partner) continue;

                    const opponents = participants
                        .filter((p) => p.team !== myTeam)
                        .map((p) => p.player_id);

                    if (opponents.length !== 2) continue;

                    const aScore = Number(m.team_a_games);
                    const bScore = Number(m.team_b_games);

                    const myScore = myTeam === "A" ? aScore : bScore;
                    const oppScore = myTeam === "A" ? bScore : aScore;
                    const win = myScore > oppScore;

                    views.push({
                        matchId: m.id,
                        date: m.played_at,
                        mySide,
                        partnerId: partner.player_id,
                        opponentIds: [opponents[0], opponents[1]],
                        win,
                        scoreFor: myScore,
                        scoreAgainst: oppScore,
                    });
                }

                if (!cancelled) setMatches(views);
            } catch (e: any) {
                if (!cancelled) setError(e?.message ?? "Erreur inconnue");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [playerId]);

    const stats = useMemo(() => {
        const played = matches.length;
        const wins = matches.filter((m) => m.win).length;
        const globalRate = played === 0 ? 0 : wins / played;

        const leftMatches = matches.filter((m) => m.mySide === "LEFT");
        const rightMatches = matches.filter((m) => m.mySide === "RIGHT");

        const leftPlayed = leftMatches.length;
        const rightPlayed = rightMatches.length;

        const leftWins = leftMatches.filter((m) => m.win).length;
        const rightWins = rightMatches.filter((m) => m.win).length;

        const leftRate = leftPlayed === 0 ? 0 : leftWins / leftPlayed;
        const rightRate = rightPlayed === 0 ? 0 : rightWins / rightPlayed;

        const byPartner: Record<string, { played: number; wins: number }> = {};
        for (const m of matches) {
            const key = m.partnerId;
            if (!byPartner[key]) byPartner[key] = { played: 0, wins: 0 };
            byPartner[key].played += 1;
            if (m.win) byPartner[key].wins += 1;
        }

        const partnerRows = Object.entries(byPartner)
            .map(([partnerId, s]) => ({
                partnerId,
                partnerName: playersById[partnerId]?.name ?? "Inconnu",
                played: s.played,
                wins: s.wins,
                rate: s.played === 0 ? 0 : s.wins / s.played,
            }))
            .sort((a, b) => {
                if (b.rate !== a.rate) return b.rate - a.rate;
                return b.played - a.played;
            });

        return {
            played,
            wins,
            globalRate,
            leftPlayed,
            leftRate,
            rightPlayed,
            rightRate,
            partnerRows,
        };
    }, [matches, playersById]);

    if (!playerId) return null;

    return (
        <main className={styles.page}>
            <div className={styles.container}>
                <header className={styles.header}>
                    <button className={styles.back} onClick={() => router.back()} type="button">
                        ← Retour
                    </button>

                    <div className={styles.titleWrap}>
                        <h1 className={styles.title}>{player?.name ?? "Joueur"}</h1>
                        <p className={styles.subtitle}>Historique & statistiques</p>
                    </div>
                </header>

                {loading && <div className={styles.state}>Chargement…</div>}
                {error && <div className={styles.error}>Erreur : {error}</div>}

                {!loading && !error && (
                    <>
                        {/* STATS */}
                        <section className={styles.section}>
                            <div className={styles.sectionHead}>
                                <h2 className={styles.h2}>Stats</h2>
                            </div>

                            <div className={styles.kpiGrid}>
                                <div className={styles.kpiCard}>
                                    <div className={styles.kpiLabel}>GLOBAL</div>
                                    <div className={styles.kpiValue}>
                                        {pct(stats.globalRate)}{" "}
                                        <span className={styles.kpiSub}>({stats.played} matchs)</span>
                                    </div>
                                </div>

                                <div className={styles.kpiCard}>
                                    <div className={styles.kpiLabel}>GAUCHE</div>
                                    <div className={styles.kpiValue}>
                                        {pct(stats.leftRate)}{" "}
                                        <span className={styles.kpiSub}>({stats.leftPlayed} matchs)</span>
                                    </div>
                                </div>

                                <div className={styles.kpiCard}>
                                    <div className={styles.kpiLabel}>DROITE</div>
                                    <div className={styles.kpiValue}>
                                        {pct(stats.rightRate)}{" "}
                                        <span className={styles.kpiSub}>({stats.rightPlayed} matchs)</span>
                                    </div>
                                </div>

                                <div className={styles.kpiCard}>
                                    <div className={styles.kpiLabel}>BILAN</div>
                                    <div className={styles.kpiValue}>
                                        {stats.wins}/{stats.played} <span className={styles.kpiSub}>(V/MJ)</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* PARTNERS */}
                        <section className={styles.section}>
                            <div className={styles.sectionHead}>
                                <h2 className={styles.h2}>Taux de victoire par partenaire</h2>
                            </div>

                            {stats.partnerRows.length === 0 ? (
                                <div className={styles.state}>Aucun match à afficher.</div>
                            ) : (
                                <div className={styles.partnerGrid}>
                                    {stats.partnerRows.map((p) => (
                                        <div key={p.partnerId} className={styles.partnerCard}>
                                            <div className={styles.partnerTop}>
                                                <div className={styles.partnerName}>{p.partnerName}</div>
                                                <div className={styles.partnerRate}>{pct(p.rate)}</div>
                                            </div>
                                            <div className={styles.partnerMeta}>
                                                <span className={styles.metaPill}>{p.wins}/{p.played} victoires</span>
                                                <span className={styles.metaPill}>{p.played} matchs</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* HISTORY */}
                        <section className={styles.section}>
                            <div className={styles.sectionHead}>
                                <h2 className={styles.h2}>Historique</h2>
                            </div>

                            {matches.length === 0 ? (
                                <div className={styles.state}>Aucun match à afficher.</div>
                            ) : (
                                <div className={styles.historyGrid}>
                                    {matches.map((m) => {
                                        const partner = playersById[m.partnerId]?.name ?? "?";
                                        const o1 = playersById[m.opponentIds[0]]?.name ?? "?";
                                        const o2 = playersById[m.opponentIds[1]]?.name ?? "?";

                                        return (
                                            <article
                                                key={m.matchId}
                                                className={`${styles.matchCard} ${m.win ? styles.win : styles.loss}`}
                                            >
                                                <div className={styles.matchTop}>
                                                    <div className={styles.matchDate}>{fmtDate(m.date)}</div>
                                                    <div className={styles.matchBadge}>
                                                        {m.win ? "✅ Victoire" : "❌ Défaite"}
                                                    </div>
                                                </div>

                                                <div className={styles.matchScore}>
                                                    {m.scoreFor}–{m.scoreAgainst}
                                                    <span className={styles.matchSide}>
                                                        {m.mySide === "LEFT" ? "Gauche" : "Droite"}
                                                    </span>
                                                </div>

                                                <div className={styles.matchTeams}>
                                                    <div className={styles.teamRow}>
                                                        <div className={styles.teamLabel}>Avec</div>
                                                        <div className={styles.teamNames}>{partner}</div>
                                                    </div>

                                                    <div className={styles.teamRow}>
                                                        <div className={styles.teamLabel}>Contre</div>
                                                        <div className={styles.teamNames}>
                                                            {o1} <span className={styles.sep}>/</span> {o2}
                                                        </div>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}