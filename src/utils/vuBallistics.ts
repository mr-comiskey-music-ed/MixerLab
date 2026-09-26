import { useRef, useEffect, useState } from 'react';

export type VuBallisticsMode = 'vu' | 'ppm' | 'vintage';

export interface BallisticsConfig {
  omegaN: number;      // Undamped natural angular frequency (rad/s)
  zeta: number;        // Damping ratio (dimensionless)
  decayRate?: number;  // Fall decay rate for asymmetrical modes like PPM
  name: string;
  description: string;
}

export const BALLISTICS_PRESETS: Record<VuBallisticsMode, BallisticsConfig> = {
  // ANSI C16.5-1954 / IEC 60268-17: 300ms rise to 99%, 1.0-1.5% overshoot, 300ms fall
  vu: {
    omegaN: 18.0,
    zeta: 0.815,
    name: 'ANSI VU (300ms)',
    description: 'Standard 300ms rise and fall times with natural mass inertia and 1.2% overshoot'
  },
  // IEC 60268-10 Peak Programme Meter: rapid attack (10ms), slower release
  ppm: {
    omegaN: 52.0,
    zeta: 0.92,
    decayRate: 0.65,
    name: 'Fast PPM (10ms)',
    description: 'High-speed transient peak response with controlled linear decay'
  },
  // Heavy galvanometer needle from vintage 1950s/60s tube consoles
  vintage: {
    omegaN: 13.8,
    zeta: 0.74,
    name: 'Vintage Heavy (400ms)',
    description: 'Higher mechanical inertia with 2.8% needle bounce and deliberate travel'
  }
};

// Standard VU meter scale calibration points (dB VU -> normalized deflection [0, 1])
// 0 VU is standard operating level (+4 dBu / -14 dBFS headroom) at ~83.5% deflection
export const VU_SCALE_POINTS: [number, number][] = [
  [-20, 0.00],
  [-10, 0.22],
  [-7, 0.36],
  [-5, 0.49],
  [-3, 0.63],
  [-2, 0.70],
  [-1, 0.77],
  [0, 0.835], // 0 VU reference mark
  [1, 0.895],
  [2, 0.950],
  [3, 1.000]  // +3 VU top of printed scale
];

/**
 * Convert raw audio level [0, 1] to decibels relative to 0 VU reference.
 * Assumes 0 VU aligns with ~0.65 linear full-scale amplitude (giving ~3.7 dB headroom to full digital clip 1.0).
 */
export function levelToVuDb(level: number): number {
  if (level <= 0.001) return -40;
  return 20 * Math.log10(level / 0.65);
}

/**
 * Map dB VU to normalized scale deflection [0, 1.08] where 0 is -20 VU, 0.835 is 0 VU, and 1.0 is +3 VU.
 */
export function vuDbToDeflection(db: number): number {
  if (db <= -20) return 0;
  if (db >= 3) {
    // Beyond +3 VU up to the physical mechanical right stop pin
    return Math.min(1.08, 1.0 + (db - 3) * 0.026);
  }
  for (let i = 0; i < VU_SCALE_POINTS.length - 1; i++) {
    const [db0, def0] = VU_SCALE_POINTS[i];
    const [db1, def1] = VU_SCALE_POINTS[i + 1];
    if (db >= db0 && db <= db1) {
      const frac = (db - db0) / (db1 - db0);
      return def0 + frac * (def1 - def0);
    }
  }
  return 0;
}

/**
 * Direct mapping from linear level to scale deflection
 */
export function levelToDeflection(level: number): number {
  if (level <= 0.005) return 0;
  const db = levelToVuDb(level);
  return vuDbToDeflection(db);
}

/**
 * Convert scale deflection [0, 1] to needle rotation angle in degrees.
 * Needle arc sweeps from -38° (-20 VU) to +38° (+3 VU), total 76° arc.
 */
export function deflectionToAngle(deflection: number): number {
  // -38° at deflection 0 (-20 VU)
  // +25.5° at deflection 0.835 (0 VU)
  // +38° at deflection 1.000 (+3 VU)
  return -38 + deflection * 76;
}

export interface UseVuBallisticsResult {
  pos: number;          // Normalized needle position [0, 1.08]
  angle: number;        // Rotation angle in degrees [-38°, +44°]
  velocity: number;     // Current angular velocity
  peakHold: number;     // Normalized peak hold level [0, 1]
  targetDeflection: number; // Raw target deflection before ballistics
}

/**
 * React hook implementing 2nd-order differential equation physics for analog VU meters.
 * Simulates D'Arsonval moving-coil galvanometer mechanics:
 * J*(d^2θ/dt^2) + D*(dθ/dt) + K*θ = Magnetic Torque
 */
export function useVuBallistics(
  rawLevel: number,
  mode: VuBallisticsMode = 'vu'
): UseVuBallisticsResult {
  const [state, setState] = useState<UseVuBallisticsResult>({
    pos: 0,
    angle: -38,
    velocity: 0,
    peakHold: 0,
    targetDeflection: 0
  });

  const rawLevelRef = useRef(rawLevel);
  rawLevelRef.current = rawLevel;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const simRef = useRef({
    pos: 0,
    vel: 0,
    peakHold: 0,
    peakHoldTime: 0,
    lastTime: performance.now()
  });

  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      const sim = simRef.current;
      const dt = Math.min((now - sim.lastTime) / 1000, 0.05); // Cap to 50ms for numerical stability
      sim.lastTime = now;

      const currentMode = modeRef.current;
      const config = BALLISTICS_PRESETS[currentMode] || BALLISTICS_PRESETS.vu;

      // Target deflection from incoming raw level
      const target = levelToDeflection(rawLevelRef.current);

      if (currentMode === 'ppm' && target < sim.pos && config.decayRate) {
        // PPM asymmetric decay: fast rise with differential equation, controlled linear fall
        sim.vel = 0;
        sim.pos = Math.max(target, sim.pos - config.decayRate * dt);
      } else {
        // 2nd-order spring-mass-damper physics
        const omegaN = config.omegaN;
        const zeta = config.zeta;
        const displacement = target - sim.pos;

        // Acceleration = omegaN^2 * (target - pos) - 2 * zeta * omegaN * vel
        const accel = omegaN * omegaN * displacement - 2 * zeta * omegaN * sim.vel;

        // Semi-implicit Euler integration
        sim.vel += accel * dt;
        sim.pos += sim.vel * dt;
      }

      // Mechanical stop pins
      if (sim.pos < 0) {
        sim.pos = 0;
        if (sim.vel < 0) sim.vel = -sim.vel * 0.12; // Slight bounce off resting bumper pin
      } else if (sim.pos > 1.08) {
        sim.pos = 1.08;
        if (sim.vel > 0) sim.vel = -sim.vel * 0.15; // Bounce off high-end bumper pin
      }

      // Peak hold indicator physics (holds for 1.2s then drops)
      if (sim.pos > sim.peakHold) {
        sim.peakHold = sim.pos;
        sim.peakHoldTime = now + 1200;
      } else if (now > sim.peakHoldTime) {
        sim.peakHold = Math.max(sim.pos, sim.peakHold - 0.7 * dt);
      }

      const angle = deflectionToAngle(sim.pos);

      setState({
        pos: sim.pos,
        angle,
        velocity: sim.vel,
        peakHold: sim.peakHold,
        targetDeflection: target
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  return state;
}
