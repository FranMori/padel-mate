// lib/playersApi.ts
import { supabase } from "./supabaseClient";

export type Player = { id: string; name: string };

export async function fetchPlayers(): Promise<Player[]> {
    const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .order("name");

    if (error) throw error;
    return data ?? [];
}