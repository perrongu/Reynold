/**
 * CFD2DRenderer — rendu CFD simple, lisible, piloté par les calculs backend.
 *
 * Stack: HTML Canvas 2D (pas de Three.js, pas de bloom, pas de blending additif).
 * - Laminaire: profil Poiseuille parabolique
 * - Transition: blend laminaire ↔ turbulent
 * - Turbulent: profil plus plat + fluctuations incompressibles (streamfunction)
 *
 * Le chaos est ancré sur turbulence_intensity (fraction, ex 0.05 = 5%).
 */
export class CFD2DRenderer {
    constructor(container) {
        this.container = container;

        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.canvas.style.imageRendering = 'auto';

        this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
        this.container.appendChild(this.canvas);

        // Visual params
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.bg = '#0a0e14';
        this.fadeAlpha = 0.08; // plus bas = traînées plus longues
        this.pipePadding = 32;

        // Sim params
        this.numParticles = 22000; // dense mais lisible
        this.particles = new Float32Array(this.numParticles * 4); // x,y,age,seed
        this.maxAge = 240;
        this.time = 0;

        // Physical inputs (depuis UI + backend)
        this.velocity_mps = 1.0;
        this.diameter_m = 0.1;
        this.reynolds = 2000;
        this.turbulenceFactor = 0.0; // 0..1 (backend)
        this.turbulenceIntensity = 0.0; // fraction (backend)

        // Precomputed modes for streamfunction (incompressible)
        this.modes = this._makeModes(10);

        this._resize();
        this._resetParticles();

        this._resizeHandler = () => this._resize();
        window.addEventListener('resize', this._resizeHandler);
    }

    setInputs({ velocity, diameter, reynolds, turbulence_factor, turbulence_intensity }) {
        if (Number.isFinite(velocity)) this.velocity_mps = Math.max(velocity, 0.001);
        if (Number.isFinite(diameter)) this.diameter_m = Math.max(diameter, 0.001);
        if (Number.isFinite(reynolds)) this.reynolds = reynolds;
        if (Number.isFinite(turbulence_factor)) this.turbulenceFactor = this._clamp01(turbulence_factor);
        if (Number.isFinite(turbulence_intensity)) this.turbulenceIntensity = Math.max(0, turbulence_intensity);
    }

    tick(dt) {
        // dt en secondes
        this.time += dt;
        this._fade();
        this._drawPipe();
        this._advectAndDraw(dt);
    }

    dispose() {
        window.removeEventListener('resize', this._resizeHandler);
        this.canvas.remove();
    }

    // -----------------------------
    // Core rendering
    // -----------------------------

    _fade() {
        const { ctx, w, h } = this;
        ctx.fillStyle = this._rgba(this.bg, this.fadeAlpha);
        ctx.fillRect(0, 0, w, h);
    }

    _drawPipe() {
        const { ctx } = this;
        const { x0, y0, x1, y1, r } = this._pipeRect();

        // contour subtil
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = 'rgba(180, 200, 255, 0.18)';
        ctx.lineWidth = 2;
        this._roundRect(ctx, x0, y0, x1 - x0, y1 - y0, r);
        ctx.stroke();
        ctx.restore();

        // lignes de paroi (fine)
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = 'rgba(0, 245, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + r, y0 + 1);
        ctx.lineTo(x1 - r, y0 + 1);
        ctx.moveTo(x0 + r, y1 - 1);
        ctx.lineTo(x1 - r, y1 - 1);
        ctx.stroke();
        ctx.restore();
    }

    _advectAndDraw(dt) {
        const { ctx } = this;
        const { x0, y0, x1, y1 } = this._pipeRect();
        const pipeW = x1 - x0;
        const pipeH = y1 - y0;

        // Mapping simulation coords:
        // - sim x: [0,1] => along pipe
        // - sim y: [-1,1] => across pipe (paroi à ±1)
        const tf = this.turbulenceFactor;
        const I = this.turbulenceIntensity; // fraction

        // base speed scale (pixels/s): calibré pour être lisible
        // On encode U via velocity_mps, mais on clamp visuellement.
        const U = this.velocity_mps;
        const pxPerS = pipeW * (0.18 + 0.10 * Math.tanh(U / 2)); // ~0.18..0.28*W / s

        // turbulence amplitude: u_rms ~ I * U
        // Gain visuel: amplification agressive pour rendre le brassage visible
        const Re = this.reynolds;
        const turbPx = pipeH * (0.25 * Math.pow(tf, 1.5)) * Math.sqrt(Re / 4000);

        // fréquence: augmente avec turbulence + Re (structures plus fines à haut Re)
        const kBase = 2.0 + tf * 4.0 + Math.log10(1 + Re / 2000) * 2;
        const omega = 0.6 + tf * 1.5 + Math.sqrt(Re / 10000) * 0.8;

        ctx.save();
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.9;
        ctx.lineCap = 'round';

        const p = this.particles;
        for (let i = 0; i < p.length; i += 4) {
            let sx = p[i];
            let sy = p[i + 1];
            let age = p[i + 2];
            const seed = p[i + 3];

            if (age > this.maxAge || !Number.isFinite(sx) || !Number.isFinite(sy)) {
                const r = this._spawn(seed);
                sx = r.x;
                sy = r.y;
                age = 0;
            }

            // vitesse locale (sim units)
            const uProfile = this._axialProfile(sy, tf); // 0..~2
            const u = uProfile * pxPerS;

            // fluctuations incompressibles via streamfunction psi
            // v = dpsi/dx ; u_add = -dpsi/dy
            const t = this.time;
            const psi = this._psi(sx, sy, t, seed, kBase, omega);
            const dpsi_dx = psi.dpsi_dx;
            const dpsi_dy = psi.dpsi_dy;
            const uAdd = -dpsi_dy * turbPx;
            const vAdd = dpsi_dx * turbPx;

            const vx = (u + uAdd);
            const vy = vAdd;

            const dtPx = dt;
            const nx = sx + (vx / pipeW) * dtPx; // normalize by pipeW
            const ny = sy + (vy / pipeH) * dtPx * 2; // y is [-1,1]

            // draw segment
            const xA = x0 + sx * pipeW;
            const yA = y0 + (0.5 + sy * 0.5) * pipeH;
            const xB = x0 + (nx % 1) * pipeW;
            const yB = y0 + (0.5 + ny * 0.5) * pipeH;

            // Couleur: bleu (laminaire) -> jaune (transition) -> rouge (turbulent)
            // On combine un indicateur global (turbulenceFactor) + un indicateur local (fluctuations / vitesse axiale).
            const localRatio = (Math.abs(uAdd) + Math.abs(vAdd)) / (Math.abs(u) + 1e-6);
            const localT = this._clamp01(tf * 0.65 + localRatio * 0.7);

            // Gradient centre -> paroi (lisibilité CFD):
            // - brightness ~ vitesse (centre plus lumineux)
            // - fade near wall to show boundary layer
            const speed01 = this._clamp01(uProfile / 2.0);
            const wall01 = this._clamp01(1.0 - Math.abs(sy)); // 1 centre, 0 paroi
            const intensity = (0.35 + 0.65 * speed01) * (0.55 + 0.45 * wall01);
            const alpha = 0.35 + 0.55 * (0.4 * speed01 + 0.6 * wall01);

            ctx.strokeStyle = this._regimeColorRGBA(localT, intensity, alpha);
            ctx.beginPath();
            ctx.moveTo(xA, yA);
            ctx.lineTo(xB, yB);
            ctx.stroke();

            // update state with boundary handling
            sx = nx % 1;
            if (sx < 0) sx += 1;

            sy = ny;
            if (sy > 1) sy = 2 - sy;
            if (sy < -1) sy = -2 - sy;

            p[i] = sx;
            p[i + 1] = sy;
            p[i + 2] = age + 1;
        }

        ctx.restore();
    }

    // -----------------------------
    // Flow model
    // -----------------------------

    _axialProfile(y, tf) {
        // y in [-1,1]
        const r = Math.min(1, Math.abs(y));

        // laminaire (Poiseuille): u/Umean = 2*(1-r^2)
        const lam = 2 * (1 - r * r);

        // turbulent: profil plus plat avec exposant variable (couche limite plus mince)
        // n = 7 + 3*(1-tf) => n varie de 10 (laminaire) à 7 (turbulent)
        const n = 7 + 3 * (1 - tf);
        const turb = Math.pow(1 - r, 1 / n) * 1.0;

        // transition blend (backend tf déjà "physique"/corrélé)
        return lam * (1 - tf) + turb * tf;
    }

    _psi(x, y, t, seed, kBase, omega) {
        // Streamfunction: somme de modes sin/cos => champ incompressible
        // x in [0,1], y in [-1,1]
        const yy = (y + 1) * 0.5; // -> [0,1]

        let psi = 0;
        let dpsi_dx = 0;
        let dpsi_dy = 0;

        for (let i = 0; i < this.modes.length; i++) {
            const m = this.modes[i];
            const kx = (m.kx + kBase) * Math.PI * 2;
            const ky = (m.ky + kBase * 0.7) * Math.PI * 2;
            const ph = m.phase + seed * 6.28318;
            const w = omega * m.omega;

            const ax = kx * x + w * t + ph;
            const ay = ky * yy - w * t * 0.7 + ph * 0.8;

            const s1 = Math.sin(ax);
            const c1 = Math.cos(ax);
            const s2 = Math.sin(ay);
            const c2 = Math.cos(ay);

            const a = m.amp;

            // psi = a * sin(ax) * sin(ay)
            psi += a * s1 * s2;
            // dpsi/dx = a * kx * cos(ax) * sin(ay)
            dpsi_dx += a * kx * c1 * s2;
            // dpsi/dy = a * ky * sin(ax) * cos(ay) * d(yy)/dy ; yy = (y+1)/2 => 0.5
            dpsi_dy += a * ky * s1 * c2 * 0.5;
        }

        // Normalize derivatives to something stable-ish
        const norm = 1 / (this.modes.length * 40);
        return { psi: psi * norm, dpsi_dx: dpsi_dx * norm, dpsi_dy: dpsi_dy * norm };
    }

    // -----------------------------
    // Particles
    // -----------------------------

    _resetParticles() {
        const p = this.particles;
        for (let i = 0; i < p.length; i += 4) {
            const seed = Math.random();
            const r = this._spawn(seed);
            p[i] = r.x;
            p[i + 1] = r.y;
            p[i + 2] = Math.random() * this.maxAge;
            p[i + 3] = seed;
        }
        this._fillBg();
    }

    _spawn(seed) {
        // Conduite "pleine partout": spawn uniforme sur toute la longueur
        const x = this._hash01(seed, 1.234);

        // y: distribution légèrement biasée vers la paroi (lecture du cisaillement),
        // mais reste pleine sur toute la section.
        const u = this._hash01(seed, 9.876);
        const sign = this._hash01(seed, 4.321) > 0.5 ? 1 : -1;
        const p = 2.0;
        const y = sign * (1 - Math.pow(u, p));

        return { x, y: this._clamp(y, -1, 1) };
    }

    // -----------------------------
    // Colormap
    // -----------------------------

    _regimeColor(t) {
        // Aligné avec l'échelle UI:
        // - Laminaire: bleu (#3b82f6)
        // - Transition: jaune/orange (#f59e0b)
        // - Turbulent: rouge (#ef4444)
        const x = this._clamp01(t);

        const lam = [0x3b / 255, 0x82 / 255, 0xf6 / 255];
        const mid = [0xf5 / 255, 0x9e / 255, 0x0b / 255];
        const tur = [0xef / 255, 0x44 / 255, 0x44 / 255];

        const lerp3 = (a, b, tt) => [
            a[0] * (1 - tt) + b[0] * tt,
            a[1] * (1 - tt) + b[1] * tt,
            a[2] * (1 - tt) + b[2] * tt
        ];

        let c;
        if (x < 0.5) c = lerp3(lam, mid, x / 0.5);
        else c = lerp3(mid, tur, (x - 0.5) / 0.5);

        return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
    }

    _regimeColorRGBA(t, intensity, alpha) {
        // même hue que _regimeColor, mais modulé (centre->paroi / vitesse)
        const x = this._clamp01(t);
        const k = this._clamp(intensity, 0.15, 1.2);
        const a = this._clamp(alpha, 0.05, 0.98);

        const lam = [0x3b / 255, 0x82 / 255, 0xf6 / 255];
        const mid = [0xf5 / 255, 0x9e / 255, 0x0b / 255];
        const tur = [0xef / 255, 0x44 / 255, 0x44 / 255];

        const lerp3 = (aa, bb, tt) => [
            aa[0] * (1 - tt) + bb[0] * tt,
            aa[1] * (1 - tt) + bb[1] * tt,
            aa[2] * (1 - tt) + bb[2] * tt
        ];

        let c;
        if (x < 0.5) c = lerp3(lam, mid, x / 0.5);
        else c = lerp3(mid, tur, (x - 0.5) / 0.5);

        const r = this._clamp01(c[0] * k);
        const g = this._clamp01(c[1] * k);
        const b = this._clamp01(c[2] * k);

        return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
    }

    // -----------------------------
    // Helpers / setup
    // -----------------------------

    _resize() {
        const rect = this.container.getBoundingClientRect();
        this.w = Math.max(1, Math.floor(rect.width * this.dpr));
        this.h = Math.max(1, Math.floor(rect.height * this.dpr));
        this.canvas.width = this.w;
        this.canvas.height = this.h;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
        // after scale, coordinates are CSS pixels
        this.w = rect.width;
        this.h = rect.height;
        this._fillBg();
    }

    _fillBg() {
        const { ctx, w, h } = this;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = this.bg;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    _pipeRect() {
        // Conduite occupe toujours la pleine largeur de l'écran
        const pipeW = this.w - this.pipePadding * 2;
        
        // Hauteur dépend uniquement du diamètre (pas de ratio avec largeur)
        // ref: 0.1m => height ~ 22% viewport
        const d = this.diameter_m;
        const ref = 0.1;
        const scale = Math.sqrt(d / ref);
        const baseH = this.h * 0.22;
        const pipeH = this._clamp(baseH * scale, this.h * 0.12, this.h * 0.55);

        const x0 = (this.w - pipeW) / 2;
        const y0 = (this.h - pipeH) / 2;
        const x1 = x0 + pipeW;
        const y1 = y0 + pipeH;
        const r = pipeH * 0.18;
        return { x0, y0, x1, y1, r };
    }

    _roundRect(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
    }

    _makeModes(n) {
        const modes = [];
        for (let i = 0; i < n; i++) {
            // small integer-ish frequencies
            const kx = 1 + (i % 4);
            const ky = 1 + ((i * 7) % 5);
            const phase = Math.random() * Math.PI * 2;
            const omega = 0.6 + Math.random() * 1.8;
            // decaying amplitude
            const amp = 1 / (1 + i * 0.85);
            modes.push({ kx, ky, phase, omega, amp });
        }
        return modes;
    }

    _hash01(seed, k) {
        // hash déterministe -> [0,1)
        const x = Math.sin((seed + k) * 43758.5453123) * 143758.5453;
        return x - Math.floor(x);
    }

    _rgba(hex, a) {
        // hex '#rrggbb'
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    _clamp01(x) {
        return x < 0 ? 0 : x > 1 ? 1 : x;
    }

    _clamp(x, a, b) {
        return x < a ? a : x > b ? b : x;
    }
}
