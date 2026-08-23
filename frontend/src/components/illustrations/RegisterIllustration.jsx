import { motion } from "framer-motion";

// Companion piece to LoginIllustration — same flat-vector family, same
// palette, different moment: a farmer signing up + a seedling being
// planted to read as "new beginning / new account."
const PALETTE = {
  skyTop: "#FBEBE4",
  skyBottom: "#F6F7F2",
  hillBack: "#E7F3EA",
  hillFront: "#CFE8D6",
  sun: "#B8860B",
  sunGlow: "#F4D58D",
  skin: "#C98A55",
  skinShade: "#B87843",
  shirt: "#8A2E10",
  shirtShade: "#6B240C",
  pants: "#3B3120",
  hair: "#241C12",
  desk: "#A9754A",
  deskShade: "#8F5F39",
  paper: "#FFFFFF",
  paperLine: "#CFE8D6",
  pen: "#0F5132",
  soil: "#6B4A2C",
  soilDark: "#573B22",
  potPlantLeaf: "#0F5132",
  potPlantLeafLight: "#3E7A52",
  seedlingPot: "#8A2E10",
  ground: "#CFE8D6",
  cloud: "#FFFFFF",
  check: "#0F5132",
};

export function RegisterIllustration({ parallax = { x: 0, y: 0 } }) {
  return (
    <motion.svg
      viewBox="0 0 400 520"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMax slice"
      style={{ x: parallax.x, y: parallax.y }}
    >
      <defs>
        <linearGradient id="regSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PALETTE.skyTop} />
          <stop offset="100%" stopColor={PALETTE.skyBottom} />
        </linearGradient>
        <radialGradient id="regSunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={PALETTE.sunGlow} stopOpacity="0.9" />
          <stop offset="100%" stopColor={PALETTE.sunGlow} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="400" height="520" fill="url(#regSky)" />

      <motion.g
        animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.04, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "100px 100px" }}
      >
        <circle cx="100" cy="100" r="66" fill="url(#regSunGlow)" />
        <circle cx="100" cy="100" r="32" fill={PALETTE.sun} />
      </motion.g>

      <motion.g animate={{ x: [0, 16, 0] }} transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}>
        <ellipse cx="310" cy="86" rx="30" ry="12" fill={PALETTE.cloud} opacity="0.7" />
        <ellipse cx="332" cy="78" rx="20" ry="9" fill={PALETTE.cloud} opacity="0.7" />
      </motion.g>
      <motion.g animate={{ x: [0, -14, 0] }} transition={{ duration: 21, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}>
        <ellipse cx="350" cy="160" rx="22" ry="9" fill={PALETTE.cloud} opacity="0.5" />
      </motion.g>

      <path d="M0,300 C90,270 180,326 260,296 C320,274 360,304 400,286 L400,520 L0,520 Z" fill={PALETTE.hillBack} />
      <path d="M0,362 C80,334 170,384 260,354 C330,330 370,362 400,348 L400,520 L0,520 Z" fill={PALETTE.hillFront} />

      <ellipse cx="200" cy="470" rx="190" ry="46" fill={PALETTE.ground} opacity="0.6" />

      {/* Seedling being planted — small pot with soil mound, sapling swaying */}
      <g transform="translate(300,398)">
        <path d="M-24,20 L24,20 L18,44 L-18,44 Z" fill={PALETTE.seedlingPot} />
        <ellipse cx="0" cy="20" rx="24" ry="7" fill={PALETTE.soilDark} />
        <ellipse cx="0" cy="16" rx="19" ry="5.5" fill={PALETTE.soil} />
        <motion.g
          animate={{ rotate: [-5, 5, -5] }}
          transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "0px 16px" }}
        >
          <path d="M0,16 C0,2 0,-8 0,-20" stroke={PALETTE.potPlantLeaf} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M0,4 C-10,0 -16,-8 -16,-16 C-6,-14 0,-8 0,4 Z" fill={PALETTE.potPlantLeaf} />
          <path d="M0,-2 C10,-6 16,-14 16,-22 C6,-20 0,-12 0,-2 Z" fill={PALETTE.potPlantLeafLight} />
        </motion.g>
      </g>

      {/* Desk */}
      <rect x="70" y="392" width="220" height="14" rx="6" fill={PALETTE.desk} />
      <rect x="82" y="406" width="10" height="46" fill={PALETTE.deskShade} />
      <rect x="266" y="406" width="10" height="46" fill={PALETTE.deskShade} />

      {/* Registration form / paper on the desk, checkmark settling in */}
      <g transform="translate(160,352)">
        <rect x="-40" y="-40" width="80" height="52" rx="4" fill={PALETTE.paper} stroke={PALETTE.paperLine} strokeWidth="2" />
        <rect x="-30" y="-28" width="44" height="4" rx="2" fill={PALETTE.paperLine} />
        <rect x="-30" y="-18" width="60" height="4" rx="2" fill={PALETTE.paperLine} />
        <rect x="-30" y="-8" width="36" height="4" rx="2" fill={PALETTE.paperLine} />
        <motion.g
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatType: "reverse", repeatDelay: 3.4 }}
          style={{ transformOrigin: "24px 4px" }}
        >
          <circle cx="24" cy="4" r="11" fill={PALETTE.check} />
          <path d="M19,4 L23,8 L30,0" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </motion.g>
      </g>

      {/* Farmer, standing, signing the form */}
      <motion.g
        transform="translate(190,300)"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M-34,50 C-34,16 -18,-4 0,-4 C18,-4 34,16 34,50 L34,88 L-34,88 Z" fill={PALETTE.shirt} />
        <path d="M-34,50 C-34,16 -18,-4 0,-4 L0,88 L-34,88 Z" fill={PALETTE.shirtShade} opacity="0.35" />

        <circle cx="0" cy="-30" r="24" fill={PALETTE.skin} />
        <path d="M-24,-36 C-24,-54 24,-54 24,-36 C24,-28 16,-28 0,-28 C-16,-28 -24,-28 -24,-36 Z" fill={PALETTE.hair} />
        <path d="M-22,-38 C-10,-44 10,-44 22,-38" fill="none" stroke="#F6F7F2" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        <path d="M-9,-22 Q0,-17 9,-22" fill="none" stroke={PALETTE.skinShade} strokeWidth="3" strokeLinecap="round" />
        <path d="M-8,-28 Q0,-25 8,-28" fill="none" stroke={PALETTE.hair} strokeWidth="2.5" strokeLinecap="round" />

        {/* right arm reaching down to the paper, writing motion */}
        <motion.path
          d="M28,20 C40,26 46,36 34,50"
          fill="none" stroke={PALETTE.skin} strokeWidth="13" strokeLinecap="round"
          animate={{ d: ["M28,20 C40,26 46,36 34,50", "M28,20 C42,22 48,32 36,46", "M28,20 C40,26 46,36 34,50"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* left arm resting */}
        <path d="M-28,22 C-38,30 -40,42 -32,52" fill="none" stroke={PALETTE.skin} strokeWidth="13" strokeLinecap="round" />
      </motion.g>
    </motion.svg>
  );
}