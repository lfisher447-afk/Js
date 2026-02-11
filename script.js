import security from './security.js';

// Configuration
const INSTANCES = [
    'https://invidious.lunivers.trade',
    'https://invidious.ritoge.com',
    'https://yewtu.be',
    'https://vid.puffyan.us',
    'https://invidious.drgns.space'
];

const state = {
    activeInstance: null,
    xframe: localStorage.getItem('xframe') === 'true',
    optimized: localStorage.getItem('optimized') === 'true'
};

// Application Logic
const app = {
    async init() {
        // Particles
        if (!state.optimized) {
            particlesJS.load('particles-js', 'https://cdn.jsdelivr.net/gh/VincentGarreau/particles.js/particles.json', null);
        } else {
            document.body.classList.add('optimized');
            document.getElementById('opt-toggle').checked = true;
        }

        // Restore Settings
        document.getElementById('xframe-toggle').checked = state.xframe;
        
        // Find Best Instance
        await this.findInstance();
        
        // Listeners
        document.getElementById('launch-btn').addEventListener('click', () => this.launchVideo());
        document.getElementById('video-link').addEventListener('keypress', (e) => {
            if(e.key === 'Enter') this.launchVideo();
        });
    },

    async findInstance() {
        const status = document.getElementById('backend-status');
        const select = document.getElementById('backend-select');
        
        status.textContent = "Finding best server...";
        
        // Quick race to find fastest working instance
        const promises = INSTANCES.map(url => 
            fetch(`${url}/api/v1/stats`, { signal: AbortSignal.timeout(3000) })
            .then(res => res.ok ? url : Promise.reject())
        );

        try {
            const winner = await Promise.any(promises);
            state.activeInstance = winner;
            status.textContent = `Connected: ${new URL(winner).hostname}`;
            status.style.color = "#58C114";
            
            // Populate select
            INSTANCES.forEach(url => {
                const opt = document.createElement('option');
                opt.value = url;
                opt.textContent = new URL(url).hostname;
                if(url === winner) opt.selected = true;
                select.appendChild(opt);
            });
        } catch (e) {
            status.textContent = "Using Fallback (Youtube-NoCookie)";
            status.style.color = "#FFC107";
            state.activeInstance = null; // Fallback mode
        }
    },

    changeBackend() {
        const val = document.getElementById('backend-select').value;
        if(val !== 'auto') {
            state.activeInstance = val;
            document.getElementById('backend-status').textContent = `Manual: ${new URL(val).hostname}`;
        } else {
            this.findInstance();
        }
    },

    toggleOpt() {
        state.optimized = !state.optimized;
        localStorage.setItem('optimized', state.optimized);
        location.reload(); 
    },

    toggleXFrame() {
        state.xframe = !state.xframe;
        localStorage.setItem('xframe', state.xframe);
        this.toast(`X-Frame Proxy ${state.xframe ? 'Enabled' : 'Disabled'}`);
    },

    switchView(view) {
        document.querySelectorAll('.spa-section').forEach(el => el.classList.remove('active-section'));
        document.getElementById(`view-${view}`).classList.add('active-section');
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        // logic to highlight active nav button could go here
    },

    toast(msg) {
        const t = document.createElement('div');
        t.className = 'toast show';
        t.textContent = msg;
        document.getElementById('toast-container').appendChild(t);
        setTimeout(() => t.remove(), 3000);
    },

    // Video Logic
    launchVideo() {
        const input = document.getElementById('video-link');
        const url = input.value;
        const vidId = this.extractId(url);
        
        if(!vidId) return this.toast("Invalid URL");
        
        this.createPlayer(vidId);
        input.value = "";
    },

    extractId(url) {
        const m = url.match(/(?:youtu\.be\/|youtube\.com\/.*v=)([\w-]{11})/);
        return m ? m[1] : null;
    },

    async createPlayer(id) {
        const container = document.getElementById('video-grid');
        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper fade-in';

        // Fetch Metadata for Title/Quality if using Invidious
        let title = "YouTube Video";
        let src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
        
        if (state.activeInstance) {
            try {
                const meta = await fetch(`${state.activeInstance}/api/v1/videos/${id}`).then(r=>r.json());
                title = meta.title;
                // Quality selection logic
                const prefQ = localStorage.getItem('prefQuality') || '720p';
                // Simplified: Invidious embed usually handles adaptive, 
                // but direct video file (hls) would allow custom controls.
                // For iframe embed:
                src = `${state.activeInstance}/embed/${id}?autoplay=1`;
            } catch(e) { console.warn("Meta fetch failed", e); }
        }

        // Iframe creation
        let iframe;
        if(state.xframe) {
            iframe = document.createElement('iframe', { is: 'x-frame-anywhere' });
            iframe.setAttribute('is', 'x-frame-anywhere');
        } else {
            iframe = document.createElement('iframe');
        }
        
        iframe.src = src;
        iframe.style.width = '100%';
        iframe.style.height = '400px';
        iframe.style.border = 'none';
        iframe.allow = "autoplay; fullscreen; encrypted-media";

        wrapper.innerHTML = `
            <div class="player-controls">
                <span>${title}</span>
                <button onclick="this.closest('.video-wrapper').remove()" style="background:red;border:none;color:white;cursor:pointer;">X</button>
            </div>
        `;
        wrapper.appendChild(iframe);
        container.prepend(wrapper);
    },

    // Search Logic
    async search() {
        const query = document.getElementById('search-input').value;
        if(!state.activeInstance) return this.toast("No Invidious Instance Connected");
        
        const grid = document.getElementById('search-results');
        grid.innerHTML = "Loading...";
        
        try {
            const data = await fetch(`${state.activeInstance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`)
                        .then(r => r.json());
            
            grid.innerHTML = "";
            data.forEach(item => {
                const card = document.createElement('div');
                card.className = 'video-card fade-in';
                // Handle different thumbnail structures
                const thumb = item.videoThumbnails?.find(t=>t.quality==='medium')?.url || 
                              (item.videoThumbnails ? item.videoThumbnails[0].url : '');
                
                card.innerHTML = `
                    <img src="${thumb}" class="thumb" loading="lazy">
                    <div class="details">
                        <div class="title">${item.title}</div>
                        <div class="author">${item.author}</div>
                    </div>
                `;
                card.onclick = () => {
                    this.switchView('home');
                    this.createPlayer(item.videoId);
                };
                grid.appendChild(card);
            });
        } catch(e) {
            grid.innerHTML = "Search Failed.";
        }
    }
};

// Global Expose
window.app = app;
window.addEventListener('DOMContentLoaded', () => app.init());
