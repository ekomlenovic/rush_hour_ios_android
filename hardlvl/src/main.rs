// ─────────────────────────────────────────────────────────────────────────────
//  Rush Hour – Level Generator
//
//  Format JSON : { exitRow, exitCol } où (exitRow, exitCol) est la case
//  hors-grille par laquelle la voiture cible sort.
//
//  Règles de cohérence exit ↔ voiture cible :
//    - exit sur bord droit  (exitCol == gs)     → cible horizontale, cible.fixed == exitRow
//    - exit sur bord gauche (exitCol == -1 → 255) → cible horizontale, cible.fixed == exitRow
//    - exit sur bord bas    (exitRow == gs)     → cible verticale,   cible.fixed == exitCol
//    - exit sur bord haut   (exitRow == -1 → 255) → cible verticale, cible.fixed == exitCol
//
//  Optimisations : bitboard u64, VecDeque BFS, FxHashSet réutilisé,
//                  max_bfs_states (abandon board insoluble), par_iter 1-level/cœur,
//                  écriture incrémentale JSON.
// ─────────────────────────────────────────────────────────────────────────────

use std::{
    collections::VecDeque,
    io::{BufWriter, Write},
    fs::File,
    sync::atomic::{AtomicU32, Ordering},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
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
#[command(name = "rush_hour_gen")]
struct Cli {
    #[arg(long, default_value_t = 0)]  easy:   u32,
    #[arg(long, default_value_t = 0)]  normal: u32,
    #[arg(long, default_value_t = 0)]  hard:   u32,
    #[arg(long, default_value_t = 0)]  expert: u32,
    #[arg(long, default_value_t = 0)]  master: u32,
    #[arg(long, default_value_t = 1)]  start_id: u32,
    #[arg(short, long, default_value = "levels.json")] output: String,
    #[arg(long, default_value_t = 50_000)] max_restarts: u32,
    #[arg(long, default_value_t = 0)]  threads: usize,
    /// Max états BFS avant d'abandonner un board insoluble (ex: 300000)
    #[arg(long, default_value_t = 300_000)] max_bfs_states: usize,
}

// ── Exit ──────────────────────────────────────────────────────────────────────

/// La sortie est décrite par la case hors-grille où sort la voiture cible.
/// On stocke aussi quel bord est concerné pour la logique BFS/génération.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ExitSide { Right, Left, Bottom, Top }

impl ExitSide {
    fn random(rng: &mut SmallRng) -> Self {
        match rng.gen_range(0..4u8) {
            0 => ExitSide::Right,
            1 => ExitSide::Left,
            2 => ExitSide::Bottom,
            _ => ExitSide::Top,
        }
    }

    /// La voiture cible est horizontale pour Left/Right, verticale pour Top/Bottom.
    fn target_horizontal(self) -> bool {
        matches!(self, ExitSide::Right | ExitSide::Left)
    }

    /// Calcule (exitRow, exitCol) = case hors-grille selon le bord et la position fixe.
    ///
    /// `fixed` est :
    ///   - la ligne de la voiture cible pour Left/Right
    ///   - la colonne de la voiture cible pour Top/Bottom
    fn exit_cell(self, fixed: u8, gs: u8) -> (u8, u8) {
        match self {
            ExitSide::Right  => (fixed, gs),       // col == gs (hors droite)
            ExitSide::Left   => (fixed, 255),      // col == 255 repr. -1 (hors gauche)
            ExitSide::Bottom => (gs,    fixed),    // row == gs (hors bas)
            ExitSide::Top    => (255,   fixed),    // row == 255 repr. -1 (hors haut)
        }
    }
}

// ── Data model ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Vehicle {
    id:          String,
    row:         u8,
    col:         u8,
    length:      u8,
    orientation: String,
    is_target:   bool,
    color:       String,
}

/// Format JSON identique à l'original : exitRow + exitCol
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Level {
    id:         u32,
    grid_size:  u8,
    exit_row:   u8,   // ligne hors-grille (255 = -1 pour bord haut)
    exit_col:   u8,   // colonne hors-grille (255 = -1 pour bord gauche)
    min_moves:  u32,
    vehicles:   Vec<Vehicle>,
    updated_at: u64,
}

#[derive(Debug, Clone, Copy)]
struct DifficultyConfig {
    grid_size:    u8,
    min_vehicles: usize,
    max_vehicles: usize,
    min_moves:    u32,
    max_moves:    u32,
}

#[derive(Debug, Clone, Copy)]
struct Task {
    id:         u32,
    cfg:        DifficultyConfig,
    label:      &'static str,
    idx:        u32,
    count:      u32,
    exit_side:  ExitSide,
    max_states: usize,
}

// ── Internal Board Representation ─────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct VehicleData {
    pos:        u8,   // col si horizontal, row si vertical
    fixed:      u8,   // row si horizontal, col si vertical
    length:     u8,
    horizontal: bool,
}

fn is_valid_board(vehicles: &[VehicleData], gs: u8) -> bool {
    let mut grid = [[false; 10]; 10];
    for v in vehicles {
        if v.pos + v.length > gs || v.fixed >= gs { return false; }
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

// ── Bitboard ──────────────────────────────────────────────────────────────────

#[inline(always)]
fn build_bitboard(
    pos:      &StateArray,
    is_horiz: &[bool; MAX_VEHICLES],
    fixed:    &[u8;   MAX_VEHICLES],
    lengths:  &[u8;   MAX_VEHICLES],
    n:        usize,
    gs:       u8,
) -> u64 {
    let mut board: u64 = 0;
    for i in 0..n {
        for k in 0..lengths[i] {
            let (r, c) = if is_horiz[i] { (fixed[i], pos[i] + k) } else { (pos[i] + k, fixed[i]) };
            board |= 1u64 << (r * gs + c);
        }
    }
    board
}

#[inline(always)]
fn clear_vehicle_bits(
    board:    u64,
    pos:      &StateArray,
    is_horiz: &[bool; MAX_VEHICLES],
    fixed:    &[u8;   MAX_VEHICLES],
    lengths:  &[u8;   MAX_VEHICLES],
    skip:     usize,
    gs:       u8,
) -> u64 {
    let mut b = board;
    for k in 0..lengths[skip] {
        let (r, c) = if is_horiz[skip] { (fixed[skip], pos[skip] + k) } else { (pos[skip] + k, fixed[skip]) };
        b &= !(1u64 << (r * gs + c));
    }
    b
}

#[inline(always)]
fn bit_set(board: u64, r: u8, c: u8, gs: u8) -> bool {
    board & (1u64 << (r * gs + c)) != 0
}

// ── BFS ───────────────────────────────────────────────────────────────────────

const BITS: u32 = 3;

#[inline(always)]
fn encode_state(positions: &StateArray, n: usize) -> u64 {
    let mut key: u64 = 0;
    for i in 0..n { key |= (positions[i] as u64) << (i as u32 * BITS); }
    key
}

/// Conditions de victoire pour la voiture cible (vi == 0) :
///
///   ExitSide::Right  : cible horizontale, dernier bout atteint >= gs-1
///   ExitSide::Left   : cible horizontale, pos == 0 (peut encore reculer hors gauche)
///   ExitSide::Bottom : cible verticale,   dernier bout atteint >= gs-1
///   ExitSide::Top    : cible verticale,   pos == 0
///
/// Abandon anticipé si visited.len() >= max_states → board insoluble / trop dur.
fn bfs(
    n:          usize,
    is_horiz:   &[bool; MAX_VEHICLES],
    fixed:      &[u8;   MAX_VEHICLES],
    lengths:    &[u8;   MAX_VEHICLES],
    gs:         u8,
    init:       &StateArray,
    depth_lim:  u32,
    exit_side:  ExitSide,
    max_states: usize,
    visited:    &mut FxHashSet<u64>,
) -> u32 {
    visited.clear();
    visited.insert(encode_state(init, n));

    let mut queue: VecDeque<(StateArray, u32)> = VecDeque::with_capacity(1 << 14);
    queue.push_back((*init, 0));

    while let Some((pos, depth)) = queue.pop_front() {
        if depth >= depth_lim { continue; }

        let full = build_bitboard(&pos, is_horiz, fixed, lengths, n, gs);

        for vi in 0..n {
            let cur  = pos[vi];
            let vlen = lengths[vi];
            let wo   = clear_vehicle_bits(full, &pos, is_horiz, fixed, lengths, vi, gs);

            if is_horiz[vi] {
                let row = fixed[vi];

                // ← gauche
                let mut nc = cur as i16 - 1;
                while nc >= 0 {
                    if bit_set(wo, row, nc as u8, gs) { break; }
                    let mut next = pos; next[vi] = nc as u8;
                    let key = encode_state(&next, n);
                    if visited.insert(key) {
                        if vi == 0 && exit_side == ExitSide::Left && nc == 0 {
                            return depth + 1;
                        }
                        if visited.len() >= max_states { return u32::MAX; }
                        queue.push_back((next, depth + 1));
                    }
                    nc -= 1;
                }

                // → droite
                let mut nc = cur + 1;
                while nc + vlen - 1 < gs {
                    let tip = nc + vlen - 1;
                    if bit_set(wo, row, tip, gs) { break; }
                    let mut next = pos; next[vi] = nc;
                    let key = encode_state(&next, n);
                    if visited.insert(key) {
                        if vi == 0 && exit_side == ExitSide::Right && tip >= gs - 1 {
                            return depth + 1;
                        }
                        if visited.len() >= max_states { return u32::MAX; }
                        queue.push_back((next, depth + 1));
                    }
                    nc += 1;
                }
            } else {
                let col = fixed[vi];

                // ↑ haut
                let mut nr = cur as i16 - 1;
                while nr >= 0 {
                    if bit_set(wo, nr as u8, col, gs) { break; }
                    let mut next = pos; next[vi] = nr as u8;
                    let key = encode_state(&next, n);
                    if visited.insert(key) {
                        if vi == 0 && exit_side == ExitSide::Top && nr == 0 {
                            return depth + 1;
                        }
                        if visited.len() >= max_states { return u32::MAX; }
                        queue.push_back((next, depth + 1));
                    }
                    nr -= 1;
                }

                // ↓ bas
                let mut nr = cur + 1;
                while nr + vlen - 1 < gs {
                    let tip = nr + vlen - 1;
                    if bit_set(wo, tip, col, gs) { break; }
                    let mut next = pos; next[vi] = nr;
                    let key = encode_state(&next, n);
                    if visited.insert(key) {
                        if vi == 0 && exit_side == ExitSide::Bottom && tip >= gs - 1 {
                            return depth + 1;
                        }
                        if visited.len() >= max_states { return u32::MAX; }
                        queue.push_back((next, depth + 1));
                    }
                    nr += 1;
                }
            }
        }
    }
    u32::MAX
}

fn solve_board(
    vehicles:   &[VehicleData],
    gs:         u8,
    max_moves:  u32,
    exit_side:  ExitSide,
    max_states: usize,
    visited:    &mut FxHashSet<u64>,
) -> u32 {
    let n = vehicles.len();
    let mut is_horiz = [false; MAX_VEHICLES];
    let mut fixed    = [0u8;   MAX_VEHICLES];
    let mut lengths  = [0u8;   MAX_VEHICLES];
    let mut init_pos = [0u8;   MAX_VEHICLES];
    for (i, v) in vehicles.iter().enumerate() {
        is_horiz[i] = v.horizontal;
        fixed[i]    = v.fixed;
        lengths[i]  = v.length;
        init_pos[i] = v.pos;
    }
    bfs(n, &is_horiz, &fixed, &lengths, gs, &init_pos, max_moves, exit_side, max_states, visited)
}

// ── Génération du board ───────────────────────────────────────────────────────

/// Génère un board aléatoire valide.
///
/// La voiture cible (index 0) est :
///   - horizontale et sur `target_fixed` (= ligne) pour Left/Right
///   - verticale   et sur `target_fixed` (= colonne) pour Top/Bottom
///
/// `target_fixed` est tiré aléatoirement et FIXÉ pour toute la vie du board :
/// il détermine sur quelle ligne/colonne la sortie sera placée.
fn random_board(cfg: DifficultyConfig, exit_side: ExitSide, rng: &mut SmallRng) -> (Vec<VehicleData>, u8) {
    let horizontal = exit_side.target_horizontal();
    // La case de sortie est alignée sur target_fixed (ligne ou colonne selon le bord)
    let target_fixed = rng.gen_range(0..cfg.grid_size);

    // Restrict target_pos to the opposite side of the board relative to the exit
    let target_pos = match exit_side {
        ExitSide::Right | ExitSide::Bottom => rng.gen_range(0..=(cfg.grid_size / 2 - 1)),
        ExitSide::Left | ExitSide::Top     => rng.gen_range((cfg.grid_size / 2)..=(cfg.grid_size - 2)),
    };

    let target = VehicleData { pos: target_pos, fixed: target_fixed, length: 2, horizontal };
    let mut vehicles = vec![target];

    let target_count = rng.gen_range(cfg.min_vehicles..=cfg.max_vehicles);
    let mut attempts = 0;

    while vehicles.len() < target_count && attempts < 200 {
        let length = if rng.gen_bool(0.3) { 3 } else { 2 };
        let horiz  = rng.gen_bool(0.5);
        let pos    = rng.gen_range(0..=(cfg.grid_size - length));
        let fixed  = rng.gen_range(0..cfg.grid_size);

        let v = VehicleData { pos, fixed, length, horizontal: horiz };
        vehicles.push(v);
        if !is_valid_board(&vehicles, cfg.grid_size) { vehicles.pop(); }
        attempts += 1;
    }

    (vehicles, target_fixed)
}

fn mutate(board: &[VehicleData], cfg: DifficultyConfig, rng: &mut SmallRng) -> Option<Vec<VehicleData>> {
    let mut nb = board.to_vec();
    match rng.gen_range(0..3u8) {
        0 if nb.len() > 1 => {
            let idx    = rng.gen_range(1..nb.len());
            let length = if rng.gen_bool(0.2) { 3 } else { 2 };
            nb[idx] = VehicleData {
                pos:        rng.gen_range(0..=(cfg.grid_size - length)),
                fixed:      rng.gen_range(0..cfg.grid_size),
                length,
                horizontal: rng.gen_bool(0.5),
            };
        }
        1 if nb.len() < cfg.max_vehicles => {
            let length = if rng.gen_bool(0.3) { 3 } else { 2 };
            nb.push(VehicleData {
                pos:        rng.gen_range(0..=(cfg.grid_size - length)),
                fixed:      rng.gen_range(0..cfg.grid_size),
                length,
                horizontal: rng.gen_bool(0.5),
            });
        }
        2 if nb.len() > cfg.min_vehicles => { nb.remove(rng.gen_range(1..nb.len())); }
        _ => {}
    }
    if is_valid_board(&nb, cfg.grid_size) { Some(nb) } else { None }
}

fn board_to_level(
    id:        u32,
    board:     &[VehicleData],
    moves:     u32,
    gs:        u8,
    exit_side: ExitSide,
    // target_fixed : ligne (Left/Right) ou colonne (Top/Bottom) de la voiture cible
    target_fixed: u8,
) -> Level {
    let colors = [
        "#F59E0B","#10B981","#3B82F6","#EC4899","#06B6D4",
        "#8B5CF6","#F97316","#64748B","#14B8A6",
    ];
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;

    // (exitRow, exitCol) = case hors-grille par laquelle sort la cible
    let (exit_row, exit_col) = exit_side.exit_cell(target_fixed, gs);

    Level {
        id,
        grid_size:  gs,
        exit_row,
        exit_col,
        min_moves:  moves,
        updated_at: now,
        vehicles:   board.iter().enumerate().map(|(i, v)| Vehicle {
            id:          if i == 0 { "target".into() } else { format!("v{i}") },
            row:         if v.horizontal { v.fixed } else { v.pos },
            col:         if v.horizontal { v.pos   } else { v.fixed },
            length:      v.length,
            orientation: if v.horizontal { "horizontal".into() } else { "vertical".into() },
            is_target:   i == 0,
            color:       if i == 0 { "#EF4444".into() } else { colors[i % colors.len()].into() },
        }).collect(),
    }
}

// ── Génération mono-thread d'un level ─────────────────────────────────────────

fn generate_single(task: &Task, max_restarts: u32) -> Option<(Level, u32, Duration)> {
    let t0         = Instant::now();
    let cfg        = task.cfg;
    let exit_side  = task.exit_side;
    let max_states = task.max_states;
    let mut rng    = SmallRng::seed_from_u64(rand::random());

    let mut visited: FxHashSet<u64> =
        FxHashSet::with_capacity_and_hasher(max_states.min(1 << 17), Default::default());

    for restart in 0..max_restarts {
        // random_board retourne aussi target_fixed qui est FIXÉ pour ce restart
        let (mut board, target_fixed) = random_board(cfg, exit_side, &mut rng);
        let mut score = solve_board(&board, cfg.grid_size, cfg.max_moves, exit_side, max_states, &mut visited);
        if score == u32::MAX { score = 0; }

        let mut stuck = 0u32;

        for _ in 0..2000 {
            if let Some(mutated) = mutate(&board, cfg, &mut rng) {
                let ns = solve_board(&mutated, cfg.grid_size, cfg.max_moves, exit_side, max_states, &mut visited);
                if ns == u32::MAX { continue; }

                let accept = ns > score || (ns == score && rng.gen_bool(0.3));
                if accept {
                    stuck = if ns > score { 0 } else { stuck + 1 };
                    board = mutated;
                    score = ns;

                    if score >= cfg.min_moves && score <= cfg.max_moves {
                        return Some((
                            board_to_level(task.id, &board, score, cfg.grid_size, exit_side, target_fixed),
                            restart + 1,
                            t0.elapsed(),
                        ));
                    }
                }
            }
            if stuck > 150 { break; }
        }
    }
    None
}

// ── Main ──────────────────────────────────────────────────────────────────────

fn main() {
    let cli = Cli::parse();

    let num_threads = if cli.threads > 0 {
        cli.threads
    } else {
        std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4)
    };
    rayon::ThreadPoolBuilder::new().num_threads(num_threads).build_global().unwrap();

    println!("╔══════════════════════════════════════════════════════╗");
    println!("║  Rush Hour Gen — {} threads, bfs_states={}  ║", num_threads, cli.max_bfs_states);
    println!("╚══════════════════════════════════════════════════════╝\n");

    let specs: &[(&'static str, u32, fn(u8) -> DifficultyConfig)] = &[
        ("EASY",   cli.easy,   |gs| DifficultyConfig { grid_size: gs, min_vehicles: 5,  max_vehicles: 8,  min_moves: 6,  max_moves: 12  }),
        ("NORMAL", cli.normal, |gs| DifficultyConfig { grid_size: gs, min_vehicles: 8,  max_vehicles: 12, min_moves: 12, max_moves: 20  }),
        ("HARD",   cli.hard,   |gs| DifficultyConfig { grid_size: gs, min_vehicles: 10, max_vehicles: 14, min_moves: 20, max_moves: 40  }),
        ("EXPERT", cli.expert, |gs| DifficultyConfig { grid_size: gs, min_vehicles: 12, max_vehicles: 16, min_moves: 40, max_moves: 60  }),
        ("MASTER", cli.master, |gs| DifficultyConfig { grid_size: gs, min_vehicles: 14, max_vehicles: 18, min_moves: 60, max_moves: 100 }),
    ];

    let base = cli.max_bfs_states;

    let mut tasks: Vec<Task> = Vec::new();
    let mut current_id = cli.start_id;
    let mut rng_main   = SmallRng::from_entropy();

    for (label, count, make_cfg) in specs {
        let max_states = match *label {
            "EASY" | "NORMAL" => base / 3,
            "HARD"            => base,
            "EXPERT"          => base * 2,
            "MASTER"          => base * 4,
            _                 => base,
        }.max(10_000);

        for i in 1..=*count {
            let gs = match *label {
                "EASY" | "NORMAL" => if rng_main.gen_bool(0.2) { 7 } else { 6 },
                "HARD" | "EXPERT" => if rng_main.gen_bool(0.5) { 7 } else { 6 },
                "MASTER"          => if rng_main.gen_bool(0.6) { 8 } else { 7 },
                _                 => 6,
            };
            tasks.push(Task {
                id:    current_id,
                cfg:   make_cfg(gs),
                label,
                idx:   i,
                count: *count,
                exit_side:  ExitSide::random(&mut rng_main),
                max_states,
            });
            current_id += 1;
        }
    }

    let total        = tasks.len();
    let done_counter = AtomicU32::new(0);
    let global_start = Instant::now();
    println!("  {} levels à générer sur {} threads\n", total, num_threads);

    let results: Vec<Option<(Level, u32, Duration)>> = tasks
        .par_iter()
        .map(|task| {
            let res  = generate_single(task, cli.max_restarts);
            let done = done_counter.fetch_add(1, Ordering::Relaxed) + 1;
            match &res {
                Some((level, restarts, elapsed)) =>
                    println!(
                        "  [{:<6} {:>2}/{:<2}] id={:>3} | {:>2}x{:<2} | {:>3} coups | exit=({},{}) | {:>5} restarts | {:.2?}  [{}/{}]",
                        task.label, task.idx, task.count,
                        level.id, level.grid_size, level.grid_size,
                        level.min_moves, level.exit_row, level.exit_col,
                        restarts, elapsed, done, total
                    ),
                None =>
                    eprintln!("  [{:<6} {:>2}/{:<2}] ÉCHEC  [{}/{}]",
                        task.label, task.idx, task.count, done, total),
            }
            res
        })
        .collect();

    let file  = File::create(&cli.output).expect("Impossible de créer le fichier");
    let mut w = BufWriter::new(file);
    let mut ok = 0u32;
    write!(w, "[\n").unwrap();
    let mut first = true;
    for opt in &results {
        if let Some((level, _, _)) = opt {
            if !first { write!(w, ",\n").unwrap(); }
            first = false;
            write!(w, "{}", serde_json::to_string_pretty(level).unwrap()).unwrap();
            ok += 1;
        }
    }
    write!(w, "\n]\n").unwrap();
    w.flush().unwrap();

    println!("\n  {}/{} levels en {:.2?} — {}", ok, total, global_start.elapsed(), cli.output);
}