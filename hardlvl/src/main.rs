// ─────────────────────────────────────────────────────────────────────────────
//  Rush Hour – Level Generator (v2 : BFS multi-source inverse)
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
//  Principe : le board est construit avec la cible DÉJÀ sur la case gagnante.
//  Un BFS multi-source depuis tous les états gagnants donne la distance à la
//  victoire de tous les états de la composante connexe (graphe non orienté).
//  Score du layout = profondeur max ; la position de départ est tirée dans la
//  couche de la difficulté voulue.
// ─────────────────────────────────────────────────────────────────────────────

use std::{
    cmp::Reverse,
    fs::File,
    io::{BufWriter, Write},
    sync::atomic::{AtomicU32, Ordering},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use clap::Parser;
use rand::{rngs::SmallRng, Rng, SeedableRng};
use rayon::prelude::*;
use rustc_hash::FxHashSet;
use serde::{Deserialize, Serialize};

const MAX_VEHICLES: usize = 20;

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
    /// Max états explorés par composante avant d'abandonner un board (ex: 300000)
    #[arg(long, default_value_t = 300_000)] max_bfs_states: usize,
    /// Budget de temps (secondes) par level avant d'abandonner
    #[arg(long, default_value_t = 120)] time_budget_secs: u64,
}

// ── Exit ──────────────────────────────────────────────────────────────────────

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

    /// Position (col si horizontal, row si vertical) de la cible quand elle est sortie.
    fn goal_pos(self, gs: u8) -> u8 {
        match self {
            ExitSide::Right | ExitSide::Bottom => gs - 2,
            ExitSide::Left | ExitSide::Top => 0,
        }
    }

    /// Calcule (exitRow, exitCol) = case hors-grille selon le bord et la position fixe.
    fn exit_cell(self, fixed: u8, gs: u8) -> (u8, u8) {
        match self {
            ExitSide::Right  => (fixed, gs),
            ExitSide::Left   => (fixed, 255),
            ExitSide::Bottom => (gs,    fixed),
            ExitSide::Top    => (255,   fixed),
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Level {
    id:         u32,
    grid_size:  u8,
    exit_row:   u8,   // 255 = -1 pour bord haut
    exit_col:   u8,   // 255 = -1 pour bord gauche
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

// ── Board interne ─────────────────────────────────────────────────────────────

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

// ── Clé d'état : 3 bits par véhicule ──────────────────────────────────────────

#[inline(always)]
fn get_pos(key: u64, i: usize) -> u8 { ((key >> (i * 3)) & 7) as u8 }

#[inline(always)]
fn set_pos(key: u64, i: usize, p: u8) -> u64 {
    (key & !(7u64 << (i * 3))) | ((p as u64) << (i * 3))
}

// ── Layout : masques précalculés ──────────────────────────────────────────────

struct Layout {
    n:       usize,
    gs:      u8,
    lengths: [u8; MAX_VEHICLES],
    /// mask[i][p] = cases occupées par le véhicule i à la position p
    mask:    [[u64; 8]; MAX_VEHICLES],
}

impl Layout {
    fn new(board: &[VehicleData], gs: u8) -> (Self, u64) {
        let mut l = Layout {
            n: board.len(),
            gs,
            lengths: [0; MAX_VEHICLES],
            mask: [[0; 8]; MAX_VEHICLES],
        };
        let mut key = 0u64;
        for (i, v) in board.iter().enumerate() {
            l.lengths[i] = v.length;
            for p in 0..=(gs - v.length) {
                let mut m = 0u64;
                for k in 0..v.length {
                    let (r, c) = if v.horizontal { (v.fixed, p + k) } else { (p + k, v.fixed) };
                    m |= 1u64 << (r as u32 * gs as u32 + c as u32);
                }
                l.mask[i][p as usize] = m;
            }
            key = set_pos(key, i, v.pos);
        }
        (l, key)
    }

    #[inline(always)]
    fn for_each_neighbor(&self, key: u64, mut f: impl FnMut(u64)) {
        let mut occ = 0u64;
        for i in 0..self.n {
            occ |= self.mask[i][get_pos(key, i) as usize];
        }
        for i in 0..self.n {
            let p = get_pos(key, i);
            let others = occ & !self.mask[i][p as usize];
            let max_p = self.gs - self.lengths[i];

            let mut q = p;
            while q > 0 && self.mask[i][(q - 1) as usize] & others == 0 {
                q -= 1;
                f(set_pos(key, i, q));
            }
            let mut q = p;
            while q < max_p && self.mask[i][(q + 1) as usize] & others == 0 {
                q += 1;
                f(set_pos(key, i, q));
            }
        }
    }
}

/// layers[d] = tous les états à exactement d coups de la victoire.
/// Retourne None si la composante dépasse max_states ou ne contient aucun état gagnant.
fn distance_layers(
    l: &Layout,
    seed: u64,
    goal_pos: u8,
    max_states: usize,
    seen: &mut FxHashSet<u64>,
) -> Option<Vec<Vec<u64>>> {
    // Passe 1 : énumérer la composante connexe, collecter les états gagnants
    seen.clear();
    seen.insert(seed);
    let mut stack = vec![seed];
    let mut goals: Vec<u64> = Vec::new();
    while let Some(k) = stack.pop() {
        if get_pos(k, 0) == goal_pos { goals.push(k); }
        l.for_each_neighbor(k, |nk| {
            if seen.insert(nk) { stack.push(nk); }
        });
        if seen.len() > max_states { return None; }
    }
    if goals.is_empty() { return None; }

    // Passe 2 : BFS multi-source depuis tous les états gagnants
    seen.clear();
    for &g in &goals { seen.insert(g); }
    let mut layers: Vec<Vec<u64>> = vec![goals];
    loop {
        let mut next: Vec<u64> = Vec::new();
        for &k in layers.last().unwrap() {
            l.for_each_neighbor(k, |nk| {
                if seen.insert(nk) { next.push(nk); }
            });
        }
        if next.is_empty() { break; }
        layers.push(next);
    }
    Some(layers)
}

fn eval(
    board: &[VehicleData],
    gs: u8,
    side: ExitSide,
    max_states: usize,
    seen: &mut FxHashSet<u64>,
) -> Option<Vec<Vec<u64>>> {
    let (l, seed) = Layout::new(board, gs);
    distance_layers(&l, seed, side.goal_pos(gs), max_states, seen)
}

// ── Génération du board ───────────────────────────────────────────────────────

/// Génère un board aléatoire valide, cible DÉJÀ sur la case gagnante.
/// Le point de départ est choisi ensuite dans les couches du BFS.
fn random_board(cfg: DifficultyConfig, exit_side: ExitSide, rng: &mut SmallRng) -> (Vec<VehicleData>, u8) {
    let horizontal   = exit_side.target_horizontal();
    let target_fixed = rng.gen_range(0..cfg.grid_size);
    let target_pos   = exit_side.goal_pos(cfg.grid_size);

    let target = VehicleData { pos: target_pos, fixed: target_fixed, length: 2, horizontal };
    let mut vehicles = vec![target];

    let target_count = rng.gen_range(cfg.min_vehicles..=cfg.max_vehicles);
    let mut attempts = 0;

    while vehicles.len() < target_count && attempts < 200 {
        let length = if rng.gen_bool(0.3) { 3 } else { 2 };
        let horiz  = rng.gen_bool(0.5);
        let pos    = rng.gen_range(0..=(cfg.grid_size - length));
        let fixed  = rng.gen_range(0..cfg.grid_size);

        vehicles.push(VehicleData { pos, fixed, length, horizontal: horiz });
        if !is_valid_board(&vehicles, cfg.grid_size) { vehicles.pop(); }
        attempts += 1;
    }

    (vehicles, target_fixed)
}

/// Mutations surtout locales (paysage plus lisse pour le hill-climbing).
/// Ne touche jamais au véhicule 0 (la cible).
fn mutate(board: &[VehicleData], cfg: DifficultyConfig, rng: &mut SmallRng) -> Option<Vec<VehicleData>> {
    let gs = cfg.grid_size;
    let mut nb = board.to_vec();

    match rng.gen_range(0..8u8) {
        // décalage de ±1 le long de la voie
        0 | 1 if nb.len() > 1 => {
            let idx = rng.gen_range(1..nb.len());
            let v = &mut nb[idx];
            let max_p = gs - v.length;
            if rng.gen_bool(0.5) {
                if v.pos == 0 { return None; }
                v.pos -= 1;
            } else {
                if v.pos >= max_p { return None; }
                v.pos += 1;
            }
        }
        // changement de voie de ±1
        2 | 3 if nb.len() > 1 => {
            let idx = rng.gen_range(1..nb.len());
            let v = &mut nb[idx];
            if rng.gen_bool(0.5) {
                if v.fixed == 0 { return None; }
                v.fixed -= 1;
            } else {
                if v.fixed + 1 >= gs { return None; }
                v.fixed += 1;
            }
        }
        // inversion d'orientation
        4 if nb.len() > 1 => {
            let idx = rng.gen_range(1..nb.len());
            let v = &mut nb[idx];
            v.horizontal = !v.horizontal;
            v.pos = v.pos.min(gs - v.length);
        }
        // changement de longueur 2 <-> 3
        5 if nb.len() > 1 => {
            let idx = rng.gen_range(1..nb.len());
            let v = &mut nb[idx];
            v.length = if v.length == 2 { 3 } else { 2 };
            v.pos = v.pos.min(gs - v.length);
        }
        // ajout d'un véhicule
        6 if nb.len() < cfg.max_vehicles => {
            let length = if rng.gen_bool(0.3) { 3 } else { 2 };
            nb.push(VehicleData {
                pos:        rng.gen_range(0..=(gs - length)),
                fixed:      rng.gen_range(0..gs),
                length,
                horizontal: rng.gen_bool(0.5),
            });
        }
        // suppression d'un véhicule
        7 if nb.len() > cfg.min_vehicles => {
            let idx = rng.gen_range(1..nb.len());
            nb.remove(idx);
        }
        _ => return None,
    }

    if is_valid_board(&nb, gs) { Some(nb) } else { None }
}

fn board_to_level(
    id:           u32,
    board:        &[VehicleData],
    moves:        u32,
    gs:           u8,
    exit_side:    ExitSide,
    target_fixed: u8,
) -> Level {
    let colors = [
        "#F59E0B", "#10B981", "#3B82F6", "#EC4899", "#06B6D4",
        "#8B5CF6", "#F97316", "#64748B", "#14B8A6",
    ];
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
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

// ── Génération d'un level ─────────────────────────────────────────────────────

/// Tire une position de départ dans les couches [lo ..= min(score, max_moves)]
/// et construit le Level correspondant.
fn finalize(
    task:         &Task,
    board:        &mut [VehicleData],
    layers:       &[Vec<u64>],
    lo:           u32,
    score:        u32,
    target_fixed: u8,
    rng:          &mut SmallRng,
) -> Level {
    let hi    = score.min(task.cfg.max_moves);
    let d     = rng.gen_range(lo..=hi);
    let layer = &layers[d as usize];
    let key   = layer[rng.gen_range(0..layer.len())];
    for (i, v) in board.iter_mut().enumerate() {
        v.pos = get_pos(key, i);
    }
    board_to_level(task.id, board, d, task.cfg.grid_size, task.exit_side, target_fixed)
}

/// Un restart complet : board aléatoire + hill-climbing.
fn try_restart(
    task:     &Task,
    rng:      &mut SmallRng,
    seen:     &mut FxHashSet<u64>,
    restart:  u32,
    deadline: Instant,
) -> Option<(Level, u32)> {
    if Instant::now() >= deadline { return None; }

    let cfg  = task.cfg;
    let gs   = cfg.grid_size;
    let side = task.exit_side;

    let (mut board, target_fixed) = random_board(cfg, side, rng);
    let mut layers = eval(&board, gs, side, task.max_states, seen);
    let mut score  = layers.as_ref().map_or(0, |l| l.len() as u32 - 1);

    // Difficulté visée pour ce restart → variété dans le palier
    let want = rng.gen_range(cfg.min_moves..=cfg.max_moves);
    let mut stuck = 0u32;

    for _ in 0..3000 {
        if let Some(ls) = &layers {
            if score >= want {
                let level = finalize(task, &mut board, ls, want, score, target_fixed, rng);
                return Some((level, restart + 1));
            }
        }
        if stuck > 400 || Instant::now() >= deadline { break; }

        let Some(m) = mutate(&board, cfg, rng) else { stuck += 1; continue };
        let Some(ml) = eval(&m, gs, side, task.max_states, seen) else { stuck += 1; continue };
        let ns = ml.len() as u32 - 1;

        // Recuit léger : descente autorisée seulement sous min_moves
        let accept = ns > score
            || (ns == score && rng.gen_bool(0.3))
            || (ns + 1 == score && score < cfg.min_moves && rng.gen_bool(0.05));

        if accept {
            if ns > score { stuck = 0; } else { stuck += 1; }
            board  = m;
            score  = ns;
            layers = Some(ml);
        } else {
            stuck += 1;
        }
    }

    // Repli : `want` inatteignable, mais le layout est assez dur pour le palier
    if score >= cfg.min_moves {
        if let Some(ls) = &layers {
            let level = finalize(task, &mut board, ls, cfg.min_moves, score, target_fixed, rng);
            return Some((level, restart + 1));
        }
    }
    None
}

/// Restarts parallélisés + budget de temps.
fn generate_single(task: &Task, max_restarts: u32, budget: Duration) -> Option<(Level, u32, Duration)> {
    let t0       = Instant::now();
    let deadline = t0 + budget;
    let cap      = task.max_states.min(1 << 17);

    (0..max_restarts)
        .into_par_iter()
        .map_init(
            || (
                SmallRng::from_entropy(),
                FxHashSet::<u64>::with_capacity_and_hasher(cap, Default::default()),
            ),
            |(rng, seen), r| try_restart(task, rng, seen, r, deadline),
        )
        .find_map_any(|x| x)
        .map(|(level, restarts)| (level, restarts, t0.elapsed()))
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
    println!("║  Rush Hour Gen v2 — {} threads, bfs_states={}", num_threads, cli.max_bfs_states);
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
        }
        .max(10_000);

        for i in 1..=*count {
            let gs = match *label {
                "EASY" | "NORMAL" => if rng_main.gen_bool(0.2) { 7 } else { 6 },
                "HARD"            => if rng_main.gen_bool(0.5) { 7 } else { 6 },
                // 6x6 quasi inatteignable pour 40-60 coups → 7 ou 8
                "EXPERT"          => if rng_main.gen_bool(0.3) { 8 } else { 7 },
                "MASTER"          => if rng_main.gen_bool(0.6) { 8 } else { 7 },
                _                 => 6,
            };
            tasks.push(Task {
                id:         current_id,
                cfg:        make_cfg(gs),
                label:      *label,
                idx:        i,
                count:      *count,
                exit_side:  ExitSide::random(&mut rng_main),
                max_states,
            });
            current_id += 1;
        }
    }

    // Les plus dures d'abord : évite qu'un MASTER tourne seul en fin de run
    tasks.sort_by_key(|t| Reverse(t.cfg.min_moves));

    let total        = tasks.len();
    let done_counter = AtomicU32::new(0);
    let global_start = Instant::now();
    let budget       = Duration::from_secs(cli.time_budget_secs);
    println!("  {} levels à générer sur {} threads\n", total, num_threads);

    let results: Vec<Option<(Level, u32, Duration)>> = tasks
        .par_iter()
        .map(|task| {
            let res  = generate_single(task, cli.max_restarts, budget);
            let done = done_counter.fetch_add(1, Ordering::Relaxed) + 1;
            match &res {
                Some((level, restarts, elapsed)) => println!(
                    "  [{:<6} {:>2}/{:<2}] id={:>3} | {:>2}x{:<2} | {:>3} coups | exit=({},{}) | {:>5} restarts | {:.2?}  [{}/{}]",
                    task.label, task.idx, task.count,
                    level.id, level.grid_size, level.grid_size,
                    level.min_moves, level.exit_row, level.exit_col,
                    restarts, elapsed, done, total
                ),
                None => eprintln!(
                    "  [{:<6} {:>2}/{:<2}] ÉCHEC  [{}/{}]",
                    task.label, task.idx, task.count, done, total
                ),
            }
            res
        })
        .collect();

    // Sortie triée par id
    let mut levels: Vec<Level> = results.into_iter().flatten().map(|(l, _, _)| l).collect();
    levels.sort_by_key(|l| l.id);

    let file  = File::create(&cli.output).expect("Impossible de créer le fichier");
    let mut w = BufWriter::new(file);
    write!(w, "[\n").unwrap();
    for (i, level) in levels.iter().enumerate() {
        if i > 0 { write!(w, ",\n").unwrap(); }
        write!(w, "{}", serde_json::to_string_pretty(level).unwrap()).unwrap();
    }
    write!(w, "\n]\n").unwrap();
    w.flush().unwrap();

    println!(
        "\n  {}/{} levels en {:.2?} — {}",
        levels.len(), total, global_start.elapsed(), cli.output
    );
}