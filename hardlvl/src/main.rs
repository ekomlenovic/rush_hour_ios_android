// ─────────────────────────────────────────────────────────────────────────────
//  Rush Hour – Level Generator (Ultra-Optimized + Evolutionary Hill Climbing)
// ─────────────────────────────────────────────────────────────────────────────

use std::{
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc,
    },
    time::Instant,
};

use clap::Parser;
use rand::{rngs::SmallRng, Rng, SeedableRng};
use rayon::prelude::*;
use rustc_hash::FxHashSet;
use serde::{Deserialize, Serialize};

const MAX_VEHICLES: usize = 20;
type StateArray = [u8; MAX_VEHICLES];

// ── CLI ───────────────────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
#[command(name = "rush_hour_gen", about = "Evolutionary Rush Hour generator")]
struct Cli {
    #[arg(long, default_value_t = 0)]
    hard: u32,
    #[arg(long, default_value_t = 0)]
    expert: u32,
    #[arg(long, default_value_t = 1)]
    start_id: u32,
    #[arg(short, long, default_value = "levels.json")]
    output: String,
    /// Nombre de redémarrages (restarts) si l'évolution se bloque
    #[arg(long, default_value_t = 50_000)]
    max_restarts: u32,
    #[arg(long, default_value_t = 0)]
    threads: usize,
}

// ── Data model ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Vehicle {
    id: String,
    row: u8,
    col: u8,
    length: u8,
    orientation: String,
    is_target: bool,
    color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Level {
    id: u32,
    grid_size: u8,
    exit_row: u8,
    exit_col: u8,
    min_moves: u32,
    vehicles: Vec<Vehicle>,
}

#[derive(Debug, Clone, Copy)]
struct DifficultyConfig {
    grid_size: u8,
    min_vehicles: usize,
    max_vehicles: usize,
    min_moves: u32,
    max_moves: u32,
}

// ── NOUVELLES CONFIGURATIONS BASSÉES SUR TES DONNÉES ──────────────────────────

const HARD: DifficultyConfig = DifficultyConfig {
    grid_size: 6,
    min_vehicles: 10,
    max_vehicles: 14,
    min_moves: 20,
    max_moves: 35,
};

const EXPERT: DifficultyConfig = DifficultyConfig {
    grid_size: 6,
    min_vehicles: 12,
    max_vehicles: 16,
    min_moves: 35,
    max_moves: 50,
};




const COLORS: &[&str] = &[
    "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#06B6D4", "#8B5CF6", "#F97316", "#64748B", "#14B8A6",
];

// ── Internal Board Representation ─────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct VehicleData {
    pos: u8, // col if horiz, row if vert
    fixed: u8, // row if horiz, col if vert
    length: u8,
    horizontal: bool,
}

// Vérifie si une configuration de véhicules est valide (pas de chevauchement ni hors limites)
fn is_valid_board(vehicles: &[VehicleData], gs: u8) -> bool {
    let mut grid = [[false; 10]; 10];
    for v in vehicles {
        if v.pos + v.length > gs || v.fixed >= gs {
            return false;
        }
        for i in 0..v.length {
            let (r, c) = if v.horizontal {
                (v.fixed as usize, (v.pos + i) as usize)
            } else {
                ((v.pos + i) as usize, v.fixed as usize)
            };
            if grid[r][c] { return false; }
            grid[r][c] = true;
        }
    }
    true
}

// ── BFS ───────────────────────────────────────────────────────────────────────

// OPTIMISATION MAJEURE: Sur une grille 6x6, la position (pos) va au max de 0 à 4.
// 3 bits suffisent pour stocker un chiffre de 0 à 7. 
// Pour 20 voitures max: 20 * 3 bits = 60 bits. On passe tout en u64 au lieu de u128 !
const BITS: u32 = 3;

#[inline(always)]
fn encode_state(positions: &StateArray, n: usize) -> u64 {
    let mut key: u64 = 0;
    for i in 0..n {
        key |= (positions[i] as u64) << (i as u32 * BITS);
    }
    key
}

#[inline(always)]
fn cell_occupied(
    pos: &StateArray,
    is_horiz: &[bool; MAX_VEHICLES],
    fixed: &[u8; MAX_VEHICLES],
    lengths: &[u8; MAX_VEHICLES],
    n: usize,
    row: u8,
    col: u8,
    skip: usize,
) -> bool {
    for i in 0..n {
        if i == skip { continue; }
        if is_horiz[i] {
            if fixed[i] == row && col >= pos[i] && col < pos[i] + lengths[i] { return true; }
        } else {
            if fixed[i] == col && row >= pos[i] && row < pos[i] + lengths[i] { return true; }
        }
    }
    false
}

fn bfs(
    n: usize,
    is_horiz: &[bool; MAX_VEHICLES],
    fixed: &[u8; MAX_VEHICLES],
    lengths: &[u8; MAX_VEHICLES],
    grid_size: u8,
    exit_col: u8,
    init_positions: &StateArray,
    depth_limit: u32,
) -> u32 {
    let init_key = encode_state(init_positions, n);
    // Utilisation de u64 : plus rapide à hacher, moins de RAM allouée.
    let mut visited: FxHashSet<u64> = FxHashSet::with_capacity_and_hasher(1 << 15, Default::default());
    visited.insert(init_key);

    let mut queue: Vec<(StateArray, u32)> = Vec::with_capacity(1 << 15);
    queue.push((*init_positions, 0));
    let mut head = 0usize;

    while head < queue.len() {
        let (pos, depth) = queue[head];
        head += 1;

        if depth >= depth_limit { continue; }

        for vi in 0..n {
            let cur = pos[vi];
            let vlen = lengths[vi];

            if is_horiz[vi] {
                let row = fixed[vi];
                // Slide LEFT
                let mut nc = cur as i16 - 1;
                while nc >= 0 {
                    if cell_occupied(&pos, is_horiz, fixed, lengths, n, row, nc as u8, vi) { break; }
                    let mut next = pos;
                    next[vi] = nc as u8;
                    let key = encode_state(&next, n);
                    if visited.insert(key) { queue.push((next, depth + 1)); }
                    nc -= 1;
                }
                // Slide RIGHT
                let mut nc = cur + 1;
                while (nc + vlen - 1) < grid_size {
                    let tip = nc + vlen - 1;
                    if cell_occupied(&pos, is_horiz, fixed, lengths, n, row, tip, vi) { break; }
                    let mut next = pos;
                    next[vi] = nc;
                    let key = encode_state(&next, n);
                    if visited.insert(key) {
                        if vi == 0 && tip >= exit_col { return depth + 1; }
                        queue.push((next, depth + 1));
                    }
                    nc += 1;
                }
            } else {
                let col = fixed[vi];
                // Slide UP
                let mut nr = cur as i16 - 1;
                while nr >= 0 {
                    if cell_occupied(&pos, is_horiz, fixed, lengths, n, nr as u8, col, vi) { break; }
                    let mut next = pos;
                    next[vi] = nr as u8;
                    let key = encode_state(&next, n);
                    if visited.insert(key) { queue.push((next, depth + 1)); }
                    nr -= 1;
                }
                // Slide DOWN
                let mut nr = cur + 1;
                while (nr + vlen - 1) < grid_size {
                    let tip = nr + vlen - 1;
                    if cell_occupied(&pos, is_horiz, fixed, lengths, n, tip, col, vi) { break; }
                    let mut next = pos;
                    next[vi] = nr;
                    let key = encode_state(&next, n);
                    if visited.insert(key) { queue.push((next, depth + 1)); }
                    nr += 1;
                }
            }
        }
    }
    u32::MAX
}

fn solve_board(vehicles: &[VehicleData], gs: u8, max_moves: u32) -> u32 {
    let n = vehicles.len();
    let mut is_horiz = [false; MAX_VEHICLES];
    let mut fixed = [0; MAX_VEHICLES];
    let mut lengths = [0; MAX_VEHICLES];
    let mut init_pos = [0; MAX_VEHICLES];

    for (i, v) in vehicles.iter().enumerate() {
        is_horiz[i] = v.horizontal;
        fixed[i] = v.fixed;
        lengths[i] = v.length;
        init_pos[i] = v.pos;
    }

    bfs(n, &is_horiz, &fixed, &lengths, gs, gs - 1, &init_pos, max_moves)
}

// ── Evolutionary Algorithm (Hill Climbing) ────────────────────────────────────

fn random_board(cfg: DifficultyConfig, rng: &mut SmallRng) -> Vec<VehicleData> {
    let mut vehicles = Vec::new();
    let target_row = (cfg.grid_size / 2 - 1) as u8;
    
    // 1. Voiture cible (toujours index 0)
    vehicles.push(VehicleData {
        pos: rng.gen_range(0..=(cfg.grid_size - 3)), // La longueur 2 nécessite -3 pour la position
        fixed: target_row,
        length: 2,
        horizontal: true,
    });

    // 2. Remplissage aléatoire
    let target_count = rng.gen_range(cfg.min_vehicles..=cfg.max_vehicles);
    let mut attempts = 0;
    while vehicles.len() < target_count && attempts < 100 {
        let length = if rng.gen_bool(0.3) { 3 } else { 2 };
        let horizontal = rng.gen_bool(0.5);
        let pos = rng.gen_range(0..=(cfg.grid_size - length));
        let fixed = rng.gen_range(0..cfg.grid_size);

        // Ne pas bloquer trivialement la ligne de sortie avec une voiture horizontale
        if horizontal && fixed == target_row && pos > vehicles[0].pos {
            attempts += 1; continue;
        }

        let new_v = VehicleData { pos, fixed, length, horizontal };
        vehicles.push(new_v);
        
        if !is_valid_board(&vehicles, cfg.grid_size) {
            vehicles.pop(); // Revert
        }
        attempts += 1;
    }
    vehicles
}

fn mutate(board: &[VehicleData], cfg: DifficultyConfig, rng: &mut SmallRng) -> Option<Vec<VehicleData>> {
    let mut new_board = board.to_vec();
    let action = rng.gen_range(0..3);

    match action {
        0 => { // Déplacer/Modifier une voiture existante
            if new_board.len() > 1 {
                let idx = rng.gen_range(1..new_board.len());
                let length = if rng.gen_bool(0.2) { 3 } else { 2 };
                let horizontal = rng.gen_bool(0.5);
                new_board[idx] = VehicleData {
                    pos: rng.gen_range(0..=(cfg.grid_size - length)),
                    fixed: rng.gen_range(0..cfg.grid_size),
                    length,
                    horizontal,
                };
            }
        }
        1 => { // Ajouter une voiture
            if new_board.len() < cfg.max_vehicles {
                let length = if rng.gen_bool(0.3) { 3 } else { 2 };
                let horizontal = rng.gen_bool(0.5);
                new_board.push(VehicleData {
                    pos: rng.gen_range(0..=(cfg.grid_size - length)),
                    fixed: rng.gen_range(0..cfg.grid_size),
                    length,
                    horizontal,
                });
            }
        }
        2 => { // Supprimer une voiture
            if new_board.len() > cfg.min_vehicles {
                let idx = rng.gen_range(1..new_board.len());
                new_board.remove(idx);
            }
        }
        _ => {}
    }

    if is_valid_board(&new_board, cfg.grid_size) { Some(new_board) } else { None }
}

fn generate_evolutionary(level_id: u32, cfg: DifficultyConfig, max_restarts: u32) -> Option<(Level, u32)> {
    let attempts = Arc::new(AtomicU32::new(0));

    let result = (0..max_restarts).into_par_iter().find_map_any(|attempt_idx| {
        attempts.fetch_add(1, Ordering::Relaxed);
        let mut rng = SmallRng::seed_from_u64(rand::random::<u64>() ^ attempt_idx as u64);
        
        // Point de départ
        let mut current_board = random_board(cfg, &mut rng);
        let mut current_score = solve_board(&current_board, cfg.grid_size, cfg.max_moves);
        if current_score == u32::MAX { current_score = 0; }

        let max_mutations = 2000; // Mutations par restart
        let mut stuck_counter = 0;

        for _ in 0..max_mutations {
            if let Some(mutated_board) = mutate(&current_board, cfg, &mut rng) {
                let new_score = solve_board(&mutated_board, cfg.grid_size, cfg.max_moves);
                
                // On accepte si c'est résoluble ET que c'est au moins aussi difficile
                if new_score != u32::MAX && new_score >= current_score {
                    if new_score > current_score { stuck_counter = 0; } else { stuck_counter += 1; }
                    
                    current_board = mutated_board;
                    current_score = new_score;

                    // Si on atteint la plage cible, on a gagné !
                    if current_score >= cfg.min_moves && current_score <= cfg.max_moves {
                        return Some((current_board, current_score));
                    }
                }
            }
            // Anti-blocage : si on tourne en rond, on casse la boucle pour trigger un restart
            if stuck_counter > 150 { break; }
        }
        None
    });

    if let Some((final_board, moves)) = result {
        let vehicles = final_board.iter().enumerate().map(|(i, v)| Vehicle {
            id: if i == 0 { "target".to_string() } else { format!("v{}", i) },
            row: if v.horizontal { v.fixed } else { v.pos },
            col: if v.horizontal { v.pos } else { v.fixed },
            length: v.length,
            orientation: if v.horizontal { "horizontal".into() } else { "vertical".into() },
            is_target: i == 0,
            color: if i == 0 { "#EF4444".into() } else { COLORS[i % COLORS.len()].into() },
        }).collect();

        Some((
            Level {
                id: level_id,
                grid_size: cfg.grid_size,
                exit_row: (cfg.grid_size / 2 - 1) as u8,
                exit_col: cfg.grid_size - 1,
                min_moves: moves,
                vehicles,
            },
            attempts.load(Ordering::Relaxed),
        ))
    } else {
        None
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

fn main() {
    let cli = Cli::parse();
    if cli.threads > 0 { rayon::ThreadPoolBuilder::new().num_threads(cli.threads).build_global().unwrap(); }

    println!("╔══════════════════════════════════════════════════╗");
    println!("║ Rush Hour Gen — Évolution & Optimisation Extrême ║");
    println!("╚══════════════════════════════════════════════════╝");
    
    let global_start = Instant::now();
    let mut all_levels = Vec::new();
    let mut current_id = cli.start_id;

    let configs = [(cli.hard, HARD, "HARD"), (cli.expert, EXPERT, "EXPERT")];

    for (count, cfg, label) in configs {
        for i in 1..=count {
            let t0 = Instant::now();
            if let Some((level, restarts)) = generate_evolutionary(current_id, cfg, cli.max_restarts) {
                println!("  [{:<6} {:>2}/{:<2}] id={:>3} | {:>2} coups | {:>5} restarts | {:.2?}", 
                         label, i, count, current_id, level.min_moves, restarts, t0.elapsed());
                all_levels.push(level);
                current_id += 1;
            } else {
                eprintln!("  [{:<6} {:>2}/{:<2}] ÉCHEC après {} restarts", label, i, count, cli.max_restarts);
            }
        }
    }

    let json_str = serde_json::to_string_pretty(&all_levels).unwrap();
    std::fs::write(&cli.output, &json_str).unwrap();
    println!("\n  Génération terminée en {:.2?}! Fichier écrit: {}", global_start.elapsed(), cli.output);
}