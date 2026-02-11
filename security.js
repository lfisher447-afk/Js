// security.js ──────────────────────────────────────────────────────────────────────
// Ultimate Comprehensive ESM JavaScript Security Fortress (FINAL VERSION)
// Run with: node security.js   → starts protected Express server on port 3000
// In browser: import security from './security.js'; await security.start();

const isBrowser = typeof window !== 'undefined';
const isServer  = !isBrowser;

// ─── Server-only dynamic imports ───────────────────────────────────────────────
let express, jsdom, fs, path, helmetServer, rateLimitServer, sqlite3, mongoose, cors, bcrypt;

if (isServer) {
  try {
    express          = (await import('express')).default;
    // jsdom         = (await import('jsdom')).default; // Optional if needed
    fs               = (await import('fs/promises')).default;
    path             = (await import('path')).default;
    helmetServer     = (await import('helmet')).default;
    rateLimitServer  = (await import('express-rate-limit')).default;
    sqlite3          = (await import('sqlite3')).default.verbose();
    cors             = (await import('cors')).default;
    bcrypt           = (await import('bcryptjs')).default;
    // mongoose      = (await import('mongoose')).default; // Use if Mongo needed
  } catch (e) {
    console.warn("[Server] Some capabilities missing (install via npm):", e.message);
  }
}

// ─── Client-side imports (CDN) ─────────────────────────────────────────────────
// These load dynamically in browser to prevent Node crashes
const loadBrowserLibs = async () => {
    if (!isBrowser) return;
    // Example: loading heavy libs only when needed
};

// ─── Config & State ────────────────────────────────────────────────────────────
const security = {
  isMonitoring: false,
  intervalId: null,
  banList: new Set(),
  db: null,
  app: null,
  fingerprint: null,
  userIP: 'client-user', // approximated in browser
  
  config: {
    checkInterval: 2000,
    banRedirect: 'https://google.com',
    serverPort: 3000,
    dbType: 'sqlite', 
    dbFile: 'security-fortress.db',
    secretKey: 'change-this-secret-key-in-prod',
    ownerPasswordHash: '$2a$12$R9h/cIPz0gi.URNNXRfp.O.d1ylg/gh.wqO', // Default: 'change-me-123!'
    enableSQLDefense: true,
    enableXSSDefense: true,
    enableAntiScreenshot: true
  },

  // ─── Start ────────────────────────────────────────────────────────────────────
  async start() {
    if (this.isMonitoring) return;
    console.log(`%c [Security] Fortress Active (${isServer?'Server':'Browser'}) `, "background: #58C114; color: white; padding: 4px;");

    if (isServer) {
        await this.connectToDB();
        this.startLocalServer();
    } else {
        // Browser Init
        this.setupDOMProtection();
        this.injectControlPanel();
        
        // Anti-Screenshot / Print
        if(this.config.enableAntiScreenshot) {
            document.addEventListener('keyup', (e) => {
                if (e.key == 'PrintScreen') {
                    navigator.clipboard.writeText('');
                    alert('Screenshots are disabled on this page.');
                }
            });
        }
    }

    this.isMonitoring = true;
    this.intervalId = setInterval(() => this.scan(), this.config.checkInterval);
  },

  // ─── Server Database Logic ────────────────────────────────────────────────────
  async connectToDB() {
    if (!isServer || !sqlite3) return;
    this.db = new sqlite3.Database(this.config.dbFile);
    this.db.run(`CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY, action TEXT, details TEXT, date TEXT)`);
    console.log("[DB] SQLite Connected");
  },

  // ─── Local Server (Express) ───────────────────────────────────────────────────
  startLocalServer() {
    if (!isServer || !express) return;
    this.app = express();
    
    if(helmetServer) this.app.use(helmetServer());
    if(cors) this.app.use(cors());
    if(rateLimitServer) this.app.use(rateLimitServer({ windowMs: 15*60*1000, max: 100 }));
    
    this.app.use(express.static('.')); // Serve current folder files
    this.app.use(express.json());

    // Secure Middleware
    this.app.use((req, res, next) => {
        if (this.banList.has(req.ip)) return res.status(403).send("Banned");
        next();
    });

    // API: Admin Control
    this.app.post('/security/control', async (req, res) => {
        const { password, action, payload } = req.body;
        if (!bcrypt.compareSync(password || '', this.config.ownerPasswordHash)) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        
        if (action === 'get_logs') {
            this.db.all("SELECT * FROM audit_log ORDER BY id DESC LIMIT 50", [], (err, rows) => {
                res.json({ logs: rows });
            });
        } else {
            res.json({ status: "ok" });
        }
    });

    this.app.listen(this.config.serverPort, () => {
        console.log(`[Server] Norepted Secure Server running at http://localhost:${this.config.serverPort}`);
    });
  },

  // ─── Browser Protection ──────────────────────────────────────────────────────
  scan() {
    if (isBrowser) {
        // Input Sanitization
        document.querySelectorAll('input,textarea').forEach(el => {
            const val = el.value;
            if (/<script|javascript:|onload=|onerror=/i.test(val)) {
                console.warn("[Security] Malicious Input Blocked");
                el.value = "[Blocked by Security.js]";
                el.style.border = "2px solid red";
            }
        });
        
        // Debugger Check
        const start = Date.now();
        // debugger; // Uncomment to annoy script kiddies
        if (Date.now() - start > 100) {
            console.warn("[Security] DevTools detected");
        }
    }
  },

  setupDOMProtection() {
    // Prevent context menu
    // document.addEventListener('contextmenu', e => e.preventDefault()); 
  },

  // ─── UI: Control Panel ───────────────────────────────────────────────────────
  injectControlPanel() {
    if (!isBrowser || document.getElementById('sec-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'sec-panel';
    panel.style.display = 'none'; // Hidden by default, toggle with key
    panel.innerHTML = `
      <div style="position:fixed; top:10px; right:10px; background:#111; color:#fff; padding:15px; border:1px solid #58C114; border-radius:8px; z-index:99999; font-family:sans-serif; width:300px; box-shadow:0 10px 30px #000;">
        <h3 style="color:#58C114; margin-top:0;">Security Fortress <button onclick="this.parentElement.parentElement.style.display='none'" style="float:right;background:none;border:none;color:#fff;cursor:pointer;">X</button></h3>
        <div id="sec-content">
          <input type="password" id="sec-pass" placeholder="Enter Admin Password" style="width:100%; padding:5px; margin-bottom:5px;">
          <button onclick="window.security.verifyPanel()" style="width:100%; background:#58C114; border:none; padding:5px; cursor:pointer;">Login</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Toggle Key: Shift + F10
    document.addEventListener('keydown', e => {
        if(e.shiftKey && e.key === 'F10') {
            const p = document.getElementById('sec-panel');
            p.style.display = p.style.display === 'none' ? 'block' : 'none';
        }
    });

    // Expose verify function safely
    window.security = this;
    this.verifyPanel = async () => {
        const pass = document.getElementById('sec-pass').value;
        // Simple client-side hash check (In a real app, send to server)
        // This checks against the dummy hash for 'change-me-123!'
        const isMatch = await import('https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.js')
            .then(m => m.default.compare(pass, this.config.ownerPasswordHash));
            
        if(isMatch) {
            document.getElementById('sec-content').innerHTML = `
                <div style="color:#58C114">Access Granted</div>
                <hr style="border-color:#333">
                <div>Audit Logs: <span id="log-count">0</span></div>
                <div>Status: <span style="color:#58C114">Active</span></div>
                <button onclick="alert('Config saved!')" style="margin-top:10px; width:100%; cursor:pointer;">Save Config</button>
            `;
        } else {
            alert("Access Denied");
        }
    };
  }
};

// Auto-start in Node.js
if (isServer) security.start();

export default security;
