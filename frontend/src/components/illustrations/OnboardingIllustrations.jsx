import { motion, AnimatePresence } from "framer-motion";

// One small flat-vector scene per onboarding step, all sharing the same
// palette/weight as the login & register illustrations so the whole flow
// feels like one hand. Each is self-contained (transparent background) and
// bottom-anchored, meant to sit on AuthLayout's own peach/green split
// backdrop — same composition idea as /farmer-register-art.png.

const P = {
  primary: "#8A2E10",
  primaryDark: "#6B240C",
  accent: "#0F5132",
  accentDark: "#0A3D25",
  accentLight: "#3E7A52",
  gold: "#B8860B",
  ink: "#241C12",
  skin: "#C98A55",
  skinShade: "#B87843",
  soilDark: "#573B22",
  soilMid: "#6B4A2C",
  soilLight: "#8F5F39",
  wood: "#A9754A",
  woodDark: "#8F5F39",
  cream: "#FFFDF8",
  water: "#3E7A52",
};

const easeOut = [0.16, 1, 0.3, 1];
const sceneMotion = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.98 },
  transition: { duration: 0.4, ease: easeOut },
};

function LanguageScene() {
  return (
    <motion.svg {...sceneMotion} viewBox="0 0 300 320" className="absolute bottom-0 inset-x-0 w-full h-full">
      <g transform="translate(150,250)">
        <ellipse cx="0" cy="46" rx="90" ry="14" fill={P.soilDark} opacity="0.12" />
        {/* Devanagari bubble */}
        <motion.g
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <rect x="-96" y="-70" width="92" height="70" rx="16" fill={P.accent} />
          <path d="M-40,0 L-52,18 L-30,0 Z" fill={P.accent} />
          <text x="-50" y="-27" textAnchor="middle" fontSize="30" fill="#fff" fontFamily="sans-serif">अ</text>
        </motion.g>
        {/* Latin bubble */}
        <motion.g
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        >
          <rect x="6" y="-96" width="92" height="70" rx="16" fill={P.primary} />
          <path d="M46,-26 L58,-8 L36,-26 Z" fill={P.primary} />
          <text x="52" y="-53" textAnchor="middle" fontSize="30" fill="#fff" fontFamily="serif">A</text>
        </motion.g>
        {/* small globe floating between them */}
        <motion.g
          transform="translate(-6,-118)"
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "0px 0px" }}
        >
          <circle r="16" fill={P.gold} />
          <ellipse cx="0" cy="0" rx="16" ry="6" fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.7" />
          <ellipse cx="0" cy="0" rx="6" ry="16" fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.7" />
        </motion.g>
      </g>
    </motion.svg>
  );
}

function SoilScene() {
  return (
    <motion.svg {...sceneMotion} viewBox="0 0 300 320" className="absolute bottom-0 inset-x-0 w-full h-full">
      <g transform="translate(150,260)">
        <path d="M-100,0 C-60,-10 60,-10 100,0 L100,60 L-100,60 Z" fill={P.soilMid} />
        <path d="M-100,18 C-60,10 60,10 100,18 L100,60 L-100,60 Z" fill={P.soilDark} />
        <path d="M-100,0 C-60,-10 60,-10 100,0 C60,4 -60,4 -100,0 Z" fill={P.woodDark} opacity="0.5" />
        {/* sprout growing out of the soil */}
        <motion.g
          animate={{ rotate: [-4, 4, -4] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "0px 0px" }}
        >
          <path d="M0,0 C0,-20 0,-38 0,-56" stroke={P.accent} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M0,-16 C-16,-12 -26,-24 -26,-36 C-12,-32 -2,-24 0,-16 Z" fill={P.accent} />
          <path d="M0,-30 C14,-26 22,-38 22,-48 C10,-44 2,-38 0,-30 Z" fill={P.accentLight} />
        </motion.g>
        {/* roots visible below ground */}
        <path d="M0,4 C-10,14 -14,26 -10,36" fill="none" stroke={P.soilLight} strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
        <path d="M0,4 C8,16 10,28 6,38" fill="none" stroke={P.soilLight} strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
      </g>
    </motion.svg>
  );
}

function FarmSizeScene() {
  const ticks = [-72, -54, -36, -18, 0, 18, 36, 54, 72];
  return (
    <motion.svg {...sceneMotion} viewBox="0 0 300 320" className="absolute bottom-0 inset-x-0 w-full h-full">
      <g transform="translate(150,268)">
        <ellipse cx="0" cy="26" rx="112" ry="30" fill={P.accentLight} opacity="0.2" />
        {/* top-down field plot, corners pinned by the two flags below */}
        <path d="M-88,20 L88,20 L64,-38 L-64,-38 Z" fill={P.accentLight} opacity="0.4" />
        <path d="M-88,20 L88,20 L64,-38 L-64,-38 Z" fill="none" stroke={P.accent} strokeWidth="2" strokeDasharray="6 6" opacity="0.5" />
        {/* corner flags marking the plot being measured */}
        {[-88, 88].map((x, i) => (
          <g key={i} transform={`translate(${x},20)`}>
            <line x1="0" y1="0" x2="0" y2="-34" stroke={P.ink} strokeWidth="2.5" />
            <path d={`M0,-34 L${i === 0 ? 18 : -18},-27 L0,-20 Z`} fill={P.primary} />
            <circle cy="2" r="4" fill={P.ink} />
          </g>
        ))}
        {/* measuring tape stretched straight between the two flags */}
        <motion.g
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: easeOut, delay: 0.2 }}
          style={{ transformOrigin: "0px 44px" }}
        >
          <rect x="-88" y="40" width="176" height="9" rx="4.5" fill={P.gold} />
          {ticks.map((x, i) => (
            <rect key={i} x={x - 1} y={41.5} width="2" height={i % 2 === 0 ? 6 : 3.5} fill={P.cream} opacity="0.85" />
          ))}
        </motion.g>
        {/* small acres badge */}
        <motion.g
          transform="translate(0,72)"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7, ease: easeOut }}
        >
          <rect x="-30" y="-13" width="60" height="26" rx="13" fill={P.primary} />
          <text x="0" y="5" textAnchor="middle" fontSize="14" fill="#fff" fontFamily="sans-serif" fontWeight="600">acres</text>
        </motion.g>
      </g>
    </motion.svg>
  );
}

function CropsScene() {
  return (
    <motion.svg {...sceneMotion} viewBox="0 0 300 320" className="absolute bottom-0 inset-x-0 w-full h-full">
      <defs>
        <clipPath id="basketBodyClip">
          <path d="M-70,-6 C-70,2 -40,8 0,8 C40,8 70,2 70,-6 L54,50 C34,58 -34,58 -54,50 Z" />
        </clipPath>
        <linearGradient id="basketShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={P.wood} />
          <stop offset="100%" stopColor={P.soilMid} />
        </linearGradient>
      </defs>
      <g transform="translate(150,266)">
        <ellipse cx="0" cy="62" rx="76" ry="11" fill={P.soilDark} opacity="0.14" />

        {/* basket body — wider and shallower, with a real elliptical mouth */}
        <path d="M-70,-6 C-70,2 -40,8 0,8 C40,8 70,2 70,-6 L54,50 C34,58 -34,58 -54,50 Z" fill="url(#basketShade)" />
        <g clipPath="url(#basketBodyClip)">
          {[-56, -34, -12, 12, 34, 56].map((x, i) => (
            <line key={`v${i}`} x1={x} y1="-10" x2={x * 0.66} y2="62" stroke={P.soilDark} strokeWidth="2.2" opacity="0.35" />
          ))}
          {[10, 26, 42].map((y, i) => (
            <path key={`h${i}`} d={`M-70,${y - 6} C-40,${y + 2} 40,${y + 2} 70,${y - 6}`} stroke={P.soilDark} strokeWidth="2" fill="none" opacity="0.3" />
          ))}
        </g>

        {/* back inside wall of the basket mouth, sits behind the produce */}
        <ellipse cx="0" cy="-6" rx="70" ry="9" fill={P.soilDark} opacity="0.55" />

        {/* wheat sheaf, tied with a ribbon */}
        <motion.g animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "-34px -10px" }}>
          {[-11, 0, 11].map((dx, i) => (
            <g key={i}>
              <path d={`M${-34 + dx},-10 C${-34 + dx},-34 ${-34 + dx * 1.3},-56 ${-34 + dx * 1.5},-76`} stroke={P.gold} strokeWidth="3.2" fill="none" strokeLinecap="round" />
              {[0.28, 0.48, 0.68, 0.86].map((t, j) => {
                const y = -10 - t * 62;
                const x = -34 + dx + dx * 0.4 * t;
                return (
                  <g key={j}>
                    <line x1={x} y1={y} x2={x - 4.5} y2={y - 5.5} stroke={P.gold} strokeWidth="1.8" strokeLinecap="round" />
                    <line x1={x} y1={y} x2={x + 4.5} y2={y - 5.5} stroke={P.gold} strokeWidth="1.8" strokeLinecap="round" />
                  </g>
                );
              })}
            </g>
          ))}
          <rect x="-46" y="-18" width="24" height="8" rx="3.5" fill={P.primary} transform="rotate(-8 -34 -14)" />
        </motion.g>

        {/* chili pair, crossed for a fuller look */}
        <motion.g animate={{ rotate: [3, -3, 3] }} transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "6px -10px" }}>
          <path d="M10,-10 C0,-28 -6,-46 4,-60 C12,-54 16,-42 12,-30 C9,-22 10,-16 10,-10 Z" fill={P.primaryDark} opacity="0.9" transform="rotate(-14 6 -10)" />
          <path d="M6,-10 C0,-28 4,-52 20,-68 C27,-62 28,-50 23,-38 C18,-25 12,-16 6,-10 Z" fill={P.primary} />
          <path d="M11,-45 C7,-33 6,-20 6,-10" stroke={P.primaryDark} strokeWidth="1.6" fill="none" opacity="0.5" />
          <path d="M18,-66 C17,-73 22,-77 29,-76" stroke={P.accent} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        </motion.g>

        {/* mango, with soft rounded highlight for depth */}
        <motion.g animate={{ y: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
          <ellipse cx="42" cy="-26" rx="19" ry="23" fill={P.gold} transform="rotate(20 42 -26)" />
          <ellipse cx="42" cy="-26" rx="19" ry="23" fill={P.primary} opacity="0.12" transform="rotate(20 42 -26)" />
          <ellipse cx="36" cy="-33" rx="7.5" ry="13" fill="#fff" opacity="0.22" transform="rotate(20 42 -26)" />
          <path d="M40,-48 C44,-55 51,-55 53,-50" stroke={P.accent} strokeWidth="3.4" fill="none" strokeLinecap="round" />
        </motion.g>

        {/* front lip of the basket, drawn last so it occludes the produce bases */}
        <path d="M-70,-6 C-70,2 -40,8 0,8 C40,8 70,2 70,-6 C70,-11 40,-15 0,-15 C-40,-15 -70,-11 -70,-6 Z" fill={P.wood} />
        <ellipse cx="0" cy="-9" rx="70" ry="6" fill="none" stroke={P.woodDark} strokeWidth="1.6" opacity="0.4" />
      </g>
    </motion.svg>
  );
}

function IrrigationScene() {
  return (
    <motion.svg {...sceneMotion} viewBox="0 0 300 320" className="absolute bottom-0 inset-x-0 w-full h-full">
      <g transform="translate(150,270)">
        <ellipse cx="0" cy="30" rx="90" ry="14" fill={P.water} opacity="0.15" />
        {/* two sprouts being watered */}
        {[-30, 26].map((x, i) => (
          <g key={i} transform={`translate(${x},14)`}>
            <path d="M0,0 C0,-14 0,-24 0,-34" stroke={P.accent} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M0,-10 C-10,-8 -16,-16 -16,-24 C-6,-22 0,-16 0,-10 Z" fill={P.accent} />
            <path d="M0,-18 C9,-16 14,-24 14,-30 C6,-28 1,-24 0,-18 Z" fill={P.accentLight} />
          </g>
        ))}
        {/* watering can, positioned above and right of the sprouts, spout tipped toward them */}
        <g>
          <rect x="60" y="-160" width="52" height="34" rx="10" fill={P.gold} />
          <path d="M60,-146 C46,-146 36,-136 36,-124 C36,-112 46,-102 60,-102" fill="none" stroke={P.gold} strokeWidth="10" strokeLinecap="round" />
          <path d="M108,-150 L46,-96 L54,-86 L116,-138 Z" fill={P.gold} />
          <rect x="76" y="-176" width="10" height="14" rx="3" fill={P.gold} />
        </g>
        {/* falling droplets from the spout tip */}
        {[0, 1, 2].map((i) => (
          <motion.path
            key={i}
            d="M0,0 C-3,4 -3,9 0,11 C3,9 3,4 0,0 Z"
            fill={P.water}
            initial={{ opacity: 0, y: -90, x: 46 }}
            animate={{ opacity: [0, 1, 1, 0], y: [-90, -28] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.35, ease: "easeIn" }}
          />
        ))}
      </g>
    </motion.svg>
  );
}

function ProblemScene() {
  return (
    <motion.svg {...sceneMotion} viewBox="0 0 300 320" className="absolute bottom-0 inset-x-0 w-full h-full">
      <g transform="translate(150,260)">
        <ellipse cx="0" cy="50" rx="90" ry="14" fill={P.soilDark} opacity="0.1" />
        {/* wilted leaf, drooping on its stem */}
        <motion.g
          animate={{ rotate: [-3, 2, -3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "0px 50px" }}
        >
          <path d="M0,50 C-4,20 -4,-10 6,-38" stroke={P.soilMid} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M4,-10 C-30,-24 -54,-6 -60,26 C-30,20 4,10 4,-10 Z" fill={P.accentLight} opacity="0.9" />
          <path d="M4,-10 C-14,-8 -32,4 -42,20" stroke={P.soilMid} strokeWidth="1.6" fill="none" opacity="0.5" />
          {/* wilt spots */}
          <circle cx="-22" cy="2" r="4.4" fill={P.soilMid} opacity="0.75" />
          <circle cx="-38" cy="14" r="3.2" fill={P.soilMid} opacity="0.7" />
          <circle cx="-12" cy="-8" r="2.8" fill={P.soilMid} opacity="0.65" />
        </motion.g>
        {/* small bug sitting on the leaf */}
        <motion.g
          transform="translate(-30,10)"
          animate={{ x: [0, 8, 0], y: [0, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <ellipse cx="0" cy="0" rx="9" ry="7" fill={P.primary} />
          <path d="M-9,0 L9,0" stroke={P.primaryDark} strokeWidth="1.4" />
          <circle cx="6" cy="-1" r="1.6" fill="#fff" />
        </motion.g>
        {/* magnifying glass examining it */}
        <motion.g
          transform="translate(46,-24)"
          animate={{ rotate: [0, 6, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "46px -24px" }}
        >
          <circle r="26" fill={P.cream} opacity="0.3" />
          <circle r="26" fill="none" stroke={P.ink} strokeWidth="4.5" />
          <line x1="18" y1="18" x2="38" y2="38" stroke={P.ink} strokeWidth="6" strokeLinecap="round" />
        </motion.g>
      </g>
    </motion.svg>
  );
}

function LocationScene() {
  return (
    <motion.svg {...sceneMotion} viewBox="0 0 300 320" className="absolute bottom-0 inset-x-0 w-full h-full">
      <g transform="translate(150,270)">
        <ellipse cx="0" cy="30" rx="100" ry="22" fill={P.accentLight} opacity="0.25" />
        {/* tiny hut */}
        <g transform="translate(-40,4)">
          <rect x="-20" y="-10" width="40" height="24" fill={P.wood} />
          <path d="M-26,-10 L0,-32 L26,-10 Z" fill={P.primary} />
          <rect x="-6" y="0" width="12" height="14" fill={P.soilDark} />
        </g>
        {/* tiny tree */}
        <g transform="translate(30,0)">
          <rect x="-3" y="-4" width="6" height="18" fill={P.woodDark} />
          <circle cx="0" cy="-18" r="16" fill={P.accent} />
        </g>
        {/* map pin dropping in */}
        <motion.g
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: [-60, 0, -6, 0], opacity: 1 }}
          transition={{ duration: 1.1, ease: easeOut, times: [0, 0.6, 0.8, 1] }}
        >
          <path d="M0,-90 C20,-90 34,-76 34,-58 C34,-34 0,0 0,0 C0,0 -34,-34 -34,-58 C-34,-76 -20,-90 0,-90 Z" fill={P.primary} />
          <circle cx="0" cy="-58" r="13" fill="#fff" />
        </motion.g>
      </g>
    </motion.svg>
  );
}

function WhatsAppScene() {
  return (
    <motion.svg {...sceneMotion} viewBox="0 0 300 320" className="absolute bottom-0 inset-x-0 w-full h-full">
      <g transform="translate(150,260)">
        <ellipse cx="0" cy="48" rx="70" ry="12" fill={P.soilDark} opacity="0.1" />
        {/* phone */}
        <rect x="-42" y="-96" width="84" height="150" rx="16" fill={P.ink} />
        <motion.rect
          x="-34" y="-86" width="68" height="126" rx="6" fill={P.accent}
          animate={{ opacity: [0.92, 1, 0.92] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* chat bubble on the screen */}
        <motion.g
          initial={{ opacity: 0, scale: 0.7, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: easeOut }}
        >
          <rect x="-24" y="-64" width="48" height="30" rx="10" fill="#fff" />
          <path d="M-10,-34 L-16,-24 L0,-34 Z" fill="#fff" />
          <circle cx="-10" cy="-49" r="3" fill={P.accent} opacity="0.5" />
          <circle cx="0" cy="-49" r="3" fill={P.accent} opacity="0.5" />
          <circle cx="10" cy="-49" r="3" fill={P.accent} opacity="0.5" />
        </motion.g>
        {/* connected checkmark badge */}
        <motion.g
          transform="translate(20,-4)"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.15, 1] }}
          transition={{ duration: 0.5, delay: 0.7, ease: easeOut }}
        >
          <circle r="14" fill={P.gold} />
          <path d="M-5,0 L-1,4 L6,-5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </motion.g>
        {/* small leaf accent */}
        <motion.g
          transform="translate(-56,-70)"
          animate={{ rotate: [-8, 8, -8] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M0,0 C-14,-6 -16,-22 -6,-32 C4,-22 8,-8 0,0 Z" fill={P.accentLight} />
        </motion.g>
      </g>
    </motion.svg>
  );
}

const STEP_SCENES = {
  chat_language: LanguageScene,
  soil_type: SoilScene,
  farm_acres: FarmSizeScene,
  preferred_crops: CropsScene,
  irrigation_type: IrrigationScene,
  main_problem: ProblemScene,
  home_location: LocationScene,
  connect_whatsapp: WhatsAppScene,
};

/**
 * Crossfades between the per-step scenes above as `stepKey` changes.
 * Drop straight into AuthLayout's `illustrationNode` prop.
 */
export function OnboardingIllustration({ stepKey }) {
  const Scene = STEP_SCENES[stepKey];
  return (
    <div className="relative w-full h-full">
      <AnimatePresence mode="wait">
        {Scene && <Scene key={stepKey} />}
      </AnimatePresence>
    </div>
  );
}