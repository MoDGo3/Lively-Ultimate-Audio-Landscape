// --------------------------------------------------------
// 1. Setup Three.js
// --------------------------------------------------------
const canvasWebGL = document.getElementById('canvas-webgl');
const renderer = new THREE.WebGLRenderer({ antialias: false, canvas: canvasWebGL, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
const clock = new THREE.Clock();

// Set camera position matching the original The Hill (lgz4xpht.sjn)
camera.position.set(0, 16, 128);
camera.lookAt(new THREE.Vector3(0, 28, 0));

// --------------------------------------------------------
// 2. Setup 2D Canvas (For Circle Visualizer)
// --------------------------------------------------------
const canvas2D = document.getElementById('canvas-2d');
const ctx2D = canvas2D.getContext('2d');

const canvasStars = document.getElementById('canvas-stars');
const ctxStars = canvasStars.getContext('2d');

function resizeCanvas() {
    canvas2D.width = window.innerWidth;
    canvas2D.height = window.innerHeight;
    canvasStars.width = window.innerWidth;
    canvasStars.height = window.innerHeight;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --------------------------------------------------------
// 3. State & Variables
// --------------------------------------------------------
let settings = {
    autoColor: true,
    bgColor: "#0e0e0e",
    hillColor: "#ffffff",
    fontColor: "#ffffff",
    speed: 1.0,
    albumBgToggle: true,
    blurIntensity: 5,
    showMountain: true,
    showCircle: false,
    hillOpacity: 100,
    parallaxIntensity: 1,
    isSquare: false,
    displayScaling: 1.0,
    albumRotation: false,
    showAlbumArt: true,
    mouseParallax: true,
    showVisualizer: true,
    visualizerStyle: 0,
    meteorFrequency: 5,
    meteorCount: 3,
    meteorDirection: 0,
    starToggle: true,
    starCount: 150,
    timeToggle: true,
    dateToggle: true,
    _12hour: true,
    mmddyy: false,
    clockScale: 80,
    clockX: 50.0,
    clockY: 36.2,
    clockAutoColor: true,
    clockColor: "#ffffff"
};
let audioData = new Array(128).fill(0);
const colorThief = new ColorThief();
let dynamicColor = null;
window.currentVisualizerColor = "#ffffff";

// Meteor & Star Variables
let meteors = [];
let pendingMeteors = [];
let lastMeteorGroupTime = 0;
let stars = [];
let isPaused = false;

// --------------------------------------------------------
// 4. The Hill Plane (Imported from lgz4xpht.sjn)
// --------------------------------------------------------
class Plane {
  constructor() {
    // We use a DataTexture to send the Audio Array to the WebGL Shader
    this.audioDataArray = new Uint8Array(128);
    let format = THREE.LuminanceFormat || THREE.RedFormat; // Support both old and new Three.js
    this.audioTexture = new THREE.DataTexture(this.audioDataArray, 128, 1, format, THREE.UnsignedByteType);
    this.audioTexture.needsUpdate = true;

    this.uniforms = {
      time : { type: 'f', value: 0 },
      ucolor : { type: 'v3', value: new THREE.Vector3(1., 1., 1.) },
      uopacity : { type: 'f', value: 1.0 },
      uaudio : { type: 't', value: this.audioTexture },
      ushowMountain : { type: 'f', value: 1.0 }
    };
    this.mesh = this.createMesh();
    this.time = 1;
  }
  
  updateAudio(audioArray) {
    for(let i = 0; i < 128; i++) {
        this.audioDataArray[i] = audioArray[i] * 255;
    }
    this.audioTexture.needsUpdate = true;
  }

  createMesh() {
    return new THREE.Mesh(
      new THREE.PlaneGeometry(256, 256, 256, 256), // High resolution plane
      new THREE.RawShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        vertexShader: `
#define GLSLIFY 1
attribute vec3 position;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float time;
uniform sampler2D uaudio;
uniform float ushowMountain;
varying vec3 vPosition;

mat4 rotateMatrixX(float radian) {
  return mat4(1.0, 0.0, 0.0, 0.0, 0.0, cos(radian), -sin(radian), 0.0, 0.0, sin(radian), cos(radian), 0.0, 0.0, 0.0, 0.0, 1.0);
}
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }
float cnoise(vec3 P) {
  vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0); Pi0 = mod289(Pi0); Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x); vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy); vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 * (1.0 / 7.0); vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5; gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0); vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 * (1.0 / 7.0); vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5; gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1); vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x); vec3 g100 = vec3(gx0.y,gy0.y,gz0.y); vec3 g010 = vec3(gx0.z,gy0.z,gz0.z); vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x); vec3 g101 = vec3(gx1.y,gy1.y,gz1.y); vec3 g011 = vec3(gx1.z,gy1.z,gz1.z); vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x, Pf0.yz)); float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z)); float n001 = dot(g001, vec3(Pf0.xy, Pf1.z)); float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz)); float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y); float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); return 2.2 * n_xyz;
}

void main(void) {
  // Rotate plane 90 degrees (Original rotation)
  vec3 updatePosition = (rotateMatrixX(radians(90.0)) * vec4(position, 1.0)).xyz;
  
  float sin1 = sin(radians(updatePosition.x / 128.0 * 90.0));
  vec3 noisePosition = updatePosition + vec3(0.0, 0.0, time * -30.0);
  
  float noise1 = cnoise(noisePosition * 0.08);
  float noise2 = cnoise(noisePosition * 0.06);
  float noise3 = cnoise(noisePosition * 0.4);
  
  // Original shape calculation from lgz4xpht.sjn
  vec3 lastPosition = updatePosition + vec3(0.0, 
    noise1 * sin1 * 8.0 + 
    noise2 * sin1 * 8.0 + 
    noise3 * (abs(sin1) * 2.0 + 0.5) + 
    pow(sin1, 2.0) * 40.0, 0.0);

  // Audio Visualizer lines overlay (Additive layer)
  float audioU = abs(updatePosition.x) / 128.0;
  float audioVal = texture2D(uaudio, vec2(audioU, 0.5)).r;
  lastPosition.y += audioVal * 35.0; 
  
  vPosition = lastPosition;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(lastPosition, 1.0);
}
`,
        fragmentShader: `
precision highp float;
#define GLSLIFY 1
varying vec3 vPosition;
uniform vec3 ucolor;
uniform float uopacity;

void main(void) {
  // Distance fade out effect (from original shader)
  float opacity = (96.0 - length(vPosition)) / 256.0 * 0.6;
  gl_FragColor = vec4(ucolor, opacity * uopacity);
}
`
      })
    );
  }
  render(deltaTime) {
    this.uniforms.time.value += deltaTime * this.time;
  }
}

const plane = new Plane();
scene.add(plane.mesh);

// --------------------------------------------------------
// 5. Animation Loop
// --------------------------------------------------------
function drawCircleVisualizer() {
    ctx2D.clearRect(0, 0, canvas2D.width, canvas2D.height);
    
    if (!settings.showVisualizer || settings.visualizerStyle === undefined) return;

    let albumart = document.getElementById('albumart');
    if (!albumart || albumart.width === 0 || albumart.offsetParent === null) return;

    let rect = albumart.getBoundingClientRect();
    let centerX = rect.left + rect.width / 2;
    let centerY = rect.top + rect.height / 2;
    const baseRadius = (albumart.offsetWidth / 2) + 2;

    const totalBars = 92; 
    const angleStep = (Math.PI * 2) / totalBars;

    for (let i = 0; i < totalBars; i++) {
        let index = i < totalBars / 2 ? i : totalBars - 1 - i;
        let angle = i * angleStep + (Math.PI / 2);

        let raw = audioData[index % 128] || 0;
        let barHeight = Math.pow(raw, 2) * 120;
        const maxBarHeight = 80;
        if (barHeight > maxBarHeight) barHeight = maxBarHeight;
        if (barHeight < 3) barHeight = 3;

        const width = baseRadius * angleStep * 0.8; 

        ctx2D.save();
        ctx2D.translate(centerX, centerY);
        
        if (settings.visualizerStyle === 1) { // Square Peaks
            let normalizedAngle = (angle - Math.PI / 2) % (Math.PI * 2);
            if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
            
            let cos = Math.cos(normalizedAngle);
            let sin = Math.sin(normalizedAngle);
            let scale = 1 / Math.max(Math.abs(cos), Math.abs(sin));
            
            ctx2D.translate(cos * baseRadius * scale, sin * baseRadius * scale);
            
            let squareAngle = 0;
            if (scale === 1/Math.abs(cos)) squareAngle = cos > 0 ? 0 : Math.PI;
            else squareAngle = sin > 0 ? Math.PI/2 : -Math.PI/2;
            ctx2D.rotate(squareAngle);
        } else { // Circle Peaks
            ctx2D.rotate(angle);
            ctx2D.translate(baseRadius, 0);
        }

        let gradient = ctx2D.createLinearGradient(0, 0, barHeight, 0);
        gradient.addColorStop(0, window.currentVisualizerColor);
        gradient.addColorStop(1, 'rgba(255,255,255,0.1)');

        ctx2D.fillStyle = gradient;
        ctx2D.beginPath();
        ctx2D.moveTo(0, -width / 2);
        ctx2D.lineTo(barHeight, 0); 
        ctx2D.lineTo(0, width / 2);
        ctx2D.closePath();
        ctx2D.fill();

        ctx2D.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx2D.lineWidth = 0.5;
        ctx2D.stroke();

        ctx2D.restore();
    }
}

function animate() {
    requestAnimationFrame(animate);

    // Update and draw meteors only if not paused
    updateMeteorSpawning();

    plane.time = settings.speed;
    plane.updateAudio(audioData);
    plane.render(clock.getDelta());

    renderer.render(scene, camera);

    drawBackgroundStars();
    drawCircleVisualizer();
    drawMeteors();
}
animate();
// --- Background Star Functions ---
function initStars() {
    stars = [];
    let count = parseInt(settings.starCount) || 150;
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * canvas2D.width,
            y: Math.random() * canvas2D.height * 0.7, // Only top 70% of sky
            size: Math.random() * 1.5 + 0.5,
            twinkleSpeed: 0.01 + Math.random() * 0.03,
            phase: Math.random() * Math.PI * 2
        });
    }
}
initStars();

function drawBackgroundStars() {
    ctxStars.clearRect(0, 0, canvasStars.width, canvasStars.height);
    if (!settings.starToggle) return;
    for (let s of stars) {
        s.phase += s.twinkleSpeed;
        // Brighter opacity range: 0.3 to 1.0
        let opacity = 0.3 + (Math.sin(s.phase) + 1) * 0.35;
        ctxStars.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctxStars.beginPath();
        ctxStars.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctxStars.fill();
    }
}

// --- Meteor Shower Functions ---
function spawnMeteor() {
    if (meteors.length > 50) return; // Safety limit to prevent lag

    let fromLeft = (settings.meteorDirection === 0);

    let meteor = {
        x: fromLeft ? Math.random() * (canvas2D.width * 0.4) 
                    : canvas2D.width * 0.6 + Math.random() * (canvas2D.width * 0.4),
        y: Math.random() * (canvas2D.height * 0.3),
        vx: fromLeft ? 6 + Math.random() * 4 : -(6 + Math.random() * 4),
        vy: 4 + Math.random() * 3,
        tailLength: 100 + Math.random() * 60,
        opacity: 1.0,
        life: 0, // Frame counter for flash effect
        alive: true
    };
    meteors.push(meteor);
}

function updateMeteorSpawning() {
    const now = performance.now();
    
    // If paused or hidden, clear pending and stop
    if (isPaused || document.hidden || parseInt(settings.meteorCount) <= 0) {
        pendingMeteors = [];
        return;
    }

    // Check if it's time for a new group
    let freqMs = settings.meteorFrequency * 1000;
    if (now - lastMeteorGroupTime > freqMs) {
        lastMeteorGroupTime = now;
        let count = parseInt(settings.meteorCount) || 0;
        for (let i = 0; i < count; i++) {
            // Distribute meteors randomly within the next frequency window
            pendingMeteors.push(now + Math.random() * freqMs);
        }
    }

    // Spawn pending meteors when their time comes
    for (let i = pendingMeteors.length - 1; i >= 0; i--) {
        if (now >= pendingMeteors[i]) {
            spawnMeteor();
            pendingMeteors.splice(i, 1);
        }
    }
}

function drawMeteors() {
    for (let i = meteors.length - 1; i >= 0; i--) {
        let m = meteors[i];
        if (!m.alive) { meteors.splice(i, 1); continue; }

        let tailX = m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.tailLength;
        let tailY = m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.tailLength;

        // Flash effect: brighter and thicker during first 30 frames (~0.5s)
        let isFlashing = m.life < 30;
        let finalOpacity = isFlashing ? Math.min(1.0, m.opacity + 0.3) : m.opacity;
        
        let grad = ctx2D.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${finalOpacity})`);
        grad.addColorStop(1, `rgba(255, 255, 255, 0)`);

        ctx2D.beginPath();
        ctx2D.moveTo(m.x, m.y);
        ctx2D.lineTo(tailX, tailY);
        
        if (isFlashing) {
            ctx2D.shadowBlur = 10;
            ctx2D.shadowColor = "white";
            ctx2D.lineWidth = 3.5;
        } else {
            ctx2D.shadowBlur = 0;
            ctx2D.lineWidth = 2;
        }
        
        ctx2D.strokeStyle = grad;
        ctx2D.stroke();
        
        // Reset shadow for next draws
        ctx2D.shadowBlur = 0;

        m.x += m.vx;
        m.y += m.vy;
        m.opacity -= 0.012;
        m.life++;

        if (m.opacity <= 0 || m.x < -200 || m.x > canvas2D.width + 200 || m.y > canvas2D.height) {
            m.alive = false;
        }
    }
}

// --- Clock Functions ---
const dayArr = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function UpdateClock() {
    const d = new Date();
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    const dayEl = document.getElementById('clock-day');
    const container = document.getElementById('clock-container');

    if (!settings.timeToggle && !settings.dateToggle) {
        container.style.display = "none";
    } else {
        container.style.display = "block";
        
        // Time
        if (settings.timeToggle) {
            timeEl.style.display = "block";
            if (settings._12hour) {
                timeEl.innerHTML = `- ${new Intl.DateTimeFormat('en-US', { 'hour': '2-digit', 'minute': '2-digit', 'hour12': true }).format(d)} -`.replace("AM", "").replace("PM", "");
            } else {
                timeEl.innerHTML = `- ${new Intl.DateTimeFormat('en-US', { 'hour': '2-digit', 'minute': '2-digit', 'hour12': false }).format(d)} -`;
            }
        } else {
            timeEl.style.display = "none";
        }

        // Date & Day
        if (settings.dateToggle) {
            dateEl.style.display = "block";
            dayEl.style.display = "block";
            
            dayEl.innerText = dayArr[d.getDay()];
            
            if (settings.mmddyy) {
                dateEl.innerText = new Intl.DateTimeFormat('en-US', { 'month': 'short', 'day': '2-digit', 'year': '2-digit' }).format(d).replace(',', '');
            } else {
                dateEl.innerText = new Intl.DateTimeFormat('en-GB', { 'day': '2-digit', 'month': '2-digit', 'year': '2-digit' }).format(d).replace(',', '');
            }
        } else {
            dateEl.style.display = "none";
            dayEl.style.display = "none";
        }
    }
    setTimeout(UpdateClock, 1000);
}
UpdateClock();

// --------------------------------------------------------
// 6. Lively Wallpaper API
// --------------------------------------------------------
window.livelyWindowStateListener = function(data) {
    let obj = JSON.parse(data);
    isPaused = obj.IsPaused;
    
    // Clear existing and pending meteors when paused to ensure no lag upon resume
    if (isPaused) {
        meteors = [];
        pendingMeteors = [];
    }
};

window.livelyPropertyListener = function(name, val) {
    settings[name] = val;
    if (name === "meteorFrequency" || name === "meteorCount" || name === "meteorDirection") {
        lastMeteorGroupTime = 0; // Reset group timer
        pendingMeteors = [];     // Clear pending
    }
    if (name === "starCount") {
        initStars();
    }
    applySettings();
};

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function applySettings() {
    document.body.style.backgroundColor = settings.bgColor;
    
    let rgb;
    if (settings.autoColor && dynamicColor) {
        rgb = { r: dynamicColor[0], g: dynamicColor[1], b: dynamicColor[2] };
    } else {
        rgb = hexToRgb(settings.hillColor);
    }
    
    if(rgb) {
        plane.uniforms.ucolor.value = new THREE.Vector3(rgb.r/255, rgb.g/255, rgb.b/255);
        window.currentVisualizerColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
    
    // Toggle mountain visibility and opacity
    plane.mesh.visible = settings.showMountain;
    plane.uniforms.uopacity.value = settings.hillOpacity / 100.0;
    
    let trackContainer = document.getElementById('track-container');
    let clockContainer = document.getElementById('clock-container');
    
    let fontColor = (settings.autoColor && dynamicColor) ? 
        `rgb(${dynamicColor[0]}, ${dynamicColor[1]}, ${dynamicColor[2]})` : settings.fontColor;

    if(trackContainer) {
        trackContainer.style.visibility = settings.showAlbumArt ? "visible" : "hidden";
        trackContainer.style.color = fontColor;
    }

    if(clockContainer) {
        let clockFontColor = settings.clockColor;
        if (settings.clockAutoColor && dynamicColor) {
            clockFontColor = `rgb(${dynamicColor[0]}, ${dynamicColor[1]}, ${dynamicColor[2]})`;
        }
            
        clockContainer.style.setProperty('color', clockFontColor, 'important');
        clockContainer.style.left = settings.clockX + "%";
        clockContainer.style.top = settings.clockY + "%";
        clockContainer.style.transform = `translateX(-50%) scale(${settings.clockScale / 100})`;
    }
    
    let bgContainer = document.getElementById('bg-album-container');
    if(bgContainer) {
        bgContainer.style.display = settings.albumBgToggle ? "block" : "none";
        bgContainer.style.filter = `blur(${settings.blurIntensity}px)`;
    }
    
    let albumart = document.getElementById('albumart');
    if(albumart) {
        albumart.style.borderRadius = settings.isSquare ? "10px" : "50%";
        if (settings.albumRotation) {
            albumart.style.animation = "rotate 20s linear infinite";
            albumart.style.transform = ""; 
        } else {
            albumart.style.animation = "none";
            albumart.style.transform = "rotate(0deg)";
        }
    }
    
    renderer.setPixelRatio(settings.displayScaling * window.devicePixelRatio);
}

// Mouse Parallax Event
document.addEventListener("mousemove", function(e) {
    let px = 0, py = 0;
    
    if (settings.mouseParallax) {
        px = (window.innerWidth / 2 - e.pageX) / 90 * settings.parallaxIntensity;
        py = (window.innerHeight / 2 - e.pageY) / 90 * settings.parallaxIntensity;
    }
    
    let trackContainer = document.getElementById('track-container');
    if(trackContainer) trackContainer.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
    
    let bgContainer = document.getElementById('bg-album-container');
    if(bgContainer) bgContainer.style.transform = `translate(${-px * 0.5}px, ${-py * 0.5}px)`;
    
    camera.position.x = px * 2;
    camera.position.y = 16 + py * 2;
    camera.lookAt(new THREE.Vector3(0, 28, 0));
});

window.livelyCurrentTrack = function(data) {
    let obj = JSON.parse(data);
    let trackContainer = document.getElementById('track-container');
    let bgContainer = document.getElementById('bg-album-container');
    
    if (obj != null && obj.Title) {
        document.getElementById('track-title').innerText = obj.Title;
        document.getElementById('track-artist').innerText = obj.Artist || "Unknown Artist";
        if (obj.Thumbnail != null) {
            let imgStr = 'data:image/png;base64,' + obj.Thumbnail;
            document.getElementById('albumart').src = imgStr;
            bgContainer.style.backgroundImage = 'url(' + imgStr + ')';
        }
        if (settings.showAlbumArt) trackContainer.style.opacity = '1';
    } else {
        trackContainer.style.opacity = '0';
        bgContainer.style.backgroundImage = 'none';
    }
};

let albumartElement = document.getElementById('albumart');
if (albumartElement) {
    albumartElement.addEventListener("load", function () {
        try {
            dynamicColor = colorThief.getColor(albumartElement);
            applySettings();
        } catch(e) {
            console.error("ColorThief Error:", e);
        }
    });
}

window.livelyAudioListener = function(audioArray) {
    audioData = audioArray;
};
