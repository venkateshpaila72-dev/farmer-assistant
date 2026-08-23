import { motion } from "framer-motion";

// A hand-drawn, flat-vector "farmer checking today's data" scene — same
// family of shapes as the reference (rounded desk, laptop, mug, plant),
// re-themed for Kisan Sahayak and built entirely out of SVG primitives so
// it's crisp at any size and cheap to animate.
const easeOut = [0.16, 1, 0.3, 1];

const PALETTE = {
  skyTop: "#FBEBE4",
  skyBottom: "#F6F7F2",
  hillBack: "#E7F3EA",
  hillFront: "#CFE8D6",
  sun: "#B8860B",
  sunGlow: "#F4D58D",
  skin: "#C98A55",
  skinShade: "#B87843",
  shirt: "#0F5132",
  shirtShade: "#0A3D25",
  pants: "#3B3120",
  hair: "#241C12",
  desk: "#A9754A",
  deskShade: "#8F5F39",
  laptop: "#241C12",
  screen: "#0F5132",
  screenGlow: "#E7F3EA",
  mug: "#8A2E10",
  mugInside: "#6B240C",
  plantPot: "#B8860B",
  plantLeaf: "#0F5132",
  plantLeafLight: "#3E7A52",
  ground: "#CFE8D6",
  cloud: "#FFFFFF",
};

export function LoginIllustration({ parallax = { x: 0, y: 0 } }) {
  return (
    <motion.svg
      viewBox="0 0 400 520"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMax slice"
      style={{ x: parallax.x, y: parallax.y }}
    >
      <defs>
        <linearGradient id="loginSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PALETTE.skyTop} />
          <stop offset="100%" stopColor={PALETTE.skyBottom} />
        </linearGradient>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={PALETTE.sunGlow} stopOpacity="0.9" />
          <stop offset="100%" stopColor={PALETTE.sunGlow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width="400" height="520" fill="url(#loginSky)" />

      {/* Sun, softly pulsing */}
      <motion.g
        animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.04, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "300px 110px" }}
      >
        <circle cx="300" cy="110" r="70" fill="url(#sunGlow)" />
        <circle cx="300" cy="110" r="34" fill={PALETTE.sun} />
      </motion.g>

      {/* Drifting clouds */}
      <motion.g
        animate={{ x: [0, 14, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      >
        <ellipse cx="90" cy="90" rx="34" ry="14" fill={PALETTE.cloud} opacity="0.7" />
        <ellipse cx="115" cy="82" rx="24" ry="11" fill={PALETTE.cloud} opacity="0.7" />
      </motion.g>
      <motion.g
        animate={{ x: [0, -18, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        <ellipse cx="55" cy="170" rx="26" ry="10" fill={PALETTE.cloud} opacity="0.55" />
      </motion.g>

      {/* Rolling hills */}
      <path d="M0,300 C90,260 180,320 260,290 C320,268 360,300 400,280 L400,520 L0,520 Z" fill={PALETTE.hillBack} />
      <path d="M0,360 C80,330 170,380 260,350 C330,326 370,360 400,344 L400,520 L0,520 Z" fill={PALETTE.hillFront} />

      {/* Ground under the desk */}
      <ellipse cx="200" cy="470" rx="190" ry="46" fill={PALETTE.ground} opacity="0.6" />

      {/* Small potted plant, leaves swaying */}
      <g transform="translate(295,392)">
        <rect x="-16" y="18" width="32" height="26" rx="6" fill={PALETTE.plantPot} />
        <motion.g
          animate={{ rotate: [-4, 4, -4] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "0px 18px" }}
        >
          <path d="M0,18 C-4,0 -18,-6 -26,-16 C-12,-14 -2,-2 0,10 Z" fill={PALETTE.plantLeaf} />
          <path d="M0,18 C4,-2 18,-10 28,-20 C16,-16 4,-4 0,10 Z" fill={PALETTE.plantLeafLight} />
          <path d="M0,18 C0,2 0,-10 0,-24 C-2,-8 -1,4 0,18 Z" fill={PALETTE.plantLeaf} />
        </motion.g>
      </g>

      {/* Desk */}
      <g>
        <rect x="70" y="392" width="220" height="14" rx="6" fill={PALETTE.desk} />
        <rect x="82" y="406" width="10" height="46" fill={PALETTE.deskShade} />
        <rect x="266" y="406" width="10" height="46" fill={PALETTE.deskShade} />
      </g>

      {/* Mug */}
      <g transform="translate(110,368)">
        <rect x="-14" y="0" width="28" height="24" rx="4" fill={PALETTE.mug} />
        <rect x="-14" y="0" width="28" height="6" fill={PALETTE.mugInside} />
        <path d="M14,4 q12,2 12,10 q0,8 -12,10" fill="none" stroke={PALETTE.mug} strokeWidth="4" strokeLinecap="round" />
        <motion.path
          d="M-6,-4 q2,-8 -2,-14"
          fill="none"
          stroke={PALETTE.mug}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.5"
          animate={{ opacity: [0.15, 0.5, 0.15], y: [0, -4, 0] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </g>

      {/* Laptop showing weather + price data, screen gently glowing */}
      <g transform="translate(200,362)">
        <rect x="-46" y="10" width="92" height="8" rx="3" fill={PALETTE.laptop} />
        <path d="M-52,10 L52,10 L46,-52 L-46,-52 Z" fill={PALETTE.laptop} />
        <motion.rect
          x="-40" y="-46" width="80" height="42" rx="3"
          fill={PALETTE.screen}
          animate={{ opacity: [0.92, 1, 0.92] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* mini chart bars */}
        <rect x="-30" y="-14" width="8" height="10" fill={PALETTE.screenGlow} />
        <rect x="-18" y="-20" width="8" height="16" fill={PALETTE.screenGlow} />
        <rect x="-6" y="-10" width="8" height="6" fill={PALETTE.screenGlow} />
        <rect x="6" y="-24" width="8" height="20" fill={PALETTE.screenGlow} />
        {/* sun + line = weather glyph */}
        <circle cx="24" cy="-36" r="5" fill={PALETTE.sun} />
      </g>

      {/* Farmer, idle bob + subtle arm typing motion */}
      <motion.g
        transform="translate(200,300)"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* stool/chair back hint */}
        <rect x="-30" y="70" width="60" height="10" rx="4" fill={PALETTE.deskShade} opacity="0.5" />

        {/* torso */}
        <path d="M-34,40 C-34,10 -18,-6 0,-6 C18,-6 34,10 34,40 L34,74 L-34,74 Z" fill={PALETTE.shirt} />
        <path d="M-34,40 C-34,10 -18,-6 0,-6 L0,74 L-34,74 Z" fill={PALETTE.shirtShade} opacity="0.35" />

        {/* head */}
        <circle cx="0" cy="-32" r="24" fill={PALETTE.skin} />
        {/* simple turban / headwrap, nod to farmer identity */}
        <path d="M-24,-38 C-24,-56 24,-56 24,-38 C24,-30 16,-30 0,-30 C-16,-30 -24,-30 -24,-38 Z" fill={PALETTE.hair} />
        <path d="M-22,-40 C-10,-46 10,-46 22,-40" fill="none" stroke="#F6F7F2" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />

        {/* moustache + gentle smile */}
        <path d="M-9,-24 Q0,-19 9,-24" fill="none" stroke={PALETTE.skinShade} strokeWidth="3" strokeLinecap="round" />
        <path d="M-8,-30 Q0,-27 8,-30" fill="none" stroke={PALETTE.hair} strokeWidth="2.5" strokeLinecap="round" />

        {/* arms typing, tiny alternating tap */}
        <motion.path
          d="M-30,18 C-42,26 -46,36 -40,46"
          fill="none" stroke={PALETTE.skin} strokeWidth="13" strokeLinecap="round"
          animate={{ d: ["M-30,18 C-42,26 -46,36 -40,46", "M-30,18 C-42,24 -46,32 -40,42", "M-30,18 C-42,26 -46,36 -40,46"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M30,18 C42,24 46,32 40,42"
          fill="none" stroke={PALETTE.skin} strokeWidth="13" strokeLinecap="round"
          animate={{ d: ["M30,18 C42,24 46,32 40,42", "M30,18 C42,28 46,38 40,48", "M30,18 C42,24 46,32 40,42"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />
      </motion.g>
    </motion.svg>
  );
}