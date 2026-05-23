/**
 * D.A.V.E. Tech Demo Engine
 * Real-time Vector Field Simulation, Mesh Architecture, and Evaluator Pipelines
 */

// Default Policy Configuration Structure Object
const defaultPolicy = {
  minConfidence: 0.82,
  caps: {
    "Mahi-Mahi": 15,
    Tuna: 8,
    Mackerel: 40,
  },
  iffAssets: ["dive-tender-1", "crew-boat-alpha", "autonomous-pod-0"],
  environment: {
    currentSpeed: 1.4,
    currentDirection: 65,
    depthMaxMeters: 120,
  },
};

// Global Environment Core State Engine
const state = {
  hilAutonomous: true,
  policy: { ...defaultPolicy },
  fauna: [],
  nodes: [],
  ripples: [],
  logs: [],
  activeEvaluationContact: null,
  activeEvaluationStep: 0,
  evaluationTimer: 0,
  systemLockdown: false,
  harvestCounts: { "Mahi-Mahi": 0, Tuna: 0, Mackerel: 0 },
  scanlineY: 0, // Sonar refresh vector line
  scanlineTrail: [], // AESTHETIC: trailing decay lines for sonar sweep
};

// Procedural Acoustic Audio Engine (Web Audio API Synth)
const AudioArray = {
  ctx: null,
  init() {
    if (!this.ctx)
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },
  ping(freq = 290, duration = 0.8) {
    try {
      this.init();
      if (this.ctx.state === "suspended") this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        freq * 0.4,
        this.ctx.currentTime + duration,
      );

      gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        this.ctx.currentTime + duration,
      );

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // AudioContext fallback for restricted browser security contexts
    }
  },
};

// Species Configuration Array Parameters
// Re-balanced Ecosystem Presets: Sparse targets + heavy environmental noise
const SPECIES_PRESETS = [
  {
    name: "Mahi-Mahi",
    density: 0.0001,
    behavior: "fast",
    color: "#00f3ff",
    size: 4,
    speed: 2.8,
    isTarget: true,
  },
  {
    name: "Tuna",
    density: 0.00005,
    behavior: "schooling",
    color: "#8ba4ff",
    size: 6,
    speed: 3.2,
    isTarget: true,
  },
  {
    name: "Mackerel",
    density: 0.00015,
    behavior: "erratic",
    color: "#a2e3a6",
    size: 3,
    speed: 2.0,
    isTarget: true,
  },
  {
    name: "Dolphin",
    density: 0.00002,
    behavior: "playful",
    color: "#38bdf8",
    size: 8,
    speed: 2.5,
    isTarget: false,
  },
  {
    name: "Shark",
    density: 0.00002,
    behavior: "predator",
    color: "#475569",
    size: 10,
    speed: 1.5,
    isTarget: false,
  },
  {
    name: "Sea Turtle",
    density: 0.00001,
    behavior: "slow",
    color: "#15803d",
    size: 8,
    speed: 0.6,
    isTarget: false,
  },
  // Non-target Biomass Noise (Marine Snow / Plankton Clouds)
  {
    name: "Marine Snow",
    density: 0.0018,
    behavior: "drift",
    color: "rgba(139, 148, 158, 0.12)",
    size: 1.5,
    speed: 0.3,
    isTarget: false,
  },
];

// Initialize Infrastructure Layouts
const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");
const logContainer = document.getElementById("logContainer");
const policyEditor = document.getElementById("policyEditor");
const hilSwitch = document.getElementById("hilSwitch");
const hilModal = document.getElementById("hilModal");

// Setup Configuration Editors
policyEditor.value = JSON.stringify(state.policy, null, 2);

function pushLog(text, severity = "system") {
  const timestamp = new Date().toLocaleTimeString();
  state.logs.unshift({ timestamp, text, severity });

  const entry = document.createElement("div");
  entry.className = `log-entry ${severity}`;
  entry.innerHTML = `[${timestamp}] ${text}`;

  logContainer.insertBefore(entry, logContainer.firstChild);
  if (logContainer.children.length > 80) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

// Canvas Sizing Adjustments
// FIX: getBoundingClientRect returns 0 if called before flex layout settles.
// Use requestAnimationFrame to defer until after first paint.
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return; // guard against pre-layout call
  canvas.width = rect.width;
  canvas.height = rect.height;
}

// FIX: on resize, reposition mesh nodes to new canvas proportions
// without wiping fauna or harvest counts (don't call initSimulation)
function repositionNodes() {
  if (state.nodes.length < 3) return;
  state.nodes[0].x = canvas.width * 0.25;
  state.nodes[0].y = canvas.height * 0.3;
  state.nodes[1].x = canvas.width * 0.75;
  state.nodes[1].y = canvas.height * 0.4;
  state.nodes[2].x = canvas.width * 0.5;
  state.nodes[2].y = canvas.height * 0.75;
}

window.addEventListener("resize", () => {
  resizeCanvas();
  repositionNodes();
});

// Robust utility to extract pure R, G, B channel values from either Hex or RGBA strings
function getRgbChannels(colorStr) {
  if (colorStr.startsWith("#")) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colorStr);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : "139, 148, 158";
  } else if (colorStr.startsWith("rgb")) {
    const matches = colorStr.match(/\d+/g);
    if (matches && matches.length >= 3) {
      return `${matches[0]}, ${matches[1]}, ${matches[2]}`;
    }
  }
  return "139, 148, 158"; // Fallback text-muted channels
}
// Entity Class Realism Definitions
class FaunaEntity {
  constructor(x, y, preset, customFields = {}) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.x = x || Math.random() * canvas.width;
    this.y = y || Math.random() * canvas.height;
    this.species = preset.name;
    this.behavior = preset.behavior;
    this.color = preset.color;
    this.size = preset.size;
    this.baseSpeed = preset.speed;
    this.confidence = 0.6 + Math.random() * 0.38;

    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * this.baseSpeed;
    this.vy = Math.sin(angle) * this.baseSpeed;

    Object.assign(this, customFields);
  }

  update(currentRad, currentSpeed) {
    if (state.systemLockdown && this.species !== "Human") {
      return; // Freeze activity during critical safety system locks
    }

    // Apply Global Vector Field Currents
    this.x += this.vx + Math.cos(currentRad) * currentSpeed;
    this.y += this.vy + Math.sin(currentRad) * currentSpeed;

    // Behavioral Physics Adaptations
    if (this.behavior === "erratic" && Math.random() < 0.05) {
      const angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * this.baseSpeed;
      this.vy = Math.sin(angle) * this.baseSpeed;
    } else if (this.behavior === "schooling" && Math.random() < 0.02) {
      const cluster = state.fauna.find(
        (f) => f.species === this.species && f.id !== this.id,
      );
      if (cluster) {
        this.vx = this.vx * 0.8 + cluster.vx * 0.2;
        this.vy = this.vy * 0.8 + cluster.vy * 0.2;
      }
    }

    // Border Collision Restructuring Wrap
    if (this.x < 0) this.x = canvas.width;
    if (this.x > canvas.width) this.x = 0;
    if (this.y < 0) this.y = canvas.height;
    if (this.y > canvas.height) this.y = 0;
  }

  // Updated Draw Loop inside FaunaEntity Class
  draw() {
    ctx.save();

    if (this.species === "Human") {
      const pulseFactor = Math.sin(Date.now() / 150);
      const outerRadius = this.size * 4 + pulseFactor * 6;

      const gradient = ctx.createRadialGradient(
        this.x,
        this.y,
        2,
        this.x,
        this.y,
        outerRadius,
      );
      gradient.addColorStop(0, "rgba(255, 123, 114, 1.0)");
      gradient.addColorStop(0.2, "rgba(218, 54, 51, 0.8)");
      gradient.addColorStop(0.6, "rgba(218, 54, 51, 0.2)");
      gradient.addColorStop(1, "rgba(218, 54, 51, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, outerRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff7b72";
      ctx.font = "bold 9px monospace";
      ctx.fillText(
        "⚠️ HAZARD: BRK_CLS_0",
        this.x + outerRadius + 4,
        this.y + 3,
      );
    } else {
      // Standard Fauna: Probabilistic Energy Blob with safe channel interpolation
      const uncertaintyModifier = (1.1 - this.confidence) * 35;
      const coreRadius = this.size * 0.4;
      const envelopeRadius = this.size * 2.5 + uncertaintyModifier;

      const rgbChannels = getRgbChannels(this.color);
      const alphaMultiplier = this.species === "Marine Snow" ? 0.25 : 1.0; // Keeps environmental noise faint

      ctx.globalCompositeOperation = "screen";

      const gradient = ctx.createRadialGradient(
        this.x,
        this.y,
        coreRadius,
        this.x,
        this.y,
        envelopeRadius,
      );
      gradient.addColorStop(
        0,
        `rgba(${rgbChannels}, ${1.0 * alphaMultiplier})`,
      );
      gradient.addColorStop(
        0.15,
        `rgba(${rgbChannels}, ${0.6 * alphaMultiplier})`,
      );
      gradient.addColorStop(
        0.5,
        `rgba(${rgbChannels}, ${0.15 * alphaMultiplier})`,
      );
      gradient.addColorStop(1, `rgba(${rgbChannels}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, envelopeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Sonar Scanline Pass Highlight Spark
      const distToSweep = Math.abs(this.y - state.scanlineY);
      if (distToSweep < 30 && this.species !== "Marine Snow") {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * (1 - distToSweep / 30)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x - 12, this.y);
        ctx.lineTo(this.x + 12, this.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
// Network Mesh Nodes (Master / Pods / Tenders)
class MeshNode {
  constructor(x, y, role, name) {
    this.x = x;
    this.y = y;
    this.role = role;
    this.name = name;
    this.pulseScale = 1.0;
    this.pulseDir = 1;
  }

  update() {
    this.pulseScale += 0.008 * this.pulseDir;
    if (this.pulseScale > 1.2 || this.pulseScale < 0.95) this.pulseDir *= -1;
  }

  draw() {
    ctx.beginPath();
    ctx.fillStyle = state.systemLockdown
      ? "rgba(218,54,51,0.2)"
      : "rgba(88,166,255,0.15)";
    ctx.arc(this.x, this.y, 35 * this.pulseScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = state.systemLockdown
      ? varCSS("--accent-red")
      : varCSS("--accent-blue");
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = varCSS("--text-muted");
    ctx.font = "9px monospace";
    ctx.fillText(
      `${this.role.toUpperCase()}:${this.name}`,
      this.x - 25,
      this.y - 12,
    );
  }
}

// Setup Infrastructure Systems
function initSimulation() {
  state.fauna = [];
  state.nodes = [
    new MeshNode(canvas.width * 0.25, canvas.height * 0.3, "master", "M-01"),
    new MeshNode(canvas.width * 0.75, canvas.height * 0.4, "pod", "P-0A"),
    new MeshNode(canvas.width * 0.5, canvas.height * 0.75, "tender", "T-ALPHA"),
  ];

  SPECIES_PRESETS.forEach((preset) => {
    const totalToSpawn = Math.max(
      1,
      Math.floor(canvas.width * canvas.height * preset.density),
    );

    if (preset.behavior === "schooling") {
      const schoolX = Math.random() * canvas.width;
      const schoolY = Math.random() * canvas.height;

      for (let i = 0; i < totalToSpawn; i++) {
        const offsetX = (Math.random() - 0.5) * 60;
        const offsetY = (Math.random() - 0.5) * 60;
        state.fauna.push(
          new FaunaEntity(schoolX + offsetX, schoolY + offsetY, preset),
        );
      }
    } else {
      for (let i = 0; i < totalToSpawn; i++) {
        state.fauna.push(new FaunaEntity(null, null, preset));
      }
    }
  });

  pushLog(
    "System Mesh Infrastructure established. 10-Gate ROE module active.",
    "system",
  );
}

function varCSS(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

// User-Triggered Object Injection (Interactive Click Exception Engine)
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  const human = new FaunaEntity(
    clickX,
    clickY,
    {
      name: "Human",
      behavior: "slow",
      color: "#da3633",
      size: 8,
      speed: 0.2,
    },
    { confidence: 1.0 },
  );

  // AESTHETIC: Multiple expanding warning rings for Human detection
  state.ripples.push({
    x: clickX,
    y: clickY,
    radius: 5,
    maxRadius: 80,
    color: "rgba(218, 54, 51, 0.7)",
  });
  state.ripples.push({
    x: clickX,
    y: clickY,
    radius: 20,
    maxRadius: 130,
    color: "rgba(218, 54, 51, 0.45)",
  });
  state.ripples.push({
    x: clickX,
    y: clickY,
    radius: 40,
    maxRadius: 200,
    color: "rgba(218, 54, 51, 0.2)",
  });

  state.fauna.push(human);
  pushLog(
    "CRITICAL HAZARD: Unscheduled human visual detection signature acquired.",
    "hard-stop",
  );

  // Cinematic Feedback: Signal shudder + sub-bass ping
  const bg = canvas.parentElement.querySelector(".canvas-bg");
  if (bg) bg.classList.add("hardware-glitch");
  canvas.classList.add("hardware-glitch");
  AudioArray.ping(95, 1.2);
  setTimeout(() => {
    if (bg) bg.classList.remove("hardware-glitch");
    canvas.classList.remove("hardware-glitch");
  }, 250);

  state.activeEvaluationContact = human;
  state.activeEvaluationStep = 1;
  state.evaluationTimer = 0;
  resetUIGates();
});

// ROE Pipeline Step Interface Controller Logic
function resetUIGates() {
  document.querySelectorAll(".roe-gate").forEach((gate) => {
    gate.className = "roe-gate";
    gate.querySelector(".gate-status").innerText = "IDLE";
  });
}

function updateUIGateVisual(stepNumber, classString, statusText) {
  const gate = document.querySelector(`.roe-gate[data-step="${stepNumber}"]`);
  if (gate) {
    gate.className = `roe-gate ${classString}`;
    gate.querySelector(".gate-status").innerText = statusText;
  }
}

// Run through Evaluator Loop Pipeline steps sequentially
function processROEPipeline() {
  if (state.systemLockdown) {
    document.querySelectorAll(".roe-gate").forEach((gate) => {
      gate.className = "roe-gate hard-stop-state";
      gate.querySelector(".gate-status").innerText = "LOCKED";
    });
    return;
  }

  // Scan Selector Module: Filter out marine noise and un-targetable biomass
  if (!state.activeEvaluationContact) {
    if (state.fauna.length === 0) return;

    const validTargets = state.fauna.filter(
      (f) =>
        f.species === "Human" ||
        (SPECIES_PRESETS.find((p) => p.name === f.species)?.isTarget &&
          state.policy.caps[f.species] !== undefined),
    );

    if (validTargets.length > 0 && Math.random() < 0.015) {
      const selectedTarget =
        validTargets[Math.floor(Math.random() * validTargets.length)];
      state.activeEvaluationContact = selectedTarget;
      state.activeEvaluationStep = 1;
      state.evaluationTimer = 0;
      resetUIGates();

      // Synthetic Target Lock Sound Effect Trigger
      AudioArray.ping(selectedTarget.species === "Human" ? 170 : 310, 0.35);
    }
    return;
  }

  state.evaluationTimer++;
  if (state.evaluationTimer >= 15) {
    state.evaluationTimer = 0;
    const step = state.activeEvaluationStep;
    const contact = state.activeEvaluationContact;

    if (!state.fauna.find((f) => f.id === contact.id)) {
      state.activeEvaluationContact = null;
      resetUIGates();
      return;
    }

    if (step === 1 || step === 3) {
      state.ripples.push({
        x: contact.x,
        y: contact.y,
        radius: 1,
        maxRadius: 60,
      });
    }

    switch (step) {
      case 1:
        updateUIGateVisual(1, "passed", "ACQUIRED");
        state.activeEvaluationStep = 2;
        break;
      case 2:
        updateUIGateVisual(2, "passed", contact.species.toUpperCase());
        state.activeEvaluationStep = 3;
        break;
      case 3:
        updateUIGateVisual(3, "passed", "RESOLVED");
        state.activeEvaluationStep = 4;
        break;
      case 4:
        updateUIGateVisual(4, "passed", "TRACKING");
        state.activeEvaluationStep = 5;
        break;
      case 5:
        if (contact.species === "Human") {
          updateUIGateVisual(5, "hard-stop-state", "VIOLATION");
          triggerSystemLockdown();
        } else if (state.policy.caps[contact.species] !== undefined) {
          const capCount = state.policy.caps[contact.species];
          const currentCount = state.harvestCounts[contact.species] || 0;
          if (currentCount >= capCount) {
            updateUIGateVisual(5, "failed", "CAP EXCEEDED");
            pushLog(
              `ROE Boundary: Harvest allocation cap hit for ${contact.species}.`,
              "observe",
            );
            abortPipelineSequence();
          } else {
            updateUIGateVisual(5, "passed", "VALID");
            state.activeEvaluationStep = 6;
          }
        } else {
          updateUIGateVisual(5, "failed", "PROTECTED");
          pushLog(
            `ROE Boundary: Species ${contact.species} is out-of-policy scope.`,
            "observe",
          );
          abortPipelineSequence();
        }
        break;
      case 6:
        if (contact.confidence >= state.policy.minConfidence) {
          updateUIGateVisual(
            6,
            "passed",
            `${Math.floor(contact.confidence * 100)}% CONF`,
          );
          state.activeEvaluationStep = 7;
        } else {
          updateUIGateVisual(6, "failed", "LOW CONF");
          pushLog(
            `ROE Abort: Visual confidence threshold below limit for ${contact.species}.`,
            "observe",
          );
          abortPipelineSequence();
        }
        break;
      case 7:
        if (state.hilAutonomous) {
          updateUIGateVisual(7, "passed", "AUTO_PASS");
          state.activeEvaluationStep = 8;
        } else {
          updateUIGateVisual(7, "processing", "AWAITING");
          state.activeEvaluationStep = "HIL_HOLD";
          displayHILInterceptPrompt(contact);
        }
        break;
      case 8:
        updateUIGateVisual(8, "passed", "READY");
        state.activeEvaluationStep = 9;
        break;
      case 9:
        updateUIGateVisual(9, "passed", "ARMED");
        state.activeEvaluationStep = 10;
        break;
      case 10:
        updateUIGateVisual(10, "passed", "EXECUTED");
        executeSubdueImpactEffect(contact);
        break;
    }
  }

  if (state.activeEvaluationStep >= 1 && state.activeEvaluationStep <= 10) {
    const currentGate = document.querySelector(
      `.roe-gate[data-step="${state.activeEvaluationStep}"]`,
    );
    if (currentGate && !currentGate.classList.contains("passed")) {
      currentGate.classList.add("processing");
      currentGate.querySelector(".gate-status").innerText = "SCANNED";
    }
  }
}

function abortPipelineSequence() {
  state.activeEvaluationContact = null;
  state.activeEvaluationStep = 0;
  setTimeout(resetUIGates, 1500);
}

function triggerSystemLockdown() {
  state.systemLockdown = true;
  state.activeEvaluationStep = 0;
  hilModal.classList.add("hidden");
  pushLog(
    "🚨 ROE CRITICAL EXCEPTION: HARD LOCKDOWN ENFORCED. ALL ACTUATORS RECOILED.",
    "hard-stop",
  );
}

function displayHILInterceptPrompt(contact) {
  const infoEl = document.getElementById("hilModalTargetInfo");
  if (infoEl) {
    infoEl.innerHTML = `Confirm automated target capture for <strong>${contact.species}</strong><br>Confidence Matrix: ${(contact.confidence * 100).toFixed(1)}%`;
  }
  hilModal.classList.remove("hidden");
}

document.getElementById("modalConfirmBtn").addEventListener("click", () => {
  if (
    state.activeEvaluationStep === "HIL_HOLD" &&
    state.activeEvaluationContact
  ) {
    hilModal.classList.add("hidden");
    updateUIGateVisual(7, "passed", "MAN_PASS");
    state.activeEvaluationStep = 8;
    state.evaluationTimer = 0;
    pushLog(
      `HIL Override: Human validated token. Target authorization cleared.`,
      "system",
    );
  }
});

document.getElementById("modalRejectBtn").addEventListener("click", () => {
  hilModal.classList.add("hidden");
  pushLog(
    `HIL Input Override: User rejected target tracking track execution token.`,
    "observe",
  );
  abortPipelineSequence();
});

function executeSubdueImpactEffect(contact) {
  state.ripples.push({
    x: contact.x,
    y: contact.y,
    radius: 5,
    maxRadius: 110,
    color: "rgba(35, 134, 54, 0.8)",
  });

  state.harvestCounts[contact.species] =
    (state.harvestCounts[contact.species] || 0) + 1;
  pushLog(
    `[MESH-FIRE] Actuators deployed: Harvest pass successful on ${contact.species}.`,
    "subdue",
  );

  state.fauna = state.fauna.filter((f) => f.id !== contact.id);
  abortPipelineSequence();
}

// Primary Application Animation Mechanics Loops
function renderLoop() {
  // Alpha transparency block blends pixels into the Unsplash bathymetric background
  ctx.fillStyle = "rgba(2, 5, 10, 0.3)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // AESTHETIC: Sonar scanline with decaying trail
  state.scanlineY += 1.6;
  if (state.scanlineY > canvas.height) {
    state.scanlineY = 0;
    state.scanlineTrail = [];
  }

  // Push current position to trail and trim
  state.scanlineTrail.push(state.scanlineY);
  if (state.scanlineTrail.length > 18) state.scanlineTrail.shift();

  // Draw trail lines with exponential opacity decay
  state.scanlineTrail.forEach((ty, i) => {
    const alpha = (i / state.scanlineTrail.length) * 0.12;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(0, 229, 192, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.moveTo(0, ty);
    ctx.lineTo(canvas.width, ty);
    ctx.stroke();
  });

  // Bright leading edge
  ctx.beginPath();
  ctx.strokeStyle = "rgba(0, 229, 192, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.moveTo(0, state.scanlineY);
  ctx.lineTo(canvas.width, state.scanlineY);
  ctx.stroke();

  const currentRad =
    (state.policy.environment.currentDirection * Math.PI) / 180;
  const currentSpeed = state.policy.environment.currentSpeed * 0.2;

  // Render Visual Grid Flow indicators
  ctx.strokeStyle = "rgba(48, 54, 61, 0.15)";
  ctx.lineWidth = 1;
  const stepSize = 80;
  for (let x = 0; x < canvas.width; x += stepSize) {
    for (let y = 0; y < canvas.height; y += stepSize) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(currentRad) * 12, y + Math.sin(currentRad) * 12);
      ctx.stroke();
    }
  }

  // Update & Draw Fauna
  state.fauna.forEach((entity) => {
    entity.update(currentRad, currentSpeed);
    entity.draw();
  });

  // Update & Draw Fleet Nodes Infrastructure
  state.nodes.forEach((node) => {
    node.update();
    node.draw();

    if (state.activeEvaluationContact && !state.systemLockdown) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(88, 166, 255, 0.2)";
      ctx.setLineDash([4, 4]);
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(
        state.activeEvaluationContact.x,
        state.activeEvaluationContact.y,
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  // Draw active tracking target telemetry overlays + HUD systems info
  if (state.activeEvaluationContact && !state.systemLockdown) {
    const c = state.activeEvaluationContact;
    const colorStyle =
      c.species === "Human" ? varCSS("--accent-red") : varCSS("--accent-blue");
    const textColor = c.species === "Human" ? "#ff7b72" : "#58a6ff";

    ctx.beginPath();
    ctx.strokeStyle = colorStyle;
    ctx.lineWidth = 1.5;
    ctx.arc(c.x, c.y, c.size + 10, 0, Math.PI * 2);
    ctx.stroke();

    // Technical crosshair nodes
    ctx.beginPath();
    ctx.moveTo(c.x - c.size - 15, c.y);
    ctx.lineTo(c.x - c.size - 6, c.y);
    ctx.moveTo(c.x + c.size + 6, c.y);
    ctx.lineTo(c.x + c.size + 15, c.y);
    ctx.moveTo(c.x, c.y - c.size - 15);
    ctx.lineTo(c.x, c.y - c.size - 6);
    ctx.moveTo(c.x, c.y + c.size + 6);
    ctx.lineTo(c.x, c.y + c.size + 15);
    ctx.stroke();

    // Telemetry Real-time Calculations
    const depth = Math.floor(
      (c.y / canvas.height) * state.policy.environment.depthMaxMeters,
    );
    const dx = c.x - canvas.width / 2;
    const dy = c.y - canvas.height / 2;
    let bearing = Math.floor((Math.atan2(dy, dx) * 180) / Math.PI);
    if (bearing < 0) bearing += 360;
    const range = Math.floor(Math.sqrt(dx * dx + dy * dy) * 1.6);
    const velocity = (Math.sqrt(c.vx * c.vx + c.vy * c.vy) * 2.8).toFixed(1);

    ctx.fillStyle = textColor;
    ctx.font = "9px monospace";
    const hudX = c.x + c.size + 18;
    let hudY = c.y - 14;

    ctx.fillText(`TRK_ID: ${c.id.toUpperCase()}`, hudX, hudY);
    ctx.fillText(`RNG:    ${range}m`, hudX, hudY + 11);
    ctx.fillText(
      `BRG:    ${bearing.toString().padStart(3, "0")}°`,
      hudX,
      hudY + 22,
    );
    ctx.fillText(`DEP:    ${depth}m`, hudX, hudY + 33);
    ctx.fillText(`VLO:    ${velocity}kts`, hudX, hudY + 44);

    // Leader indicator line structure
    ctx.beginPath();
    ctx.strokeStyle =
      c.species === "Human" ? "rgba(218,54,51,0.35)" : "rgba(88,166,255,0.35)";
    ctx.lineWidth = 1;
    ctx.moveTo(c.x + c.size + 10, c.y);
    ctx.lineTo(hudX - 4, c.y);
    ctx.stroke();
  }

  // Render Sonar Wave Propagation Echoes
  state.ripples.forEach((ripple, index) => {
    ripple.radius += 2.5;
    ctx.beginPath();
    ctx.strokeStyle =
      ripple.color ||
      "rgba(188, 140, 255, " + (1 - ripple.radius / ripple.maxRadius) + ")";
    ctx.lineWidth = 1.5;
    ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    ctx.stroke();
  });
  state.ripples = state.ripples.filter((r) => r.radius < r.maxRadius);

  // AESTHETIC: Canvas vignette overlay — keeps center bright, edges dark
  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.25,
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.85,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // AESTHETIC: Species tally HUD — bottom left corner
  ctx.save();
  const hud = [
    { label: "MAHI-MAHI", key: "Mahi-Mahi", color: "#00f3ff" },
    { label: "TUNA", key: "Tuna", color: "#8ba4ff" },
    { label: "MACKEREL", key: "Mackerel", color: "#a2e3a6" },
  ];
  const hudBaseX = 12;
  let hudBaseY = canvas.height - 12 - hud.length * 16;
  ctx.font = "9px 'Share Tech Mono', monospace";
  hud.forEach(({ label, key, color }) => {
    const cap = state.policy.caps[key] || 0;
    const count = state.harvestCounts[key] || 0;
    const pct = cap > 0 ? count / cap : 0;
    // Bar background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(hudBaseX, hudBaseY, 90, 10);
    // Bar fill
    ctx.fillStyle =
      pct >= 1
        ? "rgba(218,54,51,0.5)"
        : `rgba(${color === "#00f3ff" ? "0,243,255" : color === "#8ba4ff" ? "139,164,255" : "162,227,166"},0.35)`;
    ctx.fillRect(hudBaseX, hudBaseY, 90 * pct, 10);
    // Label
    ctx.fillStyle = color;
    ctx.fillText(`${label}: ${count}/${cap}`, hudBaseX + 94, hudBaseY + 9);
    hudBaseY += 16;
  });
  ctx.restore();

  // Compute Active Processing Gates Serialization Steps
  processROEPipeline();

  requestAnimationFrame(renderLoop);
}

// User-Interface Interactivity Subscriptions
hilSwitch.addEventListener("change", (e) => {
  state.hilAutonomous = e.target.checked;
  if (state.hilAutonomous) {
    pushLog("System configuration modified: MODE → FULL AUTONOMOUS.", "subdue");
    if (state.activeEvaluationStep === "HIL_HOLD") {
      hilModal.classList.add("hidden");
      updateUIGateVisual(7, "passed", "AUTO_PASS");
      state.activeEvaluationStep = 8;
    }
  } else {
    pushLog(
      "System configuration modified: MODE → HUMAN-IN-THE-LOOP (HIL).",
      "observe",
    );
  }
});

document.getElementById("applyPolicyBtn").addEventListener("click", () => {
  try {
    const parsed = JSON.parse(policyEditor.value);
    state.policy = parsed;
    pushLog(
      "System baseline config successfully updated via live hot-reload engine.",
      "system",
    );

    policyEditor.style.borderColor = varCSS("--accent-green");
    setTimeout(
      () => (policyEditor.style.borderColor = varCSS("--border-color")),
      400,
    );
  } catch (err) {
    pushLog(
      "Live Hot-Reload Parse Error: Invalid configuration structure syntax mapping.",
      "hard-stop",
    );
    policyEditor.style.borderColor = varCSS("--accent-red");
  }
});

document.getElementById("resetSimulationBtn").addEventListener("click", () => {
  state.systemLockdown = false;
  state.harvestCounts = { "Mahi-Mahi": 0, Tuna: 0, Mackerel: 0 };
  initSimulation();
  abortPipelineSequence();
});

// Runtime Execution Start Trigger
// FIX: defer init to after first rAF so flex layout has settled and
// getBoundingClientRect returns real dimensions, not 0.
if (canvas) {
  requestAnimationFrame(() => {
    resizeCanvas();
    initSimulation();
    state.hilAutonomous = hilSwitch.checked;
    requestAnimationFrame(renderLoop);
  });
}
