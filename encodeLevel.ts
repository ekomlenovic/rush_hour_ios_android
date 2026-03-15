/**
 * Encode a Rush Hours level JSON into the share URL format.
 *
 * Usage:
 *   ts-node encodeLevel.ts level.json
 *
 * The script reads a JSON level file and outputs the share URL.
 */

import fs from "fs";

type Orientation = "horizontal" | "vertical";

interface Vehicle {
    id: string;
    row: number;
    col: number;
    length: number;
    orientation: Orientation;
    isTarget: boolean;
    color: string;
}

interface Level {
    id: number;
    gridSize: number;
    exitRow: number;
    exitCol: number;
    minMoves: number;
    vehicles: Vehicle[];
}

/**
 * Serializes a Level object into the compact string format used by the game.
 */
function serializeLevel(level: Level): string {
    const parts = [
        level.gridSize,
        level.exitRow,
        level.exitCol,
        level.minMoves
    ];

    const vehicleStrings = level.vehicles.map(v => {
        const orientation = v.orientation === "horizontal" ? "h" : "v";
        const isTarget = v.isTarget ? "1" : "0";
        const color = v.color.replace("#", "");

        return `${v.row},${v.col},${v.length},${orientation},${isTarget},${color},${v.id}`;
    });

    return `${parts.join("|")}|${vehicleStrings.join(";")}`;
}

/**
 * Encodes a string to Base64.
 */
function encodeBase64(data: string): string {
    return Buffer.from(data, "utf8").toString("base64");
}

/**
 * Generates the share URL.
 */
function generateShareUrl(level: Level): string {
    const serialized = serializeLevel(level);
    const b64 = encodeBase64(serialized);

    return `rush-hours://game?data=${encodeURIComponent(b64)}`;
}

/**
 * Entry point
 */
function main() {
    const file = process.argv[2];

    if (!file) {
        console.error("Usage: ts-node encodeLevel.ts <level.json>");
        process.exit(1);
    }

    const raw = fs.readFileSync(file, "utf8");
    const level: Level = JSON.parse(raw);

    const url = generateShareUrl(level);

    console.log("\nShare URL:\n");
    console.log(url);
    console.log("\nBase64:\n");
    console.log(url.split("data=")[1]);
}

main();