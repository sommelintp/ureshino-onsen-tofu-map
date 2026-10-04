#!/usr/bin/env node
// data/places.json → CSV（Google スプレッドシートへの初期投入・貼り付け用）
// 使い方: node scripts/json-to-csv.mjs [出力パス]   （既定: data/places.csv。スプレッドシートへのインポート用）
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { S, ROOT, loadPlaces } from './_lib.mjs';

const out = resolve(ROOT, process.argv[2] || 'data/places.csv');
const { places } = loadPlaces();
const rows = places.map(S.placeToRow);
mkdirSync(resolve(out, '..'), { recursive: true });
// Excel/Sheets が UTF-8 と認識するよう BOM を付ける
writeFileSync(out, '﻿' + S.objectsToCSV(rows));
console.log(`${rows.length} 行を書き出しました: ${out}`);
