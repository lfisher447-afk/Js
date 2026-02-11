/* validator.js - Node.js Version */
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';

const DATA_DIR = 'data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const VALID_FILE = path.join(DATA_DIR, 'valid.json');
const CANDIDATE_FILE = path.join(DATA_DIR, 'candidates.txt');

const STRUCTURE = { video: [], search: [], channel: [], playlist: [], comments: [] };

const fetchUrl = (url, timeout = 5000) => {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.get(url, { timeout }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ ok: res.statusCode === 200, json: () => { try { return JSON.parse(data) } catch { return null } } }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error("Timeout")); });
    });
};

async function validate() {
    console.log("Starting Validation...");
    // Create base files if missing
    if (!fs.existsSync(CANDIDATE_FILE)) {
        fs.writeFileSync(CANDIDATE_FILE, "https://invidious.lunivers.trade\nhttps://yewtu.be");
    }

    const candidates = fs.readFileSync(CANDIDATE_FILE, 'utf8').split('\n').filter(Boolean);
    const valid = { ...STRUCTURE };

    for (const url of candidates) {
        const cleanUrl = url.trim().replace(/\/$/, "");
        console.log(`Checking ${cleanUrl}...`);
        try {
            const stats = await fetchUrl(`${cleanUrl}/api/v1/stats`);
            if (stats.ok && stats.json()) {
                console.log(`  -> SUCCESS`);
                // Add to all categories for simplicity
                Object.keys(valid).forEach(k => valid[k].push(cleanUrl));
            } else {
                console.log(`  -> FAILED`);
            }
        } catch (e) {
            console.log(`  -> ERROR: ${e.message}`);
        }
    }

    fs.writeFileSync(VALID_FILE, JSON.stringify(valid, null, 2));
    console.log(`Saved valid instances to ${VALID_FILE}`);
}

validate();
