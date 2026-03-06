// Tatting Pattern Designer - Version 1.05 TEST
// CHANGES IN v1.05:
// - Split ring notation labels: A and B sections shown on correct curves
// - Orphaned notation label ghost fix (stable React keys + <g> wrapper)
// - Realistic rendering performance: bezier pre-sampling (3-5x faster)
// - Pan tool no longer changes selection
// - Path edit tool smart click: chain→stay, ring/other→exit to select, dbl-click empty→exit
// - Hit testing improved: split rings and lines use path proximity not center distance
// - Spinner arrows removed from all number inputs
// - Rotation input minimum width (3 chars always visible)
// - Default notation: rings/chains 6ds-p-6ds, split rings 3ds-p-3ds
// - Chain default length calculated from stitch count × dsWidth
// - Default zoom 180%
// - Show Unnumbered: pink glow on elements, not the button
// - Dropdown menus (File/Arrange/Options) open left when near screen edge
// - BG cycle: dark / half-dark / white
// - Notation labels always black outline (not affected by bg color)
// - Split ring sizing fixed: shorter arc defines height, bulge derived from fixed arc length
// - Split ring squeeze: height varies, bulge conserves chain length geometrically
// - Split ring reset: only resets rotation + squeeze, stays as split ring
// - Realistic rendering: stitches render inside path line (offsetAmount fix)
// - Realistic rendering: 30fps cap on mouse-move redraws
// - Picot offset calibrated to 10px
// - Ortho lock: hold Shift or toggle button to constrain movement to X/Y axis
// - Left toolbar: ortho lock next to rotate, path edit moved to row 3
// 
// THIS IS A TEST VERSION FOR SHARING/EXPERIMENTATION
// The main production version is tatting-designer-v1_04-dev.tsx
//
// VERSION 1.04 CHANGES:
// - WEDGE STITCH RENDERING: Rings use proper trapezoid shapes computed in world
//   coordinates from exact polar geometry — no more gaps on tight rings.
//   Chains/teardrops use skew-corrected matrix transform for curved paths.
// - generatePattern rewritten: jp tokens annotated with connected element refs
// - Line property bar: Order # only, no notation field
// - Lines get optional orderNumber field
// - Fixed zoom buttons to zoom towards center of screen (same fix as pinch zoom)
// - Zoom in/out buttons now use proper camera transform
// - Parser accepts both "-" and "." as separators
// - Help menu fully updated with all features
//
// ZOOM BUTTON FIX:
// - Notation parser now accepts both "-" and "." as separators
// - Examples: "r: 5ds-p-5ds" or "r: 5ds.p.5ds" both work
// - Applies to: parseNotation, reverseNotation, countActualStitches, 
//   countStitchesInRange, and getStitchTypes functions
//
// HELP MENU UPDATE:
// - Added Ctrl+N (New), D (Duplicate in place), F (Fit All) to shortcuts
// - Added Line Tool documentation
// - Added Flipping feature (Flip H/V buttons)
// - Updated Rotation section with fine rotation for groups
// - Added Arrange Menu documentation (duplicate, alignment)
// - Added Options Menu documentation (BG, Grid, Snap)
// - Updated Groups section with rotation input info
// - Removed non-existent Scissors Tool (LLM error)
// - Updated Tips with radial pattern workflow and new features
//
// PERFORMANCE OPTIMIZATIONS:
// - Auto-save interval no longer recreates on every state change (uses refs)
// - RAF batching already implemented for mouse move
// - useMemo used for expensive calculations
// - Event listeners properly cleaned up
//
// RELEASE v1.02:
// - Reference image controls moved to top property bar (cleaner UI)
// - Image tool in left toolbar now acts as tool mode (like Pan, Select, Path)
// - Controls appear in property bar when Image tool is selected
// - Path editor now smoothly interpolates control point angles (no more jarring snaps)
// - Drag endpoints gradually transition instead of instant recalculation
//
// Previous (v1.01):
// - All toolbar buttons now EXACTLY 44px height with flex centering
// - Icon-only buttons are perfect 44px × 44px squares
// - File and Schematic buttons match height but can be wider (have text)
// - Used exact width/height instead of minWidth/minHeight for precision
// - Updated version display to "Version 1.01" in startup disclaimer
//
// Previous (v93.7.4):
// - ALL Row 1 buttons now px-3 py-2 (Eye, Undo, Redo, Copy, Paste were still p-2)
// - Added explicit sizing (minWidth: 44px, minHeight: 44px) to text/emoji buttons
// - Added flex centering (flex items-center justify-center) for uniform appearance
// - BG, Grid, Snap, and Help buttons now match icon button sizes perfectly
//
// Previous (v93.7.3):
// - Reverted Help button to "?" text (FileQuestionMark icon not supported in artifact)
// - Kept uniform button heights (all buttons px-3 py-2 in Row 1)
//
// Previous (v93.7.2):
// - Standardized all Row 1 button heights (Grid, Snap, Help buttons now px-3 py-2)
// - Replaced "?" text with FileQuestionMark icon for consistency
// - All toolbar buttons now uniform height and professional appearance
//
// Previous (v93.7.1):
// - Shorter labels: "Opac: 50%" instead of two lines
// - Eye and Remove buttons now in same row (side by side)
// - Confirmation dialog before removing reference image (prevents accidents)
// - Image validation: checks file type (must be image/*) and size (max 10MB)
// - Error handling for corrupted or invalid image files
//
// Previous (v93.7):
// - Reference controls now INLINE in left toolbar (like picot join tool)
// - Click Image button to show/hide controls
// - Upload button appears when controls expanded
// - Sliders and buttons show in toolbar grid
// - No more floating panels - everything in one place!
//
// Previous (v93.3.3):
// - External JSON loading implemented for DMC colors (dmc_colors.json)
// - Colors now loaded from external file with fallback to embedded colors
// - Comprehensive validation for JSON structure and data types
//
// FIXES (v93.3.2):
// - Properties panel now maintains consistent 6rem height on all screen sizes (no more jumping)
// - Reference image toolbar positioned below main toolbar (top-44 instead of top-20)
// - Both rows of main toolbar now clear before reference image controls appear
// MINOR UPDATE (v93.3.1):
// - Added "Version 0.1" text to disclaimer popup
// NEW (v93.3):
// - Gradient picker now uses scrolling instead of pagination
// - Removed pagination controls (prev/next buttons)
// - Grid scrolls vertically with max-height: 400px
// - Shows total gradient count instead of page numbers
// - Cleaner, more intuitive interface like color swatches
// FIXES (v93.2):
// - PNG export completely removed (browser security restrictions prevent it from working)
// - SVG export now excludes guide picots (green picots with isGuide flag)
// - Notation numbers always white color (not element color)
// - Order numbers hidden from rings by default (cleaner view)
// - Order numbers shown for ALL elements (rings AND chains) when "Show Unnumbered" is toggled on
// CORRECT IMPLEMENTATION (v93.1):
// - Flip using mirror rotation formulas
// - FlipHorizontal (vertical mirror/left-right): newAngle = 180° - θ
// - FlipVertical (horizontal mirror/top-bottom): newAngle = -θ
// - Reverses notation (2ds-p-5ds → 5ds-p-2ds)
// - Applies rotation to paths (doesn't mirror coordinates directly)
// - Updates rotation angle display to show new angle
// - This preserves picot orientation correctly!
// FIXED (v92.7.1):
// - Order field now scales down on mobile (added top-toolbar-scalable class)
// - Shape and Squeeze fields also scale down on mobile
// - "Order:", "Shape:", and "Squeeze:" labels hidden on mobile
// - Properties panel should now fit in 2 lines on mobile
// NEW (v92.7):
// - ADDED: File operations dropdown menu (replaces individual buttons)
// - Menu includes: Save, Load, Export SVG, Generate Pattern
// - REMOVED: Project name input field (redundant - name set in save dialog)
// - Saves significant toolbar space, especially on mobile
// - Click overlay closes menu when clicking outside
// FIXED (v92.6):
// - Properties toolbar now fits in 2 lines max on mobile (max-height: 6rem)
// - Empty state placeholder matches 2-line height on mobile
// - Properties panel inputs and buttons scaled smaller on mobile (0.75rem font, smaller padding)
// - Text labels smaller on mobile (0.65rem) to fit more content
// FIXED (v92.5.1):
// - Picots now stay on the same side of the curve when flipping
// - Flipping toggles labelsInside property (inside becomes outside and vice versa)
// - When you flip a curve, its "handedness" changes, so we toggle the label side
// - Works for both rings and chains, circles and teardrops
// NEW (v92.4):
// - ADDED: Horizontal and vertical flip/mirror transformations
// - ADDED: Flip buttons in toolbar (after rotation buttons)
// - Flip preserves element properties (notation, picots, colors, etc.)
// - Reverses path order for closed paths to maintain correct direction
// NEW (v92.3):
// - ADDED: Save dialog modal (replaces browser prompt that wasn't working)
// - ADDED: Startup disclaimer modal with test version warning
// - FIXED: Color picker modal height reduced 20% more on mobile (60vh/55vh/50vh)
// BUGFIXES (v92.2):
// - FIXED: Notation labels now display correctly for repeat patterns (e.g., "2x(p-3ds)" shows "3-p-3" not "0-p-0")
// - FIXED: Copy-paste with Ctrl+V now clears order numbers (was only fixed for button paste)
// - FIXED: Save dialog now prompts for filename before saving (can change name)
// BUGFIXES (v92.1):
// - Copy-paste now clears order numbers to avoid duplicates
// - Squeezing ring now preserves rotation (was resetting to 0°)
// - Changing notation now preserves rotation (already worked, confirmed)
// - Squeezing creates only 2 undo states (start/end) instead of many
// - Color picker modals now scale down on mobile (85%/75%/65%)
// - Gradient picker modal now scales down on mobile (85%/75%/65%)
// NEW in v92: Reduced gradients to 6 test samples (rest will be loaded externally)
// NEW in v92: Updated icon set for better visual clarity
// NEW in v92: Pinch-to-zoom support for mobile devices (two-finger gesture)
// FIXED in v92: Top toolbar scaling now matches side toolbars (0.68, 0.6, 0.5 at different breakpoints)
// FIXED: Stitch count labels now show actual stitch count from notation (not DS-equivalent path length)
// EXAMPLE: "5ds, 4ss, 2rds" shows "11" (not "9 DS") - counts 5+4+2=11 stitches
// FIXED: SS stitches now properly anchored - offset along tangent direction (follow the curve)
// NEW: Copy/Paste buttons in top toolbar (next to Undo/Redo)
// ROLLBACK: Mobile responsive changes removed (toolbar hiding, text hiding) - back to full display
// NEW: Quick Start Guide - comprehensive onboarding in Help modal (default tab)
// NEW: Order numbers are unique - conflicts auto-reassign to next available number
// NEW: "Show Unnumbered" toggle button - highlights elements without order numbers (yellow tint)
// IMPROVED: Reference image toolbar moved higher (top-left), collapsible, redesigned with icons
// IMPROVED: Gradient toolbar collapse now works on mobile (added touch handler)
// IMPROVED: Top properties bar now wraps on small screens (flex-wrap)
// NEW: Squeeze tool for rings - adjust width/height ratio while keeping path length constant
// FIXED: Teardrop picot angles at tip/bottom now respect element rotation (no more dancing!)
// - Right palette DMC swatches: ONLY solid colors (gradients filtered out)
// - Bottom toolbar: Gradient-only picker (click + button)
// - Clean separation: solids on right, gradients on bottom
// - Gradient picker matches DMC swatches (search, categories, pagination, preview)
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// ── Tatting Icons (inlined) ─────────────────────────────────────────────
// tatting-icons.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Custom SVG icon library for TattingCAD.
// Generated from Inkscape SVGs — Session 20.
// Import from here instead of lucide-react in the main app.
// ─────────────────────────────────────────────────────────────────────────────

// ── Inline SVGs for icons not yet custom-drawn in Inkscape ───────────────────

export const IconMove = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M480,-80 L310,-250 L367,-307 L440,-234 L440,-440 L235,-440 L308,-368 L250,-310 L80,-480 L249,-649 L306,-592 L234,-520 L440,-520 L440,-726 L367,-653 L310,-710 L480,-880 L650,-710 L593,-653 L520,-726 L520,-520 L725,-520 L652,-592 L710,-650 L880,-480 L710,-310 L653,-367 L726,-440 L520,-440 L520,-235 L592,-308 L650,-250 L480,-80 Z" fill="currentColor"/>
  </svg>
);

export const IconMenu = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M120,-680 L120,-760 L840,-760 L840,-680 L120,-680 Z M120,-200 L120,-280 L840,-280 L840,-200 L120,-200 Z M120,-440 L120,-520 L840,-520 L840,-440 L120,-440 Z" fill="currentColor"/>
  </svg>
);

export const IconClose = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M256,-200 L200,-256 L424,-480 L200,-704 L256,-760 L480,-536 L704,-760 L760,-704 L536,-480 L760,-256 L704,-200 L480,-424 L256,-200 Z" fill="currentColor"/>
  </svg>
);

export const IconChevronDown = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M480,-360 L280,-560 L680,-560 L480,-360 Z" fill="currentColor"/>
  </svg>
);

export const IconRefImageOn = IconImage;
export const IconRefImageOff = IconImage; // not used — same as on


export const IconOrtho = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M480,-80 L310,-250 L367,-307 L440,-234 L440,-400 L520,-400 L520,-235 L592,-308 L650,-250 L480,-80 Z M250,-310 L80,-480 L249,-649 L306,-592 L234,-520 L400,-520 L400,-440 L235,-440 L308,-368 L250,-310 Z M710,-310 L653,-367 L726,-440 L560,-440 L560,-520 L725,-520 L652,-592 L710,-650 L880,-480 L710,-310 Z M440,-560 L440,-726 L367,-653 L310,-710 L480,-880 L650,-710 L593,-653 L520,-726 L520,-560 L440,-560 Z" fill="currentColor"/>
  </svg>
);
export const IconOrthoOn = IconOrtho; // alias for compatibility


export const IconJoinPicots = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M155,-75 Q120,-110 120,-160 Q120,-210 155,-245 Q190,-280 240,-280 Q254,-280 266,-277 Q278,-274 289,-269 L346,-340 Q318,-371 307,-410 Q296,-449 302,-488 L221,-515 Q204,-490 178,-475 Q152,-460 120,-460 Q70,-460 35,-495 Q0,-530 0,-580 Q0,-630 35,-665 Q70,-700 120,-700 Q170,-700 205,-665 Q240,-630 240,-580 L240,-572 L321,-544 Q341,-580 374.5,-605 Q408,-630 450,-637 L450,-724 Q411,-735 385.5,-766.5 Q360,-798 360,-840 Q360,-890 395,-925 Q430,-960 480,-960 Q530,-960 565,-925 Q600,-890 600,-840 Q600,-798 574,-766.5 Q548,-735 510,-724 L510,-637 Q552,-630 585.5,-605 Q619,-580 639,-544 L720,-572 L720,-580 Q720,-630 755,-665 Q790,-700 840,-700 Q890,-700 925,-665 Q960,-630 960,-580 Q960,-530 925,-495 Q890,-460 840,-460 Q808,-460 781.5,-475 Q755,-490 739,-515 L658,-488 Q664,-449 653,-410.5 Q642,-372 614,-340 L671,-270 Q682,-275 694,-277.5 Q706,-280 720,-280 Q770,-280 805,-245 Q840,-210 840,-160 Q840,-110 805,-75 Q770,-40 720,-40 Q670,-40 635,-75 Q600,-110 600,-160 Q600,-180 606.5,-198.5 Q613,-217 624,-232 L567,-303 Q526,-280 479.5,-280 Q433,-280 392,-303 L336,-232 Q347,-217 353.5,-198.5 Q360,-180 360,-160 Q360,-110 325,-75 Q290,-40 240,-40 Q190,-40 155,-75 Z M120,-540 Q137,-540 148.5,-551.5 Q160,-563 160,-580 Q160,-597 148.5,-608.5 Q137,-620 120,-620 Q103,-620 91.5,-608.5 Q80,-597 80,-580 Q80,-563 91.5,-551.5 Q103,-540 120,-540 Z M268.5,-131.5 Q280,-143 280,-160 Q280,-177 268.5,-188.5 Q257,-200 240,-200 Q223,-200 211.5,-188.5 Q200,-177 200,-160 Q200,-143 211.5,-131.5 Q223,-120 240,-120 Q257,-120 268.5,-131.5 Z M508.5,-811.5 Q520,-823 520,-840 Q520,-857 508.5,-868.5 Q497,-880 480,-880 Q463,-880 451.5,-868.5 Q440,-857 440,-840 Q440,-823 451.5,-811.5 Q463,-800 480,-800 Q497,-800 508.5,-811.5 Z M480,-360 Q522,-360 551,-389 Q580,-418 580,-460 Q580,-502 551,-531 Q522,-560 480,-560 Q438,-560 409,-531 Q380,-502 380,-460 Q380,-418 409,-389 Q438,-360 480,-360 Z M748.5,-131.5 Q760,-143 760,-160 Q760,-177 748.5,-188.5 Q737,-200 720,-200 Q703,-200 691.5,-188.5 Q680,-177 680,-160 Q680,-143 691.5,-131.5 Q703,-120 720,-120 Q737,-120 748.5,-131.5 Z M868.5,-551.5 Q880,-563 880,-580 Q880,-597 868.5,-608.5 Q857,-620 840,-620 Q823,-620 811.5,-608.5 Q800,-597 800,-580 Q800,-563 811.5,-551.5 Q823,-540 840,-540 Q857,-540 868.5,-551.5 Z M480,-840 Z M120,-580 Z M480,-460 Z M840,-580 Z M240,-160 Z M720,-160 Z" fill="currentColor"/>
  </svg>
);


// ── Tools — left toolbar ────────────────────────────────────────────────────
export const IconPan = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M402,-40 Q372,-40 346,-53.5 Q320,-67 303,-92 L48,-465 L72,-488 Q91,-507 117,-510 Q143,-513 164,-498 L280,-417 L280,-800 Q280,-817 291.5,-828.5 Q303,-840 320,-840 Q337,-840 348.5,-828.5 Q360,-817 360,-800 L360,-263 L212,-367 L369,-138 Q374,-130 383,-125 Q392,-120 402,-120 L680,-120 Q713,-120 736.5,-143.5 Q760,-167 760,-200 L760,-760 Q760,-777 771.5,-788.5 Q783,-800 800,-800 Q817,-800 828.5,-788.5 Q840,-777 840,-760 L840,-200 Q840,-134 793,-87 Q746,-40 680,-40 L402,-40 Z M440,-480 L440,-880 Q440,-897 451.5,-908.5 Q463,-920 480,-920 Q497,-920 508.5,-908.5 Q520,-897 520,-880 L520,-480 L440,-480 Z M600,-480 L600,-840 Q600,-857 611.5,-868.5 Q623,-880 640,-880 Q657,-880 668.5,-868.5 Q680,-857 680,-840 L680,-480 L600,-480 Z M486,-300 Z" fill="currentColor"/>
  </svg>
);
export const IconSelect = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 4.7625 4.7625" fill="none" className={className}>
    <path d="M2.1167,4.7625 L2.1167,2.1167 L4.7625,2.1167 L4.7625,2.6458 L3.0162,2.6458 L4.7625,4.3921 L4.3921,4.7625 L2.6458,3.0162 L2.6458,4.7625 Z M1.0583,4.7625 L1.0583,4.2333 L1.5875,4.2333 L1.5875,4.7625 Z M0.5292,0.5292 L0,0.5292 Q0,0.3109 0.1554,0.1555 Q0.3109,0 0.5292,0 Z M1.0583,0.5292 L1.0583,0 L1.5875,0 L1.5875,0.5292 Z M2.1167,0.5292 L2.1167,0 L2.6458,0 L2.6458,0.5292 Z M3.175,0.5292 L3.175,0 L3.7042,0 L3.7042,0.5292 Z M4.2333,0.5292 L4.2333,0 Q4.4516,0 4.6071,0.1555 Q4.7625,0.3109 4.7625,0.5292 Z M0.5292,4.2333 L0.5292,4.7625 Q0.3109,4.7625 0.1554,4.6071 Q0,4.4516 0,4.2333 Z M0,3.7042 L0,3.175 L0.5292,3.175 L0.5292,3.7042 Z M0,2.6458 L0,2.1167 L0.5292,2.1167 L0.5292,2.6458 Z M0,1.5875 L0,1.0583 L0.5292,1.0583 L0.5292,1.5875 Z M4.2333,1.5875 L4.2333,1.0583 L4.7625,1.0583 L4.7625,1.5875 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);
export const IconPathEdit = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 4.3656 4.3656" fill="none" className={className}>
    <path d="M1.5081,3.175 Q0.8731,3.1419 0.4366,2.6855 Q0,2.2291 0,1.5875 Q0,0.926 0.463,0.463 Q0.926,0 1.5875,0 Q2.2291,0 2.6855,0.4366 Q3.1419,0.8731 3.175,1.5081 L2.6194,1.3428 Q2.5334,0.9856 2.249,0.7574 Q1.9645,0.5292 1.5875,0.5292 Q1.1509,0.5292 0.84,0.8401 Q0.5292,1.1509 0.5292,1.5875 Q0.5292,1.9645 0.7574,2.249 Q0.9856,2.5334 1.3428,2.6194 Z M3.8431,4.3656 L2.712,3.2345 L2.3812,4.2333 L1.5875,1.5875 L4.2333,2.3812 L3.2345,2.712 L4.3656,3.8431 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);
export const IconImage = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M200,-120 Q167,-120 143.5,-143.5 Q120,-167 120,-200 L120,-760 Q120,-793 143.5,-816.5 Q167,-840 200,-840 L760,-840 Q793,-840 816.5,-816.5 Q840,-793 840,-760 L840,-200 Q840,-167 816.5,-143.5 Q793,-120 760,-120 L200,-120 Z M200,-200 L760,-200 L760,-760 L200,-760 L200,-200 Z M240,-280 L720,-280 L570,-480 L450,-320 L360,-440 L240,-280 Z M200,-200 L200,-760 L200,-200 Z M340,-560 Q365,-560 382.5,-577.5 Q400,-595 400,-620 Q400,-645 382.5,-662.5 Q365,-680 340,-680 Q315,-680 297.5,-662.5 Q280,-645 280,-620 Q280,-595 297.5,-577.5 Q315,-560 340,-560 Z" fill="currentColor"/>
  </svg>
);

// ── Element creation ─────────────────────────────────────────────────────────
export const IconAddRing = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="-0.5292 0 5.2917 5.2917" fill="none" className={className}>
    <path d="M2.1167,5.2917 C1.5125,5.2917 1.0087,5.0844 0.6052,4.6699 C0.2017,4.2554 0,3.7394 0,3.1221 C0,2.6811 0.1753,2.2016 0.5259,1.6834 C0.8764,1.1653 1.4067,0.6041 2.1167,0 C2.8266,0.6041 3.3569,1.1653 3.7075,1.6834 C4.058,2.2016 4.2333,2.6811 4.2333,3.1221 C4.2333,3.7394 4.0316,4.2554 3.6281,4.6699 C3.2246,5.0844 2.7208,5.2917 2.1167,5.2917 Z M2.1167,4.7625 C2.5753,4.7625 2.9545,4.6071 3.2544,4.2962 C3.5542,3.9853 3.7042,3.5939 3.7042,3.1221 C3.7042,2.8002 3.5708,2.4364 3.304,2.0307 C3.0372,1.625 2.6414,1.1818 2.1167,0.7011 C1.5919,1.1818 1.1961,1.625 0.9293,2.0307 C0.6626,2.4364 0.5292,2.8002 0.5292,3.1221 C0.5292,3.5939 0.6791,3.9853 0.979,4.2962 C1.2788,4.6071 1.6581,4.7625 2.1167,4.7625 Z" fill="currentColor"/>
  </svg>
);
export const IconAddSplitRing = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="-0.5292 0 5.2917 5.2917" fill="none" className={className}>
    <path d="M2.1167,0 C1.4067,0.6041 0.8766,1.1655 0.5261,1.6836 C0.1755,2.2018 0,2.6813 0,3.1223 C0,3.7396 0.2022,4.2555 0.6056,4.67 C1.0091,5.0845 1.5125,5.2917 2.1167,5.2917 C2.7208,5.2917 3.2247,5.0845 3.6282,4.67 C4.0317,4.2555 4.2333,3.7396 4.2333,3.1223 C4.2333,2.6813 4.0584,2.2018 3.7078,1.6836 C3.3572,1.1655 2.8266,0.6041 2.1167,0 Z M2.1167,0.7012 C2.6414,1.1819 3.0374,1.6252 3.3042,2.0309 C3.571,2.4366 3.7042,2.8004 3.7042,3.1223 C3.7042,3.5941 3.5544,3.9855 3.2546,4.2964 C2.9547,4.6073 2.5753,4.7625 2.1167,4.7625 C1.6581,4.7625 1.2791,4.6073 0.9793,4.2964 C0.6794,3.9855 0.5292,3.5941 0.5292,3.1223 C0.5292,2.8004 0.6629,2.4366 0.9297,2.0309 C1.1964,1.6252 1.5919,1.1819 2.1167,0.7012 Z M1.8521,0.9855 L1.8521,1.5146 L2.3812,1.5146 L2.3812,0.9855 Z M1.8521,2.0438 L1.8521,2.573 L2.3812,2.573 L2.3812,2.0438 Z M1.8521,3.1021 L1.8521,3.6313 L2.3812,3.6313 L2.3812,3.1021 Z M1.8521,4.1605 L1.8521,4.6896 L2.3812,4.6896 L2.3812,4.1605 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);
export const IconAddChain = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -0.1003 5.821 5.821" fill="none" className={className}>
    <path d="M2.0086,0 C1.9817,0.0666 1.4949,1.0635 1.2815,1.5005 C0.8741,1.3717 0.4469,1.3073 0,1.3073 L0,1.8464 C0.5212,1.8464 1.0112,1.9451 1.4695,2.1429 C1.9277,2.3405 2.3274,2.6101 2.6688,2.9516 C3.0103,3.293 3.2798,3.6932 3.4775,4.1514 C3.6752,4.6097 3.774,5.0992 3.774,5.6204 L4.3131,5.6204 C4.3131,5.3089 4.282,5.0071 4.2194,4.7148 C4.6872,4.5826 5.7468,4.2833 5.821,4.2567 L5.6725,3.7381 C5.605,3.7624 4.541,4.0636 4.072,4.1962 C4.0418,4.1118 4.0088,4.0282 3.973,3.9456 C3.7993,3.545 3.5777,3.1834 3.308,2.8605 C3.648,2.5391 4.4833,1.7493 4.5379,1.6901 L4.1667,1.2994 C4.1171,1.3535 3.2784,2.1468 2.9373,2.4693 C2.5999,2.1546 2.2162,1.8972 1.7859,1.6974 C2.0073,1.2442 2.4652,0.3064 2.494,0.2353 Z" fill="currentColor" strokeWidth="0.0067"/>
  </svg>
);
export const IconAddLine = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 4.2333 4.2333" fill="none" className={className}>
    <path d="M0.5292,0 C0.5292,0.5115 0.6262,0.9922 0.8202,1.442 C1.0142,1.8918 1.2788,2.2842 1.614,2.6194 C1.9491,2.9545 2.3416,3.2191 2.7913,3.4131 C3.2411,3.6071 3.7218,3.7042 4.2333,3.7042 L4.2333,4.2333 C3.6512,4.2333 3.1033,4.122 2.5896,3.8993 C2.0759,3.6766 1.6272,3.3734 1.2435,2.9898 C0.8599,2.6061 0.5567,2.1575 0.334,1.6437 C0.1114,1.13 0,0.5821 0,0 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);
// Replace one with a distinct design when ready.

// ── View toggles — paired On/Off ─────────────────────────────────────────────
export const IconGridOn = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 5.6095 5.609" fill="none" className={className}>
    <path d="M0.9527,5.1857 Q0.7344,5.1857 0.5789,5.0303 Q0.4235,4.8748 0.4235,4.6566 L0.4235,0.9524 Q0.4235,0.7341 0.5789,0.5787 Q0.7344,0.4232 0.9527,0.4232 L4.6568,0.4232 Q4.8751,0.4232 5.0305,0.5787 Q5.186,0.7341 5.186,0.9524 L5.186,4.6566 Q5.186,4.8748 5.0305,5.0303 Q4.8751,5.1857 4.6568,5.1857 Z M0.9527,4.6566 L1.8324,4.6566 L1.8324,3.7768 L0.9527,3.7768 Z M2.3616,4.6566 L3.2479,4.6566 L3.2479,3.7768 L2.3616,3.7768 Z M3.7771,4.6566 L4.6568,4.6566 L4.6568,3.7768 L3.7771,3.7768 Z M0.9527,3.2477 L1.8324,3.2477 L1.8324,2.3613 L0.9527,2.3613 Z M2.3616,3.2477 L3.2479,3.2477 L3.2479,2.3613 L2.3616,2.3613 Z M3.7771,3.2477 L4.6568,3.2477 L4.6568,2.3613 L3.7771,2.3613 Z M0.9527,1.8321 L1.8324,1.8321 L1.8324,0.9524 L0.9527,0.9524 Z M2.3616,1.8321 L3.2479,1.8321 L3.2479,0.9524 L2.3616,0.9524 Z M3.7771,1.8321 L4.6568,1.8321 L4.6568,0.9524 L3.7771,0.9524 Z" fill="currentColor"/>
  </svg>
);
export const IconGridOff = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 5.6095 5.609" fill="none" className={className}>
    <path d="M0.3705,0 L0,0.3705 C0.4895,0.8871 5.239,5.609 5.239,5.609 L5.6095,5.2389 Z M1.4593,0.4232 L2.3616,1.3255 L2.3616,0.9524 L3.2479,0.9524 L3.2479,1.8324 L2.8685,1.8324 L3.777,2.7409 L3.777,2.3616 L4.6566,2.3616 L4.6566,3.2479 L4.284,3.2479 L5.1857,4.1496 L5.1857,0.9524 C5.1857,0.8069 5.1343,0.6824 5.0307,0.5788 C4.9271,0.4751 4.8021,0.4232 4.6566,0.4232 Z M3.777,0.9524 L4.6566,0.9524 L4.6566,1.8324 L3.777,1.8324 Z M0.4232,1.5234 L0.4232,4.6566 C0.4232,4.8021 0.4751,4.9265 0.5788,5.0302 C0.6824,5.1338 0.8069,5.1857 0.9524,5.1857 L4.0953,5.1857 C3.8746,4.9661 3.5812,4.6743 3.2479,4.3424 L3.2479,4.6566 L2.3616,4.6566 L2.3616,3.777 L2.6804,3.777 C2.4061,3.5036 2.1188,3.2173 1.8324,2.9316 L1.8324,3.2479 L0.9524,3.2479 L0.9524,2.3616 L1.2614,2.3616 C0.9657,2.0663 0.6809,1.7815 0.4232,1.5234 Z M0.9524,3.777 L1.8324,3.777 L1.8324,4.6566 L0.9524,4.6566 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);
export const IconSnapOn = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 5.6095 5.609" fill="none" className={className}>
    <path d="M2.8295,0.0348 C2.4635,0.0348 2.1199,0.1041 1.798,0.2431 C1.4761,0.382 1.1959,0.5703 0.9578,0.8084 C0.7196,1.0465 0.5313,1.3267 0.3924,1.6487 C0.2535,1.9706 0.1837,2.3146 0.1837,2.6806 L0.1837,5.3265 L0.2566,5.3265 L0.7129,5.3265 L1.5066,5.3265 L1.9087,5.3265 L2.0358,5.3265 L2.0358,2.6806 C2.0358,2.4601 2.113,2.2727 2.2673,2.1184 C2.4216,1.9641 2.609,1.8869 2.8295,1.8869 C3.05,1.8869 3.2374,1.9641 3.3918,2.1184 C3.5461,2.2727 3.6233,2.4601 3.6233,2.6806 L3.6233,5.3265 L4.1566,5.3265 L5.3581,5.3265 L5.4754,5.3265 L5.4754,2.6806 C5.4754,2.3146 5.4061,1.9706 5.2671,1.6487 C5.1282,1.3267 4.9399,1.0465 4.7018,0.8084 C4.4636,0.5703 4.1834,0.382 3.8615,0.2431 C3.5396,0.1041 3.1955,0.0348 2.8295,0.0348 Z M2.8295,0.564 C3.416,0.564 3.9158,0.7702 4.3281,1.1825 C4.7404,1.5948 4.9462,2.0941 4.9462,2.6806 L4.9462,3.6863 L4.154,3.6863 L4.152,2.6806 C4.152,2.3146 4.0234,2.0027 3.7654,1.7448 C3.5074,1.4868 3.195,1.3577 2.829,1.3577 C2.463,1.3577 2.1511,1.4868 1.8932,1.7448 C1.6352,2.0027 1.5061,2.3146 1.5061,2.6806 L1.5061,3.6863 L0.7124,3.6863 L0.7124,2.6806 C0.7124,2.0941 0.9186,1.5948 1.3309,1.1825 C1.7432,0.7702 2.2425,0.564 2.829,0.564 Z M4.155,4.2154 L4.9462,4.2154 L4.9462,4.7973 L4.1555,4.7973 L4.155,4.3053 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);
export const IconSnapOff = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 5.6095 5.609" fill="none" className={className}>
    <path d="M0.3705,0 L0,0.3705 C0.4895,0.8871 5.239,5.609 5.239,5.609 L5.6095,5.239 Z M2.8045,0.0543 C2.4385,0.0543 2.0949,0.1236 1.773,0.2625 C1.6774,0.3037 1.5858,0.3495 1.4976,0.3995 L1.8836,0.7855 C2.162,0.6506 2.4691,0.5834 2.8045,0.5834 C3.391,0.5834 3.8908,0.7897 4.3031,1.202 C4.7154,1.6143 4.9212,2.1136 4.9212,2.7001 L4.9212,3.7057 L4.8038,3.7057 L5.4503,4.3522 L5.4503,2.7001 C5.4503,2.3341 5.3809,1.99 5.2421,1.6681 C5.1031,1.3462 4.9148,1.066 4.6767,0.8279 C4.4386,0.5897 4.1584,0.4014 3.8365,0.2625 C3.5146,0.1236 3.1705,0.0543 2.8045,0.0543 Z M2.8045,1.3772 C2.7008,1.3772 2.6013,1.3875 2.5063,1.4082 L3.0365,1.9384 C3.1597,1.9744 3.2697,2.0408 3.3667,2.1379 C3.4637,2.2349 3.5302,2.3449 3.5662,2.4681 L4.1279,3.0298 L4.1274,2.7001 C4.1274,2.3341 3.9988,2.0222 3.7409,1.7642 C3.4829,1.5063 3.1705,1.3772 2.8045,1.3772 Z M0.4444,1.5043 C0.4172,1.5578 0.3916,1.6121 0.3674,1.6681 C0.2285,1.99 0.1587,2.3341 0.1587,2.7001 L0.1587,5.3459 L0.2316,5.3459 L0.6879,5.3459 L1.4816,5.3459 L1.8837,5.3459 L2.0108,5.3459 L2.0108,3.0701 C1.8347,2.8944 1.66,2.7197 1.4894,2.5492 C1.4844,2.5984 1.4814,2.6488 1.4814,2.7001 L1.4814,3.7057 L0.6876,3.7057 L0.6876,2.7001 C0.6876,2.4115 0.7376,2.1439 0.8375,1.8976 C0.6988,1.7587 0.5667,1.6273 0.4442,1.5043 Z M3.5982,4.6524 L3.5982,5.3459 L4.1315,5.3459 L4.2948,5.3459 C4.0997,5.1517 3.862,4.9151 3.5982,4.6524 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);
export const IconEyeOn = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M607.5,-372.5 Q660,-425 660,-500 Q660,-575 607.5,-627.5 Q555,-680 480,-680 Q405,-680 352.5,-627.5 Q300,-575 300,-500 Q300,-425 352.5,-372.5 Q405,-320 480,-320 Q555,-320 607.5,-372.5 Z M403.5,-423.5 Q372,-455 372,-500 Q372,-545 403.5,-576.5 Q435,-608 480,-608 Q525,-608 556.5,-576.5 Q588,-545 588,-500 Q588,-455 556.5,-423.5 Q525,-392 480,-392 Q435,-392 403.5,-423.5 Z M214,-281.5 Q94,-363 40,-500 Q94,-637 214,-718.5 Q334,-800 480,-800 Q626,-800 746,-718.5 Q866,-637 920,-500 Q866,-363 746,-281.5 Q626,-200 480,-200 Q334,-200 214,-281.5 Z M480,-500 Z M687.5,-339.5 Q782,-399 832,-500 Q782,-601 687.5,-660.5 Q593,-720 480,-720 Q367,-720 272.5,-660.5 Q178,-601 128,-500 Q178,-399 272.5,-339.5 Q367,-280 480,-280 Q593,-280 687.5,-339.5 Z" fill="currentColor"/>
  </svg>
);
export const IconEyeOff = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M644,-428 L586,-486 Q595,-533 559,-574 Q523,-615 466,-606 L408,-664 Q425,-672 442.5,-676 Q460,-680 480,-680 Q555,-680 607.5,-627.5 Q660,-575 660,-500 Q660,-480 656,-462.5 Q652,-445 644,-428 Z M772,-302 L714,-358 Q752,-387 781.5,-421.5 Q811,-456 832,-500 Q782,-601 688.5,-660.5 Q595,-720 480,-720 Q451,-720 423,-716 Q395,-712 368,-704 L306,-766 Q347,-783 390,-791.5 Q433,-800 480,-800 Q631,-800 749,-716.5 Q867,-633 920,-500 Q897,-441 859.5,-390.5 Q822,-340 772,-302 Z M792,-56 L624,-222 Q589,-211 553.5,-205.5 Q518,-200 480,-200 Q329,-200 211,-283.5 Q93,-367 40,-500 Q61,-553 93,-598.5 Q125,-644 166,-680 L56,-792 L112,-848 L848,-112 L792,-56 Z M222,-624 Q193,-598 169,-567 Q145,-536 128,-500 Q178,-399 271.5,-339.5 Q365,-280 480,-280 Q500,-280 519,-282.5 Q538,-285 558,-288 L522,-326 Q511,-323 501,-321.5 Q491,-320 480,-320 Q405,-320 352.5,-372.5 Q300,-425 300,-500 Q300,-511 301.5,-521 Q303,-531 306,-542 L222,-624 Z M541,-531 Z M390,-456 Z" fill="currentColor"/>
  </svg>
);
export const IconRenderSchematic = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 29.6403 29.6395" fill="none" className={className}>
    <path d="M0,0 L0,2.5244 L27.1151,29.6395 L29.6401,29.6395 L29.6401,27.4216 L28.0655,25.847 L27.6645,25.446 L26.9312,24.7127 L23.4089,21.1904 L22.8947,20.6763 L21.901,19.6825 L21.0209,18.8025 L17.4976,15.2792 L12.4706,10.2521 L8.9896,6.7712 L2.2185,0 Z M14.7552,2.3146 C12.8286,2.2835 11.5108,2.8579 10.6226,3.6608 L12.9754,6.0136 C13.3189,5.5902 13.8758,5.2605 14.7764,5.2555 C17.3129,5.2414 17.385,7.8967 17.385,7.8967 L17.4274,10.4655 L20.9827,14.0208 L20.8825,7.922 C20.8321,6.4224 19.8966,2.3975 14.7552,2.3146 Z M0,15.1526 L0,18.6495 L6.0523,18.6934 L6.0265,15.1959 Z M6.7557,15.2017 L6.781,18.6986 L11.7739,18.7353 L8.2511,15.2125 Z M22.2762,15.3143 L22.7872,15.8254 L22.7832,15.3179 Z M23.4394,15.3223 L23.4474,16.4856 L25.7987,18.8368 L29.6398,18.8642 L29.6398,15.3678 Z M0,19.5231 L0,25.6426 L1.9503,25.6566 L1.9059,19.5371 Z M2.6345,19.5422 L2.6789,25.6617 L6.1763,25.6875 L6.1313,19.5675 Z M6.7143,19.5722 L6.7587,25.6917 L10.2557,25.717 L10.2113,19.5975 Z M10.9399,19.6027 L10.9843,25.7222 L14.4812,25.748 L14.4497,21.4108 L12.654,19.6151 Z M26.679,19.7169 L26.8965,19.9345 L26.8945,19.7185 Z M27.6231,19.7239 L27.6301,20.6675 L29.6403,22.6777 L29.6403,19.7384 Z M15.1836,22.1444 L15.21,25.753 L18.7069,25.7783 L18.7059,25.6667 Z" fill="currentColor" strokeWidth="0.1531" strokeLinecap="square"/>
  </svg>
);
export const IconRenderRealistic = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 29.6403 29.6395" fill="none" className={className}>
    <path d="M14.7549,2.3146 C9.6135,2.2317 8.8075,6.4608 8.9341,7.8352 L9.0498,14.8911 L12.5468,14.9164 L12.431,7.8605 C12.431,7.8605 12.2401,5.2696 14.7766,5.2555 C17.3132,5.2414 17.3852,7.8966 17.3852,7.8966 L17.501,14.9526 L20.9979,14.9778 L20.8822,7.9219 C20.8318,6.4224 19.8963,2.3975 14.7549,2.3145 Z M0.0003,15.1526 L0.0003,18.6495 L6.0521,18.6934 L6.0268,15.1959 Z M6.7554,15.2017 L6.7807,18.6986 L14.358,18.7539 L14.3322,15.2565 Z M15.2066,15.2627 L15.2319,18.7601 L22.8092,18.8154 L22.7834,15.318 Z M23.4391,15.3227 L23.4644,18.8201 L29.6398,18.8645 L29.6398,15.3681 Z M0.0003,19.5234 L0.0003,25.643 L1.95,25.657 L1.9056,19.5374 Z M2.6342,19.5425 L2.6786,25.6621 L6.1761,25.6879 L6.1317,19.5678 Z M6.7141,19.5725 L6.7585,25.692 L10.2559,25.7174 L10.2115,19.5978 Z M10.9402,19.603 L10.9846,25.7226 L14.481,25.7484 L14.4366,19.6283 Z M15.1652,19.634 L15.2096,25.7536 L18.7071,25.7789 L18.6627,19.6593 Z M19.3913,19.6645 L19.4357,25.7841 L22.9322,25.8094 L22.8878,19.6898 Z M23.3978,19.6934 L23.4422,25.813 L26.9397,25.8388 L26.8953,19.7187 Z M27.6229,19.7244 L27.6679,25.844 L29.6398,25.8585 L29.6398,19.7389 Z" fill="currentColor" strokeWidth="0.1531" strokeLinecap="square"/>
  </svg>
);
export const IconUnnumberedOn = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M240,-160 L280,-320 L120,-320 L140,-400 L300,-400 L340,-560 L180,-560 L200,-640 L360,-640 L400,-800 L480,-800 L440,-640 L600,-640 L640,-800 L720,-800 L680,-640 L840,-640 L820,-560 L660,-560 L620,-400 L780,-400 L760,-320 L600,-320 L560,-160 L480,-160 L520,-320 L360,-320 L320,-160 L240,-160 Z M380,-400 L540,-400 L580,-560 L420,-560 L380,-400 Z" fill="currentColor"/>
  </svg>
);
export const IconUnnumberedOff = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M109.9219,-890.4688 L70.9375,-851.4844 L851.4844,-70.9375 L890.4688,-109.9219 L109.9219,-890.4688 Z M400,-800 L374.6094,-698.5938 L513.2031,-560 L580,-560 L566.6406,-506.5625 L630.625,-442.5781 L660,-560 L820,-560 L840,-640 L680,-640 L720,-800 L640,-800 L600,-640 L440,-640 L480,-800 L400,-800 Z M200,-640 L180,-560 L286.7969,-560 L206.7969,-640 L200,-640 Z M329.375,-517.4219 L300,-400 L140,-400 L120,-320 L280,-320 L240,-160 L320,-160 L360,-320 L520,-320 L480,-160 L560,-160 L585.3906,-261.4062 L446.7969,-400 L380,-400 L393.3594,-453.4375 L329.375,-517.4219 Z M673.2031,-400 L753.2031,-320 L760,-320 L780,-400 L673.2031,-400 Z" fill="currentColor"/>
  </svg>
);

// IconNoGrid is the same design as IconGridOff — upload a distinct SVG to differentiate
export const IconNoGrid = IconGridOff;

// ── Shape mode icons (new in Session 19) ────────────────────────────────────
export const IconShapeCircle = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="-0.529 0 5.2917 5.2917" fill="none" className={className}>
    <path d="M2.1166,0.5193 C1.5125,0.5193 1.0091,0.7265 0.6056,1.141 C0.2211,1.536 0.0212,2.0238 0.0031,2.6029 L0.0001,2.6029 C0.0001,2.6173 0.0003,2.6315 0.0006,2.6458 C0.0003,2.6601 0.0001,2.6743 0.0001,2.6887 L0.0031,2.6887 C0.0212,3.2679 0.2211,3.7557 0.6056,4.1507 C1.0091,4.5652 1.5125,4.7723 2.1166,4.7723 C2.7208,4.7723 3.2247,4.5652 3.6281,4.1507 C4.0126,3.7557 4.2126,3.2679 4.2307,2.6887 L4.2337,2.6887 C4.2337,2.6743 4.2339,2.6601 4.2337,2.6458 C4.2339,2.6315 4.2337,2.6173 4.2337,2.6029 L4.2307,2.6029 C4.2126,2.0238 4.0126,1.536 3.6281,1.141 C3.2247,0.7265 2.7208,0.5193 2.1166,0.5193 Z M2.1166,1.0485 C2.5752,1.0485 2.9547,1.2037 3.2545,1.5146 C3.5452,1.816 3.6952,2.1932 3.7041,2.6458 C3.6951,3.0985 3.5452,3.4756 3.2545,3.777 C2.9547,4.0879 2.5752,4.2431 2.1166,4.2431 C1.658,4.2431 1.2791,4.0879 0.9792,3.777 C0.6885,3.4756 0.5385,3.0985 0.5296,2.6458 C0.5306,2.5892 0.5336,2.5336 0.5396,2.4794 C0.5782,2.0999 0.725,1.7783 0.9794,1.5146 C1.2793,1.2037 1.6582,1.0485 2.1168,1.0485 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);
export const IconShapeTeardrop = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="-0.529 0 5.2917 5.2917" fill="none" className={className}>
    <path d="M2.1167,0 C1.4067,0.6041 0.8766,1.1655 0.5261,1.6836 C0.1755,2.2018 0,2.6813 0,3.1223 C0,3.7397 0.2016,4.2555 0.6051,4.67 C1.0086,5.0845 1.5125,5.2917 2.1167,5.2917 C2.7208,5.2917 3.2247,5.0845 3.6282,4.67 C4.0317,4.2555 4.2333,3.7397 4.2333,3.1223 C4.2333,2.6813 4.0578,2.2018 3.7073,1.6836 C3.3567,1.1655 2.8266,0.6041 2.1167,0 Z M2.1167,0.7013 C2.6414,1.1819 3.0374,1.6252 3.3042,2.0309 C3.571,2.4366 3.7042,2.8004 3.7042,3.1223 C3.7042,3.5941 3.5544,3.9855 3.2546,4.2964 C2.9547,4.6073 2.5753,4.7625 2.1167,4.7625 C1.6581,4.7625 1.2786,4.6073 0.9787,4.2964 C0.6789,3.9855 0.5292,3.5941 0.5292,3.1223 C0.5292,3.0821 0.5312,3.0409 0.5354,2.9993 C0.5645,2.7085 0.6957,2.3859 0.9291,2.0309 C1.1959,1.6252 1.5919,1.1819 2.1167,0.7013 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);

// ── Edit actions ─────────────────────────────────────────────────────────────
export const IconUndo = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -0.1323 4.2333 4.2333" fill="none" className={className}>
    <path d="M0.7938,3.9687 L0.7938,3.4396 L2.6723,3.4396 Q3.089,3.4396 3.3966,3.175 Q3.7042,2.9104 3.7042,2.5135 Q3.7042,2.1167 3.3966,1.8521 Q3.089,1.5875 2.6723,1.5875 L1.0054,1.5875 L1.6933,2.2754 L1.3229,2.6458 L0,1.3229 L1.3229,0 L1.6933,0.3704 L1.0054,1.0583 L2.6723,1.0583 Q3.3139,1.0583 3.7736,1.4751 Q4.2333,1.8918 4.2333,2.5135 Q4.2333,3.1353 3.7736,3.552 Q3.3139,3.9687 2.6723,3.9687 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);
export const IconRedo = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -0.1323 4.2333 4.2333" fill="none" className={className}>
    <path d="M3.4396,3.9687 L3.4396,3.4396 L1.561,3.4396 Q1.1443,3.4396 0.8367,3.175 Q0.5292,2.9104 0.5292,2.5135 Q0.5292,2.1167 0.8367,1.8521 Q1.1443,1.5875 1.561,1.5875 L3.2279,1.5875 L2.54,2.2754 L2.9104,2.6458 L4.2333,1.3229 L2.9104,0 L2.54,0.3704 L3.2279,1.0583 L1.561,1.0583 Q0.9194,1.0583 0.4597,1.4751 Q0,1.8918 0,2.5135 Q0,3.1353 0.4597,3.552 Q0.9194,3.9687 1.561,3.9687 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);
export const IconCopy = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M360,-240 Q327,-240 303.5,-263.5 Q280,-287 280,-320 L280,-800 Q280,-833 303.5,-856.5 Q327,-880 360,-880 L720,-880 Q753,-880 776.5,-856.5 Q800,-833 800,-800 L800,-320 Q800,-287 776.5,-263.5 Q753,-240 720,-240 L360,-240 Z M360,-320 L720,-320 L720,-800 L360,-800 L360,-320 Z M200,-80 Q167,-80 143.5,-103.5 Q120,-127 120,-160 L120,-720 L200,-720 L200,-160 L640,-160 L640,-80 L200,-80 Z M360,-320 L360,-800 L360,-320 Z" fill="currentColor"/>
  </svg>
);
export const IconPaste = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M200,-120 Q167,-120 143.5,-143.5 Q120,-167 120,-200 L120,-760 Q120,-793 143.5,-816.5 Q167,-840 200,-840 L367,-840 Q378,-875 410,-897.5 Q442,-920 480,-920 Q520,-920 551.5,-897.5 Q583,-875 594,-840 L760,-840 Q793,-840 816.5,-816.5 Q840,-793 840,-760 L840,-200 Q840,-167 816.5,-143.5 Q793,-120 760,-120 L200,-120 Z M200,-200 L760,-200 L760,-760 L680,-760 L680,-640 L280,-640 L280,-760 L200,-760 L200,-200 Z M508.5,-771.5 Q520,-783 520,-800 Q520,-817 508.5,-828.5 Q497,-840 480,-840 Q463,-840 451.5,-828.5 Q440,-817 440,-800 Q440,-783 451.5,-771.5 Q463,-760 480,-760 Q497,-760 508.5,-771.5 Z" fill="currentColor"/>
  </svg>
);
export const IconDelete = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="-0.2646 0 4.7625 4.7625" fill="none" className={className}>
    <path d="M1.3229,0 L1.3229,0.2646 L0,0.2646 L0,0.7937 L0.2646,0.7937 L0.2646,4.2333 C0.2646,4.3789 0.3165,4.5033 0.4201,4.6069 C0.5238,4.7106 0.6482,4.7625 0.7937,4.7625 L3.4396,4.7625 C3.5851,4.7625 3.7096,4.7106 3.8132,4.6069 C3.9168,4.5033 3.9688,4.3789 3.9688,4.2333 L3.9688,0.7937 L4.2333,0.7937 L4.2333,0.2646 L2.9104,0.2646 L2.9104,0 L1.3229,0 Z M0.7937,0.7937 L3.4396,0.7937 L3.4396,4.2333 L0.7937,4.2333 L0.7937,0.7937 Z M1.3229,1.3229 L1.3229,3.7042 L1.8521,3.7042 L1.8521,1.3229 L1.3229,1.3229 Z M2.3812,1.3229 L2.3812,3.7042 L2.9104,3.7042 L2.9104,1.3229 L2.3812,1.3229 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);
export const IconGroup = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M320,-320 L800,-320 L800,-720 L320,-720 L320,-320 Z M320,-240 Q287,-240 263.5,-263.5 Q240,-287 240,-320 L240,-800 Q240,-833 263.5,-856.5 Q287,-880 320,-880 L800,-880 Q833,-880 856.5,-856.5 Q880,-833 880,-800 L880,-320 Q880,-287 856.5,-263.5 Q833,-240 800,-240 L320,-240 Z M160,-80 Q127,-80 103.5,-103.5 Q80,-127 80,-160 L80,-720 L160,-720 L160,-160 L720,-160 L720,-80 L160,-80 Z M320,-800 L320,-320 L320,-800 Z" fill="currentColor"/>
  </svg>
);
export const IconUngroup = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M828,-245 L753,-320 L800,-320 L800,-720 L353,-720 L245,-828 Q253,-852 273.5,-866 Q294,-880 320,-880 L800,-880 Q833,-880 856.5,-856.5 Q880,-833 880,-800 L880,-320 Q880,-294 866,-273.5 Q852,-253 828,-245 Z M820,-28 L608,-240 L320,-240 Q287,-240 263.5,-263.5 Q240,-287 240,-320 L240,-608 L28,-820 L84,-876 L876,-84 L820,-28 Z M320,-320 L528,-320 L320,-528 L320,-320 Z M160,-80 Q127,-80 103.5,-103.5 Q80,-127 80,-160 L80,-720 L160,-720 L160,-160 L720,-160 L720,-80 L160,-80 Z M425,-423 Z M539,-534 Z" fill="currentColor"/>
  </svg>
);

// ── Transform ───────────────────────────────────────────────────────────────
export const IconFlipH = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M360,-120 L200,-120 Q167,-120 143.5,-143.5 Q120,-167 120,-200 L120,-760 Q120,-793 143.5,-816.5 Q167,-840 200,-840 L360,-840 L360,-760 L200,-760 L200,-200 L360,-200 L360,-120 Z M440,-40 L440,-920 L520,-920 L520,-40 L440,-40 Z M600,-120 L600,-200 L680,-200 L680,-120 L600,-120 Z M600,-760 L600,-840 L680,-840 L680,-760 L600,-760 Z M760,-120 L760,-200 L840,-200 Q840,-167 816.5,-143.5 Q793,-120 760,-120 Z M760,-280 L760,-360 L840,-360 L840,-280 L760,-280 Z M760,-440 L760,-520 L840,-520 L840,-440 L760,-440 Z M760,-600 L760,-680 L840,-680 L840,-600 L760,-600 Z M760,-760 L760,-840 Q793,-840 816.5,-816.5 Q840,-793 840,-760 L760,-760 Z" fill="currentColor"/>
  </svg>
);
export const IconFlipV = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M840,-360 L840,-200 Q840,-167 816.5,-143.5 Q793,-120 760,-120 L200,-120 Q167,-120 143.5,-143.5 Q120,-167 120,-200 L120,-360 L200,-360 L200,-200 L760,-200 L760,-360 Z M920,-440 L40,-440 L40,-520 L920,-520 Z M840,-600 L760,-600 L760,-680 L840,-680 Z M200,-600 L120,-600 L120,-680 L200,-680 Z M840,-760 L760,-760 L760,-840 Q793,-840 816.5,-816.5 Q840,-793 840,-760 Z M680,-760 L600,-760 L600,-840 L680,-840 Z M520,-760 L440,-760 L440,-840 L520,-840 Z M360,-760 L280,-760 L280,-840 L360,-840 Z M200,-760 L120,-760 Q120,-793 143.5,-816.5 Q167,-840 200,-840 Z" fill="currentColor"/>
  </svg>
);
export const IconRotateCW = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M440,-80 Q365,-80 299.5,-108.5 Q234,-137 185.5,-185.5 Q137,-234 108.5,-299.5 Q80,-365 80,-440 Q80,-590 185,-695 Q290,-800 440,-800 L446,-800 L384,-862 L440,-920 L600,-760 L440,-600 L384,-658 L446,-720 L440,-720 Q323,-720 241.5,-638.5 Q160,-557 160,-440 Q160,-323 241.5,-241.5 Q323,-160 440,-160 Q475,-160 509,-168.5 Q543,-177 574,-194 L632,-136 Q589,-108 540,-94 Q491,-80 440,-80 Z M680,-200 L440,-440 L680,-680 L920,-440 L680,-200 Z M680,-314 L806,-440 L680,-566 L554,-440 L680,-314 Z M680,-440 Z" fill="currentColor"/>
  </svg>
);
export const IconRotateCCW = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M520,-80 Q469,-80 420,-94 Q371,-108 328,-136 L386,-194 Q417,-177 451,-168.5 Q485,-160 520,-160 Q637,-160 718.5,-241.5 Q800,-323 800,-440 Q800,-557 718.5,-638.5 Q637,-720 520,-720 L514,-720 L576,-658 L520,-600 L360,-760 L520,-920 L576,-862 L514,-800 L520,-800 Q670,-800 775,-695 Q880,-590 880,-440 Q880,-365 851.5,-299.5 Q823,-234 774.5,-185.5 Q726,-137 660.5,-108.5 Q595,-80 520,-80 Z M280,-200 L40,-440 L280,-680 L520,-440 L280,-200 Z M280,-314 L406,-440 L280,-566 L154,-440 L280,-314 Z M280,-440 Z" fill="currentColor"/>
  </svg>
);

export const IconRotateMode = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 5.8208 5.8208" fill="none" className={className}>
    <path d="M2.9104,5.8208 C2.4165,5.8208 1.9623,5.7084 1.5478,5.4835 C1.1333,5.2586 0.7938,4.9587 0.5292,4.5839 L0.5292,5.2917 L0,5.2917 L0,3.7042 L1.5875,3.7042 L1.5875,4.2333 L0.9327,4.2333 C1.1443,4.5508 1.4232,4.8066 1.7694,5.0006 C2.1156,5.1947 2.4959,5.2917 2.9104,5.2917 C3.2412,5.2917 3.5509,5.2289 3.8398,5.1031 C4.1286,4.9775 4.38,4.8077 4.5938,4.5938 C4.8077,4.38 4.9775,4.1286 5.1032,3.8398 C5.2288,3.5509 5.2917,3.2411 5.2917,2.9104 L5.8208,2.9104 C5.8208,3.3117 5.7447,3.6887 5.5926,4.0415 C5.4405,4.3943 5.2321,4.703 4.9676,4.9676 C4.703,5.2321 4.3943,5.4405 4.0415,5.5926 C3.6887,5.7448 3.3117,5.8208 2.9104,5.8208 Z M0,2.9104 C0,2.5091 0.0761,2.1321 0.2282,1.7793 C0.3803,1.4265 0.5887,1.1179 0.8533,0.8533 C1.1179,0.5887 1.4265,0.3803 1.7793,0.2282 C2.1321,0.0761 2.5091,0 2.9104,0 C3.4043,0 3.8585,0.1125 4.273,0.3373 C4.6875,0.5622 5.0271,0.8621 5.2917,1.2369 L5.2917,0.5292 L5.8208,0.5292 L5.8208,2.1167 L4.2333,2.1167 L4.2333,1.5875 L4.8882,1.5875 C4.6765,1.27 4.3976,1.0142 4.0514,0.8202 C3.7053,0.6262 3.3249,0.5292 2.9104,0.5292 C2.5797,0.5292 2.2699,0.592 1.9811,0.7177 C1.6922,0.8434 1.4409,1.0131 1.227,1.227 C1.0131,1.4409 0.8434,1.6922 0.7177,1.9811 C0.592,2.2699 0.5292,2.5797 0.5292,2.9104 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);

// ── Align ────────────────────────────────────────────────────────────────────
export const IconAlignLeft = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M80,-80 L80,-880 L160,-880 L160,-80 L80,-80 Z M240,-280 L240,-400 L640,-400 L640,-280 L240,-280 Z M240,-560 L240,-680 L880,-680 L880,-560 L240,-560 Z" fill="currentColor"/>
  </svg>
);
export const IconAlignCenter = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M440,-80 L440,-280 L240,-280 L240,-400 L440,-400 L440,-560 L120,-560 L120,-680 L440,-680 L440,-880 L520,-880 L520,-680 L840,-680 L840,-560 L520,-560 L520,-400 L720,-400 L720,-280 L520,-280 L520,-80 L440,-80 Z" fill="currentColor"/>
  </svg>
);
export const IconAlignRight = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M800,-80 L800,-880 L880,-880 L880,-80 L800,-80 Z M320,-280 L320,-400 L720,-400 L720,-280 L320,-280 Z M80,-560 L80,-680 L720,-680 L720,-560 L80,-560 Z" fill="currentColor"/>
  </svg>
);
export const IconAlignTop = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M280,-80 L280,-720 L400,-720 L400,-80 L280,-80 Z M560,-320 L560,-720 L680,-720 L680,-320 L560,-320 Z M80,-800 L80,-880 L880,-880 L880,-800 L80,-800 Z" fill="currentColor"/>
  </svg>
);
export const IconAlignMiddle = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M280,-120 L280,-440 L80,-440 L80,-520 L280,-520 L280,-840 L400,-840 L400,-520 L560,-520 L560,-720 L680,-720 L680,-520 L880,-520 L880,-440 L680,-440 L680,-240 L560,-240 L560,-440 L400,-440 L400,-120 L280,-120 Z" fill="currentColor"/>
  </svg>
);
export const IconAlignBottom = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M280,-880 L280,-240 L400,-240 L400,-880 Z M560,-640 L560,-240 L680,-240 L680,-640 Z M80,-160 L80,-80 L880,-80 L880,-160 Z" fill="currentColor"/>
  </svg>
);

// ── File ─────────────────────────────────────────────────────────────────────
export const IconSave = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M840,-680 L840,-200 Q840,-167 816.5,-143.5 Q793,-120 760,-120 L200,-120 Q167,-120 143.5,-143.5 Q120,-167 120,-200 L120,-760 Q120,-793 143.5,-816.5 Q167,-840 200,-840 L680,-840 L840,-680 Z M760,-646 L646,-760 L200,-760 L200,-200 L760,-200 L760,-646 Z M480,-240 Q530,-240 565,-275 Q600,-310 600,-360 Q600,-410 565,-445 Q530,-480 480,-480 Q430,-480 395,-445 Q360,-410 360,-360 Q360,-310 395,-275 Q430,-240 480,-240 Z M240,-560 L600,-560 L600,-720 L240,-720 L240,-560 Z M200,-646 L200,-200 L200,-760 L200,-646 Z" fill="currentColor"/>
  </svg>
);
export const IconLoad = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M440,-320 L440,-646 L336,-542 L280,-600 L480,-800 L680,-600 L624,-542 L520,-646 L520,-320 L440,-320 Z M240,-160 Q207,-160 183.5,-183.5 Q160,-207 160,-240 L160,-360 L240,-360 L240,-240 L720,-240 L720,-360 L800,-360 L800,-240 Q800,-207 776.5,-183.5 Q753,-160 720,-160 L240,-160 Z" fill="currentColor"/>
  </svg>
);
export const IconExport = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M480,-320 L280,-520 L336,-578 L440,-474 L440,-800 L520,-800 L520,-474 L624,-578 L680,-520 L480,-320 Z M240,-160 Q207,-160 183.5,-183.5 Q160,-207 160,-240 L160,-360 L240,-360 L240,-240 L720,-240 L720,-360 L800,-360 L800,-240 Q800,-207 776.5,-183.5 Q753,-160 720,-160 L240,-160 Z" fill="currentColor"/>
  </svg>
);
export const IconNew = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M440,-240 L520,-240 L520,-360 L640,-360 L640,-440 L520,-440 L520,-560 L440,-560 L440,-440 L320,-440 L320,-360 L440,-360 L440,-240 Z M240,-80 Q207,-80 183.5,-103.5 Q160,-127 160,-160 L160,-800 Q160,-833 183.5,-856.5 Q207,-880 240,-880 L560,-880 L800,-640 L800,-160 Q800,-127 776.5,-103.5 Q753,-80 720,-80 L240,-80 Z M520,-600 L520,-800 L240,-800 L240,-160 L720,-160 L720,-600 L520,-600 Z M240,-800 L240,-600 L240,-800 L240,-160 L240,-800 Z" fill="currentColor"/>
  </svg>
);
export const IconDownload = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M400,-280 L560,-280 L560,-360 L400,-360 L400,-280 Z M400,-440 L680,-440 L680,-520 L400,-520 L400,-440 Z M280,-600 L680,-600 L680,-680 L280,-680 L280,-600 Z M480,-480 Z M265,-80 Q186,-80 130.5,-135.5 Q75,-191 75,-270 Q75,-327 104.5,-372 Q134,-417 182,-440 L80,-440 L80,-520 L320,-520 L320,-280 L240,-280 L240,-377 Q203,-369 179,-339 Q155,-309 155,-270 Q155,-224 187.5,-192 Q220,-160 265,-160 L265,-80 Z M400,-120 L400,-200 L760,-200 L760,-760 L200,-760 L200,-600 L120,-600 L120,-760 Q120,-793 143.5,-816.5 Q167,-840 200,-840 L760,-840 Q793,-840 816.5,-816.5 Q840,-793 840,-760 L840,-200 Q840,-167 816.5,-143.5 Q793,-120 760,-120 L400,-120 Z" fill="currentColor"/>
  </svg>
);

// ── Zoom / navigation ────────────────────────────────────────────────────────
export const IconZoomIn = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M784,-120 L532,-372 Q502,-348 463,-334 Q424,-320 380,-320 Q271,-320 195.5,-395.5 Q120,-471 120,-580 Q120,-689 195.5,-764.5 Q271,-840 380,-840 Q489,-840 564.5,-764.5 Q640,-689 640,-580 Q640,-536 626,-497 Q612,-458 588,-428 L840,-176 L784,-120 Z M380,-400 Q455,-400 507.5,-452.5 Q560,-505 560,-580 Q560,-655 507.5,-707.5 Q455,-760 380,-760 Q305,-760 252.5,-707.5 Q200,-655 200,-580 Q200,-505 252.5,-452.5 Q305,-400 380,-400 Z M340,-460 L340,-540 L260,-540 L260,-620 L340,-620 L340,-700 L420,-700 L420,-620 L500,-620 L500,-540 L420,-540 L420,-460 L340,-460 Z" fill="currentColor"/>
  </svg>
);
export const IconZoomOut = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M784,-120 L532,-372 Q502,-348 463,-334 Q424,-320 380,-320 Q271,-320 195.5,-395.5 Q120,-471 120,-580 Q120,-689 195.5,-764.5 Q271,-840 380,-840 Q489,-840 564.5,-764.5 Q640,-689 640,-580 Q640,-536 626,-497 Q612,-458 588,-428 L840,-176 L784,-120 Z M380,-400 Q455,-400 507.5,-452.5 Q560,-505 560,-580 Q560,-655 507.5,-707.5 Q455,-760 380,-760 Q305,-760 252.5,-707.5 Q200,-655 200,-580 Q200,-505 252.5,-452.5 Q305,-400 380,-400 Z M280,-540 L280,-620 L480,-620 L480,-540 L280,-540 Z" fill="currentColor"/>
  </svg>
);
export const IconFitView = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 5.2917 5.292" fill="none" className={className}>
    <path d="M3.175,4.4971 L4.4979,4.4971 L4.4979,3.1722 L3.9687,3.1722 L3.9687,3.9671 L3.175,3.9671 Z M0.7937,2.1198 L1.3229,2.1198 L1.3229,1.3249 L2.1167,1.3249 L2.1167,0.7949 L0.7938,0.7949 Z M0.5292,5.292 C0.3836,5.292 0.2591,5.2401 0.1554,5.1363 C0.0518,5.0325 0,4.9078 0,4.7621 L0,0.5299 C0,0.3842 0.0518,0.2595 0.1554,0.1557 C0.2591,0.0519 0.3836,0 0.5292,0 L4.7625,0 C4.908,0 5.0326,0.0519 5.1362,0.1557 C5.2398,0.2595 5.2917,0.3842 5.2917,0.5299 L5.2917,4.7621 C5.2917,4.9078 5.2399,5.0325 5.1362,5.1363 C5.0326,5.2401 4.908,5.292 4.7625,5.292 Z M0.5292,4.7621 L4.7625,4.7621 L4.7625,0.5299 L0.5292,0.5299 Z M0.5292,4.7621 L0.5292,0.5299 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);

// ── Connection ───────────────────────────────────────────────────────────────
export const IconLink = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M440,-280 L280,-280 Q197,-280 138.5,-338.5 Q80,-397 80,-480 Q80,-563 138.5,-621.5 Q197,-680 280,-680 L440,-680 L440,-600 L280,-600 Q230,-600 195,-565 Q160,-530 160,-480 Q160,-430 195,-395 Q230,-360 280,-360 L440,-360 L440,-280 Z M320,-440 L320,-520 L640,-520 L640,-440 L320,-440 Z M520,-280 L520,-360 L680,-360 Q730,-360 765,-395 Q800,-430 800,-480 Q800,-530 765,-565 Q730,-600 680,-600 L520,-600 L520,-680 L680,-680 Q763,-680 821.5,-621.5 Q880,-563 880,-480 Q880,-397 821.5,-338.5 Q763,-280 680,-280 L520,-280 Z" fill="currentColor"/>
  </svg>
);
export const IconUnlink = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M770,-302 L710,-364 Q750,-375 775,-406.5 Q800,-438 800,-480 Q800,-530 765,-565 Q730,-600 680,-600 L520,-600 L520,-680 L680,-680 Q763,-680 821.5,-621.5 Q880,-563 880,-480 Q880,-423 850.5,-375 Q821,-327 770,-302 Z M634,-440 L554,-520 L640,-520 L640,-440 L634,-440 Z M792,-56 L56,-792 L112,-848 L848,-112 L792,-56 Z M440,-280 L280,-280 Q197,-280 138.5,-338.5 Q80,-397 80,-480 Q80,-549 122,-603 Q164,-657 230,-674 L304,-600 L280,-600 Q230,-600 195,-565 Q160,-530 160,-480 Q160,-430 195,-395 Q230,-360 280,-360 L440,-360 L440,-280 Z M320,-440 L320,-520 L385,-520 L464,-440 L320,-440 Z" fill="currentColor"/>
  </svg>
);

// ── Chrome ───────────────────────────────────────────────────────────────────
export const IconSettings = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M370,-80 L354,-208 Q341,-213 329.5,-220 Q318,-227 307,-235 L188,-185 L78,-375 L181,-453 Q180,-460 180,-466.5 L180,-493.5 Q180,-500 181,-507 L78,-585 L188,-775 L307,-725 Q318,-733 330,-740 Q342,-747 354,-752 L370,-880 L590,-880 L606,-752 Q619,-747 630.5,-740 Q642,-733 653,-725 L772,-775 L882,-585 L779,-507 Q780,-500 780,-493.5 L780,-466.5 Q780,-460 778,-453 L881,-375 L771,-185 L653,-235 Q642,-227 630,-220 Q618,-213 606,-208 L590,-80 L370,-80 Z M440,-160 L519,-160 L533,-266 Q564,-274 590.5,-289.5 Q617,-305 639,-327 L738,-286 L777,-354 L691,-419 Q696,-433 698,-448.5 Q700,-464 700,-480 Q700,-496 698,-511.5 Q696,-527 691,-541 L777,-606 L738,-674 L639,-632 Q617,-655 590.5,-670.5 Q564,-686 533,-694 L520,-800 L441,-800 L427,-694 Q396,-686 369.5,-670.5 Q343,-655 321,-633 L222,-674 L183,-606 L269,-542 Q264,-527 262,-512 Q260,-497 260,-480 Q260,-464 262,-449 Q264,-434 269,-419 L183,-354 L222,-286 L321,-328 Q343,-305 369.5,-289.5 Q396,-274 427,-266 L440,-160 Z M482,-340 Q540,-340 581,-381 Q622,-422 622,-480 Q622,-538 581,-579 Q540,-620 482,-620 Q423,-620 382.5,-579 Q342,-538 342,-480 Q342,-422 382.5,-381 Q423,-340 482,-340 Z M480,-480 Z" fill="currentColor"/>
  </svg>
);
export const IconHelp = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="-0.5292 0 5.2917 5.2917" fill="none" className={className}>
    <path d="M0.926,0 C0.6659,0 0.4463,0.0905 0.2677,0.2713 C0.0891,0.4521 0,0.6703 0,0.926 L0,4.3656 C0,4.6258 0.0891,4.8454 0.2677,5.024 C0.4463,5.2026 0.6659,5.2917 0.926,5.2917 L4.2333,5.2917 L4.2333,4.7625 C4.1187,4.7625 4.0241,4.7249 3.9491,4.6499 C3.8741,4.5749 3.8365,4.4803 3.8365,4.3656 C3.8365,4.2554 3.8741,4.1617 3.9491,4.0845 C4.0241,4.0073 4.1187,3.9688 4.2333,3.9688 L4.2333,0 Z M0.926,0.5292 L3.7042,0.5292 L3.7042,3.4396 L0.926,3.4396 C0.851,3.4396 0.7817,3.4456 0.7178,3.4592 C0.6539,3.4725 0.5909,3.4944 0.5292,3.5253 L0.5292,0.926 C0.5292,0.8157 0.5669,0.722 0.6418,0.6448 C0.7168,0.5676 0.8114,0.5291 0.926,0.5291 Z M2.0428,0.7364 C1.8611,0.7364 1.7103,0.7868 1.5906,0.8873 C1.4709,0.9877 1.3885,1.106 1.3436,1.2428 L1.6738,1.3839 C1.6973,1.3155 1.7375,1.2481 1.7942,1.1818 C1.8508,1.1155 1.9338,1.0826 2.0428,1.0826 C2.1475,1.0826 2.2289,1.1117 2.2877,1.1694 C2.3465,1.2271 2.3761,1.2999 2.3761,1.3875 C2.3761,1.4602 2.3533,1.5247 2.3074,1.5813 C2.2615,1.6379 2.1945,1.7049 2.1069,1.7818 C2.0065,1.8716 1.9405,1.954 1.9095,2.0299 C1.8785,2.1058 1.863,2.2304 1.863,2.4035 L2.232,2.4035 C2.232,2.2774 2.2431,2.1881 2.2656,2.1358 C2.288,2.0834 2.3516,2.0068 2.4563,1.9063 C2.5546,1.8101 2.6269,1.7243 2.6728,1.6485 C2.7187,1.5726 2.7415,1.4815 2.7415,1.3746 C2.7415,1.1993 2.6814,1.049 2.5606,0.924 C2.4399,0.7989 2.2673,0.7364 2.0428,0.7364 Z M2.0428,2.6603 C1.9722,2.6603 1.9116,2.685 1.8614,2.7352 C1.8112,2.7854 1.7865,2.8461 1.7865,2.9166 C1.7865,2.9872 1.8112,3.0473 1.8614,3.0975 C1.9116,3.1477 1.9722,3.173 2.0428,3.173 C2.1133,3.173 2.1734,3.1478 2.2236,3.0975 C2.2738,3.0473 2.299,2.9871 2.299,2.9166 C2.299,2.8461 2.2738,2.7854 2.2236,2.7352 C2.1734,2.685 2.1133,2.6603 2.0428,2.6603 Z M0.926,3.9688 L3.3931,3.9688 C3.3622,4.0306 3.3402,4.0944 3.327,4.1605 C3.3141,4.2266 3.3074,4.2951 3.3074,4.3656 C3.3074,4.4406 3.3154,4.51 3.3307,4.5739 C3.3461,4.6378 3.3667,4.7008 3.3932,4.7625 L0.9261,4.7625 C0.8115,4.7625 0.7169,4.7249 0.6419,4.6498 C0.5669,4.5748 0.5293,4.4803 0.5293,4.3656 C0.5293,4.2554 0.567,4.1617 0.6419,4.0845 C0.7169,4.0073 0.8115,3.9688 0.9261,3.9688 Z" fill="currentColor" strokeWidth="0.0032"/>
  </svg>
);

export const IconBeadMode = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M352.5,-325.5 Q298,-371 284,-440 L80,-440 L80,-520 L284,-520 Q298,-589 352.5,-634.5 Q407,-680 480,-680 Q553,-680 607.5,-634.5 Q662,-589 676,-520 L880,-520 L880,-440 L676,-440 Q662,-371 607.5,-325.5 Q553,-280 480,-280 Q407,-280 352.5,-325.5 Z M480,-360 Q530,-360 565,-395 Q600,-430 600,-480 Q600,-530 565,-565 Q530,-600 480,-600 Q430,-600 395,-565 Q360,-530 360,-480 Q360,-430 395,-395 Q430,-360 480,-360 Z" fill="currentColor"/>
  </svg>
);

// ── Bead structure icons (placeholder until custom SVGs designed) ─────────────
// Replace with processed Inkscape versions when ready.
// Candidate files in zip: "core bead only.svg", "core+pico.svg",
// "core+picot beads.svg", "Beads on picot.svg", "Suspended Beads.svg"
export const IconBeadCore = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 7.2026 7.2026" fill="none" className={className}>
    <path d="M0.9821,2.2727 L0.6079,2.6468 C1.0195,3.0584 1.4856,3.3671 2.0063,3.5729 C2.1166,3.6165 2.2273,3.6559 2.3386,3.6902 A1.2619,1.2619 0 0,0 3.6005,4.9299 A1.2619,1.2619 0 0,0 4.8625,3.6907 C4.9743,3.6562 5.0855,3.6167 5.1963,3.5729 C5.717,3.3671 6.1831,3.0584 6.5947,2.6468 L6.2205,2.2727 C5.8588,2.6344 5.4505,2.9058 4.9953,3.0866 C4.9174,3.1175 4.8391,3.1457 4.7607,3.1713 A1.2619,1.2619 0 0,0 3.6005,2.406 A1.2619,1.2619 0 0,0 2.4404,3.1713 C2.3624,3.1458 2.2848,3.1173 2.2073,3.0866 C1.7521,2.9058 1.3438,2.6344 0.9821,2.2727 Z M3.6005,2.7869 A0.8811,0.8811 0 0,1 4.3881,3.2732 A0.8811,0.8811 0 0,1 4.4816,3.668 A0.8811,0.8811 0 0,1 4.4726,3.7915 A0.8811,0.8811 0 0,1 3.6003,4.549 A0.8811,0.8811 0 0,1 2.728,3.791 A0.8811,0.8811 0 0,1 2.719,3.668 A0.8811,0.8811 0 0,1 2.8125,3.2726 A0.8811,0.8811 0 0,1 3.6,2.7869 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);

export const IconBeadCorePicot = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 7.2026 7.2026" fill="none" className={className}>
    <path d="M0.9821,1.2957 L0.6079,1.6699 C0.9757,2.0377 1.3865,2.3232 1.8415,2.5267 L1.8415,4.0858 C1.8414,5.0916 2.6572,5.9069 3.663,5.9068 C4.6689,5.9069 5.4842,5.0916 5.4841,4.0858 L5.4841,2.4688 C5.8903,2.2703 6.2604,2.0041 6.5946,1.6699 L6.2205,1.2957 C5.8588,1.6574 5.4505,1.9288 4.9953,2.1097 C4.9174,2.1406 4.8391,2.1689 4.7607,2.1945 A1.2619,1.2619 0 0,0 3.6005,1.4291 A1.2619,1.2619 0 0,0 2.4404,2.1945 C2.3624,2.169 2.2847,2.1404 2.2073,2.1097 C1.7521,1.9288 1.3438,1.6575 0.9821,1.2957 Z M3.6,1.8099 L3.6005,1.8099 A0.8811,0.8811 0 0,1 4.3881,2.2962 A0.8811,0.8811 0 0,1 4.4816,2.691 A0.8811,0.8811 0 0,1 4.4726,2.8145 A0.8811,0.8811 0 0,1 3.6003,3.5721 A0.8811,0.8811 0 0,1 2.728,2.814 A0.8811,0.8811 0 0,1 2.719,2.691 A0.8811,0.8811 0 0,1 2.8125,2.2957 A0.8811,0.8811 0 0,1 3.6,1.8099 Z M5.1343,2.6202 L5.1343,4.0858 C5.1343,4.788 4.3653,5.557 3.663,5.557 C2.9608,5.557 2.1913,4.788 2.1913,4.0858 L2.1913,2.6647 C2.2403,2.6818 2.2894,2.6981 2.3386,2.7133 A1.2619,1.2619 0 0,0 3.6005,3.953 A1.2619,1.2619 0 0,0 4.8625,2.7138 C4.9535,2.6857 5.044,2.6546 5.1343,2.6203 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);

export const IconBeadCoreBeaded = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 7.2026 7.2026" fill="none" className={className}>
    <path d="M0.9819,0.9591 L0.6078,1.3332 C0.9755,1.7009 1.3865,1.9861 1.8413,2.1895 L1.8413,3.5047 C1.8413,4.0132 2.05,4.4729 2.386,4.8033 C2.378,4.8623 2.3732,4.9219 2.3731,4.9816 C2.373,5.6786 2.9381,6.2436 3.635,6.2435 C4.332,6.2436 4.897,5.6786 4.897,4.9816 C4.897,4.9376 4.895,4.8936 4.89,4.8498 C5.2547,4.5168 5.4838,4.0375 5.4837,3.5047 L5.4843,2.1321 C5.8904,1.9336 6.2606,1.6674 6.5948,1.3332 L6.2206,0.9591 C5.8589,1.3208 5.4506,1.5921 4.9954,1.773 C4.9175,1.8039 4.8392,1.8321 4.7608,1.8577 A1.2619,1.2619 0 0,0 3.6007,1.0924 A1.2619,1.2619 0 0,0 2.4405,1.8577 C2.3625,1.8322 2.2849,1.8037 2.2075,1.773 C1.7522,1.5921 1.3439,1.3208 0.9822,0.9591 Z M3.5999,1.4733 L3.6004,1.4733 A0.8811,0.8811 0 0,1 4.3879,1.9595 A0.8811,0.8811 0 0,1 4.4814,2.3544 A0.8811,0.8811 0 0,1 4.4724,2.4779 A0.8811,0.8811 0 0,1 3.6001,3.2354 A0.8811,0.8811 0 0,1 2.7278,2.4773 A0.8811,0.8811 0 0,1 2.7188,2.3544 A0.8811,0.8811 0 0,1 2.8123,1.959 A0.8811,0.8811 0 0,1 3.5999,1.4733 Z M5.1341,2.283 L5.1341,3.5047 C5.1341,3.8148 4.9838,4.1376 4.7559,4.4018 C4.5391,3.9828 4.1068,3.7196 3.635,3.7196 C3.1796,3.7197 2.7595,3.9652 2.5359,4.362 C2.3266,4.1055 2.1912,3.7994 2.1912,3.5047 L2.1912,2.328 C2.2401,2.3451 2.2893,2.3614 2.3385,2.3766 A1.2619,1.2619 0 0,0 3.6004,3.6163 A1.2619,1.2619 0 0,0 4.8623,2.3771 C4.9533,2.349 5.0438,2.3174 5.1341,2.283 Z M3.6629,4.1005 C4.1495,4.1005 4.544,4.495 4.544,4.9816 C4.544,5.4682 4.1495,5.8626 3.6629,5.8627 C3.1763,5.8626 2.7819,5.4682 2.7818,4.9816 C2.7819,4.495 3.1763,4.1005 3.6629,4.1005 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);

export const IconBeadSpike = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 7.2026 7.2026" fill="none" className={className}>
    <path d="M0.9818,0.2759 L0.6077,0.6501 C0.9564,0.9988 1.3443,1.2733 1.7714,1.4743 L1.7714,2.2954 C1.1495,2.3841 0.6876,2.9168 0.6878,3.545 C0.6878,4.2143 1.2407,4.7926 1.8799,4.8043 C1.8911,5.1082 2.1233,5.2969 2.3161,5.4865 C2.2205,6.1503 2.7106,6.9267 3.5651,6.9267 C4.4077,6.9267 4.8864,6.1756 4.8203,5.533 C5.0515,5.3349 5.186,5.0763 5.3071,4.8043 C5.9708,4.761 6.487,4.2101 6.4869,3.545 C6.4871,2.9209 6.0311,2.3905 5.4141,2.297 L5.4141,1.4821 C5.8478,1.2804 6.2416,1.0033 6.5949,0.6501 L6.2203,0.2759 C5.8586,0.6376 5.4503,0.9085 4.995,1.0893 C4.5398,1.2702 4.0753,1.3606 3.6013,1.3606 C3.1273,1.3606 2.6628,1.2701 2.2076,1.0893 C1.7523,0.9085 1.3435,0.6376 0.9818,0.2759 Z M2.1213,1.6195 C2.6052,1.7961 3.0987,1.8846 3.6013,1.8846 C4.0982,1.8846 4.5857,1.7983 5.0643,1.6257 L5.0643,2.2934 C4.4346,2.3742 3.963,2.9102 3.963,3.545 C3.9629,4.1192 4.3505,4.621 4.9061,4.7661 C4.8716,4.9052 4.7842,4.9888 4.686,5.0849 C4.4692,4.6659 4.0369,4.4028 3.5651,4.4028 C3.1097,4.4029 2.6896,4.6484 2.466,5.0451 C2.3783,4.972 2.3111,4.8848 2.2779,4.763 C2.5417,4.761 3.2117,4.1155 3.2117,3.545 C3.2116,2.9144 2.746,2.3806 2.1213,2.2949 Z M1.9497,2.6639 C2.3805,2.6644 2.8307,3.0083 2.8308,3.545 C2.8308,4.0768 2.3859,4.4263 1.9497,4.4261 C1.5205,4.4262 1.0686,4.083 1.0686,3.545 C1.0686,3.0097 1.5174,2.6636 1.9497,2.6639 Z M5.225,2.6639 C5.6596,2.6642 6.106,3.0118 6.106,3.545 C6.1061,4.0807 5.6567,4.4264 5.225,4.4261 C4.7913,4.4258 4.344,4.079 4.3439,3.545 C4.3437,3.0059 4.797,2.6631 5.225,2.6639 Z M3.593,4.7831 C4.0796,4.7832 4.4741,5.1776 4.4741,5.6642 C4.4741,6.1508 4.0796,6.5453 3.593,6.5453 C3.1064,6.5453 2.712,6.1508 2.712,5.6642 C2.712,5.1776 3.1064,4.7832 3.593,4.7831 Z" fill="currentColor" strokeWidth="0.149" strokeLinecap="square"/>
  </svg>
);

export const IconBeadSuspended = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 7.2026 7.2026" fill="none" className={className}>
    <path d="M0.9821,0.4015 L0.6079,0.7756 C1.0195,1.1872 1.4856,1.4959 2.0063,1.7017 C2.3295,1.8294 2.6571,1.9173 2.9887,1.9657 A0.9164,0.9164 0 0,0 2.6802,2.6515 A0.9164,0.9164 0 0,0 3.1799,3.4654 A0.9164,0.9164 0 0,0 2.6802,4.2798 A0.9164,0.9164 0 0,0 3.1442,5.0756 A0.9164,0.9164 0 0,0 2.6548,5.8849 A0.9164,0.9164 0 0,0 3.5711,6.8011 A0.9164,0.9164 0 0,0 4.4878,5.8849 A0.9164,0.9164 0 0,0 4.0238,5.0885 A0.9164,0.9164 0 0,0 4.5131,4.2798 A0.9164,0.9164 0 0,0 4.0134,3.4654 A0.9164,0.9164 0 0,0 4.5131,2.6515 A0.9164,0.9164 0 0,0 4.2062,1.9673 C4.5405,1.9191 4.8705,1.8304 5.1963,1.7017 C5.717,1.4959 6.1831,1.1872 6.5947,0.7756 L6.2205,0.4015 C5.8588,0.7632 5.4505,1.0345 4.9953,1.2154 C4.54,1.3963 4.0755,1.4867 3.6016,1.4867 C3.1276,1.4867 2.6631,1.3962 2.2078,1.2154 C1.7526,1.0345 1.3438,0.7632 0.9821,0.4015 Z M3.5964,2.0117 A0.6399,0.6399 0 0,1 4.2367,2.6515 A0.6399,0.6399 0 0,1 3.5964,3.2912 A0.6399,0.6399 0 0,1 2.9566,2.6515 A0.6399,0.6399 0 0,1 3.5964,2.0117 Z M3.5964,3.6395 A0.6399,0.6399 0 0,1 4.2367,4.2798 A0.6399,0.6399 0 0,1 3.5964,4.9196 A0.6399,0.6399 0 0,1 2.9566,4.2798 A0.6399,0.6399 0 0,1 3.5964,3.6395 Z M3.5711,5.2451 A0.6399,0.6399 0 0,1 4.2108,5.8849 A0.6399,0.6399 0 0,1 3.5711,6.5246 A0.6399,0.6399 0 0,1 2.9313,5.8849 A0.6399,0.6399 0 0,1 3.5711,5.2451 Z" fill="currentColor" strokeWidth="0.0066"/>
  </svg>
);

export const IconLanguage = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M325,-111.5 Q252,-143 197.5,-197.5 Q143,-252 111.5,-325 Q80,-398 80,-480.5 Q80,-563 111.5,-635.5 Q143,-708 197.5,-762.5 Q252,-817 325,-848.5 Q398,-880 480.5,-880 Q563,-880 635.5,-848.5 Q708,-817 762.5,-762.5 Q817,-708 848.5,-635.5 Q880,-563 880,-480.5 Q880,-398 848.5,-325 Q817,-252 762.5,-197.5 Q708,-143 635.5,-111.5 Q563,-80 480.5,-80 Q398,-80 325,-111.5 Z M480,-162 Q506,-198 525,-237 Q544,-276 556,-320 L404,-320 Q416,-276 435,-237 Q454,-198 480,-162 Z M376,-178 Q358,-211 344.5,-246.5 Q331,-282 322,-320 L204,-320 Q233,-270 276.5,-233 Q320,-196 376,-178 Z M584,-178 Q640,-196 683.5,-233 Q727,-270 756,-320 L638,-320 Q629,-282 615.5,-246.5 Q602,-211 584,-178 Z M170,-400 L306,-400 Q303,-420 301.5,-439.5 Q300,-459 300,-480 Q300,-501 301.5,-520.5 Q303,-540 306,-560 L170,-560 Q165,-540 162.5,-520.5 Q160,-501 160,-480 Q160,-459 162.5,-439.5 Q165,-420 170,-400 Z M386,-400 L574,-400 Q577,-420 578.5,-439.5 Q580,-459 580,-480 Q580,-501 578.5,-520.5 Q577,-540 574,-560 L386,-560 Q383,-540 381.5,-520.5 Q380,-501 380,-480 Q380,-459 381.5,-439.5 Q383,-420 386,-400 Z M654,-400 L790,-400 Q795,-420 797.5,-439.5 Q800,-459 800,-480 Q800,-501 797.5,-520.5 Q795,-540 790,-560 L654,-560 Q657,-540 658.5,-520.5 Q660,-501 660,-480 Q660,-459 658.5,-439.5 Q657,-420 654,-400 Z M638,-640 L756,-640 Q727,-690 683.5,-727 Q640,-764 584,-782 Q602,-749 615.5,-713.5 Q629,-678 638,-640 Z M404,-640 L556,-640 Q544,-684 525,-723 Q506,-762 480,-798 Q454,-762 435,-723 Q416,-684 404,-640 Z M204,-640 L322,-640 Q331,-678 344.5,-713.5 Q358,-749 376,-782 Q320,-764 276.5,-727 Q233,-690 204,-640 Z" fill="currentColor"/>
  </svg>
);

// ── Notation position icons ─────────────────────────────────────────────────

export const IconNotationS = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -0.4223 5.821 5.821" fill="none" className={className}>
    <path d="M0.7753,0 C0.5811,0 0.4149,0.0693 0.2766,0.2076 C0.1383,0.3459 -0.1253,0.506 0.069,0.506 L0.7353,0.506 L0.7353,2.508 L0,2.508 L1.0843,3.5923 L2.1693,2.508 L1.434,2.508 L1.434,0.506 L5.7196,0.506 L5.7196,0 Z M4.6422,1.4775 C4.4871,1.4775 4.338,1.5064 4.1938,1.5665 C4.0508,1.6252 3.9228,1.7093 3.8131,1.819 C3.7022,1.9297 3.6152,2.0596 3.5551,2.2025 C3.4964,2.3454 3.4668,2.4976 3.4668,2.6536 L3.4668,3.8007 C3.4668,3.9567 3.4964,4.1089 3.5551,4.2518 C3.6153,4.3946 3.7022,4.5237 3.8131,4.6346 C3.9227,4.7442 4.0511,4.8277 4.1938,4.8878 L4.1938,4.8908 C4.3378,4.9493 4.4874,4.9763 4.6422,4.9763 C4.7969,4.9763 4.9477,4.9494 5.0905,4.8908 C5.2349,4.8306 5.3642,4.7441 5.474,4.6328 C5.5851,4.5217 5.6705,4.3925 5.7293,4.2493 C5.7895,4.1063 5.821,3.956 5.821,3.8009 L5.821,2.6538 C5.821,2.4975 5.7895,2.3458 5.7293,2.2027 C5.6705,2.0595 5.585,1.9302 5.474,1.8192 C5.3641,1.7094 5.235,1.6254 5.0905,1.5667 C4.9483,1.5073 4.7964,1.4777 4.6422,1.4777 Z M2.1528,1.5196 L2.0017,2.1004 L2.5177,2.1004 L2.5177,4.9374 L3.1433,4.9374 L3.1433,1.9962 C3.1433,1.8613 3.1019,1.7401 3.0157,1.652 C2.9291,1.5635 2.8041,1.5196 2.6687,1.5196 Z M4.6422,2.0563 C4.7863,2.0563 4.9064,2.114 5.0229,2.2439 C5.1397,2.3742 5.1954,2.5133 5.1954,2.6791 L5.1954,3.7793 C5.1954,3.9436 5.1424,4.0836 5.0257,4.2125 L5.0227,4.2125 C4.9078,4.3407 4.7879,4.3973 4.6419,4.3973 C4.4959,4.3973 4.3775,4.3409 4.2612,4.2125 C4.1458,4.0837 4.0922,3.9438 4.0922,3.7793 L4.0922,2.6791 C4.0922,2.5148 4.1443,2.377 4.2612,2.2466 L4.2642,2.2436 C4.3808,2.1123 4.4983,2.056 4.6422,2.056 Z" fill="currentColor" strokeWidth="0.0088"/>
  </svg>
);

export const IconNotationM = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -0.4223 5.821 5.821" fill="none" className={className}>
    <path d="M4.6422,0.0002 C4.4871,0.0002 4.338,0.0284 4.1938,0.0885 C4.0508,0.1472 3.9228,0.2319 3.8131,0.3416 C3.7022,0.4524 3.6152,0.5822 3.5551,0.7251 C3.4964,0.868 3.4668,1.0202 3.4668,1.1762 L3.4668,2.3233 C3.4668,2.4793 3.4964,2.6308 3.5551,2.7737 C3.6153,2.9166 3.7022,3.0464 3.8131,3.1573 C3.9227,3.2668 4.0511,3.3504 4.1938,3.4104 L4.1938,3.4124 C4.3378,3.4709 4.4874,3.4986 4.6422,3.4986 C4.7969,3.4986 4.9477,3.471 5.0905,3.4124 C5.2349,3.3522 5.3642,3.2658 5.474,3.1544 C5.5851,3.0434 5.6705,2.9148 5.7293,2.7716 C5.7895,2.6286 5.821,2.4783 5.821,2.3233 L5.821,1.1762 C5.821,1.0199 5.7895,0.8682 5.7293,0.725 C5.6705,0.5818 5.585,0.4526 5.474,0.3415 C5.3641,0.2317 5.235,0.1477 5.0905,0.0891 C4.9483,0.0297 4.7964,0.0001 4.6422,0.0001 Z M2.1528,0.0416 L2.0017,0.623 L2.5177,0.623 L2.5177,3.4594 L3.1433,3.4594 L3.1433,0.5189 C3.1433,0.384 3.1019,0.2627 3.0157,0.1747 C2.929,0.0862 2.8041,0.0416 2.6687,0.0416 Z M4.6422,0.5789 C4.7863,0.5789 4.9064,0.6366 5.0229,0.7665 C5.1397,0.8968 5.1954,1.0359 5.1954,1.2018 L5.1954,2.302 C5.1954,2.4663 5.1424,2.6062 5.0257,2.7351 L5.0227,2.7351 C4.9078,2.8634 4.7879,2.92 4.6419,2.92 C4.4959,2.92 4.3775,2.8636 4.2612,2.7351 C4.1458,2.6063 4.0922,2.4665 4.0922,2.302 L4.0922,1.2018 C4.0922,1.0375 4.1443,0.8997 4.2612,0.7693 L4.2642,0.7663 C4.3808,0.6349 4.4983,0.5787 4.6422,0.5787 Z M1.0843,1.913 L0,2.998 L0.7353,2.998 L0.7353,4.4702 L0.069,4.4702 C-0.1253,4.4702 0.1383,4.6309 0.2766,4.7693 C0.4149,4.9076 0.5811,4.9762 0.7753,4.9762 L5.7196,4.9762 L5.7196,4.4702 L1.434,4.4702 L1.434,2.998 L2.1693,2.998 Z" fill="currentColor" strokeWidth="0.0088"/>
  </svg>
);

export const IconNotationH = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -0.4223 5.821 5.821" fill="none" className={className}>
    <path d="M4.6422,0.0002 C4.4871,0.0002 4.338,0.0284 4.1938,0.0885 C4.0508,0.1472 3.9228,0.2319 3.8131,0.3416 C3.7022,0.4524 3.6153,0.5822 3.5551,0.7251 C3.4964,0.868 3.4668,1.0202 3.4668,1.1762 L3.4668,2.3233 C3.4668,2.4793 3.4964,2.6308 3.5551,2.7737 C3.6153,2.9166 3.7023,3.0464 3.8131,3.1573 C3.9227,3.2668 4.0511,3.3504 4.1938,3.4104 L4.1938,3.4124 C4.3378,3.4709 4.4874,3.4986 4.6422,3.4986 C4.797,3.4986 4.9478,3.471 5.0906,3.4124 C5.2349,3.3522 5.3643,3.2658 5.4741,3.1544 C5.5851,3.0434 5.6705,2.9148 5.7293,2.7716 C5.7895,2.6286 5.821,2.4783 5.821,2.3233 L5.821,1.1762 C5.821,1.0199 5.7895,0.8682 5.7293,0.725 C5.6705,0.5818 5.5851,0.4526 5.4741,0.3415 C5.3642,0.2317 5.235,0.1477 5.0906,0.0891 C4.9483,0.0297 4.7964,0.0001 4.6422,0.0001 Z M2.1528,0.0416 L2.0018,0.623 L2.5177,0.623 L2.5177,3.4594 L3.1433,3.4594 L3.1433,0.5189 C3.1433,0.384 3.1019,0.2627 3.0157,0.1747 C2.929,0.0862 2.8041,0.0416 2.6688,0.0416 Z M4.6422,0.5789 C4.7863,0.5789 4.9065,0.6366 5.023,0.7665 C5.1397,0.8968 5.1954,1.0359 5.1954,1.2018 L5.1954,2.302 C5.1954,2.4663 5.1424,2.6062 5.0257,2.7351 L5.0227,2.7351 C4.9079,2.8634 4.7879,2.92 4.642,2.92 C4.4959,2.92 4.3775,2.8636 4.2612,2.7351 C4.1458,2.6063 4.0922,2.4665 4.0922,2.302 L4.0922,1.2018 C4.0922,1.0375 4.1443,0.8997 4.2612,0.7693 L4.2642,0.7663 C4.3808,0.6349 4.4983,0.5787 4.6422,0.5787 Z M1.0844,0.3255 L0,1.4105 L0.7353,1.4105 L0.7353,4.4702 L0.069,4.4702 C-0.1252,4.4702 0.1383,4.6309 0.2766,4.7693 C0.4149,4.9076 0.5811,4.9762 0.7753,4.9762 L5.7196,4.9762 L5.7196,4.4702 L1.4341,4.4702 L1.4341,1.4105 L2.1694,1.4105 Z" fill="currentColor" strokeWidth="0.0088"/>
  </svg>
);

export const IconNotes = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="none" className={className}>
    <path d="M280,-280 L364,-280 L604,-518 L518,-604 L280,-366 L280,-280 Z M632,-546 L674,-590 Q680,-596 680,-604 Q680,-612 674,-618 L618,-674 Q612,-680 604,-680 Q596,-680 590,-674 L546,-632 L632,-546 Z M200,-120 Q167,-120 143.5,-143.5 Q120,-167 120,-200 L120,-760 Q120,-793 143.5,-816.5 Q167,-840 200,-840 L368,-840 Q381,-876 411.5,-898 Q442,-920 480,-920 Q518,-920 548.5,-898 Q579,-876 592,-840 L760,-840 Q793,-840 816.5,-816.5 Q840,-793 840,-760 L840,-200 Q840,-167 816.5,-143.5 Q793,-120 760,-120 L200,-120 Z M200,-200 L760,-200 L760,-760 L200,-760 L200,-200 Z M501.5,-798.5 Q510,-807 510,-820 Q510,-833 501.5,-841.5 Q493,-850 480,-850 Q467,-850 458.5,-841.5 Q450,-833 450,-820 Q450,-807 458.5,-798.5 Q467,-790 480,-790 Q493,-790 501.5,-798.5 Z M200,-200 L200,-760 L200,-200 Z" fill="currentColor"/>
  </svg>
);

// ── End Icons ──────────────────────────────────────────────────────────

// Icons inlined — see below React import

// ============================================================================
// TRANSLATIONS — add new languages by duplicating the 'en' block.
// Notation terms (ds, p, jp …) are universal and are NOT translated.
// ============================================================================
// Fallback language list used before translations.json is loaded (or if fetch fails).
// The canonical list lives in translations.json under "_languages".
const LANGUAGES_FALLBACK: Record<string, string> = {
  en: 'English',
};

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    // ── Startup / Disclaimer ────────────────────────────────────────────────
    disclaimerTitle: 'Test Version',
    disclaimerVersion: 'Version 1.1',
    disclaimerBody2: 'Expect bugs, incomplete features, and possible data loss.',
    disclaimerBody3: 'Use at your own risk.',
    disclaimerBody4: 'Thank you for testing and for any feedback you share!',
    disclaimerDontShow: "Don't show again for this version",
    disclaimerCopyright: '© 2026 Melinda Kiss',
    disclaimerContinue: 'I Understand – Continue',
    languagePickerLabel: 'Language / Nyelv',

    // ── Top toolbar – buttons ────────────────────────────────────────────────
    menuFile: 'File',
    menuFileTitle: 'File operations',
    menuArrange: 'Arrange',
    menuArrangeTitle: 'Arrange (Duplicate & Align)',
    menuOptions: 'Options',
    menuOptionsTitle: 'Options',
    menuHelp: 'Help & Quick Reference',
    renderSchematic: 'Schematic',
    renderRealistic: 'Realistic',
    renderToggleTitle: 'Toggle realistic stitch rendering (Press V)',
    btnUndo: 'Undo (Ctrl+Z)',
    btnRedo: 'Redo (Ctrl+Shift+Z)',
    btnCopy: 'Copy (Ctrl+C)',
    btnPaste: 'Paste (Ctrl+V)',
    btnFitAll: 'Fit All Elements (F)',

    // ── File menu ────────────────────────────────────────────────────────────
    fileNew: 'New',
    fileSave: 'Save Project',
    fileLoad: 'Load Project',
    fileExportSvg: 'Export SVG',
    fileExportSvgTitle: 'Export as SVG (can be converted to PNG with external tools)',
    fileOutputNotation: 'Output notation to clipboard',
    fileShowUnnumbered: 'Show Unnumbered',

    // ── Arrange menu ─────────────────────────────────────────────────────────
    arrangeDuplicate: 'Duplicate in Place',
    arrangeAlignHeader: 'Align (2+ elements)',
    arrangeAlignLeft: 'Align Left',
    arrangeAlignCenterH: 'Align Center H',
    arrangeAlignRight: 'Align Right',
    arrangeAlignTop: 'Align Top',
    arrangeAlignCenterV: 'Align Center V',
    arrangeAlignBottom: 'Align Bottom',

    // ── Options menu ─────────────────────────────────────────────────────────
    optionsBgColor: 'Background Color',
    optionsNotationSize: 'Notation Size',
    optionsSizeSmall: 'Small',
    optionsSizeMedium: 'Medium',
    optionsSizeLarge: 'Large',
    optionsGrid: 'Show Grid',
    optionsSnap: 'Snap to Grid',

    // ── Left toolbar ─────────────────────────────────────────────────────────
    toolOrthoLock: 'Ortho lock: constrain movement to X or Y axis (or hold Shift)',
    toolPathEdit: 'Path Edit Tool',
    toolPicotJoin: 'Joint Picot Tool – Select and connect joint picots',
    toolJoinPicots: 'Join selected joint picots',
    toolBreakPicots: 'Break connections for selected picots',
    toolAddRing: 'Add Ring',
    toolAddSplitRing: 'Add Split Ring',
    toolLineTool: 'Line Tool',
    toolAddChain: 'Add Chain',
    toolGroup: 'Group selected elements',
    toolUngroup: 'Ungroup selected elements',
    toolRefImage: 'Reference Image (controls in top bar)',
    toolNotes: 'Notes',

    // ── Notes drawer ─────────────────────────────────────────────────────────
    notesTitle: 'Pattern Notes',
    notesClose: 'Close notes',
    notesPlaceholder: 'Add pattern notes, instructions, thread colours used, difficulty level, etc...',
    notesFooter: 'Saves with project · Exports with SVG',

    // ── Save dialog ──────────────────────────────────────────────────────────
    saveDialogTitle: 'Save Project',
    saveDialogLabel: 'Project Name:',
    saveDialogPlaceholder: 'Enter project name',
    saveDialogCancel: 'Cancel',
    saveDialogSave: 'Save',

    // ── Color / gradient picker ───────────────────────────────────────────────
    colorPickerTab: 'Color Picker',
    colorSwatchesTab: 'Swatches',
    colorSearchPlaceholder: 'Search by ID or name...',
    gradientSearchPlaceholder: 'Search gradients by name or ID...',
    colorHexPlaceholder: '#FFFFFF',

    // ── Property bar labels ───────────────────────────────────────────────────
    propOrder: 'Order:',
    propShape: 'Shape:',
    propSqueeze: 'Squeeze:',
    propNotation: 'Notation:',
    propRotation: 'Rotation',
    propFlipH: 'Flip Horizontal (Vertical Mirror)',
    propFlipV: 'Flip Vertical (Horizontal Mirror)',
    propNotationPos: 'Toggle notation position: inside → on path → outside',
    propResetSqueeze: 'Reset squeeze and rotation to 0',
    propToggleShape: 'Toggle circle/teardrop',
    propUploadImage: 'Upload reference image',
    propToggleVisibility: 'Toggle visibility',
    propRemoveImage: 'Remove image',
    propRotateMinus90: 'Rotate -90°',
    propRotatePlus90: 'Rotate +90°',
    propRotateGroupMinus90: 'Rotate Group -90°',
    propRotateGroupPlus90: 'Rotate Group +90°',
    propFlipGroupH: 'Flip Group Horizontal',
    propFlipGroupV: 'Flip Group Vertical',

    // ── Help modal tabs ───────────────────────────────────────────────────────
    helpTabQuickstart: 'Quick Start',
    helpTabShortcuts: 'Shortcuts',
    helpTabNotation: 'Notation',
    helpTabTools: 'Tools',
    helpTabFeatures: 'Features',
    helpTabTips: 'Tips',
  },
};



const GRID_SIZE = 25;
const COLORS = [
  // Row 1 — dark shades
  '#000000', // Black
  '#999999', // Gray
  '#8B0000', // Dark Red
  '#228B22', // Dark Green
  '#ADD8E6', // Lt Blue
  '#FFAA33', // Orange
  '#702963', // Dark Violet
  // Row 2 — saturated / light
  '#FFFFFF', // White
  '#FFFCF4', // Cream
  '#D1001C', // Red
  '#93C572', // Pistachio
  '#0F52BA', // Royal Blue
  '#FFD700', // Topaz
  '#CF9FFF', // Violet
];
const BG_COLORS = ['#111827', '#4B5563', '#FFFFFF'];

// ============================================================================
// COLOR CATEGORIZATION - Pure function for performance
// ============================================================================
const categorizeColor = (color) => {
  // If the color has a group field (from JSON), use it directly for solid colors
  if (color.group && color.type !== 'gradient') return color.group;

  // For gradients, extract first color from stops
  let hex = color.hex;
  if (color.type === 'gradient' && !hex) {
    if (typeof color.stops === 'string') {
      const firstStop = color.stops.split(',')[0];
      hex = firstStop.split(':')[1];
    } else if (Array.isArray(color.stops) && color.stops.length > 0) {
      hex = color.stops[0].color;
    } else {
      return 'all'; // Fallback for malformed gradients
    }
  }
  
  if (!hex) return 'all';
  
  hex = hex.toLowerCase();
  const name = color.name.toLowerCase();
  
  // Convert hex to RGB for better categorization
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Neutrals: grays, whites, blacks, browns
  const isNeutral = (
    (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30) || // Grayscale
    name.includes('white') || name.includes('black') || name.includes('gray') || 
    name.includes('grey') || name.includes('tan') || name.includes('brown') ||
    name.includes('beige') || name.includes('ecru') || name.includes('driftwood')
  );
  
  if (isNeutral) return 'neutrals';
  
  // Find dominant color
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  // Check name keywords first
  if (name.includes('red') || name.includes('pink') || name.includes('coral') || 
      name.includes('rose') || name.includes('salmon')) return 'reds';
  if (name.includes('blue') || name.includes('aqua') || name.includes('navy')) return 'blues';
  if (name.includes('green') || name.includes('lime') || name.includes('emerald')) return 'greens';
  if (name.includes('yellow') || name.includes('gold') || name.includes('lemon')) return 'yellows';
  if (name.includes('purple') || name.includes('violet') || name.includes('lavender') || 
      name.includes('plum') || name.includes('mauve')) return 'purples';
  
  // RGB-based categorization
  if (r > g && r > b) {
    if (b > g * 0.7) return 'purples'; // Red + Blue = Purple
    return 'reds';
  }
  if (g > r && g > b) {
    if (r > b * 1.2) return 'yellows'; // Green + Red = Yellow
    return 'greens';
  }
  if (b > r && b > g) {
    if (r > g * 0.7) return 'purples'; // Blue + Red = Purple
    return 'blues';
  }
  
  return 'neutrals';
};

// ============================================================================
// REALISTIC RENDERING: DS STITCH SVG PATH
// ============================================================================
// Single DS (Double Stitch) path - HALF of the original (which had 2 DS)
// Centered at origin, facing right, ~0.4 units wide
const DS_STITCH_PATH = "M -0.211,0.05 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.0504 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.2103 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.0504 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m -0.0016,0.1628 c -0.0276,0 -0.0496,0.0223 -0.0496,0.0499 v 0.2103 c 0,0.0276 0.022,0.0499 0.0496,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m 0.163,0 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.2103 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.0504 c 0.0276,0 0.0496,-0.0223 0.0496,-0.0499 v -0.2103 c 0,-0.0276 -0.022,-0.0499 -0.0496,-0.0499 z";

// Single Stitch (SS) - half width of DS
const SS_STITCH_PATH = "M -0.0524,0.05 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.0504 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.0488 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.0504 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m -0.0016,0.1628 c -0.0276,0 -0.0496,0.0223 -0.0496,0.0499 v 0.2103 c 0,0.0276 0.022,0.0499 0.0496,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z";

// Reinforced Double Stitch (RDS) - double width of DS
const RDS_STITCH_PATH = "M -0.5434,0.05 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.0504 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.5733 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.0504 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m -0.0016,0.1628 c -0.0276,0 -0.0496,0.0223 -0.0496,0.0499 v 0.2103 c 0,0.0276 0.022,0.0499 0.0496,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m 0.1748,0 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.2103 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m 0.1748,0 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.2103 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z m 0.1748,0 c -0.0276,0 -0.0499,0.0223 -0.0499,0.0499 v 0.2103 c 0,0.0276 0.0223,0.0499 0.0499,0.0499 h 0.0504 c 0.0276,0 0.0499,-0.0223 0.0499,-0.0499 v -0.2103 c 0,-0.0276 -0.0223,-0.0499 -0.0499,-0.0499 z";

// Joint Picot (JP) - broken arc shape
const JP_PICOT_PATH = "m -0.0262,0 c -0.0519,0.0308 -0.0954,0.0729 -0.12747,0.11974 -0.0664,0.0969 -0.10206,0.21191 -0.12713,0.32246 -0.0477,0.15131 -0.0424,0.27131 -0.0424,0.27131 l 0.25011,0.002 c 0,0 0.0117,-0.0829 0.0362,-0.21859 0.0211,-0.0931 0.0535,-0.18089 0.0899,-0.23409 0,0 -0.0588,-0.27494 -0.0792,-0.26283 z m 0.29421,0.26289 c 0.0365,0.0532 0.0714,0.14041 0.0899,0.23409 0.0208,0.10524 0.0532,0.21859 0.0532,0.21859 l 0.2496,-0.002 c 0,0 -0.0307,-0.11839 -0.0589,-0.27131 -0.0251,-0.11055 -0.0603,-0.22559 -0.12661,-0.32246 -0.0273,-0.0399 -0.0633,-0.0765 -0.10586,-0.1055 -0.0286,-0.0195 -0.10133,0.24859 -0.10133,0.24859 z";

// ============================================================================
// WEDGE SHAPES - Bounding rectangles for each stitch type in normalized coords
// Derived by tracing the SVG sub-paths of DS/SS/RDS stitch symbols.
// Format: [x_left, x_right, y_outer, y_inner]
//   x: tangent direction (positive = forward along path)
//   y: perpendicular direction (positive = INWARD toward ring center)
//   Origin = stitch center point, already offset outward from ring by offsetAmount
//   Scale factor: 0.4 normalized units = 1 DS width
// ============================================================================
const WEDGE_SHAPES = {
  'ds': [
    [-0.2609,  0.0492,  0.0500, 0.2002],  // horizontal bar
    [-0.2622, -0.1123,  0.2128, 0.5229],  // left post
    [-0.0995,  0.0504,  0.2128, 0.5229],  // right post
  ],
  'ss': [
    [-0.1023,  0.0463,  0.0500, 0.2002],  // bar (half width of DS)
    [-0.1023,  0.0463,  0.2128, 0.5229],  // post (same width as bar)
  ],
  'rds': [
    [-0.5933,  0.0798,  0.0500, 0.2002],  // wide bar
    [-0.5946, -0.4447,  0.2128, 0.5229],  // post 1
    [-0.4198, -0.2699,  0.2128, 0.5229],  // post 2
    [-0.2450, -0.0951,  0.2128, 0.5229],  // post 3
    [-0.0705,  0.0794,  0.2128, 0.5229],  // post 4
  ],
};


const DEFAULT_THREAD_PRESET = {
  id: 'default',
  name: 'Pearl Cotton Size 10, Needle Tat',
  ds20Working: 285,   // mm — working thread per 20 DS
  ds20Core: 35,       // mm — core thread per 20 DS
  picotRegular: 8,    // mm
  picotJoined: 5,     // mm
  // Alternative inputs (null = not used)
  sample20DS10Regular: null,  // mm — 20DS + 10 regular picots total
  sample20DS10Short: null,    // mm — 20DS + 10 short picots total
};

// Load presets from localStorage or use default
const loadThreadPresets = () => {
  try {
    const saved = localStorage.getItem('tcad_thread_presets');
    if (saved) return JSON.parse(saved);
  } catch {}
  return [{ ...DEFAULT_THREAD_PRESET }];
};

const loadActivePresetId = () => {
  try { return localStorage.getItem('tcad_active_preset_id') || 'default'; } catch { return 'default'; }
};


const DEFAULT_MATERIALS = [
  { id: 'default', name: 'Default', color: '#FFFFFF', isGradient: false },
];

const ThreadPropertiesNumInput = ({ label, value, onChange = null, unit = 'mm', readOnly = false, hint = null }) => {
  const [localVal, setLocalVal] = React.useState(value?.toString() ?? '');
  React.useEffect(() => { setLocalVal(value?.toString() ?? ''); }, [value]);
  const commit = () => {
    if (!onChange || readOnly) return;
    const parsed = parseFloat(localVal);
    if (!isNaN(parsed)) onChange(parsed);
    else setLocalVal(value?.toString() ?? '');
  };
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-gray-300 text-xs">{label}</label>
        {hint && <span className="text-gray-500 text-xs italic">{hint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="decimal"
          value={localVal}
          readOnly={readOnly}
          onChange={e => { if (!readOnly) setLocalVal(e.target.value); }}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }}
          className={`w-20 px-2 py-1 rounded text-sm text-white border text-right ${readOnly ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-gray-600 border-gray-500'}`}
        />
        <span className="text-gray-400 text-xs">{unit}</span>
      </div>
    </div>
  );
};

const TattingDesigner = () => {
  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [camera, setCamera] = useState({ x: 960, y: 540 }); // Center of typical 1920x1080 viewport, looking at origin
  const [zoom, setZoom] = useState(1.8); // Default zoom 180%
  const [dsWidth, setDsWidth] = useState(10);
  // Bead Library — named beads for BE notation
  const DEFAULT_BEAD_LIBRARY = [
    { id: 'bead1', name: 'Small seed', size: 'Y', color: '#ef4444' },
    { id: 'bead2', name: 'Medium seed', size: 'Z', color: '#22c55e' },
    { id: 'bead3', name: 'Large seed', size: 'V', color: '#a855f7' },
  ];
  const [beadLibrary, setBeadLibrary] = useState(DEFAULT_BEAD_LIBRARY);
  const [selectedBEs, setSelectedBEs] = useState([]); // [{ elementId, picotId }] multi-select in beading mode

  const [beadSettings, setBeadSettings] = useState({
    Y: { dsMultiplier: 1.0, color: '#ef4444' },
    Z: { dsMultiplier: 1.5, color: '#22c55e' },
    V: { dsMultiplier: 2.0, color: '#a855f7' },
  });
  const [gridEnabled, setGridEnabled] = useState(true);
  const [loadMsg, setLoadMsg] = useState(null); // { type: 'success'|'error', text: string }
  const [currentTool, setCurrentTool] = useState('pan'); // 'pan' | 'select' | 'path' | 'line' | 'picotJoin' | 'beading' | 'image'
  const [bgColor, setBgColor] = useState('#1F2937');
  const [customColors, setCustomColors] = useState([]);
  const [referenceImage, setReferenceImage] = useState(null);
  const [refImageProps, setRefImageProps] = useState({ opacity: 0.5, rotation: 0, scale: 1, visible: true, x: 0, y: 0 });
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false); // Confirmation dialog for removing ref image
  const [notationError, setNotationError] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pickerCallback, setPickerCallback] = useState(null); // fn(color) called on OK for non-swatch uses
  const [pickerGradientCallback, setPickerGradientCallback] = useState(null); // fn(gradientId) called when gradient selected
  const [editingColorIndex, setEditingColorIndex] = useState(null);
  const [pickerColor, setPickerColor] = useState('#FFFFFF');
  const [clipboard, setClipboard] = useState([]); // NEW: for copy/paste
  const [projectName, setProjectName] = useState('Untitled Pattern'); // NEW: for save/load
  const [picotConnections, setPicotConnections] = useState([]); // NEW: joint picot connections
  const [selectedPicots, setSelectedPicots] = useState([]); // NEW: selected joint picots {elementId, picotId}
  const [showHelp, setShowHelp] = useState(false); // NEW: help modal
  // helpTab state removed — help content now lives in tatting-help.html (iframe)
  const [colorPickerTab, setColorPickerTab] = useState('picker'); // 'picker' | 'swatches'
  const [dmcColors, setDmcColors] = useState([]); // DMC color database
  const [selectedDmcColor, setSelectedDmcColor] = useState(null); // Currently selected DMC color for preview
  const [dmcSearchTerm, setDmcSearchTerm] = useState(''); // Search filter for DMC colors
  const [dmcPage, setDmcPage] = useState(0); // Current page for DMC colors
  const [dmcCategory, setDmcCategory] = useState('all'); // Current category filter
  const [snapEnabled, setSnapEnabled] = useState(true); // Toggle for snap to point

  // Canvas indicator theme — all user-visible indicator colors in one object.
  // Users can download this as theme.json, edit it, and reload via Options > Load Theme.
  const DEFAULT_THEME = {
    // Snap points
    snapOuter: '#FFA500',
    snapInner: '#FFA500',
    // Joint picots (jp)
    jpUnconnected: '#00CC44',
    jpConnected:   '#FFE600',
    jpSelected:    '#FF1493',
    // Path edit handles
    handleStart:    '#00FF00',
    handleControl1: '#0088FF',
    handleControl2: '#00DDFF',
    handleStroke:   '#000000',
    // Connection lines & midpoint dot
    connectionLine: '#FFE600',
    connectionDot:  '#FFE600',
    // Guide picot arm (jpg)
    jpgArm:         '#00FF00',
    jpgArmSelected: '#66FF66',
    // Guide point diamond (gp)
    gpDiamond:      '#ADFF2F',
  };
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [snapRadius, setSnapRadius] = useState(15); // Snap radius in SCREEN pixels — divided by zoom at use sites

  const [selectedGradient, setSelectedGradient] = useState(null); // Currently selected gradient for preview
  const [gradientSearchTerm, setGradientSearchTerm] = useState(''); // Search filter for gradients
  const [gradientCategory, setGradientCategory] = useState('all'); // Current category filter
  const [gradientPage, setGradientPage] = useState(0); // Gradient picker pagination
  const [isShiftHeld, setIsShiftHeld] = useState(false); // Track if Shift key is held for rotation handles
  const [showRotationHandles, setShowRotationHandles] = useState(false); // Manual toggle for rotation handles (mobile)
  const [showUnnumbered, setShowUnnumbered] = useState(false); // Toggle to highlight unnumbered elements
  const [touchState, setTouchState] = useState({ dist: 0, zoom: 1, centerX: 0, centerY: 0 }); // NEW: for pinch-to-zoom
  const [showSaveDialog, setShowSaveDialog] = useState(false); // NEW: save dialog modal
  const [showNewCanvasDialog, setShowNewCanvasDialog] = useState(false);
  const [showLoadConfirmDialog, setShowLoadConfirmDialog] = useState(false);
  const [showJoinTip, setShowJoinTip] = useState(() => localStorage.getItem('tcad_seen_join_tip') !== '1');
  const [saveDialogName, setSaveDialogName] = useState(''); // NEW: temp name in save dialog
  const APP_VERSION = '1.1';
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    // Show if user hasn't dismissed this exact version yet
    return localStorage.getItem('tcad_seen_version') !== APP_VERSION;
  });
  const [showFileMenu, setShowFileMenu] = useState(false); // NEW: file operations dropdown menu
  const [showArrangeMenu, setShowArrangeMenu] = useState(false); // Arrange menu (align/duplicate)
  const [groupRotationInput, setGroupRotationInput] = useState(''); // Temporary input for group rotation
  const [showOptionsMenu, setShowOptionsMenu] = useState(false); // Options menu
  const [showViewMenu, setShowViewMenu] = useState(false); // View menu

  // ============================================================================
  // REALISTIC RENDERING STATE
  // ============================================================================
  const [renderMode, setRenderMode] = useState('schematic'); // 'schematic' | 'realistic'
  const [orthoLock, setOrthoLock] = useState(false); // Constrain movement to X or Y axis
  const [notationFontSize, setNotationFontSize] = useState('medium'); // 'small' | 'medium' | 'large'
  const [uiScale, setUiScale] = useState('normal'); // 'normal' | 'large'
  const [patternNotes, setPatternNotes] = useState(''); // Pattern notes / instructions
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS); // Material groups (up to 10)
  const [showMaterialsPanel, setShowMaterialsPanel] = useState(false); // Materials manager popup
  const [showThreadProperties, setShowThreadProperties] = useState(false);
  const [threadPresets, setThreadPresets] = useState(() => loadThreadPresets());
  const [activePresetId, setActivePresetId] = useState(() => loadActivePresetId());
  const lastUsedMaterialIdRef = useRef('default');
  const [notesOpen, setNotesOpen] = useState(false); // Notes drawer open/closed

  // ── Localisation ────────────────────────────────────────────────────────────
  const [language, setLanguage] = useState<string>(() => {
    const saved = localStorage.getItem('tcad_language');
    if (saved && TRANSLATIONS[saved]) return saved;
    const nav = navigator.language?.split('-')[0] ?? 'en';
    return TRANSLATIONS[nav] ? nav : 'en';
  });
  // Extra translations loaded from translations.json (merged on top of hardcoded)
  const [extraTranslations, setExtraTranslations] = useState<Record<string, Record<string, string>>>({});
  // Available languages — populated from translations.json "_languages" key
  const [availableLanguages, setAvailableLanguages] = useState<Record<string, string>>(LANGUAGES_FALLBACK);

  const t = React.useCallback((key: string): string => {
    // Priority: external JSON translation → hardcoded translation → key itself
    return extraTranslations[language]?.[key]
      ?? TRANSLATIONS[language]?.[key]
      ?? extraTranslations['en']?.[key]
      ?? TRANSLATIONS.en[key]
      ?? key;
  }, [language, extraTranslations]);


  // Hardcoded realistic rendering parameters:
  // - stitchVerticalOffset: 0.125 (outer stitch edge aligned to path line)
  // - picotVerticalOffset: 20 (perpendicular offset from stitch)
  // - picotHorizontalOffset: 0.75 * dsWidth (backwards along path)

  // Undo/Redo state - now stores {elements, connections}
  const [history, setHistory] = useState([{ elements: [], connections: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);  // Current position in history
  const isUndoRedoRef = useRef(false);  // Flag to prevent adding history during undo/redo
  const historyRef = useRef([{ elements: [], connections: [] }]);  // Ref to current history
  const historyIndexRef = useRef(0);  // Ref to current index
  const isInteractingRef = useRef(false);  // Flag to prevent history during drag/rotate operations
  const rafIdRef = useRef(null);  // RAF ID for batching mouse moves
  const lastFrameTimeRef = useRef(0); // For 30fps cap on realistic rendering
  const dragOriginRef = useRef(null); // World position at drag start, for ortho axis lock
  const pendingMouseEventRef = useRef(null);  // Store latest mouse event for batching
  // Ref to always-current handleMouseMoveInternal — fixes stale RAF closure bug where
  // a queued RAF would call the version captured at queue time, missing updates from
  // re-renders triggered by setDragTick, zoom, or camera changes.
  const handleMouseMoveInternalRef = useRef(null);
  const needsHistoryPushRef = useRef(false);  // Flag to push history after interaction ends
  const pathDragStartRef = useRef(null);  // Store initial control points and position for smooth path editing

  // Keep history refs updated
  useEffect(() => {
    historyRef.current = history;
    historyIndexRef.current = historyIndex;
  }, [history, historyIndex]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const lastMousePosRef = useRef(null); // was state — now ref to avoid re-render on every move
  const [draggedElement, setDraggedElement] = useState(null);
  // PERFORMANCE: During element translate-drag, accumulate offset in a ref instead of
  // calling setElements every frame. SVG transform handles the visual update.
  // setElements is called once on mouseup. This keeps stitchCache/elementById valid all drag.
  const dragOffsetRef = useRef({ active: false, dx: 0, dy: 0 });
  const dragTouchIdRef = useRef(null); // identifier of the touch that started the drag
  const [dragTick, setDragTick] = useState(0); // lightweight render trigger during drag
  const [selectionBox, setSelectionBox] = useState(null);
  const [rotationHandle, setRotationHandle] = useState(null);  // NEW: for rotation
  const [pivotOffset, setPivotOffset] = useState({ x: 0, y: 0 }); // NEW: pivot offset from center
  const [movingPivot, setMovingPivot] = useState(false);       // NEW: dragging pivot point

  const canvasRef = useRef(null);
  const fileButtonRef = useRef(null); // For dropdown positioning
  const arrangeButtonRef = useRef(null); // For arrange dropdown positioning
  const optionsButtonRef = useRef(null); // For options dropdown positioning
  const viewButtonRef = useRef(null); // For view dropdown positioning
  const draggedHandleRef = useRef(null); // NEW: for path edit
  const fileInputRef = useRef(null);     // NEW: for reference image upload
  const loadInputRef = useRef(null);     // NEW: for loading project files
  const themeInputRef = useRef(null);    // for loading theme JSON files
  const elementsRef = useRef([]);        // NEW: for copy/paste
  const selectedIdsRef = useRef([]);     // NEW: for copy/paste

  // Keep refs updated
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  // Track history when elements or connections change
  useEffect(() => {
    if (isUndoRedoRef.current) {
      return; // Don't add during undo/redo
    }
    
    // Skip during interactive operations (drag, rotate, path edit)
    if (isInteractingRef.current) {
      needsHistoryPushRef.current = true; // Mark that we need to push after interaction ends
      return;
    }
    
    // Get current history state from refs
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;
    const currentState = currentHistory[currentIndex];
    
    // Check if the new state is different from current history state
    const newStateStr = JSON.stringify({ elements, connections: picotConnections });
    const oldStateStr = currentState ? JSON.stringify(currentState) : null;
    
    if (oldStateStr === newStateStr) {
      return; // No change, don't add to history
    }
    
    // Deep clone the state
    const cloned = {
      elements: JSON.parse(JSON.stringify(elements)),
      connections: JSON.parse(JSON.stringify(picotConnections))
    };
    
    // Remove any history after current index (user made new action after undo)
    const newHistory = currentHistory.slice(0, currentIndex + 1);
    
    // Add new state
    newHistory.push(cloned);
    
    console.log('History:', newHistory.length - 1, 'states');
    
    // Limit history to 50 states
    if (newHistory.length > 50) {
      newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    } else {
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [elements, picotConnections]); // Depend on both elements and connections

  // Auto-save to localStorage every 30 seconds
  // PERFORMANCE: Use refs to avoid recreating interval on every state change
  // Note: elementsRef and selectedIdsRef already declared above
  const cameraRef = useRef(camera);
  const zoomRef = useRef(zoom);
  const dsWidthRef = useRef(dsWidth);
  const bgColorRef = useRef(bgColor);
  const gridEnabledRef = useRef(gridEnabled);
  const customColorsRef = useRef(customColors);
  const referenceImageRef = useRef(referenceImage);
  const refImagePropsRef = useRef(refImageProps);
  const projectNameRef = useRef(projectName);
  const picotConnectionsRef = useRef(picotConnections);
  const renderModeRef = useRef(renderMode);
  const patternNotesRef = useRef(patternNotes);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  // PERFORMANCE: Persistent notation-parse cache. Keyed by notation string.
  // Survives stitchCache rebuilds (e.g. dsWidth change) — only re-parses when notation text changes.
  const stitchTypesCacheRef = useRef(new Map());
  // PERFORMANCE: Canvas pixel dimensions — updated by ResizeObserver.
  // Used for viewport culling without calling getBoundingClientRect() every frame.
  const canvasSizeRef = useRef({ width: 1920, height: 1080 });
  
  // Keep refs up to date
  useEffect(() => {
    elementsRef.current = elements;
    selectedIdsRef.current = selectedIds;
    cameraRef.current = camera;
    zoomRef.current = zoom;
    dsWidthRef.current = dsWidth;
    bgColorRef.current = bgColor;
    gridEnabledRef.current = gridEnabled;
    customColorsRef.current = customColors;
    referenceImageRef.current = referenceImage;
    refImagePropsRef.current = refImageProps;
    projectNameRef.current = projectName;
    picotConnectionsRef.current = picotConnections;
    renderModeRef.current = renderMode;
    patternNotesRef.current = patternNotes;
  });
  
  useEffect(() => {
    const autoSave = () => {
      if (elementsRef.current.length === 0) return; // Don't save empty projects
      
      const projectData = {
        version: 90,
        name: projectNameRef.current,
        autoSaved: new Date().toISOString(),
        elements: elementsRef.current,
        picotConnections: picotConnectionsRef.current,
        camera: cameraRef.current,
        zoom: zoomRef.current,
        dsWidth: dsWidthRef.current,
        bgColor: bgColorRef.current,
        gridEnabled: gridEnabledRef.current,
        customColors: customColorsRef.current,
        referenceImage: referenceImageRef.current,
        refImageProps: refImagePropsRef.current,
        renderMode: renderModeRef.current
      };
      
      try {
        localStorage.setItem('tatting-designer-autosave', JSON.stringify(projectData));
        console.log('Auto-saved to localStorage');
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    };
    
    // Save immediately on mount if there are elements
    autoSave();
    
    // Then save every 30 seconds - interval only created ONCE
    const interval = setInterval(autoSave, 180000);
    
    return () => clearInterval(interval);
  }, []); // Empty deps - only runs once on mount!

  // Load auto-saved project on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tatting-designer-autosave');
      if (saved) {
        const projectData = JSON.parse(saved);
        
        // Only auto-load if we have no elements yet
        if (elements.length === 0 && projectData.elements && projectData.elements.length > 0) {
          const shouldLoad = window.confirm(
            `Found auto-saved project "${projectData.name}" from ${new Date(projectData.autoSaved).toLocaleString()}. Load it?`
          );
          
          if (shouldLoad) {
            setElements(projectData.elements || []);
            setPicotConnections(projectData.picotConnections || []); // NEW: load connections
            setCamera(projectData.camera || { x: 960, y: 540 });
            setZoom(projectData.zoom || 1);
            setDsWidth(projectData.dsWidth || 10);
        if (projectData.beadLibrary) setBeadLibrary(projectData.beadLibrary);
            setBgColor(projectData.bgColor || '#1F2937');
            setGridEnabled(projectData.gridEnabled !== undefined ? projectData.gridEnabled : true);
            setCustomColors(projectData.customColors || []);
            setReferenceImage(projectData.referenceImage || null);
            setRefImageProps(projectData.refImageProps || { opacity: 0.5, rotation: 0, scale: 1, visible: true });
            setProjectName(projectData.name || 'Untitled Pattern');
            setRenderMode(projectData.renderMode || 'schematic'); // NEW: realistic rendering
            setPatternNotes(projectData.patternNotes || '');
            setHistory([{ elements: projectData.elements || [], connections: projectData.picotConnections || [] }]);
            setHistoryIndex(0);
            console.log('Auto-saved project loaded');
          }
        }
      }
    } catch (error) {
      console.error('Error loading auto-save:', error);
    }
  }, []);

  // Clear group rotation input when selection changes
  useEffect(() => {
    setGroupRotationInput('');
  }, [selectedIds]);

  // Prevent browser zoom (Ctrl+wheel on desktop, pinch on touchpad)
  useEffect(() => {
    const preventBrowserZoom = (e) => {
      // Prevent Ctrl+wheel zoom (desktop)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    
    // Add listener with passive: false so we can preventDefault
    document.addEventListener('wheel', preventBrowserZoom, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', preventBrowserZoom);
    };
  }, []);

  // PERFORMANCE: Track canvas size via ResizeObserver for viewport culling.
  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvasSizeRef.current = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };
      }
    });
    ro.observe(canvasRef.current);
    // Seed with initial size
    const rect = canvasRef.current.getBoundingClientRect();
    canvasSizeRef.current = { width: rect.width, height: rect.height };
    return () => ro.disconnect();
  }, []);

  // Load DMC colors on mount (from external JSON file with validation)
  useEffect(() => {
    const loadColors = async () => {
      try {
        // Try to load from external JSON file
        const response = await fetch('./dmc_colors.json');
        
        if (!response.ok) {
          throw new Error(`Failed to load colors file: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Validate JSON structure
        if (!data.solidColors || !Array.isArray(data.solidColors)) {
          throw new Error('Invalid color file format: missing solidColors array');
        }
        if (!data.gradients || !Array.isArray(data.gradients)) {
          throw new Error('Invalid color file format: missing gradients array');
        }
        
        // Validate each solid color has required fields
        data.solidColors.forEach((color, index) => {
          if (!color.id || !color.name || !color.hex) {
            throw new Error(`Invalid solid color at index ${index}: missing required fields (id, name, hex)`);
          }
          if (!/^#[0-9A-Fa-f]{6}$/.test(color.hex)) {
            throw new Error(`Invalid solid color hex at index ${index}: ${color.hex}`);
          }
        });
        
        // Validate and flatten gradients — supports flat array with 'group' field (current format)
        // and legacy grouped {threadLine, items[]} format for backwards compatibility
        let flatGradients = [];
        data.gradients.forEach((entry, index) => {
          if (Array.isArray(entry.items)) {
            // Legacy grouped format: { threadLine: "...", items: [...] }
            if (!entry.threadLine) throw new Error(`Gradient group at index ${index} missing threadLine`);
            entry.items.forEach((g, gi) => {
              if (!g.id || !g.name || !g.stops)
                throw new Error(`Invalid gradient in group "${entry.threadLine}" at item ${gi}: missing fields`);
              flatGradients.push({ ...g, type: 'gradient', group: g.group || entry.threadLine });
            });
          } else {
            // Current flat format: { id, name, type, group, stops }
            if (!entry.id || !entry.name || !entry.stops)
              throw new Error(`Invalid gradient at index ${index}: missing required fields (id, name, stops)`);
            flatGradients.push({ ...entry, type: 'gradient' });
          }
        });
        
        // Merge solid colors and gradients
        const allColors = [...data.solidColors, ...flatGradients];
        setDmcColors(allColors);
        const gradientGroups = [...new Set(flatGradients.map(g => g.group).filter(Boolean))];
        console.log(`✅ Loaded ${data.solidColors.length} solid colors + ${flatGradients.length} gradients [${gradientGroups.join(', ')}] from dmc_colors.json`);
        
      } catch (error) {
        console.error('❌ Error loading DMC colors from external file:', error);
        console.log('⚠️ Falling back to embedded sample colors');
        
        // Fallback to minimal embedded colors if external file fails
        const fallbackColors = [
          {"id":"Ecru","name":"Ecru/off-white","hex":"#FFF7E7","group":"Whites & Neutrals"},
          {"id":"Blanc","name":"White","hex":"#FCFCFF","group":"Whites & Neutrals"},
          {"id":"B5200","name":"Snow White","hex":"#FFFFFF","group":"Whites & Neutrals"},
          {"id":"310","name":"Black","hex":"#000000","group":"Whites & Neutrals"},
          {"id":"321","name":"Christmas Red","hex":"#C8011F","group":"Reds"},
          {"id":"666","name":"Christmas Red - Bright","hex":"#E0383B","group":"Reds"},
          {"id":"3713","name":"Salmon - Very Light","hex":"#FADAD1","group":"Pinks & Mauves"},
          {"id":"798","name":"Delft - Dark","hex":"#385E9B","group":"Blues"},
          {"id":"3843","name":"Electric Blue","hex":"#0AAEE0","group":"Blues"},
          {"id":"702","name":"Kelly Green","hex":"#21844E","group":"Greens"},
          {"id":"704","name":"Chartreuse - Bright","hex":"#A6C926","group":"Greens"},
          {"id":"726","name":"Topaz - Light","hex":"#F9D667","group":"Yellows & Golds"},
          {"id":"742","name":"Tangerine - Light","hex":"#FEB246","group":"Oranges & Rusts"},
          {"id":"208","name":"Lavender - Very Dark","hex":"#82558F","group":"Purples & Violets"},
          {"id":"553","name":"Violet","hex":"#894D80","group":"Purples & Violets"},
          {"id":"762","name":"Pearl Gray - Very Light","hex":"#E9E9E9","group":"Whites & Neutrals"},
          {"id":"414","name":"Steel Gray - Dark","hex":"#999999","group":"Whites & Neutrals"},
          {"id":"433","name":"Brown - Medium","hex":"#8A5638","group":"Browns & Tans"},
          {"id":"4010","name":"Winter Sky","type":"gradient","group":"Variations","stops":"0:#c4e9f3,55:#d2d2ca,100:#bab3db"},
          {"id":"4070","name":"Autumn Leaves","type":"gradient","group":"Variations","stops":"0:#ffd89f,67:#fbb098,77:#fea270,96:#fdd269"},
          {"id":"4200","name":"Wild Fire","type":"gradient","group":"Variations","stops":"0:#BE0F36,33:#CF1B34,65:#ED3245,72:#F12D3B,82:#F12228,93:#F41913,100:#F61408"},
          {"id":"93","name":"Blue Haze","type":"gradient","group":"Variegated","stops":"0:#B2C2E6,10:#9BACD8,22:#8190C7,29:#717FBC,41:#5866AD,99:#393280"},
          {"id":"106","name":"Coral","type":"gradient","group":"Variegated","stops":"0:#F50F02,8:#FB2D20,28:#FC7766,35:#FE9381,98:#FA9579"},
          {"id":"125","name":"Seafoam Green","type":"gradient","group":"Variegated","stops":"0:#106C43,13:#1F8A56,80:#76D790,99:#A5E6AE"}
        ];
        
        setDmcColors(fallbackColors);
        console.log('📦 Loaded', fallbackColors.length, 'fallback DMC colors (18 solid + 6 gradients) — place dmc_colors.json in public/ for full catalog');
      }
    };
    
    loadColors();
  }, []); // Only run on mount

  // Load external translations on mount (translations.json)
  // Merges into the hardcoded TRANSLATIONS — external file wins for any key it defines.
  // "_languages" key in the JSON drives the language picker list.
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const response = await fetch('./translations.json');
        if (!response.ok) return; // Silently skip — hardcoded en always works
        const data = await response.json();

        // Pull language list from _languages block
        if (data._languages && typeof data._languages === 'object') {
          setAvailableLanguages(data._languages);
          // If saved language is now valid, keep it; otherwise try navigator language
          setLanguage(prev => {
            if (data._languages[prev]) return prev;
            const saved = localStorage.getItem('tcad_language');
            if (saved && data._languages[saved]) return saved;
            const nav = navigator.language?.split('-')[0] ?? 'en';
            return data._languages[nav] ? nav : 'en';
          });
        }

        // Collect all language translation blocks (skip _meta, _languages, keys starting with _)
        const langs: Record<string, Record<string, string>> = {};
        for (const [code, block] of Object.entries(data)) {
          if (code.startsWith('_') || typeof block !== 'object' || Array.isArray(block)) continue;
          // Filter out _comment* keys within the block
          const filtered: Record<string, string> = {};
          for (const [k, v] of Object.entries(block as Record<string, string>)) {
            if (!k.startsWith('_') && typeof v === 'string') filtered[k] = v;
          }
          langs[code] = filtered;
        }
        if (Object.keys(langs).length > 0) {
          setExtraTranslations(langs);
          console.log(`🌐 Loaded translations for: ${Object.keys(langs).join(', ')}`);
        }
      } catch (err) {
        console.log('ℹ️ translations.json not found — using built-in English strings.');
      }
    };
    loadTranslations();
  }, []);

  // Load external theme on mount (tatting-theme.json, same folder as the app).
  // Any key present in the file overrides the default. Unknown keys are ignored.
  // Silently does nothing if the file isn't there.
  useEffect(() => {
    const loadExternalTheme = async () => {
      try {
        const response = await fetch('./tatting-theme.json');
        if (!response.ok) return;
        const data = await response.json();
        if (typeof data !== 'object' || Array.isArray(data)) return;
        setTheme(prev => {
          const merged = { ...prev };
          for (const key of Object.keys(DEFAULT_THEME)) {
            if (typeof data[key] === 'string') merged[key] = data[key];
          }
          return merged;
        });
        console.log('🎨 tatting-theme.json loaded.');
      } catch {
        // No theme file present — use defaults, no problem.
      }
    };
    loadExternalTheme();
  }, []);
  React.useEffect(() => {
    if (notesTextareaRef.current && notesTextareaRef.current !== document.activeElement) {
      notesTextareaRef.current.value = patternNotes;
    }
  }, [patternNotes]);

  // Track Shift key for rotation handles visibility
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift') {
        setIsShiftHeld(true);
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.key === 'Shift') {
        setIsShiftHeld(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
    // Reset pivot offset when selection changes
    setPivotOffset({ x: 0, y: 0 });
  }, [selectedIds]);

  const getViewportCenter = () => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    // Account for zoom when calculating world coordinates
    return { 
      x: (rect.width / 2 - camera.x) / zoom, 
      y: (rect.height / 2 - camera.y) / zoom 
    };
  };

  // Helper functions for path calculations
  const calculatePathLength = (points) => {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      length += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
    }
    return length;
  };

  const sampleBezierPath = (path, samples = 20) => {
    const points = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      let x, y;
      
      if (path.type === 'cubic') {
        // Cubic Bezier: (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
        x = (1-t)*(1-t)*(1-t)*path.x + 
            3*(1-t)*(1-t)*t*path.control1X + 
            3*(1-t)*t*t*path.control2X + 
            t*t*t*path.endX;
        y = (1-t)*(1-t)*(1-t)*path.y + 
            3*(1-t)*(1-t)*t*path.control1Y + 
            3*(1-t)*t*t*path.control2Y + 
            t*t*t*path.endY;
      } else {
        // Quadratic Bezier: (1-t)²P0 + 2(1-t)tP1 + t²P2
        x = (1-t)*(1-t)*path.x + 2*(1-t)*t*path.controlX + t*t*path.endX;
        y = (1-t)*(1-t)*path.y + 2*(1-t)*t*path.controlY + t*t*path.endY;
      }
      
      points.push({ x, y });
    }
    return points;
  };

  // ============================================================================
  // REALISTIC RENDERING: HELPER FUNCTIONS
  // ============================================================================

  // Interpolate between two hex colors
  const interpolateColor = (color1, color2, t) => {
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);
    
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Get color at specific position along a gradient
  const getGradientColorAtPosition = (gradientId, position) => {
    const gradient = dmcColors.find(c => c.id === gradientId);
    if (!gradient || !gradient.stops) return '#FFFFFF';
    
    let stops = [];
    if (typeof gradient.stops === 'string') {
      const parts = gradient.stops.split(',');
      stops = parts.map(part => {
        const [pos, color] = part.split(':');
        return { position: parseFloat(pos) / 100, color: color.trim() };
      });
    } else if (Array.isArray(gradient.stops)) {
      stops = gradient.stops;
    }
    
    if (stops.length === 0) return '#FFFFFF';
    if (stops.length === 1) return stops[0].color;
    
    position = Math.max(0, Math.min(1, position));
    
    let before = stops[0];
    let after = stops[stops.length - 1];
    
    for (let i = 0; i < stops.length - 1; i++) {
      if (position >= stops[i].position && position <= stops[i + 1].position) {
        before = stops[i];
        after = stops[i + 1];
        break;
      }
    }
    
    const range = after.position - before.position;
    const localT = range === 0 ? 0 : (position - before.position) / range;
    return interpolateColor(before.color, after.color, localT);
  };

  // Fast version: get point and angle using pre-sampled data (avoids redundant bezier resampling)
  const getPointAndAngleAtDistanceFast = (allSamples, pathLengths, targetDistance) => {
    let accumulatedDistance = 0;
    for (let pi = 0; pi < allSamples.length; pi++) {
      const samples = allSamples[pi];
      const pathLength = pathLengths[pi];
      if (accumulatedDistance + pathLength >= targetDistance) {
        const localDistance = targetDistance - accumulatedDistance;
        let currentDist = 0;
        for (let i = 1; i < samples.length; i++) {
          const dx = samples[i].x - samples[i-1].x;
          const dy = samples[i].y - samples[i-1].y;
          const segmentDist = Math.sqrt(dx*dx + dy*dy);
          if (currentDist + segmentDist >= localDistance) {
            const t = segmentDist > 0 ? (localDistance - currentDist) / segmentDist : 0;
            return { x: samples[i-1].x + dx*t, y: samples[i-1].y + dy*t, angle: Math.atan2(dy, dx) };
          }
          currentDist += segmentDist;
        }
      }
      accumulatedDistance += pathLength;
    }
    const last = allSamples[allSamples.length-1];
    const a = last[last.length-1], b = last[last.length-2];
    return { x: a.x, y: a.y, angle: Math.atan2(a.y - b.y, a.x - b.x) };
  };

  // Legacy wrapper (used by sampleClosedPathOffset and other one-off callers)
  const getPointAndAngleAtDistance = (paths, targetDistance) => {
    const allSamples = paths.map(p => sampleBezierPath(p, 50));
    const pathLengths = allSamples.map(s => calculatePathLength(s));
    return getPointAndAngleAtDistanceFast(allSamples, pathLengths, targetDistance);
  };

  // Sample the entire closed path as a smooth offset curve (for teardrops)
  // Returns an array of {x, y, distance} points tracing the offset curve
  const sampleClosedPathOffset = (paths, offset, samplesPerStitch) => {
    let totalLength = 0;
    for (const path of paths) {
      const samples = sampleBezierPath(path, 50);
      totalLength += calculatePathLength(samples);
    }
    
    const numSamples = samplesPerStitch; // Total samples for entire ring
    const points = [];
    
    for (let i = 0; i < numSamples; i++) {
      const dist = (i / numSamples) * totalLength;
      const { x, y, angle } = getPointAndAngleAtDistance(paths, dist);
      const perpAngle = angle - Math.PI / 2;
      points.push({
        x: x + Math.cos(perpAngle) * offset,
        y: y + Math.sin(perpAngle) * offset,
        distance: dist
      });
    }
    
    return points;
  };

  // Calculate stitch positions along paths (chains/teardrops)
  const calculatePathStitches = (element) => {
    if (!element || !element.paths || element.paths.length === 0) return [];
    
    const stitches = [];
    const stitchCount = element.stitchCount || 0;
    
    // Parse stitch types from notation
    const stitchTypeMap = getStitchTypes(element.notation || '');
    
    const renderPaths = element.paths;
    
    // Pre-sample each path ONCE - avoids re-sampling on every getPointAndAngle call
    const allSamples = renderPaths.map(p => sampleBezierPath(p, 50));
    const pathLengths = allSamples.map(s => calculatePathLength(s));
    const totalLength = pathLengths.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < stitchCount; i++) {
      const position = (i + 0.5) / stitchCount;
      const distance = position * totalLength;
      const { x, y, angle } = getPointAndAngleAtDistanceFast(allSamples, pathLengths, distance);
      
      const startDist = (i / stitchCount) * totalLength;
      const endDist = ((i + 1) / stitchCount) * totalLength;
      const { angle: startAngle, x: startX, y: startY } = getPointAndAngleAtDistanceFast(allSamples, pathLengths, startDist);
      const { angle: endAngle, x: endX, y: endY } = getPointAndAngleAtDistanceFast(allSamples, pathLengths, endDist);
      
      const _matEC = getElementColor(element);
      const color = _matEC.isGradient ? getGradientColorAtPosition(_matEC.id, position) : (_matEC.color || element.color);
      const type = stitchTypeMap[i] || 'ds';
      
      stitches.push({ x, y, angle, startAngle, endAngle, startX, startY, endX, endY, color, type });
    }
    
    // Return stitches + the pre-sampled path data so the render can reuse it
    // without calling sampleBezierPath again (totalPathLength IIFE in JSX)
    return { stitches, allSamples, pathLengths, totalLength };
  };

  // Calculate stitch positions for split rings (two separate paths)
  const calculateSplitRingStitches = (element) => {
    if (!element || !element.paths || element.paths.length < 2) return [];
    
    const stitches = [];
    const stitchCountA = element.splitPosition || Math.floor(element.stitchCount / 2);
    const stitchCountB = element.stitchCount - stitchCountA;
    
    const notationA = element.notation || 'sr: 5ds';
    const notationB = element.notationB ? `sr: ${element.notationB}` : 'sr: 5ds';
    const stitchTypeMapA = getStitchTypes(notationA);
    const stitchTypeMapB = getStitchTypes(notationB);
    
    // Pre-sample each path ONCE
    const pathA = element.paths[0];
    const samplesA = [sampleBezierPath(pathA, 50)];
    const lengthsA = [calculatePathLength(samplesA[0])];
    const lengthA = lengthsA[0];
    
    // Path A uses materialId, Path B uses materialIdB (fallback to materialId)
    const ecA = getElementColor({ ...element });
    const ecB = getElementColor({ ...element, materialId: element.materialIdB || element.materialId });

    for (let i = 0; i < stitchCountA; i++) {
      const distance = ((i + 0.5) / stitchCountA) * lengthA;
      const { x, y, angle } = getPointAndAngleAtDistanceFast(samplesA, lengthsA, distance);
      const { angle: startAngle, x: startX, y: startY } = getPointAndAngleAtDistanceFast(samplesA, lengthsA, (i / stitchCountA) * lengthA);
      const { angle: endAngle, x: endX, y: endY } = getPointAndAngleAtDistanceFast(samplesA, lengthsA, ((i + 1) / stitchCountA) * lengthA);
      const color = ecA.isGradient ? getGradientColorAtPosition(ecA.id, i / stitchCountA) : ecA.color;
      const type = stitchTypeMapA[i] || 'ds';
      stitches.push({ x, y, angle, startAngle, endAngle, startX, startY, endX, endY, color, type });
    }
    
    const pathB = element.paths[1];
    const samplesB = [sampleBezierPath(pathB, 50)];
    const lengthsB = [calculatePathLength(samplesB[0])];
    const lengthB = lengthsB[0];
    
    for (let i = 0; i < stitchCountB; i++) {
      const distance = ((i + 0.5) / stitchCountB) * lengthB;
      const { x, y, angle } = getPointAndAngleAtDistanceFast(samplesB, lengthsB, distance);
      const { angle: startAngle, x: startX, y: startY } = getPointAndAngleAtDistanceFast(samplesB, lengthsB, (i / stitchCountB) * lengthB);
      const { angle: endAngle, x: endX, y: endY } = getPointAndAngleAtDistanceFast(samplesB, lengthsB, ((i + 1) / stitchCountB) * lengthB);
      const color = ecB.isGradient ? getGradientColorAtPosition(ecB.id, i / stitchCountB) : ecB.color;
      const type = stitchTypeMapB[i] || 'ds';
      stitches.push({ x, y, angle, startAngle, endAngle, startX, startY, endX, endY, color, type });
    }
    
    return stitches;
  };

  // Calculate stitch positions for circular rings
  const calculateCircleStitches = (element) => {
    if (!element || element.shapeStyle !== 'circle') return [];
    
    const stitches = [];
    const stitchCount = element.stitchCount || 0;
    const targetCircumference = stitchCount * dsWidth;
    const radius = targetCircumference / (2 * Math.PI);
    const rotation = (element.rotation || 0) * Math.PI / 180;
    
    // Parse stitch types from notation
    const stitchTypeMap = getStitchTypes(element.notation || '');
    
    for (let i = 0; i < stitchCount; i++) {
      // Offset by half a stitch so first stitch is centered, not starting at edge
      const position = (i + 0.5) / stitchCount;
      const angle = position * Math.PI * 2 + rotation;
      const x = element.center.x + Math.cos(angle) * radius;
      const y = element.center.y + Math.sin(angle) * radius;
      const tangentAngle = angle + Math.PI / 2;
      
      let color;
      const ec = getElementColor(element);
      if (ec.isGradient) {
        color = getGradientColorAtPosition(ec.id, position);
      } else {
        color = ec.color;
      }
      
      // Get stitch type for this DS position - default to 'ds'
      // May be an array for SS (2 stitches per DS position)
      const type = stitchTypeMap[i] || 'ds';
      
      stitches.push({ x, y, angle: tangentAngle, centerPolarAngle: angle, color, type });
    }
    
    return stitches;
  };

  // Calculate scale factor for stitches
  const calculateStitchScale = () => {
    const normalizedWidth = 0.4; // Single DS width (half of the original 0.8)
    return dsWidth / normalizedWidth;
  };

  // Generate SVG transform for a stitch

  // ============================================================================
  // WEDGE STITCH RENDERING
  // Trapezoid shapes that conform to path curvature, filling gaps between stitches.
  // ============================================================================

  // Render a DS/SS/RDS stitch as trapezoid paths for circular rings.
  // Works in world coordinates using exact polar geometry — perfect radial edges.
  // Returns an array of SVG "d" path strings (one per sub-shape: bar + posts).
  const renderWedgeRingShapes = (stitch, el, scale, offsetAmount, stitchType) => {
    const shapes = WEDGE_SHAPES[stitchType] || WEDGE_SHAPES['ds'];
    const cx = el.center.x;
    const cy = el.center.y;
    const r = el.stitchCount * dsWidth / (2 * Math.PI);
    const baseRadius = r + offsetAmount;

    // centerPolarAngle is the polar angle of this stitch's midpoint from ring center
    const centerPolarAngle = stitch.centerPolarAngle;

    // Angular half-span for one full stitch
    const halfArc = Math.PI / el.stitchCount; // = (2π/N) / 2

    // The WEDGE_SHAPES x-extents of the DS/SS/RDS base symbol
    // These are the leftmost and rightmost x coords across ALL rects for this type
    const STITCH_X_EXTENTS = {
      'ds':  { xMin: -0.2622, xMax:  0.0504 },
      'ss':  { xMin: -0.1036, xMax:  0.0463 },
      'rds': { xMin: -0.5946, xMax:  0.0798 },
    };
    const ext = STITCH_X_EXTENTS[stitchType] || STITCH_X_EXTENTS['ds'];
    const xSpan = ext.xMax - ext.xMin;     // full symbol width in normalized units
    const alphaStart = centerPolarAngle - halfArc;  // left edge of this stitch's arc
    const alphaEnd   = centerPolarAngle + halfArc;  // right edge

    return shapes.map(([xl, xr, yo, yi]) => {
      // Convert symbol y to radial distances from ring center.
      // Positive y in symbol = inward = SUBTRACT from baseRadius.
      const d_outer = baseRadius - yo * scale;
      const d_inner = baseRadius - yi * scale;

      // Map symbol x linearly onto the stitch's full angular span.
      // xl=ext.xMin → alphaStart, xr=ext.xMax → alphaEnd
      const tLeft  = (xl - ext.xMin) / xSpan;
      const tRight = (xr - ext.xMin) / xSpan;
      const a_left  = alphaStart + tLeft  * (alphaEnd - alphaStart);
      const a_right = alphaStart + tRight * (alphaEnd - alphaStart);

      // Four trapezoid corners in world coordinates
      const p1x = cx + d_outer * Math.cos(a_left);
      const p1y = cy + d_outer * Math.sin(a_left);
      const p2x = cx + d_outer * Math.cos(a_right);
      const p2y = cy + d_outer * Math.sin(a_right);
      const p3x = cx + d_inner * Math.cos(a_right);
      const p3y = cy + d_inner * Math.sin(a_right);
      const p4x = cx + d_inner * Math.cos(a_left);
      const p4y = cy + d_inner * Math.sin(a_left);

      return `M ${p1x},${p1y} L ${p2x},${p2y} L ${p3x},${p3y} L ${p4x},${p4y} Z`;
    });
  };

  // Wedge trapezoid rendering for CLOSED non-circle paths (teardrops, squeezed rings).
  // SMOOTH OUTER CURVE PRIORITY: Uses a pre-sampled continuous offset curve for the outer edge,
  // then bridges to polar-computed inner edge. Accepts slight distortion of hidden inner parts
  // to achieve smooth visible appearance.
  // Sample a segment of the path between startDist and endDist with offset perpendicular
  // Sample entire path with perpendicular offset, returning array of points
  const sampleFullPathWithOffset = (paths, offset, totalSamples) => {
    let totalLength = 0;
    for (const path of paths) {
      const samples = sampleBezierPath(path, 50);
      totalLength += calculatePathLength(samples);
    }

    const points = [];
    for (let i = 0; i <= totalSamples; i++) {
      const dist = (i / totalSamples) * totalLength;
      const { x, y, angle } = getPointAndAngleAtDistance(paths, dist);
      const perpAngle = angle - Math.PI / 2;
      points.push({
        x: x + Math.cos(perpAngle) * offset,
        y: y + Math.sin(perpAngle) * offset
      });
    }
    
    return points;
  };

  // Render closed path stitches using TWO parallel offset curves
  // Clean approach: sample full outer + inner curves, slice by stitch count
  const renderWedgeTeardropShapes = (stitch, el, scale, offsetAmount, stitchType, stitchIndex, subStitchCount = 1) => {
    const shapes = WEDGE_SHAPES[stitchType] || WEDGE_SHAPES['ds'];
    const stitchCount = el.stitchCount; // DS-equivalent count
    const samplesPerDS = 10; // Samples for one DS stitch
    const totalSamples = stitchCount * samplesPerDS;

    // DS-equivalent width for each stitch type (SS is half of DS)
    const dsEquivalentWidth = {
      'ds': 1.0,
      'ss': 0.5,
      'rds': 2.0
    };
    const stitchWidth = dsEquivalentWidth[stitchType] || 1.0;
    const samplesForThisStitch = samplesPerDS * stitchWidth;

    // Find the full horizontal span of this stitch type
    const STITCH_X_EXTENTS = {
      'ds':  { xMin: -0.2622, xMax:  0.0504 },
      'ss':  { xMin: -0.1023, xMax:  0.0463 },
      'rds': { xMin: -0.5946, xMax:  0.0798 },
    };
    const ext = STITCH_X_EXTENTS[stitchType] || STITCH_X_EXTENTS['ds'];
    const xSpan = ext.xMax - ext.xMin;

    return shapes.map(([xl, xr, yo, yi]) => {
      // Sample TWO parallel curves at this rectangle's outer and inner radii
      const outerOffset = offsetAmount - yo * scale;
      const innerOffset = offsetAmount - yi * scale;
      
      const outerCurve = sampleFullPathWithOffset(el.paths, outerOffset, totalSamples);
      const innerCurve = sampleFullPathWithOffset(el.paths, innerOffset, totalSamples);

      // Map this rectangle's horizontal position to slice indices
      const tLeft  = (xl - ext.xMin) / xSpan;
      const tRight = (xr - ext.xMin) / xSpan;

      // Calculate the start position in DS-equivalent units
      // For SS at effectiveIndex 5.5: baseIndex=5, fraction=0.5, so dsStart = 5.5
      const baseIndex = Math.floor(stitchIndex);
      const fraction = stitchIndex - baseIndex;
      
      const dsStart = baseIndex + fraction;  // fraction is already the DS offset
      const stitchSliceStart = dsStart * samplesPerDS;
      
      const rectStart = Math.round(stitchSliceStart + tLeft * samplesForThisStitch);
      const rectEnd = Math.round(stitchSliceStart + tRight * samplesForThisStitch);
      
      const outerSlice = outerCurve.slice(rectStart, rectEnd + 1);
      const innerSlice = innerCurve.slice(rectStart, rectEnd + 1);

      // Build closed path: outer curve forward, inner curve backward
      let pathD = `M ${outerSlice[0].x},${outerSlice[0].y}`;
      for (let j = 1; j < outerSlice.length; j++) {
        pathD += ` L ${outerSlice[j].x},${outerSlice[j].y}`;
      }
      pathD += ` L ${innerSlice[innerSlice.length - 1].x},${innerSlice[innerSlice.length - 1].y}`;
      for (let j = innerSlice.length - 2; j >= 0; j--) {
        pathD += ` L ${innerSlice[j].x},${innerSlice[j].y}`;
      }
      pathD += ` Z`;

      return pathD;
    });
  };

  // Render chain stitches using TWO parallel offset curves (same as teardrops but without center reference)
  const renderWedgeChainShapes = (stitch, el, scale, offsetAmount, stitchType, stitchIndex) => {
    const shapes = WEDGE_SHAPES[stitchType] || WEDGE_SHAPES['ds'];
    const stitchCount = el.stitchCount; // DS-equivalent count
    const samplesPerDS = 10;
    const totalSamples = stitchCount * samplesPerDS;

    // DS-equivalent width for each stitch type
    const dsEquivalentWidth = {
      'ds': 1.0,
      'ss': 0.5,
      'rds': 2.0
    };
    const stitchWidth = dsEquivalentWidth[stitchType] || 1.0;
    const samplesForThisStitch = samplesPerDS * stitchWidth;

    const STITCH_X_EXTENTS = {
      'ds':  { xMin: -0.2622, xMax:  0.0504 },
      'ss':  { xMin: -0.1023, xMax:  0.0463 },
      'rds': { xMin: -0.5946, xMax:  0.0798 },
    };
    const ext = STITCH_X_EXTENTS[stitchType] || STITCH_X_EXTENTS['ds'];
    const xSpan = ext.xMax - ext.xMin;

    return shapes.map(([xl, xr, yo, yi]) => {
      const outerOffset = offsetAmount - yo * scale;
      const innerOffset = offsetAmount - yi * scale;
      
      const outerCurve = sampleFullPathWithOffset(el.paths, outerOffset, totalSamples);
      const innerCurve = sampleFullPathWithOffset(el.paths, innerOffset, totalSamples);

      const tLeft  = (xl - ext.xMin) / xSpan;
      const tRight = (xr - ext.xMin) / xSpan;

      // Calculate position in DS-equivalent units
      // fraction is already the offset within the DS unit
      const baseIndex = Math.floor(stitchIndex);
      const fraction = stitchIndex - baseIndex;
      const dsStart = baseIndex + fraction;
      const stitchSliceStart = dsStart * samplesPerDS;
      
      const rectStart = Math.round(stitchSliceStart + tLeft * samplesForThisStitch);
      const rectEnd = Math.round(stitchSliceStart + tRight * samplesForThisStitch);
      
      const outerSlice = outerCurve.slice(rectStart, rectEnd + 1);
      const innerSlice = innerCurve.slice(rectStart, rectEnd + 1);

      let pathD = `M ${outerSlice[0].x},${outerSlice[0].y}`;
      for (let j = 1; j < outerSlice.length; j++) {
        pathD += ` L ${outerSlice[j].x},${outerSlice[j].y}`;
      }
      pathD += ` L ${innerSlice[innerSlice.length - 1].x},${innerSlice[innerSlice.length - 1].y}`;
      for (let j = innerSlice.length - 2; j >= 0; j--) {
        pathD += ` L ${innerSlice[j].x},${innerSlice[j].y}`;
      }
      pathD += ` Z`;

      return pathD;
    });
  };

  // Build a skew-corrected SVG matrix transform for chain/teardrop stitches.
  // Uses the tangent angle change across the stitch to shear the symbol
  // into a parallelogram that closes gaps on curved paths.
  const getWedgePathTransform = (stitch, offsetX, offsetY, scale) => {
    const sA = stitch.startAngle ?? stitch.angle;
    const eA = stitch.endAngle   ?? stitch.angle;
    const midAngle = (sA + eA) * 0.5;
    const phi      = (eA - sA) * 0.5; // half-skew angle
    const cosTh    = Math.cos(midAngle);
    const sinTh    = Math.sin(midAngle);
    const tanPhi   = Math.tan(phi);
    // matrix(a,b,c,d,e,f) = rotate(midAngle) * skewX(phi) * scale
    const a = scale * cosTh;
    const b = scale * sinTh;
    const c = scale * (cosTh * tanPhi - sinTh);
    const d = scale * (sinTh * tanPhi + cosTh);
    return `matrix(${a},${b},${c},${d},${offsetX},${offsetY})`;
  };


  const createCirclePath = (cx, cy, targetLength, squeeze = 0) => {
    const radius = targetLength / (2 * Math.PI);
    
    // Apply squeeze: positive = taller/narrower, negative = wider/shorter
    const widthFactor = 1 - squeeze;
    const heightFactor = 1 + squeeze;
    
    const radiusX = radius * widthFactor;
    const radiusY = radius * heightFactor;
    
    return {
      isClosed: true,
      shapeStyle: 'circle',
      paths: [
        {
          type: 'quadratic',
          x: cx + radiusX,
          y: cy,
          controlX: cx + radiusX,
          controlY: cy - radiusY * 1.5,
          endX: cx - radiusX,
          endY: cy
        },
        {
          type: 'quadratic',
          x: cx - radiusX,
          y: cy,
          controlX: cx - radiusX,
          controlY: cy + radiusY * 1.5,
          endX: cx + radiusX,
          endY: cy
        }
      ]
    };
  };

  // Create a teardrop path - based on user-provided SVG shape
  const createTeardropPath = (cx, cy, targetLength, squeeze = 0) => {
    // The SVG shape with heightRatio=2.4 and widthRatio=1.6 has an actual
    // circumference that's about 2x the simple calculation, so we need to scale down
    const scale = (targetLength / 3) * 0.495; // Correction factor based on actual path length
    
    // Proportions from the SVG (these stay constant)
    const heightRatio = 2.4;
    const widthRatio = 1.6;
    
    // Apply squeeze: positive = taller/narrower, negative = wider/shorter
    const widthFactor = 1 - squeeze;
    const heightFactor = 1 + squeeze;
    
    const height = scale * heightRatio * heightFactor;
    const width = scale * widthRatio * widthFactor;
    
    const tipY = cy - height / 2;
    const bottomY = cy + height / 2;
    const bulgeY = cy + height * 0.15; // Bulge slightly below center
    
    return {
      isClosed: true,
      shapeStyle: 'teardrop',
      paths: [
        // Tip to right bulge - smooth outward curve
        {
          type: 'cubic',
          x: cx,
          y: tipY,
          control1X: cx + width * 0.3,
          control1Y: tipY + height * 0.15,
          control2X: cx + width * 0.5,
          control2Y: bulgeY - height * 0.1,
          endX: cx + width / 2,
          endY: bulgeY
        },
        // Right bulge to bottom - curve inward
        {
          type: 'cubic',
          x: cx + width / 2,
          y: bulgeY,
          control1X: cx + width * 0.45,
          control1Y: bulgeY + height * 0.25,
          control2X: cx + width * 0.2,
          control2Y: bottomY - height * 0.05,
          endX: cx,
          endY: bottomY
        },
        // Bottom to left bulge - curve inward (mirror)
        {
          type: 'cubic',
          x: cx,
          y: bottomY,
          control1X: cx - width * 0.2,
          control1Y: bottomY - height * 0.05,
          control2X: cx - width * 0.45,
          control2Y: bulgeY + height * 0.25,
          endX: cx - width / 2,
          endY: bulgeY
        },
        // Left bulge to tip - smooth curve (mirror)
        {
          type: 'cubic',
          x: cx - width / 2,
          y: bulgeY,
          control1X: cx - width * 0.5,
          control1Y: bulgeY - height * 0.1,
          control2X: cx - width * 0.3,
          control2Y: tipY + height * 0.15,
          endX: cx,
          endY: tipY
        }
      ]
    };
  };

  // Helper: apply element's current rotation to newly-generated path data
  const applyRotationToPathData = (el, newPathData) => {
    if (!el.rotation || el.rotation === 0) return { ...el, ...newPathData };
    const rad = el.rotation * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const cx = el.center.x, cy = el.center.y;
    const rotatePt = (px, py) => {
      const dx = px - cx, dy = py - cy;
      return { x: cx + dx*cos - dy*sin, y: cy + dx*sin + dy*cos };
    };
    newPathData.paths = newPathData.paths.map(path => {
      if (path.type === 'cubic') {
        const s = rotatePt(path.x, path.y);
        const e = rotatePt(path.endX, path.endY);
        const c1 = rotatePt(path.control1X, path.control1Y);
        const c2 = rotatePt(path.control2X, path.control2Y);
        return { ...path, x:s.x, y:s.y, endX:e.x, endY:e.y, control1X:c1.x, control1Y:c1.y, control2X:c2.x, control2Y:c2.y };
      }
      const s = rotatePt(path.x, path.y);
      const e = rotatePt(path.endX, path.endY);
      const c = rotatePt(path.controlX, path.controlY);
      return { ...path, x:s.x, y:s.y, endX:e.x, endY:e.y, controlX:c.x, controlY:c.y };
    });
    return { ...el, ...newPathData };
  };

  // ── Split ring geometry: 3 controls ──────────────────────────────────────────
  // hFrac    : 0=tallest the C shapes allow, 1=fully squashed (like pinching)
  // squeezeCA: C-shape for section A (0=almond, 0.75=default natural, 3=deep C)
  // squeezeCB: C-shape for section B (same scale)
  // Height ceiling = min(maxH_A, maxH_B) — tightest arc constraint wins.
  const splitRingMeasure = (h: number, bulge: number, c: number): number => {
    const half = h / 2;
    const x0=0, y0=half, cx1=-bulge, cy1=half*c, cx2=-bulge, cy2=-half*c, x1=0, y1=-half;
    let len=0, px=x0, py=y0;
    for(let i=1;i<=60;i++){
      const t=i/60, u=1-t;
      const nx=u*u*u*x0+3*u*u*t*cx1+3*u*t*t*cx2+t*t*t*x1;
      const ny=u*u*u*y0+3*u*u*t*cy1+3*u*t*t*cy2+t*t*t*y1;
      len+=Math.hypot(nx-px,ny-py); px=nx; py=ny;
    }
    return len;
  };

  const splitRingMaxH = (arc: number, c: number): number => {
    if(c <= 0) return arc * 0.95;
    let lo=0, hi=arc;
    while(splitRingMeasure(hi, 0, c) <= arc && hi < arc*10) hi *= 1.5;
    for(let i=0;i<24;i++){
      const mid=(lo+hi)/2;
      if(splitRingMeasure(mid, 0, c) <= arc) lo=mid; else hi=mid;
    }
    return lo;
  };

  const splitRingSolveBulge = (h: number, c: number, target: number): number => {
    if(splitRingMeasure(h, 0, c) >= target) return 0;
    let lo=0, hi=target*4;
    while(splitRingMeasure(h, hi, c) < target) hi*=2;
    for(let i=0;i<22;i++){
      const mid=(lo+hi)/2;
      if(splitRingMeasure(h, mid, c) < target) lo=mid; else hi=mid;
    }
    return (lo+hi)/2;
  };

  const createSplitRingPath = (cx: number, cy: number, totalLength: number, stitchCountA: number, stitchCountB: number, hFrac = 0, squeezeCA = 0.75, squeezeCB = 0.75) => {
    const arcA = stitchCountA * dsWidth;
    const arcB = stitchCountB * dsWidth;
    const hA = splitRingMaxH(arcA, squeezeCA);
    const hB = splitRingMaxH(arcB, squeezeCB);
    const hMax = Math.min(hA, hB);
    const hMin = hMax * 0.15;
    const h = hMax - (hMax - hMin) * hFrac;
    const topY = cy - h/2;
    const botY = cy + h/2;
    const bulgeA = splitRingSolveBulge(h, squeezeCA, arcA);
    const bulgeB = splitRingSolveBulge(h, squeezeCB, arcB);
    // Path A: (cx,botY)→(cx,topY), bulges LEFT
    const c1yA = cy + (h/2)*squeezeCA;
    const c2yA = cy - (h/2)*squeezeCA;
    // Path B: (cx,topY)→(cx,botY), bulges RIGHT — mirror
    const c1yB = cy - (h/2)*squeezeCB;
    const c2yB = cy + (h/2)*squeezeCB;
    return {
      isClosed: true,
      shapeStyle: 'split-ring',
      paths: [
        { type: 'cubic', x: cx, y: botY, control1X: cx-bulgeA, control1Y: c1yA, control2X: cx-bulgeA, control2Y: c2yA, endX: cx, endY: topY },
        { type: 'cubic', x: cx, y: topY, control1X: cx+bulgeB, control1Y: c1yB, control2X: cx+bulgeB, control2Y: c2yB, endX: cx, endY: botY },
      ],
      splitPosition: stitchCountA,
    };
  };

  const parseNotation = (notation) => {
    try {
      setNotationError(null);
      const match = notation.match(/^(r|c|sr|jk|fr):\s*(.+)$/i);
      if (!match) {
        setNotationError('Invalid format');
        return null;
      }

      const type = match[1].toLowerCase();
      const pattern = match[2];
      let totalDS = 0;
      const picots = [];

      const parts = [];
      let current = '';
      let depth = 0;

      for (let char of pattern) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        // Accept both "-" and "." as separators
        if ((char === '-' || char === '.') && depth === 0) {
          if (current.trim()) parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) parts.push(current.trim());

      const processToken = (token, pos) => {
        const repeatMatch = token.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
        if (repeatMatch) {
          const count = parseInt(repeatMatch[1] || repeatMatch[4]);
          const innerPattern = repeatMatch[2] || repeatMatch[3];
          // Accept both "-" and "." as separators
          const innerParts = innerPattern.split(/[-.]/).map(s => s.trim());
          for (let i = 0; i < count; i++) {
            for (let part of innerParts) {
              pos = processToken(part, pos);
            }
          }
          return pos;
        }

        // Handle BE — Bead Element marker: 1 DS, configured visually in Beading mode
        if (token.match(/^be$/i)) {
          picots.push({
            id: Date.now() + Math.random(),
            stitchesBefore: pos,
            length: 'medium',
            isJoint: false,
            isGuide: false,
            beadType: 'be',
            beStructure: 'core',           // 'core'|'core+picot'|'core+beaded'|'suspended'|'beaded'|'joint'|'joint+beaded'
            beIsJoint: false,
            coreBeads: [null, null, null], // up to 3 bead library IDs
            picotBeads: [null, null, null],
          });
          return pos + 1;
        }

        // Handle bjp:SEQ beaded joint picot notation (e.g. bjp:Y, bjp:3Y)
        const beadedJointPicotMatch = token.match(/^bjp:([YZVyzv0-9]+)$/i);
        if (beadedJointPicotMatch) {
          const beadSeq = beadedJointPicotMatch[1].toUpperCase();
          picots.push({
            id: Date.now() + Math.random(),
            stitchesBefore: pos,
            length: 'medium',
            isJoint: true,
            isGuide: false,
            beadType: 'bjp',
            beadSeq: beadSeq,
          });
          return pos;
        }

        // Handle bp:SEQ beaded picot notation (e.g. bp:YZY, bp:2V)
        const beadedPicotMatch = token.match(/^bp:([YZVyzv0-9]+)$/i);
        if (beadedPicotMatch) {
          const beadSeq = beadedPicotMatch[1].toUpperCase();
          picots.push({
            id: Date.now() + Math.random(),
            stitchesBefore: pos,
            length: 'medium',
            isJoint: false,
            isGuide: false,
            beadType: 'bp',
            beadSeq: beadSeq,
          });
          return pos;
        }

        // Handle sb:SEQ suspended bead notation (e.g. sb:3Y, sb:YZY)
        // Zero DS — perpendicular spike off path, adds no path length
        const suspendedBeadMatch = token.match(/^sb:([YZVyzv0-9]+)$/i);
        if (suspendedBeadMatch) {
          const beadSeq = suspendedBeadMatch[1].toUpperCase();
          picots.push({
            id: Date.now() + Math.random(),
            stitchesBefore: pos,
            length: 'medium',
            isJoint: false,
            isGuide: false,
            beadType: 'sb',
            beadSeq: beadSeq,
          });
          return pos;
        }

        // Handle bcp:CORE — core bead (1ds) + plain unbeaded picot arm
        const bcpPlainMatch = token.match(/^bcp:([YZVyzv])$/i);
        if (bcpPlainMatch) {
          picots.push({
            id: Date.now() + Math.random(),
            stitchesBefore: pos,
            length: 'medium',
            isJoint: false,
            isGuide: false,
            beadType: 'bcp',
            coreSize: bcpPlainMatch[1].toUpperCase(),
            beadSeq: null,            // null = plain picot, no bead cluster
          });
          return pos + 1;
        }

        // Handle bcp:CORE:SEQ — one core bead (1ds) with picot beads branching from top
        const bcpMatch = token.match(/^bcp:([YZVyzv]):([YZVyzv0-9]+)$/i);
        if (bcpMatch) {
          const coreSize = bcpMatch[1].toUpperCase();
          const beadSeq = bcpMatch[2].toUpperCase();
          picots.push({
            id: Date.now() + Math.random(),
            stitchesBefore: pos,
            length: 'medium',
            isJoint: false,
            isGuide: false,
            beadType: 'bcp',
            coreSize: coreSize,
            beadSeq: beadSeq,
          });
          return pos + 1; // 1ds added to path like bc:
        }

        // Handle bc:SEQ core bead notation (e.g. bc:3Y, bc:YZY)
        // Each bead adds 1ds to path length — one picot entry per bead
        const coreBeadMatch = token.match(/^bc:([YZVyzv0-9]+)$/i);
        if (coreBeadMatch) {
          const rawSeq = coreBeadMatch[1].toUpperCase();
          // Expand sequence: "3Y" → ["Y","Y","Y"], "YZY" → ["Y","Z","Y"]
          const expandSeq = (seq) => {
            const out = [];
            let i = 0;
            while (i < seq.length) {
              let count = 1;
              if (/\d/.test(seq[i])) { count = parseInt(seq[i]); i++; }
              if (i < seq.length && /[YZV]/i.test(seq[i])) {
                for (let j = 0; j < count; j++) out.push(seq[i].toUpperCase());
                i++;
              } else { i++; }
            }
            return out;
          };
          const beads = expandSeq(rawSeq);
          beads.forEach((size, idx) => {
            picots.push({
              id: Date.now() + Math.random() + idx,
              stitchesBefore: pos + idx,      // each bead at its own DS position
              length: 'medium',
              isJoint: false,
              isGuide: false,
              beadType: 'bc',
              beadSize: size,                  // single bead size char
              beadSeq: null,
            });
          });
          return pos + beads.length;           // advance path by bead count
        }

        const tokenMatch = token.match(/^(\d+)?\s*(rds|ds|ss|sp|cp|p|lp|jp|jpg|gp|bp|bp1|bp2|bp3|bp4|bp5|sP|cP|LP|Lp|lP|CP|SP|JP|JPG|Jpg|jPg|jpG|GP|Gp|gP|BP|Bp|bP|BP1|BP2|BP3|BP4|BP5|RDS|Rds|rDs|DS|Ds|dS|SS|P)$/i);
        if (!tokenMatch) {
          setNotationError('Unknown element: ' + token);
          return pos;
        }

        const num = parseInt(tokenMatch[1]) || 1;
        const el = tokenMatch[2].toLowerCase();

        if (el === 'ds') return pos + num;
        if (el === 'rds') return pos + num * 2; // Reinforced DS counts as 2 DS
        if (el === 'ss') return pos + num * 0.5;

        let size = 'medium';
        let isJoint = false;
        let isGuide = false;
        let isGuidePoint = false;
        let beadType = null; // NEW: for beaded picots
        
        if (el === 'jp') {
          size = 'medium';
          isJoint = true;
        } else if (el === 'bjp') {
          size = 'medium';
          isJoint = true;
          // beadSeq handled below via bjpMatch
        } else if (el === 'jpg') {
          size = 'medium';
          isJoint = true;  // Joinable (selectable in picot join tool)
          isGuide = true;  // Renders as green arm, not orange dot
        } else if (el === 'gp') {
          isGuidePoint = true;  // Guide Point: snap dot on path, no arm rendered
          isGuide = true;
        } else if (el === 'bp') {
          size = 'medium';
          beadType = 'default'; // Default bead
        } else if (el === 'bp1') {
          size = 'medium';
          beadType = 'type1'; // Bead style 1
        } else if (el === 'bp2') {
          size = 'medium';
          beadType = 'type2'; // Bead style 2
        } else if (el === 'bp3') {
          size = 'medium';
          beadType = 'type3'; // Bead style 3
        } else if (el === 'bp4') {
          size = 'medium';
          beadType = 'type4'; // Bead style 4
        } else if (el === 'bp5') {
          size = 'medium';
          beadType = 'type5'; // Bead style 5
        } else if (el === 'lp') {
          size = 'large';
        } else if (el === 'sp' || el === 'cp') {
          size = 'small';
        }

        for (let i = 0; i < num; i++) {
          picots.push({ 
            id: Date.now() + Math.random(), 
            stitchesBefore: pos, 
            length: size,
            isJoint: isJoint,       // Joint picot (for connections)
            isGuide: isGuide,       // Guide picot (jpg: arm, gp: point)
            isGuidePoint: isGuidePoint, // Guide Point (gp): dot on path, no arm
            beadType: beadType // NEW: Beaded picot type
          });
        }
        return pos;
      };

      let position = 0;
      for (let part of parts) {
        position = processToken(part, position);
      }

      totalDS = position;
      return { type, stitchCount: totalDS, picots };
    } catch (err) {
      setNotationError('Parse error');
      return null;
    }
  };

  // Helper to reverse notation for flipping patterns
  const reverseNotation = (notation) => {
    try {
      const match = notation.match(/^(r|c|sr|jk|fr):\s*(.+)$/i);
      if (!match) return notation;
      
      const type = match[1];
      const pattern = match[2];
      
      // Split by '-' or '.' but respect parentheses
      const parts = [];
      let current = '';
      let depth = 0;
      
      for (let char of pattern) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        // Accept both "-" and "." as separators
        if ((char === '-' || char === '.') && depth === 0) {
          if (current.trim()) parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) parts.push(current.trim());
      
      // Reverse the array of parts
      const reversedParts = parts.reverse();
      
      // Also reverse content inside repeat patterns
      const processedParts = reversedParts.map(part => {
        const repeatMatch = part.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
        if (repeatMatch) {
          const count = repeatMatch[1] || repeatMatch[4];
          const innerPattern = repeatMatch[2] || repeatMatch[3];
          // Accept both "-" and "." as separators
          const innerParts = innerPattern.split(/[-.]/).map(s => s.trim());
          const reversedInner = innerParts.reverse().join('-');
          
          if (repeatMatch[1]) {
            return `${count}x(${reversedInner})`;
          } else {
            return `(${reversedInner})x${count}`;
          }
        }
        return part;
      });
      
      return `${type}: ${processedParts.join('-')}`;
    } catch (err) {
      console.error('Error reversing notation:', err);
      return notation;
    }
  };

  // Helper to count actual stitches (not DS equivalent) from notation
  const countActualStitches = (notation) => {
    let count = 0;
    
    try {
      const pattern = notation.split(':').slice(1).join(':').trim();
      if (!pattern) return 0;
      
      // Split by '-' or '.' but respect parentheses (same logic as parseNotation)
      const parts = [];
      let current = '';
      let depth = 0;
      
      for (let char of pattern) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        // Accept both "-" and "." as separators
        if ((char === '-' || char === '.') && depth === 0) {
          if (current.trim()) parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) parts.push(current.trim());
      
      const processToken = (token) => {
        // Handle repeat notation: 2x(p-3ds) or (p-3ds)x2
        const repeatMatch = token.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
        if (repeatMatch) {
          const repeatCount = parseInt(repeatMatch[1] || repeatMatch[4]);
          const innerPattern = repeatMatch[2] || repeatMatch[3];
          // Accept both "-" and "." as separators
          const innerParts = innerPattern.split(/[-.]/).map(s => s.trim());
          for (let i = 0; i < repeatCount; i++) {
            for (let part of innerParts) {
              processToken(part);
            }
          }
          return;
        }
        
        // Skip picots and beaded picots
        if (token.match(/^(sp|cp|p|lp|jp|jpg|gp|sP|cP|LP|Lp|lP|CP|SP|JP|JPG|Jpg|GP|Gp|gP|P)$/i)) return;
        if (token.match(/^bp:/i)) return; // beaded picot — zero width
        if (token.match(/^bjp:/i)) return; // beaded joint picot — zero width
        if (token.match(/^sb:/i)) return; // suspended bead — zero width
        if (token.match(/^bc:/i)) return; // core bead — adds to path but not display count
        if (token.match(/^bcp:/i)) return; // bcp: — core+picot bead, adds to path but not display count
        
        // Match stitch tokens
        const match = token.match(/^(\d+)?\s*(rds|ds|ss|RDS|Rds|rDs|DS|Ds|dS|SS)$/i);
        if (match) {
          const num = parseInt(match[1]) || 1;
          count += num; // Count actual stitches, not DS equivalent
        }
      };
      
      for (let part of parts) {
        processToken(part);
      }
    } catch (err) {
      console.error('Error counting stitches:', err);
    }
    
    return count;
  };

  // Helper to count actual stitches in a DS position range
  const countStitchesInRange = (notation, startDS, endDS) => {
    let count = 0;
    
    try {
      const pattern = notation.split(':').slice(1).join(':').trim();
      if (!pattern) return 0;
      
      // Split by '-' or '.' but respect parentheses (same logic as parseNotation)
      const parts = [];
      let current = '';
      let depth = 0;
      
      for (let char of pattern) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        // Accept both "-" and "." as separators
        if ((char === '-' || char === '.') && depth === 0) {
          if (current.trim()) parts.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) parts.push(current.trim());
      
      // Expand repeats and count
      let dsPosition = 0;
      
      const processToken = (token) => {
        // Handle repeat notation: 2x(p-3ds) or (p-3ds)x2
        const repeatMatch = token.match(/^(\d+)[x*]\((.+)\)$|^\((.+)\)[x*](\d+)$/i);
        if (repeatMatch) {
          const repeatCount = parseInt(repeatMatch[1] || repeatMatch[4]);
          const innerPattern = repeatMatch[2] || repeatMatch[3];
          // Accept both "-" and "." as separators
          const innerParts = innerPattern.split(/[-.]/).map(s => s.trim());
          for (let i = 0; i < repeatCount; i++) {
            for (let part of innerParts) {
              processToken(part);
            }
          }
          return;
        }
        
        // Skip picots and beaded picots
        if (token.match(/^(sp|cp|p|lp|jp|jpg|gp|sP|cP|LP|Lp|lP|CP|SP|JP|JPG|Jpg|GP|Gp|gP|P)$/i)) return;
        if (token.match(/^bp:/i)) return; // beaded picot — zero width
        if (token.match(/^bjp:/i)) return; // beaded joint picot — zero width
        if (token.match(/^sb:/i)) return; // suspended bead — zero width
        // bcp/bcjp: core bead — advance by 1ds
        if (token.match(/^bcp:/i)) { dsPosition += 1; return; }
        if (token.match(/^bcjp:/i)) { dsPosition += 1; return; }
        if (token.match(/^be$/i)) { dsPosition += 1; return; }
        // Core bead: advance dsPosition by bead count but don't count as stitches
        const coreBeadSkipMatch = token.match(/^bc:([YZVyzv0-9]+)$/i);
        if (coreBeadSkipMatch) {
          const seq = coreBeadSkipMatch[1].toUpperCase();
          let n = 0, i = 0;
          while (i < seq.length) {
            let cnt = 1;
            if (/\d/.test(seq[i])) { cnt = parseInt(seq[i]); i++; }
            if (i < seq.length && /[YZV]/i.test(seq[i])) { n += cnt; i++; } else { i++; }
          }
          dsPosition += n;
          return;
        }
        
        // Match stitch tokens
        const match = token.match(/^(\d+)?\s*(rds|ds|ss|RDS|Rds|rDs|DS|Ds|dS|SS)$/i);
        if (match) {
          const num = parseInt(match[1]) || 1;
          const type = match[2].toLowerCase();
          
          for (let i = 0; i < num; i++) {
            const stitchStartDS = dsPosition;
            let stitchEndDS = dsPosition;
            
            // Calculate DS span for this stitch
            if (type === 'ds') stitchEndDS = dsPosition + 1;
            else if (type === 'rds') stitchEndDS = dsPosition + 2;
            else if (type === 'ss') stitchEndDS = dsPosition + 0.5;
            
            // Check if this stitch overlaps with the range
            if (stitchEndDS > startDS && stitchStartDS < endDS) {
              count++;
            }
            
            dsPosition = stitchEndDS;
          }
        }
      };
      
      for (let part of parts) {
        processToken(part);
      }
    } catch (err) {
      console.error('Error counting stitches in range:', err);
    }
    
    return count;
  };

  // Helper to get stitch types from notation for realistic rendering
  const getStitchTypes = (notation) => {
    // PERFORMANCE: return cached result if we've parsed this exact notation string before
    if (stitchTypesCacheRef.current.has(notation)) {
      return stitchTypesCacheRef.current.get(notation);
    }
    const stitchMap = {}; // Map from DS position to stitch type or array of types
    
    try {
      const parts = notation.split(':').slice(1).join(':').trim().split(/[,.\-]/).map(s => s.trim()) || [];
      let dsPosition = 0; // Position in DS units
      
      for (let part of parts) {
        // Skip picots and beaded picots
        if (part.match(/^(sp|cp|p|lp|jp|jpg|gp|sP|cP|LP|Lp|lP|CP|SP|JP|JPG|Jpg|GP|Gp|gP|P)$/i)) continue;
        if (part.match(/^bp:/i)) continue; // beaded picot — zero width
        if (part.match(/^bjp:/i)) continue; // beaded joint picot — zero width
        if (part.match(/^sb:/i)) continue; // suspended bead — zero width
        // bcp/bcjp: advance DS position by 1
        if (part.match(/^bcp:/i)) { dsPosition += 1; continue; }
        if (part.match(/^bcjp:/i)) { dsPosition += 1; continue; }
        if (part.match(/^be$/i)) { dsPosition += 1; continue; }
        // Core bead: advance DS position without adding stitch types
        const coreBeadTypeMatch = part.match(/^bc:([YZVyzv0-9]+)$/i);
        if (coreBeadTypeMatch) {
          const seq = coreBeadTypeMatch[1].toUpperCase();
          let n = 0, si = 0;
          while (si < seq.length) {
            let cnt = 1;
            if (/\d/.test(seq[si])) { cnt = parseInt(seq[si]); si++; }
            if (si < seq.length && /[YZV]/i.test(seq[si])) { n += cnt; si++; } else { si++; }
          }
          dsPosition += n;
          continue;
        }
        
        // Match stitch tokens
        const match = part.match(/^(\d+)?\s*(rds|ds|ss|RDS|Rds|rDs|DS|Ds|dS|SS)$/i);
        if (match) {
          const count = parseInt(match[1]) || 1;
          const type = match[2].toLowerCase();
          
          for (let i = 0; i < count; i++) {
            if (type === 'rds') {
              // RDS takes 2 DS positions, both render as RDS
              stitchMap[dsPosition] = 'rds';
              stitchMap[dsPosition + 1] = 'rds';
              dsPosition += 2;
            } else if (type === 'ds') {
              // DS takes 1 position
              stitchMap[dsPosition] = 'ds';
              dsPosition += 1;
            } else if (type === 'ss') {
              // SS: 2 stitches take 1 DS position
              // Mark this position as needing 2 SS
              stitchMap[dsPosition] = ['ss', 'ss'];
              dsPosition += 0.5;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error parsing stitch types:', err);
    }

    // PERFORMANCE: store result so identical notation strings skip parsing next time
    stitchTypesCacheRef.current.set(notation, stitchMap);
    return stitchMap;
  };

  const addRing = useCallback(() => {
    const center = getViewportCenter();
    const targetLength = 12 * dsWidth;
    const squeeze = 0;
    const pathData = createTeardropPath(center.x, center.y, targetLength, squeeze);
    
    setElements(prev => [...prev, {
      id: Date.now(),
      type: 'ring',
      materialId: lastUsedMaterialIdRef.current,
      center: { x: center.x, y: center.y },
      rotation: 0,
      stitchCount: 12,
      color: '#FFFFFF',
      picots: [{ id: Date.now() + 1, stitchesBefore: 6, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null }],
      orderNumber: null,
      notation: 'r: 6ds-p-6ds',
      labelsInside: true,
      squeeze: squeeze,
      picotSideMultiplier: 1,
      ...pathData
    }]);
  }, [dsWidth, camera, zoom]);

  const addSplitRing = useCallback(() => {
    const center = getViewportCenter();
    const stitchCountA = 6;
    const stitchCountB = 6;
    const totalLength = (stitchCountA + stitchCountB) * dsWidth;
    const squeeze = 0.25;
    const pathData = createSplitRingPath(center.x, center.y, totalLength, stitchCountA, stitchCountB, 0.25, 0.75, 0.75);
    const now = Date.now();
    
    setElements(prev => [...prev, {
      id: now,
      type: 'ring',
      center: { x: center.x, y: center.y },
      rotation: 0,
      stitchCount: stitchCountA + stitchCountB,
      color: '#FFFFFF',
      picots: [
        { id: now + 1, stitchesBefore: 3, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null },
        { id: now + 2, stitchesBefore: 9, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null }
      ],
      orderNumber: null,
      notation: 'sr: 3ds-p-3ds',
      notationB: '3ds-p-3ds',
      labelsInside: true,
      squeeze: 0.25,
      squeezeCA: 0.75,
      squeezeCB: 0.75,
      picotSideMultiplier: 1,
      isSplitRing: true,
      materialId: lastUsedMaterialIdRef.current,
      ...pathData
    }]);
  }, [dsWidth, camera, zoom]);

  // Apply curve type transformation to a path for rendering
  // Takes a quadratic path and returns cubic control points based on curve type
  // REMOVED: applyCurveType function - doesn't work with length constraint and fixed endpoints
  // Now using direct cubic bezier control instead

  const addChain = useCallback(() => {
    const center = getViewportCenter();
    const stitchCount = 12;
    // Chord length derived from stitch count — arc will be slightly longer due to the curve lift,
    // so use 0.92 factor to keep the rendered arc close to stitchCount * dsWidth
    const chord = stitchCount * dsWidth * 0.92;
    const halfChord = chord / 2;
    // Gentle arc: lift control points by 1/5 of chord
    const arcLift = chord / 5;
    
    const startX = center.x - halfChord;
    const startY = center.y;
    const endX = center.x + halfChord;
    const endY = center.y;
    
    const now = Date.now();
    setElements(prev => [...prev, {
      id: now,
      type: 'chain',
      materialId: lastUsedMaterialIdRef.current,
      center: { x: center.x, y: center.y },
      isClosed: false,
      shapeStyle: 'chain',
      paths: [{
        type: 'cubic',
        x: startX,
        y: startY,
        control1X: startX + chord / 3,
        control1Y: startY - arcLift,
        control2X: startX + chord * 2 / 3,
        control2Y: startY - arcLift,
        endX: endX,
        endY: endY
      }],
      stitchCount,
      color: '#FFFFFF',
      picots: [{ id: now + 1, stitchesBefore: 6, length: 'medium', isJoint: false, isGuide: false, isGuidePoint: false, beadType: null }],
      notation: 'c: 6ds-p-6ds',
      labelsInside: true,
      picotSideMultiplier: 1
    }]);
  }, [dsWidth, camera, zoom]);

  const showLoadMsg = (type, text) => {
    setLoadMsg({ type, text });
    setTimeout(() => setLoadMsg(null), 4000);
  };

  const addLine = useCallback(() => {
    const center = getViewportCenter();
    const startX = center.x - 100;
    const startY = center.y;
    const endX = center.x + 100;
    const endY = center.y;
    
    // Create straight line (cubic bezier with control points on the line)
    const control1X = startX + (endX - startX) * 0.33;
    const control1Y = startY + (endY - startY) * 0.33;
    const control2X = startX + (endX - startX) * 0.67;
    const control2Y = startY + (endY - startY) * 0.67;
    
    setElements(prev => [...prev, {
      id: Date.now(),
      type: 'line',
      materialId: lastUsedMaterialIdRef.current,
      center: { x: center.x, y: center.y },
      isClosed: false,
      paths: [{
        type: 'cubic',
        x: startX,
        y: startY,
        control1X: control1X,
        control1Y: control1Y,
        control2X: control2X,
        control2Y: control2Y,
        endX: endX,
        endY: endY
      }],
      color: '#FFFFFF',
      notation: 'line',
      lineWidth: 2 // Line stroke width
    }]);
  }, [camera, zoom]); // Dependencies: camera/zoom for viewport center

  const deleteSelected = useCallback(() => {
    const currentSelectedIds = selectedIdsRef.current; // Use ref to avoid stale closure
    if (currentSelectedIds.length === 0) return;
    setElements(prev => prev.filter(e => !currentSelectedIds.includes(e.id)));
    setSelectedIds([]);
  }, []); // No dependencies - uses refs

  // Get bounds of a single element
  const getElementBounds = (el) => {
    if (el.isClosed && el.shapeStyle === 'circle') {
      const targetCircumference = el.stitchCount * dsWidth;
      const radius = targetCircumference / (2 * Math.PI);
      return {
        left: el.center.x - radius,
        right: el.center.x + radius,
        top: el.center.y - radius,
        bottom: el.center.y + radius,
        centerX: el.center.x,
        centerY: el.center.y,
        width: radius * 2,
        height: radius * 2
      };
    } else {
      // Path-based elements
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      el.paths.forEach(path => {
        const points = sampleBezierPath(path, 20);
        points.forEach(pt => {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
        });
      });
      return {
        left: minX,
        right: maxX,
        top: minY,
        bottom: maxY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        width: maxX - minX,
        height: maxY - minY
      };
    }
  };

  // Move element by offset
  const moveElement = (el, dx, dy) => {
    if (el.isClosed && el.shapeStyle === 'circle') {
      return {
        ...el,
        center: { x: el.center.x + dx, y: el.center.y + dy }
      };
    } else {
      // Move paths
      return {
        ...el,
        center: { x: el.center.x + dx, y: el.center.y + dy },
        paths: el.paths.map(path => ({
          ...path,
          x: path.x + dx,
          y: path.y + dy,
          endX: path.endX + dx,
          endY: path.endY + dy,
          control1X: path.control1X ? path.control1X + dx : undefined,
          control1Y: path.control1Y ? path.control1Y + dy : undefined,
          control2X: path.control2X ? path.control2X + dx : undefined,
          control2Y: path.control2Y ? path.control2Y + dy : undefined,
          controlX: path.controlX ? path.controlX + dx : undefined,
          controlY: path.controlY ? path.controlY + dy : undefined
        }))
      };
    }
  };

  // Alignment functions
  const alignLeft = () => {
    if (selectedIds.length < 2) return;
    const selectedElements = elements.filter(e => selectedIds.includes(e.id));
    const bounds = selectedElements.map(el => ({ el, bounds: getElementBounds(el) }));
    const leftmost = Math.min(...bounds.map(b => b.bounds.left));
    
    setElements(prev => prev.map(el => {
      const item = bounds.find(b => b.el.id === el.id);
      if (!item) return el;
      const dx = leftmost - item.bounds.left;
      return moveElement(el, dx, 0);
    }));
  };

  const alignRight = () => {
    if (selectedIds.length < 2) return;
    const selectedElements = elements.filter(e => selectedIds.includes(e.id));
    const bounds = selectedElements.map(el => ({ el, bounds: getElementBounds(el) }));
    const rightmost = Math.max(...bounds.map(b => b.bounds.right));
    
    setElements(prev => prev.map(el => {
      const item = bounds.find(b => b.el.id === el.id);
      if (!item) return el;
      const dx = rightmost - item.bounds.right;
      return moveElement(el, dx, 0);
    }));
  };

  const alignTop = () => {
    if (selectedIds.length < 2) return;
    const selectedElements = elements.filter(e => selectedIds.includes(e.id));
    const bounds = selectedElements.map(el => ({ el, bounds: getElementBounds(el) }));
    const topmost = Math.min(...bounds.map(b => b.bounds.top));
    
    setElements(prev => prev.map(el => {
      const item = bounds.find(b => b.el.id === el.id);
      if (!item) return el;
      const dy = topmost - item.bounds.top;
      return moveElement(el, 0, dy);
    }));
  };

  const alignBottom = () => {
    if (selectedIds.length < 2) return;
    const selectedElements = elements.filter(e => selectedIds.includes(e.id));
    const bounds = selectedElements.map(el => ({ el, bounds: getElementBounds(el) }));
    const bottommost = Math.max(...bounds.map(b => b.bounds.bottom));
    
    setElements(prev => prev.map(el => {
      const item = bounds.find(b => b.el.id === el.id);
      if (!item) return el;
      const dy = bottommost - item.bounds.bottom;
      return moveElement(el, 0, dy);
    }));
  };

  const alignCenterHorizontal = () => {
    if (selectedIds.length < 2) return;
    const selectedElements = elements.filter(e => selectedIds.includes(e.id));
    const bounds = selectedElements.map(el => ({ el, bounds: getElementBounds(el) }));
    const avgCenter = bounds.reduce((sum, b) => sum + b.bounds.centerX, 0) / bounds.length;
    
    setElements(prev => prev.map(el => {
      const item = bounds.find(b => b.el.id === el.id);
      if (!item) return el;
      const dx = avgCenter - item.bounds.centerX;
      return moveElement(el, dx, 0);
    }));
  };

  const alignCenterVertical = () => {
    if (selectedIds.length < 2) return;
    const selectedElements = elements.filter(e => selectedIds.includes(e.id));
    const bounds = selectedElements.map(el => ({ el, bounds: getElementBounds(el) }));
    const avgCenter = bounds.reduce((sum, b) => sum + b.bounds.centerY, 0) / bounds.length;
    
    setElements(prev => prev.map(el => {
      const item = bounds.find(b => b.el.id === el.id);
      if (!item) return el;
      const dy = avgCenter - item.bounds.centerY;
      return moveElement(el, 0, dy);
    }));
  };

  // Apply group rotation from input field
  // Rotate multi-selection (no groupId required) by a delta in degrees around the centroid
  const applyMultiSelectRotationDelta = (delta) => {
    if (selectedIds.length < 2) return;
    if (delta === 0) return;
    const selEls = elements.filter(e => selectedIds.includes(e.id));
    const centerX = selEls.reduce((s, e) => s + e.center.x, 0) / selEls.length;
    const centerY = selEls.reduce((s, e) => s + e.center.y, 0) / selEls.length;
    const rad = delta * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);

    setElements(prev => prev.map(el => {
      if (!selectedIds.includes(el.id)) return el;
      const dx = el.center.x - centerX, dy = el.center.y - centerY;
      const newCenterX = centerX + dx * cos - dy * sin;
      const newCenterY = centerY + dx * sin + dy * cos;
      const newRotation = ((el.rotation || 0) + delta) % 360;

      // Split rings & teardrops: regenerate path at new center + apply rotation
      if (el.isSplitRing && el.splitPosition) {
        const pathData = createSplitRingPath(newCenterX, newCenterY, el.stitchCount * dsWidth, el.splitPosition, el.stitchCount - el.splitPosition, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
        const r = newRotation * Math.PI / 180, rc = Math.cos(r), rs = Math.sin(r);
        const rot = (px, py) => { const pdx = px - newCenterX, pdy = py - newCenterY; return { x: newCenterX + pdx*rc - pdy*rs, y: newCenterY + pdx*rs + pdy*rc }; };
        const newPaths = pathData.paths.map(path => {
          const s = rot(path.x, path.y), e2 = rot(path.endX, path.endY), c1 = rot(path.control1X, path.control1Y), c2 = rot(path.control2X, path.control2Y);
          return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
        });
        return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: ((newRotation % 360) + 360) % 360 };
      }
      if (el.type === 'ring' && (el.shapeStyle === 'teardrop' || (el.squeeze !== undefined && el.squeeze > 0))) {
        const pathData = createTeardropPath(newCenterX, newCenterY, el.stitchCount * dsWidth, el.squeeze ?? 0);
        const r = newRotation * Math.PI / 180, rc = Math.cos(r), rs = Math.sin(r);
        const rot = (px, py) => { const pdx = px - newCenterX, pdy = py - newCenterY; return { x: newCenterX + pdx*rc - pdy*rs, y: newCenterY + pdx*rs + pdy*rc }; };
        const newPaths = pathData.paths.map(path => {
          if (path.type === 'cubic') {
            const s = rot(path.x, path.y), e2 = rot(path.endX, path.endY), c1 = rot(path.control1X, path.control1Y), c2 = rot(path.control2X, path.control2Y);
            return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
          } else {
            const s = rot(path.x, path.y), e2 = rot(path.endX, path.endY), ctrl = rot(path.controlX, path.controlY);
            return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: ctrl.x, controlY: ctrl.y };
          }
        });
        return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: ((newRotation % 360) + 360) % 360 };
      }
      // Chains & circle rings: rotate path points around global centroid
      const rotatePt = (px, py) => { const pdx = px - centerX, pdy = py - centerY; return { x: centerX + pdx*cos - pdy*sin, y: centerY + pdx*sin + pdy*cos }; };
      const newPaths = el.paths.map(path => {
        if (path.type === 'cubic') {
          const s = rotatePt(path.x, path.y), e2 = rotatePt(path.endX, path.endY), c1 = rotatePt(path.control1X, path.control1Y), c2 = rotatePt(path.control2X, path.control2Y);
          return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
        } else {
          const s = rotatePt(path.x, path.y), e2 = rotatePt(path.endX, path.endY), ctrl = rotatePt(path.controlX, path.controlY);
          return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: ctrl.x, controlY: ctrl.y };
        }
      });
      return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: ((newRotation % 360) + 360) % 360 };
    }));
  };

  // PERFORMANCE: O(1) element lookup by id — replaces elements.find(e => e.id === x) everywhere
  // Defined early because it is used in event handlers and callbacks throughout the component.
  const elementById = useMemo(() => new Map(elements.map(e => [e.id, e])), [elements]);

  // PERFORMANCE: O(1) material lookup by id — getElementColor calls materials.find() on every
  // element every render. This map makes it O(1) and speeds up stitchCache builds too.
  const materialsById = useMemo(() => new Map(materials.map(m => [m.id, m])), [materials]);

  const applyGroupRotation = (targetRotation) => {
    if (selectedIds.length === 0) return;
    
    const firstElement = elementById.get(selectedIds[0]);
    if (!firstElement || !firstElement.groupId) return;
    
    const groupElements = elements.filter(e => e.groupId === firstElement.groupId);
    if (groupElements.length <= 1) return;
    
    const currentRotation = groupElements[0]?.rotation || 0;
    const delta = targetRotation - currentRotation;
    
    if (delta === 0) return;
    
    const rad = delta * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Calculate group center
    const groupCenterX = groupElements.reduce((sum, el) => sum + el.center.x, 0) / groupElements.length;
    const groupCenterY = groupElements.reduce((sum, el) => sum + el.center.y, 0) / groupElements.length;
    
    setElements(prev => prev.map(el => {
      if (!selectedIds.includes(el.id)) return el;
      
      // Rotate element center around group center
      const dx = el.center.x - groupCenterX;
      const dy = el.center.y - groupCenterY;
      const newCenterX = groupCenterX + dx * cos - dy * sin;
      const newCenterY = groupCenterY + dx * sin + dy * cos;
      
      // Update rotation value for ALL elements
      const newRotation = ((el.rotation || 0) + delta) % 360;
      
      // For teardrop rings or squeezed circles, regenerate paths instead of rotating them
      let newPaths;
      if (el.type === 'ring' && (el.shapeStyle === 'teardrop' || el.shapeStyle === 'split-ring' || (el.squeeze !== undefined && el.squeeze > 0))) {
        // Regenerate path based on new rotation
        const targetLength = el.stitchCount * dsWidth;
        const squeeze = el.squeeze !== undefined ? el.squeeze : 0;
        
        let pathData;
        if (el.isSplitRing && el.splitPosition) {
          const stitchCountA = el.splitPosition;
          const stitchCountB = el.stitchCount - stitchCountA;
          pathData = createSplitRingPath(newCenterX, newCenterY, targetLength, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
        } else {
          pathData = createTeardropPath(newCenterX, newCenterY, targetLength, squeeze);
        }
        
        newPaths = pathData.paths; // Extract paths array from returned object
        
        // Apply the element's rotation by rotating the regenerated paths
        if (newRotation !== 0) {
          const elemRad = newRotation * Math.PI / 180;
          const elemCos = Math.cos(elemRad);
          const elemSin = Math.sin(elemRad);
          
          newPaths = newPaths.map(path => {
            const rotatePoint = (px, py) => {
              const pdx = px - newCenterX;
              const pdy = py - newCenterY;
              return {
                x: newCenterX + pdx * elemCos - pdy * elemSin,
                y: newCenterY + pdx * elemSin + pdy * elemCos
              };
            };
            
            if (path.type === 'cubic') {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const c1 = rotatePoint(path.control1X, path.control1Y);
              const c2 = rotatePoint(path.control2X, path.control2Y);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                control1X: c1.x, control1Y: c1.y,
                control2X: c2.x, control2Y: c2.y
              };
            } else {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const ctrl = rotatePoint(path.controlX, path.controlY);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                controlX: ctrl.x, controlY: ctrl.y
              };
            }
          });
        }
      } else {
        // For chains and circles, rotate path points around group center
        newPaths = el.paths.map(path => {
          const rotatePoint = (px, py) => {
            const pdx = px - groupCenterX;
            const pdy = py - groupCenterY;
            return {
              x: groupCenterX + pdx * cos - pdy * sin,
              y: groupCenterY + pdx * sin + pdy * cos
            };
          };
          
          if (path.type === 'cubic') {
            const start = rotatePoint(path.x, path.y);
            const end = rotatePoint(path.endX, path.endY);
            const c1 = rotatePoint(path.control1X, path.control1Y);
            const c2 = rotatePoint(path.control2X, path.control2Y);
            return {
              ...path,
              x: start.x, y: start.y,
              endX: end.x, endY: end.y,
              control1X: c1.x, control1Y: c1.y,
              control2X: c2.x, control2Y: c2.y
            };
          } else {
            const start = rotatePoint(path.x, path.y);
            const end = rotatePoint(path.endX, path.endY);
            const ctrl = rotatePoint(path.controlX, path.controlY);
            return {
              ...path,
              x: start.x, y: start.y,
              endX: end.x, endY: end.y,
              controlX: ctrl.x, controlY: ctrl.y
            };
          }
        });
      }
      
      return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: newRotation };
    }));
    
    // Clear input after applying
    setGroupRotationInput('');
  };

  const groupSelected = useCallback(() => {
    const currentSelectedIds = selectedIdsRef.current; // Use ref to avoid stale closure
    if (currentSelectedIds.length < 2) return; // Need at least 2 elements to group
    
    const groupId = Date.now() + Math.random(); // Unique group ID
    
    setElements(prev => prev.map(el => 
      currentSelectedIds.includes(el.id) ? { ...el, groupId } : el
    ));
    
    console.log('Grouped', currentSelectedIds.length, 'elements with ID:', groupId);
  }, []); // No dependencies - uses refs

  const ungroupSelected = useCallback(() => {
    const currentSelectedIds = selectedIdsRef.current; // Use ref to avoid stale closure
    if (currentSelectedIds.length === 0) return;
    
    setElements(prev => prev.map(el => {
      if (currentSelectedIds.includes(el.id)) {
        const { groupId, ...rest } = el; // Remove groupId property
        return rest;
      }
      return el;
    }));
    
    console.log('Ungrouped', currentSelectedIds.length, 'elements');
  }, []); // No dependencies - uses refs

  const undo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    
    if (currentIndex > 0) {
      isUndoRedoRef.current = true;
      const newIndex = currentIndex - 1;
      const state = currentHistory[newIndex];
      setHistoryIndex(newIndex);
      setElements(JSON.parse(JSON.stringify(state.elements)));
      setPicotConnections(JSON.parse(JSON.stringify(state.connections)));
      console.log('Undo to state', newIndex);
      setTimeout(() => { isUndoRedoRef.current = false; }, 0);
    }
  }, []); // No dependencies - uses refs

  const redo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    
    if (currentIndex < currentHistory.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = currentIndex + 1;
      const state = currentHistory[newIndex];
      setHistoryIndex(newIndex);
      setElements(JSON.parse(JSON.stringify(state.elements)));
      setPicotConnections(JSON.parse(JSON.stringify(state.connections)));
      console.log('Redo to state', newIndex);
      setTimeout(() => { isUndoRedoRef.current = false; }, 0);
    }
  }, []); // No dependencies - uses refs

  // Copy selected elements to clipboard
  const copySelected = () => {
    if (selectedIds.length > 0) {
      const selectedElements = elements.filter(el => selectedIds.includes(el.id));
      const cloned = JSON.parse(JSON.stringify(selectedElements)); // Deep clone
      setClipboard(cloned);
      console.log('Copied:', cloned.length, 'elements');
    }
  };

  // Paste elements from clipboard with offset
  const pasteFromClipboard = () => {
    if (clipboard.length === 0) return;
    
    const offset = 30;
    
    // Create a map of old groupIds to new groupIds
    const groupIdMap = new Map();
    clipboard.forEach(el => {
      if (el.groupId && !groupIdMap.has(el.groupId)) {
        groupIdMap.set(el.groupId, Date.now() + Math.random());
      }
    });
    
    // Create a map of old element IDs to new element IDs
    const elementIdMap = new Map();
    
    const newElements = clipboard.map(el => {
      const newEl = JSON.parse(JSON.stringify(el)); // Deep clone
      const newId = Date.now() + Math.random();
      elementIdMap.set(el.id, newId);
      newEl.id = newId;
      
      // Preserve group membership with new groupId
      if (el.groupId) {
        newEl.groupId = groupIdMap.get(el.groupId);
      }
      
      // Offset position
      newEl.center.x += offset;
      newEl.center.y += offset;
      
      // Update path coordinates
      if (newEl.paths) {
        newEl.paths = newEl.paths.map(path => {
          const newPath = { ...path };
          newPath.x += offset;
          newPath.y += offset;
          if (path.controlX !== undefined) newPath.controlX += offset;
          if (path.controlY !== undefined) newPath.controlY += offset;
          if (path.control1X !== undefined) newPath.control1X += offset;
          if (path.control1Y !== undefined) newPath.control1Y += offset;
          if (path.control2X !== undefined) newPath.control2X += offset;
          if (path.control2Y !== undefined) newPath.control2Y += offset;
          if (path.endX !== undefined) newPath.endX += offset;
          if (path.endY !== undefined) newPath.endY += offset;
          return newPath;
        });
      }
      
      // Clear order number to avoid conflicts
      delete newEl.orderNumber;
      
      return newEl;
    });
    
    setElements(prev => [...prev, ...newElements]);
    setSelectedIds(newElements.map(el => el.id));
    console.log('Pasted:', newElements.length, 'elements');
  };

  // Duplicate in place (no offset) - for creating flower patterns
  const duplicateInPlace = () => {
    const currentSelectedIds = selectedIdsRef.current;
    const currentElements = elementsRef.current;
    if (currentSelectedIds.length === 0) return;

    const selectedElements = currentElements.filter(e => currentSelectedIds.includes(e.id));
    // Create a map of old groupIds to new groupIds
    const groupIdMap = new Map();
    selectedElements.forEach(el => {
      if (el.groupId && !groupIdMap.has(el.groupId)) {
        groupIdMap.set(el.groupId, Date.now() + Math.random());
      }
    });
    
    const newElements = selectedElements.map(el => {
      const newEl = JSON.parse(JSON.stringify(el)); // Deep clone
      const newId = Date.now() + Math.random();
      newEl.id = newId;
      
      // Preserve group membership with new groupId
      if (el.groupId) {
        newEl.groupId = groupIdMap.get(el.groupId);
      }
      
      // NO offset - duplicate in place!
      
      // Clear order number to avoid conflicts
      delete newEl.orderNumber;
      
      return newEl;
    });
    
    setElements(prev => [...prev, ...newElements]);
    setSelectedIds(newElements.map(el => el.id));
  };

  // Save project as JSON file
  // New canvas - confirm if there are elements
  const newCanvas = () => {
    if (elements.length === 0) return; // Already empty
    setShowNewCanvasDialog(true);
  };

  const confirmNewCanvas = () => {
    setShowNewCanvasDialog(false);
    setElements([]);
    setSelectedIds([]);
    setClipboard([]);
    setPicotConnections([]);
    setSelectedPicots([]);
    setProjectName('Untitled Pattern');
    setCamera({ x: 0, y: 0 });
    setZoom(1);
    setHistory([{ elements: [], connections: [] }]);
    setHistoryIndex(0);
  };

  const saveProject = useCallback(() => {
    // Open save dialog with current project name
    setSaveDialogName(projectName);
    setShowSaveDialog(true);
  }, [projectName]); // Dependency: projectName for dialog default
  
  // Actually perform the save after user confirms
  const performSave = useCallback(() => {
    const finalName = saveDialogName.trim() || 'Untitled Pattern';
    setProjectName(finalName);
    setShowSaveDialog(false);
    
    const projectData = {
      version: 90,
      name: finalName,
      created: new Date().toISOString(),
      elements: elements,
      picotConnections: picotConnections, // NEW: save connections
      camera: camera,
      zoom: zoom,
      dsWidth: dsWidth,
      beadLibrary: beadLibrary,
      bgColor: bgColor,
      gridEnabled: gridEnabled,
      customColors: customColors,
      referenceImage: referenceImage,
      refImageProps: refImageProps,
      renderMode: renderMode, // NEW: realistic rendering
      patternNotes: patternNotes, // Pattern notes
      materials: materials, // Material groups
      activeThreadPreset: threadPresets.find(p => p.id === activePresetId) || threadPresets[0] || DEFAULT_THREAD_PRESET
    };
    
    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${finalName.replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('Project saved:', finalName);
  }, [saveDialogName, elements, picotConnections, camera, zoom, dsWidth, bgColor, gridEnabled, customColors, referenceImage, refImageProps, renderMode, patternNotes, materials]);

  // Load project from JSON file
  const loadProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // FILE VALIDATION
    // 1. Check file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      showLoadMsg('error', 'Wrong file format — please select a .json file.');
      e.target.value = '';
      return;
    }
    
    // 2. Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showLoadMsg('error', 'Failed to load project: file too large (max 10MB).');
      e.target.value = '';
      return;
    }
    
    // 3. Check MIME type
    if (file.type && file.type !== 'application/json' && file.type !== 'text/json') {
      // Allow empty type (some browsers don't set it for .json)
      console.warn('⚠️ Unexpected MIME type:', file.type, '(continuing anyway)');
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        // 4. Validate JSON parsing
        let projectData;
        try {
          projectData = JSON.parse(event.target.result);
        } catch (parseError) {
          showLoadMsg('error', 'Failed to load project: corrupted file (invalid JSON).');
          return;
        }
        
        // 5. Validate it's a tatting project (must have elements array)
        if (!projectData.elements || !Array.isArray(projectData.elements)) {
          showLoadMsg('error', 'Failed to load project: unvalidated file (missing elements).');
          return;
        }
        
        // 6. Validate elements structure
        const invalidElements = projectData.elements.filter((el, index) => {
          if (!el.id || !el.type || !el.paths || !Array.isArray(el.paths)) {
            console.error(`Invalid element at index ${index}:`, el);
            return true;
          }
          if (el.type !== 'ring' && el.type !== 'chain' && el.type !== 'line') {
            console.error(`Invalid element type at index ${index}:`, el.type);
            return true;
          }
          return false;
        });
        
        if (invalidElements.length > 0) {
          showLoadMsg('error', `Failed to load project: ${invalidElements.length} invalid element(s) found.`);
          return;
        }
        
        // 7. Validate data types for optional fields
        if (projectData.camera && (typeof projectData.camera.x !== 'number' || typeof projectData.camera.y !== 'number')) {
          console.warn('⚠️ Invalid camera data, using defaults');
          projectData.camera = { x: 960, y: 540 };
        }
        
        if (projectData.zoom && (typeof projectData.zoom !== 'number' || projectData.zoom <= 0)) {
          console.warn('⚠️ Invalid zoom data, using default');
          projectData.zoom = 1;
        }
        
        if (projectData.picotConnections && !Array.isArray(projectData.picotConnections)) {
          console.warn('⚠️ Invalid picotConnections data, using empty array');
          projectData.picotConnections = [];
        }
        
        // ALL VALIDATION PASSED - Load the project
        setElements(projectData.elements || []);
        setPicotConnections(projectData.picotConnections || []);
        setCamera(projectData.camera || { x: 960, y: 540 });
        setZoom(projectData.zoom || 1);
        setDsWidth(projectData.dsWidth || 10);
        setBgColor(projectData.bgColor || '#1F2937');
        setGridEnabled(projectData.gridEnabled !== undefined ? projectData.gridEnabled : true);
        setCustomColors(projectData.customColors || []);
        setReferenceImage(projectData.referenceImage || null);
        setRefImageProps(projectData.refImageProps || { opacity: 0.5, rotation: 0, scale: 1, visible: true });
        setProjectName(projectData.name || 'Untitled Pattern');
        setRenderMode(projectData.renderMode || 'schematic');
        setPatternNotes(projectData.patternNotes || '');
        setMaterials(projectData.materials || DEFAULT_MATERIALS);
        // Thread preset: if project has one, add/update in presets list and make it active
        if (projectData.activeThreadPreset) {
          const pt = projectData.activeThreadPreset;
          setThreadPresets(prev => {
            const exists = prev.find(p => p.id === pt.id);
            return exists ? prev.map(p => p.id === pt.id ? pt : p) : [...prev, pt];
          });
          setActivePresetId(pt.id);
          localStorage.setItem('tcad_active_preset_id', pt.id);
        }
        
        // Clear selection and reset history
        setSelectedIds([]);
        setSelectedPicots([]);
        setHistory([{ elements: projectData.elements || [], connections: projectData.picotConnections || [] }]);
        setHistoryIndex(0);
        
        console.log('✅ Project loaded successfully:', projectData.name || 'Untitled');
        // Show success toast AFTER all state updates
        setTimeout(() => showLoadMsg('success', `Load completed — ${(projectData.elements || []).length} element(s) loaded.`), 50);
        
      } catch (error) {
        console.error('❌ Error loading project:', error);
        showLoadMsg('error', `Failed to load project: ${error.message}`);
      }
    };
    
    reader.onerror = () => {
      showLoadMsg('error', 'Failed to load project: error reading file.');
    };
    
    reader.readAsText(file);
    
    // Reset input so same file can be loaded again
    e.target.value = '';
  };

  // Load a theme JSON file and merge it over the default (unknown keys are ignored)
  const loadTheme = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          showLoadMsg('error', 'Invalid theme file — expected a JSON object.');
          return;
        }
        // Merge: only accept keys that exist in DEFAULT_THEME
        const merged = { ...DEFAULT_THEME };
        for (const key of Object.keys(DEFAULT_THEME)) {
          if (typeof parsed[key] === 'string') merged[key] = parsed[key];
        }
        setTheme(merged);
        showLoadMsg('success', 'Theme loaded.');
      } catch {
        showLoadMsg('error', 'Failed to load theme: invalid JSON.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };


  const exportSVG = useCallback(() => {
    if (!canvasRef.current) return;
    
    // Get the SVG element
    const svgElement = canvasRef.current.querySelector('svg');
    if (!svgElement) return;
    
    // Clone the SVG
    const clonedSvg = svgElement.cloneNode(true);
    
    // Calculate bounds of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      el.paths.forEach(path => {
        const points = sampleBezierPath(path, 20);
        points.forEach(pt => {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
        });
      });
    });
    
    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Set viewBox to show only the design
    clonedSvg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
    clonedSvg.setAttribute('width', width);
    clonedSvg.setAttribute('height', height);
    
    // Remove the transform from the main group to use viewBox instead
    const mainGroup = clonedSvg.querySelector('g');
    if (mainGroup) {
      mainGroup.removeAttribute('transform');
    }
    
    // Serialize to string
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(clonedSvg);
    
    // Append pattern notes below the design if present
    if (patternNotes && patternNotes.trim()) {
      const noteLines = patternNotes.trim().split('\n');
      const lineHeight = 20;
      const notesY = maxY + 10; // Start just below pattern padding
      const notesHeight = noteLines.length * lineHeight + 40;
      // Expand SVG height to accommodate notes
      const newHeight = height + notesHeight;
      clonedSvg.setAttribute('height', newHeight);
      clonedSvg.setAttribute('viewBox', `${minX} ${minY} ${width} ${newHeight}`);
      // Build text elements
      const notesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      // Header
      const header = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      header.setAttribute('x', minX + padding);
      header.setAttribute('y', notesY + 20);
      header.setAttribute('font-family', 'sans-serif');
      header.setAttribute('font-size', '14');
      header.setAttribute('font-weight', 'bold');
      header.setAttribute('fill', '#333');
      header.textContent = 'Notes:';
      notesGroup.appendChild(header);
      // Note lines
      noteLines.forEach((line, i) => {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', minX + padding);
        t.setAttribute('y', notesY + 44 + i * lineHeight);
        t.setAttribute('font-family', 'sans-serif');
        t.setAttribute('font-size', '13');
        t.setAttribute('fill', '#333');
        t.textContent = line || ' ';
        notesGroup.appendChild(t);
      });
      clonedSvg.appendChild(notesGroup);
    }

    // Add XML declaration
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
    
    // Download
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('SVG exported:', projectName);
  }, [elements, projectName]);

  // Generate pattern text from ordered elements
  const generatePattern = useCallback(() => {
    // Build a lookup: elementId → type label + order number
    // Handles duplicate order numbers safely - marks them with ⚠
    const orderNumberCount = {};
    elements.forEach(el => {
      const num = el.orderNumber?.toString().trim();
      if (num) orderNumberCount[num] = (orderNumberCount[num] || 0) + 1;
    });

    const getElementRef = (elementId) => {
      const el = elementById.get(elementId);
      if (!el) return null;
      const num = el.orderNumber?.toString().trim();
      const typeLabel = el.type === 'ring' ? 'R' : el.type === 'chain' ? 'CH' : null;
      if (!typeLabel) return null; // Lines are not referenced in jp output
      if (!num) return `${typeLabel}#?`;
      if (orderNumberCount[num] > 1) return `${typeLabel}#${num}⚠`;
      return `${typeLabel}#${num}`;
    };

    // Build a lookup: elementId + picotId → list of connected element refs
    // A picot can appear in multiple connections
    const picotConnectionMap = {}; // key: "elementId:picotId" → Set of element refs
    picotConnections.forEach(conn => {
      if (conn.picots.length < 2) return;
      conn.picots.forEach(p => {
        const key = `${p.elementId}:${p.picotId}`;
        if (!picotConnectionMap[key]) picotConnectionMap[key] = [];
        // Add refs for all OTHER picots in this connection
        conn.picots.forEach(other => {
          if (other.elementId === p.elementId && other.picotId === p.picotId) return;
          const ref = getElementRef(other.elementId);
          if (ref && !picotConnectionMap[key].includes(ref)) {
            picotConnectionMap[key].push(ref);
          }
        });
      });
    });

    // Annotate a notation string: replace jp tokens with jp(→...) references
    const annotateNotation = (notation, elementId) => {
      if (!notation) return notation;
      const el = elementById.get(elementId);
      if (!el || !el.picots) return notation;

      // Work through the notation token by token, replacing jp occurrences in order
      // We match each jp in the notation to the corresponding picot by index
      const jpPicots = el.picots.filter(p => p.isJoint);
      let jpIndex = 0;

      // Split notation preserving separators (- or .)
      // We need to reconstruct with same separators
      const prefix = notation.match(/^(r|c|sr|jk|fr):\s*/i)?.[0] || '';
      const body = notation.slice(prefix.length);

      // Tokenize body preserving separators
      const tokens = [];
      let cur = '';
      let depth = 0;
      for (const char of body) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        if ((char === '-' || char === '.') && depth === 0) {
          if (cur.trim()) tokens.push({ text: cur.trim(), sep: char });
          cur = '';
        } else {
          cur += char;
        }
      }
      if (cur.trim()) tokens.push({ text: cur.trim(), sep: '' });

      const annotated = tokens.map(tok => {
        if (/^jp$/i.test(tok.text)) {
          const picot = jpPicots[jpIndex++];
          if (!picot) return tok.text;
          const key = `${elementId}:${picot.id}`;
          const refs = picotConnectionMap[key];
          if (!refs || refs.length === 0) {
            return 'jp(?)';
          }
          return `jp(→${refs.join(', →')})`;
        }
        return tok.text;
      });

      // Rejoin with original separators
      let result = prefix;
      annotated.forEach((t, i) => {
        result += t;
        if (i < tokens.length - 1 && tokens[i].sep) result += tokens[i].sep;
      });
      return result;
    };

    // Collect elements that have order numbers (rings + chains + lines with numbers)
    const orderedElements = elements
      .filter(el => {
        const num = el.orderNumber?.toString().trim();
        return num && num !== '';
      })
      .map(el => ({
        order: parseFloat(el.orderNumber),
        rawOrder: el.orderNumber.toString().trim(),
        element: el
      }))
      .filter(item => !isNaN(item.order))
      .sort((a, b) => a.order - b.order);

    // If no numbered elements, build a warning header but still run thread estimate below
    let fallbackHeader = '';
    if (orderedElements.length === 0) {
      const hasAnyElements = elements.some(el => el.type !== 'line');
      if (hasAnyElements) {
        const unnumbered = elements.filter(el => el.type !== 'line');
        const list = unnumbered.map(el => {
          const typeLabel = el.type === 'ring' ? (el.isSplitRing ? 'SR' : 'R') : 'CH';
          const hint = el.notation
            ? ' (' + el.notation.replace(/^(r|c|sr):\s*/i, '').slice(0, 35) + ')' : '';
          return `  • ${typeLabel}${hint}`;
        });
        fallbackHeader = `⚠ Some elements don't have an assigned order number:\n${list.join('\n')}`;
      } else {
        // Truly empty canvas — nothing to estimate, exit early
        const notesBlock = patternNotes && patternNotes.trim()
          ? '\n\n--- Notes ---\n' + patternNotes.trim() : '';
        navigator.clipboard.writeText('No objects on canvas.' + notesBlock).then(() => {
          showLoadMsg('success', 'Notation copied to clipboard');
        }).catch(() => {
          showLoadMsg('error', 'Copy failed — check browser clipboard permissions');
        });
        return;
      }
    }

    // Warn about duplicates but don't abort
    const dupNums = Object.entries(orderNumberCount)
      .filter(([, count]) => count > 1)
      .map(([num]) => num);

    const patternLines = orderedElements.map(item => {
      const el = item.element;
      const dupWarning = orderNumberCount[item.rawOrder] > 1 ? ' ⚠DUPLICATE#' : '';

      if (el.type === 'line') {
        return `${item.rawOrder}${dupWarning}. [Line]`;
      }

      // Format split ring notation specially
      let notationText;
      if (el.isSplitRing) {
        const notationA = el.notation.replace(/^sr:\s*/, '');
        const notationB = el.notationB || '5ds';
        notationText = `sr: A: ${notationA} B: ${notationB}`;
      } else {
        notationText = el.notation;
      }

      // Annotate notation (adds jp connection references)
      const annotated = annotateNotation(notationText, el.id);
      
      // Add connection references for joined picots
      const jpPicots = el.picots?.filter(p => p.isJoint) || [];
      if (jpPicots.length > 0) {
        // Find all elements connected via these joined picots
        const connectedElements = new Set();
        
        picotConnections.forEach(conn => {
          // Check if this element is part of the connection
          const hasThisElement = conn.picots.some(p => p.elementId === el.id);
          if (hasThisElement) {
            // Add all OTHER elements in this connection
            conn.picots.forEach(p => {
              if (p.elementId !== el.id) {
                const connEl = elementById.get(p.elementId);
                if (connEl && connEl.orderNumber) {
                  const typePrefix = connEl.type === 'ring' ? 'r' : connEl.type === 'chain' ? 'c' : 'line';
                  connectedElements.add(`${typePrefix}${connEl.orderNumber}`);
                }
              }
            });
          }
        });
        
        if (connectedElements.size > 0) {
          const refs = Array.from(connectedElements).sort().map(ref => `//${ref}`).join('');
          return `${item.rawOrder}${dupWarning}. ${annotated} ${refs}`;
        }
      }
      
      return `${item.rawOrder}${dupWarning}. ${annotated}`;
    });

    if (dupNums.length > 0) {
      patternLines.unshift(`⚠ Warning: duplicate order numbers: ${dupNums.join(', ')}`);
    }

    // Collect unnumbered rings + chains (lines without numbers are less meaningful to list)
    const unnumberedElements = elements.filter(el => {
      if (el.type === 'line') return false; // lines optional, skip to keep output clean
      const num = el.orderNumber?.toString().trim();
      return !num || num === '';
    });

    const unnumberedBlock = unnumberedElements.length > 0
      ? (() => {
          const list = unnumberedElements.map(el => {
            const typeLabel = el.type === 'ring'
              ? (el.isSplitRing ? 'SR' : 'R')
              : 'CH';
            // Show a short notation hint so user can identify the element
            const hint = el.notation
              ? ' (' + el.notation.replace(/^(r|c|sr):\s*/i, '').slice(0, 35) + (el.notation.length > 40 ? '…' : '') + ')'
              : '';
            return `  • ${typeLabel}${hint}`;
          });
          return `\n\n⚠ Some elements don't have an assigned order number:\n${list.join('\n')}`;
        })()
      : '';

    // Append pattern notes if present
    const notesBlock = patternNotes && patternNotes.trim()
      ? `\n\n--- Notes ---\n${patternNotes.trim()}`
      : '';


    // ── Thread Estimate ──────────────────────────────────────────────────────
    const activePreset = (() => {
      const preset = threadPresets.find(p => p.id === activePresetId);
      return preset || threadPresets[0] || DEFAULT_THREAD_PRESET;
    })();

    const perDsWorking  = activePreset.ds20Working / 20;   // mm per DS
    const perDsCore     = activePreset.ds20Core / 20;      // mm per DS core
    const perSsWorking  = perDsWorking * 0.5;
    const picotMm = {
      regular: activePreset.picotRegular,
      joined:  activePreset.picotJoined,
      long:    activePreset.picotRegular * 2,
      short:   activePreset.picotShort ?? (activePreset.picotRegular * 0.5),
      medium:  activePreset.picotRegular,
      lp:      activePreset.picotRegular * 2,
      sp:      activePreset.picotShort ?? (activePreset.picotRegular * 0.5),
      p:       activePreset.picotRegular,
    };

    // Per-material working thread (mm)
    const materialMm: Record<string, number> = {};
    const ensureMat = (id) => { if (!(id in materialMm)) materialMm[id] = 0; };
    let coreTotal = 0;  // mm
    let countDS = 0, countSS = 0, countPicots = 0, countJoined = 0;

    const countStitchType = (notation) => {
      // Returns { ds, ss, regular, long, short, joined, beadDs } from a notation string
      // beadDs = DS-equivalent occupied by bc:/bcp: beads (core thread only, no working thread)
      const result = { ds: 0, ss: 0, regular: 0, long: 0, short: 0, joined: 0, beadDs: 0 };
      if (!notation) return result;

      // Helper: expand bead sequence "3Y" → 3, "YZY" → 3, "YZ" → 2
      const countBeadsInSeq = (seq) => {
        let count = 0, i = 0;
        while (i < seq.length) {
          if (/\d/.test(seq[i])) {
            const n = parseInt(seq[i]); i++;
            if (i < seq.length && /[YZV]/i.test(seq[i])) { count += n; i++; }
          } else if (/[YZV]/i.test(seq[i])) { count += 1; i++; }
          else { i++; }
        }
        return count;
      };

      const tokens = notation.replace(/^(r|c|sr|ch):\s*/i, '').split(/[,\s\-]+/);
      for (const tok of tokens) {
        // bc:SEQ — each bead in sequence = 1 DS on core, 0 working thread
        const bcMatch = tok.match(/^bc:([YZVyzv0-9]+)$/i);
        if (bcMatch) { result.beadDs += countBeadsInSeq(bcMatch[1]); continue; }

        // bcp:CORE or bcp:CORE:SEQ — 1 DS on core, 0 working thread
        const bcpMatch = tok.match(/^bcp:([YZVyzv])(:([YZVyzv0-9]+))?$/i);
        if (bcpMatch) { result.beadDs += 1; continue; }

        // bcjp:CORE or bcjp:CORE:SEQ — 1 DS on core, 0 working thread, is joint
        const bcjpMatch = tok.match(/^bcjp:([YZVyzv])(:([YZVyzv0-9]+))?$/i);
        if (bcjpMatch) { result.beadDs += 1; continue; }
        // BE — 1 DS core, counted from beadLibrary entries not notation
        if (tok.match(/^be$/i)) { result.beadDs += 1; continue; }

        // Standard stitch tokens: 12ds, 5p, 3jp, etc.
        const m = tok.match(/^(\d+)(ds|ss|rds|p|lp|sp|jp|gjp|bjp)?$/i);
        if (!m) continue;
        const n = parseInt(m[1]);
        const t = (m[2] || 'ds').toLowerCase();
        if (t === 'ds') result.ds += n;
        else if (t === 'rds') result.ds += n * 2;
        else if (t === 'ss') result.ss += n;
        else if (t === 'p') result.regular += n;
        else if (t === 'lp') result.long += n;
        else if (t === 'sp') result.short += n;
        else if (t === 'jp' || t === 'gjp') result.joined += n;
        // bjp: zero DS width, skip
      }
      return result;
    };

    for (const el of elements) {
      const matId = el.materialId || 'default';
      ensureMat(matId);

      if (el.type === 'line') {
        // Path length in px ÷ dsWidth → DS units → multiply by core and working per DS
        const totalPx = (el.paths || []).reduce((sum, path) => {
          const pts = [];
          for (let i = 0; i <= 20; i++) {
            const t = i / 20, u = 1 - t;
            if (path.type === 'cubic') {
              pts.push({ x: u*u*u*path.x+3*u*u*t*path.control1X+3*u*t*t*path.control2X+t*t*t*path.endX,
                          y: u*u*u*path.y+3*u*u*t*path.control1Y+3*u*t*t*path.control2Y+t*t*t*path.endY });
            } else {
              pts.push({ x: u*u*path.x+2*u*t*(path.controlX||path.control1X)+t*t*path.endX,
                          y: u*u*path.y+2*u*t*(path.controlY||path.control1Y)+t*t*path.endY });
            }
          }
          let len = 0;
          for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
          return sum + len;
        }, 0);
        const dsUnits = totalPx / dsWidth;
        materialMm[matId] += dsUnits * perDsWorking;
        coreTotal += dsUnits * perDsCore;
        countDS += Math.round(dsUnits);
        continue;
      }

      // Ring, chain, teardrop, split ring
      const notationStr = el.notation || '';
      const s = countStitchType(notationStr);
      materialMm[matId] += s.ds * perDsWorking + s.ss * perSsWorking;
      // beadDs: beads occupy path (core) but use no working thread
      coreTotal += (s.ds + s.ss * 0.5 + s.beadDs) * perDsCore;
      countDS += s.ds + s.beadDs; countSS += s.ss;

      // Picots from parsed notation stitches
      const picotList = el.picots || [];
      for (const p of picotList) {
        // bcp with no beadSeq = plain picot — include its thread length
        if (p.beadType && !(p.beadType === 'bcp' && !p.beadSeq) && !(p.beadType === 'bcjp' && !p.beadSeq)) continue;
        if (p.isJoint) {
          // Joined picots: add to both connected elements — handled via connections below
          continue;
        }
        const pLen = picotMm[p.length] || picotMm['regular'];
        materialMm[matId] += pLen;
        countPicots++;
      }

      // Split ring section B
      if (el.isSplitRing && el.notationB) {
        const matIdB = el.materialIdB || matId;
        ensureMat(matIdB);
        const sB = countStitchType(el.notationB);
        materialMm[matIdB] += sB.ds * perDsWorking + sB.ss * perSsWorking;
        coreTotal += (sB.ds + sB.ss * 0.5 + sB.beadDs) * perDsCore;
        countDS += sB.ds + sB.beadDs; countSS += sB.ss;
      }
    }

    // Joined picots: add joined picot length to both connected elements' materials
    for (const conn of picotConnections) {
      countJoined++;
      for (const cp of conn.picots) {
        const el = elementById.get(cp.elementId);
        if (!el) continue;
        const matId = el.materialId || 'default';
        ensureMat(matId);
        materialMm[matId] += picotMm['joined'];
      }
    }

    // ── Bead Count ───────────────────────────────────────────────────────────
    // Expand a bead sequence string ("3Y", "YZY", etc.) → {Y:n, Z:n, V:n}
    const countBeadsInSeqObj = (seq) => {
      const counts = { Y: 0, Z: 0, V: 0 };
      if (!seq) return counts;
      let i = 0;
      const s = seq.toUpperCase();
      while (i < s.length) {
        let n = 1;
        if (/\d/.test(s[i])) { n = parseInt(s[i]); i++; }
        if (i < s.length && /[YZV]/.test(s[i])) { counts[s[i]] += n; i++; }
        else { i++; }
      }
      return counts;
    };
    const addBeads = (totals, counts) => {
      for (const k of ['Y','Z','V']) totals[k] += counts[k] || 0;
    };

    const beadTotals = { Y: 0, Z: 0, V: 0 };

    for (const el of elements) {
      // Beads on picots (bc, bcp, bp, bp1-5, bjp, sb)
      for (const p of (el.picots || [])) {
        if (!p.beadType) continue;
        if (p.beadType === 'bc') {
          // Single bead per picot entry — beadSize is 'Y', 'Z', or 'V'
          const sz = (p.beadSize || 'Y').toUpperCase();
          if (sz in beadTotals) beadTotals[sz]++;
        } else if (p.beadType === 'bcp' || p.beadType === 'bcjp') {
          // 1 core bead + optional cluster (bcp/bcjp)
          const coreSz = (p.coreSize || 'Y').toUpperCase();
          if (coreSz in beadTotals) beadTotals[coreSz]++;
          addBeads(beadTotals, countBeadsInSeqObj(p.beadSeq || ''));
        } else if (p.beadSeq) {
          // bp, bjp, sb — all carry a beadSeq
          addBeads(beadTotals, countBeadsInSeqObj(p.beadSeq));
        }
      }
      // Line beads
      if (el.type === 'line' && el.lineBeads) {
        addBeads(beadTotals, countBeadsInSeqObj(el.lineBeads));
      }
      // BE beads — count from bead library
      for (const p of (el.picots || [])) {
        if (p.beadType !== 'be') continue;
        for (const beadId of (p.coreBeads || [])) {
          if (!beadId) continue;
          const b = beadLibrary.find(b => b.id === beadId);
          if (b) {
            const sz = b.size === 'S' ? 'Y' : b.size === 'M' ? 'Z' : b.size === 'L' ? 'V' : b.size;
            if (sz in beadTotals) beadTotals[sz]++;
          }
        }
        for (const beadId of (p.picotBeads || [])) {
          if (!beadId) continue;
          const b = beadLibrary.find(b => b.id === beadId);
          if (b) {
            const sz = b.size === 'S' ? 'Y' : b.size === 'M' ? 'Z' : b.size === 'L' ? 'V' : b.size;
            if (sz in beadTotals) beadTotals[sz]++;
          }
        }
      }
    }

    const beadEntries = [
      beadTotals.Y > 0 ? `Y (small) × ${beadTotals.Y}` : null,
      beadTotals.Z > 0 ? `Z (medium) × ${beadTotals.Z}` : null,
      beadTotals.V > 0 ? `V (large) × ${beadTotals.V}` : null,
    ].filter(Boolean);
    const beadBlock = beadEntries.length > 0
      ? `\n\n--- Beads ---\n` + beadEntries.join('\n')
      : '';

    const mmToM = (mm) => (mm / 1000).toFixed(2);

    const materialLines = Object.entries(materialMm)
      .filter(([, mm]) => mm > 0)
      .map(([id, mm]) => {
        const mat = materials.find(m => m.id === id);
        const name = mat ? mat.name : id;
        return `${name} ~ ${mmToM(mm)} m`;
      });

    const coreM = parseFloat(mmToM(coreTotal));
    const multiMat = Object.keys(materialMm).filter(id => (materialMm[id] || 0) > 0).length > 1;

    const threadBlock = materialLines.length > 0
      ? `\n\n--- Thread Estimate (${activePreset.name}) ---` +
        `\n(tie-ins and tails not included)\n` +
        materialLines.map(l => `\n${l}`).join('') +
        `\n\nNote: core thread not included — add manually` +
        (multiMat ? ` (multi-material pattern)` : '') +
        `\nCore thread ~ ${coreM} m` +
        `\n\nDS: ${countDS}  SS: ${countSS}  Picots: ${countPicots}  Joined: ${countJoined}`
      : '';

    const patternText = (fallbackHeader
      ? fallbackHeader + (threadBlock ? threadBlock : '') + beadBlock + notesBlock
      : patternLines.join('\n') + unnumberedBlock + notesBlock + threadBlock + beadBlock);

    navigator.clipboard.writeText(patternText).then(() => {
      showLoadMsg('success', 'Notation copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy:', err);
      showLoadMsg('error', 'Copy failed — check browser clipboard permissions');
    });
  }, [elements, picotConnections, patternNotes, threadPresets, activePresetId, materials, dsWidth]);

  // Export as PNG

  // Join selected joint picots with a connection
  const joinSelectedPicots = useCallback(() => {
    if (selectedPicots.length < 2) {
      console.log('Need at least 2 joint picots to join');
      return;
    }
    
    // Create a new connection
    const connection = {
      id: Date.now() + Math.random(),
      picots: [...selectedPicots] // Array of {elementId, picotId}
    };
    
    setPicotConnections(prev => [...prev, connection]);
    setSelectedPicots([]); // Clear selection after joining
    console.log('Joined', selectedPicots.length, 'picots');
  }, [selectedPicots]); // Dependency: selectedPicots for creating connection

  // Break connections for selected joint picots
  const breakSelectedPicots = useCallback(() => {
    if (selectedPicots.length === 0) {
      console.log('No picots selected to break');
      return;
    }
    
    // Remove any connections that include any of the selected picots
    setPicotConnections(prev => prev.filter(conn => {
      return !conn.picots.some(p => 
        selectedPicots.some(sp => sp.elementId === p.elementId && sp.picotId === p.picotId)
      );
    }));
    
    setSelectedPicots([]); // Clear selection after breaking
    console.log('Broke connections for selected picots');
  }, [selectedPicots]); // Dependency: selectedPicots for filtering


  const allColors = [...COLORS, ...customColors];

  const screenToWorld = useCallback((screenX, screenY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - camera.x) / zoom,
      y: (screenY - rect.top - camera.y) / zoom
    };
  }, [camera, zoom]); // Dependencies: camera and zoom for coordinate transformation

  // Returns minimum distance from (worldX, worldY) to any sampled point on the element's paths.
  // Used for both hit-testing and tie-breaking between overlapping elements.
  const minPathDistance = (element, worldX, worldY) => {
    let minDist = Infinity;
    for (let path of element.paths) {
      const points = sampleBezierPath(path, 20);
      for (let pt of points) {
        const d = Math.hypot(pt.x - worldX, pt.y - worldY);
        if (d < minDist) minDist = d;
      }
    }
    return minDist;
  };

  const isPointInElement = (element, worldX, worldY) => {
    return minPathDistance(element, worldX, worldY) < 40;
  };
  
  // Find closest element by minimum path distance (works correctly for split rings and lines)
  const findClosestElement = (worldX, worldY, filterFn = null) => {
    const candidates = elements.filter(el => {
      if (filterFn && !filterFn(el)) return false;
      return isPointInElement(el, worldX, worldY);
    });
    
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    
    // Tie-break by minimum distance to any path point (not center distance)
    let closest = candidates[0];
    let closestDist = minPathDistance(closest, worldX, worldY);
    
    for (let i = 1; i < candidates.length; i++) {
      const dist = minPathDistance(candidates[i], worldX, worldY);
      if (dist < closestDist) {
        closest = candidates[i];
        closestDist = dist;
      }
    }
    
    return closest;
  };

  const getBoundingBox = (ids) => {
    const els = elements.filter(e => ids.includes(e.id));
    if (els.length === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    els.forEach(el => {
      // Handle circles (rendered as SVG circle, not paths)
      if (el.isClosed && el.shapeStyle === 'circle') {
        const targetCircumference = el.stitchCount * dsWidth;
        const radius = targetCircumference / (2 * Math.PI);
        
        // Add picot lengths to radius if element has picots
        let maxPicotLength = 0;
        if (el.picots && el.picots.length > 0) {
          const picotSize = { small: 13, medium: 20, large: 26 };
          el.picots.forEach(p => {
            const len = picotSize[p.length] || 20;
            maxPicotLength = Math.max(maxPicotLength, len);
          });
        }
        
        const effectiveRadius = radius + maxPicotLength;
        
        minX = Math.min(minX, el.center.x - effectiveRadius);
        minY = Math.min(minY, el.center.y - effectiveRadius);
        maxX = Math.max(maxX, el.center.x + effectiveRadius);
        maxY = Math.max(maxY, el.center.y + effectiveRadius);
      } else {
        // Sample all paths to find bounds (for chains, teardrops, lines)
        let elMinX = Infinity, elMinY = Infinity, elMaxX = -Infinity, elMaxY = -Infinity;
        el.paths.forEach(path => {
          const points = sampleBezierPath(path, 20);
          points.forEach(pt => {
            elMinX = Math.min(elMinX, pt.x);
            elMinY = Math.min(elMinY, pt.y);
            elMaxX = Math.max(elMaxX, pt.x);
            elMaxY = Math.max(elMaxY, pt.y);
          });
        });
        
        // Account for picots on this element only — expand element bounds, then merge
        if (el.picots && el.picots.length > 0) {
          const picotSize = { small: 13, medium: 20, large: 26 };
          let maxPicotLength = 0;
          el.picots.forEach(p => {
            const len = picotSize[p.length] || 20;
            maxPicotLength = Math.max(maxPicotLength, len);
          });
          elMinX -= maxPicotLength;
          elMinY -= maxPicotLength;
          elMaxX += maxPicotLength;
          elMaxY += maxPicotLength;
        }

        minX = Math.min(minX, elMinX);
        minY = Math.min(minY, elMinY);
        maxX = Math.max(maxX, elMaxX);
        maxY = Math.max(maxY, elMaxY);
      }
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  };

  // Fit all elements in view
  const fitAllElements = () => {
    if (elements.length === 0) return;
    if (!canvasRef.current) return;
    
    const allIds = elements.map(e => e.id);
    const bbox = getBoundingBox(allIds);
    if (!bbox) return;
    
    console.log('Fit All - BBox:', bbox);
    console.log('Fit All - Elements:', elements.length);
    
    // Get actual canvas dimensions
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    
    console.log('Fit All - Canvas size:', canvasWidth, 'x', canvasHeight);
    
    // Minimal padding - 25px
    const padding = 25;
    
    // Calculate zoom to fit with padding
    const zoomX = (canvasWidth - padding * 2) / bbox.width;
    const zoomY = (canvasHeight - padding * 2) / bbox.height;
    let newZoom = Math.min(zoomX, zoomY);
    
    // Don't zoom in too much or too little
    newZoom = Math.max(0.3, Math.min(3, newZoom));
    
    console.log('Fit All - New zoom:', newZoom, 'Pattern center:', bbox.centerX, bbox.centerY);
    
    // Camera is a translate offset, not a center point!
    // Transform is: translate(camera.x, camera.y) scale(zoom)
    // To center bbox.center on screen: screenCenter = worldCenter * zoom + camera
    // So: camera = screenCenter - worldCenter * zoom
    const cameraX = (canvasWidth / 2) - (bbox.centerX * newZoom);
    const cameraY = (canvasHeight / 2) - (bbox.centerY * newZoom);
    
    console.log('Fit All - Camera offset:', cameraX, cameraY);
    
    setZoom(newZoom);
    setCamera({ x: cameraX, y: cameraY });
    
    console.log('Fit All - Applied!');
  };

  // Zoom toward the center of the screen by a delta amount.
  // Reads from refs so it stays correct even when called from stale closures
  // (e.g. the keydown useEffect which only re-registers on clipboard change).
  const zoomToCenter = (delta) => {
    const currentZoom = zoomRef.current;
    const currentCamera = cameraRef.current;
    const newZoom = Math.max(0.1, Math.min(3, currentZoom + delta));
    if (!canvasRef.current) { setZoom(newZoom); return; }
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = rect.width / 2;
    const canvasY = rect.height / 2;
    const worldX = (canvasX - currentCamera.x) / currentZoom;
    const worldY = (canvasY - currentCamera.y) / currentZoom;
    setZoom(newZoom);
    setCamera({ x: canvasX - worldX * newZoom, y: canvasY - worldY * newZoom });
  };

  // NEW: Handle detection for path edit mode (chains and lines)
  const getHandleAtPoint = (element, worldX, worldY) => {
    if ((element.type !== 'chain' && element.type !== 'line') || !element.paths || element.paths.length === 0) return null;
    const handleRadius = 22 / zoom; // Fixed screen-pixel size — matches rendered handle size
    const path = element.paths[0]; // Chains and lines have one path
    
    if (Math.hypot(path.x - worldX, path.y - worldY) < handleRadius) {
      return { type: 'start', elementId: element.id };
    }
    if (Math.hypot(path.endX - worldX, path.endY - worldY) < handleRadius) {
      return { type: 'end', elementId: element.id };
    }
    
    // Support both quadratic and cubic bezier
    if (path.type === 'cubic') {
      // Check control1 first (closer to start)
      if (Math.hypot(path.control1X - worldX, path.control1Y - worldY) < handleRadius) {
        return { type: 'control1', elementId: element.id };
      }
      // Check control2 (closer to end)
      if (Math.hypot(path.control2X - worldX, path.control2Y - worldY) < handleRadius) {
        return { type: 'control2', elementId: element.id };
      }
    } else if (path.type === 'quadratic') {
      // Legacy quadratic support
      if (Math.hypot(path.controlX - worldX, path.controlY - worldY) < handleRadius) {
        return { type: 'control', elementId: element.id };
      }
    }
    
    return null;
  };

  const handleMouseDown = (e) => {
    // Middle click (button 1) = pan, regardless of current tool
    if (e.button === 1) {
      e.preventDefault(); // Prevent default middle-click behavior
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }
    
    // Only handle left click for tools
    if (e.button !== 0) return;
    const world = screenToWorld(e.clientX, e.clientY);

    // Check for rotation handles and pivot FIRST (when select tool active and elements selected)
    if (currentTool === 'select' && selectedIds.length > 0) {
      const bbox = getBoundingBox(selectedIds);
      if (bbox) {
        const pivotX = bbox.centerX + pivotOffset.x;
        const pivotY = bbox.centerY + pivotOffset.y;
        
        // Check if clicking pivot point (8px radius)
        if (Math.hypot(pivotX - world.x, pivotY - world.y) < 8) {
          setMovingPivot(true);
          setDragStart({ x: world.x, y: world.y });
          isInteractingRef.current = true; // Mark as interacting
          return;
        }
        
        // Check corner handles (10px radius) - ONLY if rotation handles are enabled
        const shouldShowRotationHandles = isShiftHeld || showRotationHandles;
        
        if (shouldShowRotationHandles) {
          const corners = [
            { x: bbox.x, y: bbox.y, name: 'tl' },
            { x: bbox.x + bbox.width, y: bbox.y, name: 'tr' },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height, name: 'br' },
            { x: bbox.x, y: bbox.y + bbox.height, name: 'bl' }
          ];
          
          for (let corner of corners) {
            if (Math.hypot(corner.x - world.x, corner.y - world.y) < 10) {
              setRotationHandle(corner.name);
              setDragStart({ x: world.x, y: world.y, centerX: pivotX, centerY: pivotY });
              isInteractingRef.current = true; // Mark as interacting
              return;
            }
          }
        }
      }
    }

    // NEW: Path edit mode
    if (currentTool === 'path') {
      // Only chains are editable with the path tool
      const isPathEditable = (el) => el.type === 'chain';

      if (selectedIds.length === 1) {
        const selected = elementById.get(selectedIds[0]);
        if (selected && isPathEditable(selected)) {
          const handle = getHandleAtPoint(selected, world.x, world.y);
          if (handle) {
            draggedHandleRef.current = handle;
            lastMousePosRef.current = { x: world.x, y: world.y };
            isInteractingRef.current = true;
            
            const path = selected.paths[0];
            if (path.type === 'cubic') {
              pathDragStartRef.current = {
                startX: world.x,
                startY: world.y,
                control1X: path.control1X,
                control1Y: path.control1Y,
                control2X: path.control2X,
                control2Y: path.control2Y
              };
            } else {
              pathDragStartRef.current = {
                startX: world.x,
                startY: world.y,
                controlX: path.controlX,
                controlY: path.controlY
              };
            }
            return;
          }
        }
      }
      
      // No handle hit — check what was clicked
      const clicked = findClosestElement(world.x, world.y);
      if (clicked) {
        if (isPathEditable(clicked)) {
          // Another path-editable element: stay in path edit, switch to it
          setSelectedIds([clicked.id]);
        } else {
          // Non-path element (e.g. line): exit to select tool
          setSelectedIds([clicked.id]);
          setCurrentTool('select');
        }
      }
      // Empty canvas single click: do nothing — stay in path edit mode
      // (double click on empty canvas exits — handled in onDoubleClick)
    } else if (currentTool === 'line') {
      // Line tool mode - can edit line elements
      if (selectedIds.length === 1) {
        const selected = elementById.get(selectedIds[0]);
        if (selected && selected.type === 'line') {
          const handle = getHandleAtPoint(selected, world.x, world.y);
          if (handle) {
            draggedHandleRef.current = handle;
            lastMousePosRef.current = { x: world.x, y: world.y };
            isInteractingRef.current = true;
            
            // Store initial control points
            const path = selected.paths[0];
            if (path.type === 'cubic') {
              pathDragStartRef.current = {
                startX: world.x,
                startY: world.y,
                control1X: path.control1X,
                control1Y: path.control1Y,
                control2X: path.control2X,
                control2Y: path.control2Y
              };
            }
            return;
          }
        }
      }
      
      // If no handle was clicked, allow selecting a line by clicking on it
      const clicked = findClosestElement(world.x, world.y, el => el.type === 'line');
      if (clicked) {
        setSelectedIds([clicked.id]);
      } else {
        // Create new line on click
        const newLine = {
          id: Date.now(),
          type: 'line',
          center: { x: world.x, y: world.y },
          isClosed: false,
          paths: [{
            type: 'cubic',
            x: world.x,
            y: world.y,
            control1X: world.x,
            control1Y: world.y,
            control2X: world.x,
            control2Y: world.y,
            endX: world.x,
            endY: world.y
          }],
          color: '#FFFFFF',
          notation: 'line',
          lineWidth: 2
        };
        setElements(prev => [...prev, newLine]);
        setSelectedIds([newLine.id]);
        // Start dragging the endpoint
        draggedHandleRef.current = { type: 'end', elementId: newLine.id };
        lastMousePosRef.current = { x: world.x, y: world.y };
        isInteractingRef.current = true;
      }
    } else if (currentTool === 'pan') {
      // Pan tool: always pan, never change selection
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (currentTool === 'select') {
      const clicked = findClosestElement(world.x, world.y);
      if (clicked) {
        // Check if clicked element is part of a group
        const groupMembers = clicked.groupId 
          ? elements.filter(el => el.groupId === clicked.groupId).map(el => el.id)
          : [clicked.id];
        
        if (e.ctrlKey || e.shiftKey) {
          // Multi-select: toggle the group or individual element
          setSelectedIds(prev => {
            const allSelected = groupMembers.every(id => prev.includes(id));
            if (allSelected) {
              // Remove all group members
              return prev.filter(id => !groupMembers.includes(id));
            } else {
              // Add all group members
              return [...new Set([...prev, ...groupMembers])];
            }
          });
        } else {
          // Single select: select the whole group
          if (!selectedIds.includes(clicked.id)) setSelectedIds(groupMembers);
          setDraggedElement(clicked.id);
          lastMousePosRef.current = { x: world.x, y: world.y };
          dragOriginRef.current = { x: world.x, y: world.y }; // For ortho axis lock
          isInteractingRef.current = true; // Mark as interacting
        }
      } else {
        if (!e.ctrlKey && !e.shiftKey) setSelectedIds([]);
        setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
      }
    } else if (currentTool === 'picotJoin') {
      // NEW: Picot Join mode - start box selection for joint picots
      setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
    } else if (currentTool === 'beading') {
      // Beading mode: hit-test BE picots; start drag-rect if miss
      let hitBE = null;
      elements.forEach(el => {
        (el.picots || []).forEach(p => {
          if (p.beadType !== 'be') return;
          const pos = getPicotPosition(el, p, true);
          if (!pos) return;
          if (Math.hypot(pos.x - world.x, pos.y - world.y) < 20 / zoom) {
            hitBE = { elementId: el.id, picotId: p.id };
          }
        });
      });
      if (hitBE) {
        const hasModifier = e.shiftKey || e.ctrlKey || e.metaKey;
        if (hasModifier) {
          // Shift/Ctrl+click: toggle in selection
          const alreadySel = selectedBEs.some(s => s.elementId === hitBE.elementId && s.picotId === hitBE.picotId);
          setSelectedBEs(alreadySel
            ? selectedBEs.filter(s => !(s.elementId === hitBE.elementId && s.picotId === hitBE.picotId))
            : [...selectedBEs, hitBE]
          );
        } else {
          setSelectedBEs([hitBE]);
        }
      } else {
        // Start drag-rect selection (same as picotJoin)
        setSelectionBox({ x: world.x, y: world.y, width: 0, height: 0 });
      }
    }
  };

  const handleMouseMove = (e) => {
    // PERFORMANCE OPTIMIZATION: RAF Batching + 30fps cap for realistic rendering
    pendingMouseEventRef.current = { clientX: e.clientX, clientY: e.clientY };
    
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame((timestamp) => {
        rafIdRef.current = null;
        
        if (!pendingMouseEventRef.current) return;
        
        // Cap at ~30fps (33ms per frame) — realistic rendering is expensive,
        // display refresh (60-120fps) is overkill for this use case
        const elapsed = timestamp - lastFrameTimeRef.current;
        if (elapsed < 33) {
          // Too soon — re-queue for next frame without processing
          rafIdRef.current = requestAnimationFrame((ts) => {
            rafIdRef.current = null;
            lastFrameTimeRef.current = ts;
            const ev = pendingMouseEventRef.current;
            // Call via ref so we always use the latest version of the handler,
            // not the version captured in the stale RAF closure.
            if (ev) handleMouseMoveInternalRef.current?.(ev);
          });
          return;
        }
        
        lastFrameTimeRef.current = timestamp;
        const e = pendingMouseEventRef.current;
        // Call via ref so we always use the latest version of the handler.
        handleMouseMoveInternalRef.current?.(e);
      });
    }
  };
  
  // Internal mouse move handler (actual logic)
  const handleMouseMoveInternal = (e) => {
    const world = screenToWorld(e.clientX, e.clientY);

    // Pivot point movement
    if (movingPivot && dragStart) {
      const dx = world.x - dragStart.x;
      const dy = world.y - dragStart.y;
      setPivotOffset({ x: pivotOffset.x + dx, y: pivotOffset.y + dy });
      setDragStart({ x: world.x, y: world.y });
      return;
    }

    // Rotation handle dragging
    if (rotationHandle && dragStart) {
      const bbox = getBoundingBox(selectedIds);
      if (!bbox) return;
      
      const pivotX = dragStart.centerX;
      const pivotY = dragStart.centerY;
      
      const angle1 = Math.atan2(dragStart.y - pivotY, dragStart.x - pivotX);
      const angle2 = Math.atan2(world.y - pivotY, world.x - pivotX);
      const delta = (angle2 - angle1) * 180 / Math.PI;
      const rad = delta * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      // Calculate new bounding box center by rotating old center around pivot
      const oldCenterRelX = bbox.centerX - pivotX;
      const oldCenterRelY = bbox.centerY - pivotY;
      const newBboxCenterX = pivotX + oldCenterRelX * cos - oldCenterRelY * sin;
      const newBboxCenterY = pivotY + oldCenterRelX * sin + oldCenterRelY * cos;
      
      // Rotate all selected elements around the pivot point
      setElements(prev => prev.map(el => {
        if (!selectedIds.includes(el.id)) return el;
        
        // Calculate element center position relative to pivot
        const relX = el.center.x - pivotX;
        const relY = el.center.y - pivotY;
        
        const newCenterX = pivotX + relX * cos - relY * sin;
        const newCenterY = pivotY + relX * sin + relY * cos;
        
        // Rotate all path points
        const newPaths = el.paths.map(path => {
          const rotatePoint = (px, py) => {
            const rpx = px - pivotX;
            const rpy = py - pivotY;
            return {
              x: pivotX + rpx * cos - rpy * sin,
              y: pivotY + rpx * sin + rpy * cos
            };
          };
          
          const start = rotatePoint(path.x, path.y);
          const end = rotatePoint(path.endX, path.endY);
          
          if (path.type === 'cubic') {
            const c1 = rotatePoint(path.control1X, path.control1Y);
            const c2 = rotatePoint(path.control2X, path.control2Y);
            return {
              ...path,
              x: start.x, y: start.y,
              endX: end.x, endY: end.y,
              control1X: c1.x, control1Y: c1.y,
              control2X: c2.x, control2Y: c2.y
            };
          } else {
            const ctrl = rotatePoint(path.controlX, path.controlY);
            return {
              ...path,
              x: start.x, y: start.y,
              endX: end.x, endY: end.y,
              controlX: ctrl.x, controlY: ctrl.y
            };
          }
        });
        
        return {
          ...el,
          center: { x: newCenterX, y: newCenterY },
          rotation: (el.rotation || 0) + delta,
          paths: newPaths
        };
      }));
      
      // Update pivot offset to keep pivot in same world position
      // New offset = pivot world position - new bbox center
      setPivotOffset({
        x: pivotX - newBboxCenterX,
        y: pivotY - newBboxCenterY
      });
      
      setDragStart({ x: world.x, y: world.y, centerX: pivotX, centerY: pivotY });
      return;
    }

    // NEW: Path edit mode handle dragging
    // Line tool dragging - simpler than paths, no length constraints
    if (currentTool === 'line' && draggedHandleRef.current) {
      const handleInfo = draggedHandleRef.current;
      setElements(prev => prev.map(el => {
        if (el.id !== handleInfo.elementId || el.type !== 'line' || !el.paths || el.paths.length === 0) return el;

        const path = el.paths[0];
        
        if (handleInfo.type === 'start') {
          // Move start point with snap
          let newX = world.x;
          let newY = world.y;
          
          // SNAP TO POINT: Check if near any snap points
          if (snapEnabled) {
            const snapPoint = findNearestSnapPoint(world.x, world.y, handleInfo.elementId);
            if (snapPoint) {
              newX = snapPoint.x;
              newY = snapPoint.y;
            }
          }
          
          return {
            ...el,
            paths: [{
              ...path,
              x: newX,
              y: newY,
              // Keep control points on the line — interpolate between new start and existing end
              control1X: newX + (path.endX - newX) * 0.33,
              control1Y: newY + (path.endY - newY) * 0.33
            }],
            center: {
              x: (newX + path.endX) / 2,
              y: (newY + path.endY) / 2
            }
          };
        } else if (handleInfo.type === 'end') {
          // Move end point with snap
          let newX = world.x;
          let newY = world.y;
          
          // SNAP TO POINT: Check if near any snap points
          if (snapEnabled) {
            const snapPoint = findNearestSnapPoint(world.x, world.y, handleInfo.elementId);
            if (snapPoint) {
              newX = snapPoint.x;
              newY = snapPoint.y;
            }
          }
          
          return {
            ...el,
            paths: [{
              ...path,
              endX: newX,
              endY: newY,
              // Keep control points on the line for straight lines
              control2X: path.x + (newX - path.x) * 0.67,
              control2Y: path.y + (newY - path.y) * 0.67
            }],
            center: {
              x: (path.x + newX) / 2,
              y: (path.y + newY) / 2
            }
          };
        } else if (handleInfo.type === 'control1') {
          // Move control point 1 freely (for curved lines)
          return {
            ...el,
            paths: [{
              ...path,
              control1X: world.x,
              control1Y: world.y
            }]
          };
        } else if (handleInfo.type === 'control2') {
          // Move control point 2 freely (for curved lines)
          return {
            ...el,
            paths: [{
              ...path,
              control2X: world.x,
              control2Y: world.y
            }]
          };
        }
        
        return el;
      }));
    }
    
    if (currentTool === 'path' && draggedHandleRef.current) {
      const handleInfo = draggedHandleRef.current;
      setElements(prev => prev.map(el => {
        if (el.id !== handleInfo.elementId || el.type !== 'chain' || !el.paths || el.paths.length === 0) return el;

        const path = el.paths[0];
        const targetLength = el.stitchCount * dsWidth;
        const tolerance = targetLength * 0.07;

        if (handleInfo.type === 'start') {
          // SMART ENDPOINT DRAGGING:
          // When dragging start point: keep END fixed, adjust control points to maintain length
          
          let newStartX = world.x;
          let newStartY = world.y;
          
          // SNAP TO POINT: Check if near any snap points
          if (snapEnabled) {
            const snapPoint = findNearestSnapPoint(world.x, world.y, handleInfo.elementId);
            if (snapPoint) {
              newStartX = snapPoint.x;
              newStartY = snapPoint.y;
            }
          }
          
          // CLAMP: Prevent dragging beyond target length (prevents infinite stretching)
          const dx = newStartX - path.endX;
          const dy = newStartY - path.endY;
          const straightLineDist = Math.hypot(dx, dy);
          
          if (straightLineDist > targetLength) {
            // Clamp to target length
            const angle = Math.atan2(dy, dx);
            newStartX = path.endX + Math.cos(angle) * targetLength;
            newStartY = path.endY + Math.sin(angle) * targetLength;
          }
          
          if (path.type === 'cubic') {
            // For cubic bezier: adjust both control points proportionally
            const midX = (newStartX + path.endX) / 2;
            const midY = (newStartY + path.endY) / 2;
            const dx = path.endX - newStartX;
            const dy = path.endY - newStartY;
            const perpX = -dy;
            const perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            
            if (perpLen === 0) {
              return { ...el, paths: [{ ...path, x: newStartX, y: newStartY }] };
            }
            
            // Calculate average perpendicular offset of old control points
            const oldMidX = (path.x + path.endX) / 2;
            const oldMidY = (path.y + path.endY) / 2;
            const oldOffset1X = path.control1X - oldMidX;
            const oldOffset1Y = path.control1Y - oldMidY;
            const oldOffset2X = path.control2X - oldMidX;
            const oldOffset2Y = path.control2Y - oldMidY;
            const avgDepth = ((oldOffset1X * perpX + oldOffset1Y * perpY) + 
                             (oldOffset2X * perpX + oldOffset2Y * perpY)) / (2 * perpLen);
            const oldSide = Math.sign(avgDepth) || 1;
            
            // Binary search for control point depth (target position)
            let minDepth = 0;
            let maxDepth = targetLength;
            let targetControl1X = midX, targetControl1Y = midY;
            let targetControl2X = midX, targetControl2Y = midY;
            
            for (let iter = 0; iter < 15; iter++) {
              const tryDepth = (minDepth + maxDepth) / 2;
              const perpDirX = (perpX / perpLen) * tryDepth * oldSide;
              const perpDirY = (perpY / perpLen) * tryDepth * oldSide;
              
              // Position control points at 1/3 and 2/3 along the line, plus perpendicular offset
              const tryControl1X = newStartX + dx * 0.33 + perpDirX;
              const tryControl1Y = newStartY + dy * 0.33 + perpDirY;
              const tryControl2X = newStartX + dx * 0.67 + perpDirX;
              const tryControl2Y = newStartY + dy * 0.67 + perpDirY;
              
              const tryPath = {
                type: 'cubic',
                x: newStartX,
                y: newStartY,
                endX: path.endX,
                endY: path.endY,
                control1X: tryControl1X,
                control1Y: tryControl1Y,
                control2X: tryControl2X,
                control2Y: tryControl2Y
              };
              const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
              
              if (Math.abs(tryLength - targetLength) < tolerance * 0.5) {
                targetControl1X = tryControl1X;
                targetControl1Y = tryControl1Y;
                targetControl2X = tryControl2X;
                targetControl2Y = tryControl2Y;
                break;
              }
              
              if (tryLength < targetLength) {
                minDepth = tryDepth;
              } else {
                maxDepth = tryDepth;
              }
              
              targetControl1X = tryControl1X;
              targetControl1Y = tryControl1Y;
              targetControl2X = tryControl2X;
              targetControl2Y = tryControl2Y;
            }
            
            // SMOOTH INTERPOLATION: blend between initial and target control points
            let finalControl1X = targetControl1X;
            let finalControl1Y = targetControl1Y;
            let finalControl2X = targetControl2X;
            let finalControl2Y = targetControl2Y;
            
            if (pathDragStartRef.current) {
              // Calculate drag distance as interpolation factor (0 = start, 1 = full)
              const dragDist = Math.hypot(newStartX - pathDragStartRef.current.startX, 
                                         newStartY - pathDragStartRef.current.startY);
              const maxDist = dsWidth * 3; // Reach full target after dragging ~3 stitch widths
              const t = Math.min(1, dragDist / maxDist); // Clamp to [0, 1]
              
              // Interpolate between initial and target
              finalControl1X = pathDragStartRef.current.control1X * (1 - t) + targetControl1X * t;
              finalControl1Y = pathDragStartRef.current.control1Y * (1 - t) + targetControl1Y * t;
              finalControl2X = pathDragStartRef.current.control2X * (1 - t) + targetControl2X * t;
              finalControl2Y = pathDragStartRef.current.control2Y * (1 - t) + targetControl2Y * t;
            }
            
            return { 
              ...el, 
              paths: [{ 
                ...path, 
                x: newStartX, 
                y: newStartY, 
                control1X: finalControl1X, 
                control1Y: finalControl1Y,
                control2X: finalControl2X,
                control2Y: finalControl2Y
              }] 
            };
            
          } else {
            // Quadratic bezier (legacy)
            const midX = (newStartX + path.endX) / 2;
            const midY = (newStartY + path.endY) / 2;
            const dx = path.endX - newStartX;
            const dy = path.endY - newStartY;
            const perpX = -dy;
            const perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            
            if (perpLen === 0) {
              return { ...el, paths: [{ ...path, x: newStartX, y: newStartY }] };
            }
            
            const oldMidX = (path.x + path.endX) / 2;
            const oldMidY = (path.y + path.endY) / 2;
            const oldOffsetX = path.controlX - oldMidX;
            const oldOffsetY = path.controlY - oldMidY;
            const oldSide = Math.sign(oldOffsetX * perpX + oldOffsetY * perpY) || 1;
            
            let minDepth = 0;
            let maxDepth = targetLength;
            let bestControlX = midX;
            let bestControlY = midY;
            
            for (let iter = 0; iter < 15; iter++) {
              const tryDepth = (minDepth + maxDepth) / 2;
              const tryControlX = midX + (perpX / perpLen) * tryDepth * oldSide;
              const tryControlY = midY + (perpY / perpLen) * tryDepth * oldSide;
              
              const tryPath = {
                x: newStartX,
                y: newStartY,
                endX: path.endX,
                endY: path.endY,
                controlX: tryControlX,
                controlY: tryControlY
              };
              const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
              
              if (Math.abs(tryLength - targetLength) < tolerance * 0.5) {
                bestControlX = tryControlX;
                bestControlY = tryControlY;
                break;
              }
              
              if (tryLength < targetLength) {
                minDepth = tryDepth;
              } else {
                maxDepth = tryDepth;
              }
              
              bestControlX = tryControlX;
              bestControlY = tryControlY;
            }
            
            // SMOOTH INTERPOLATION: blend between initial and target control point
            let finalControlX = bestControlX;
            let finalControlY = bestControlY;
            
            if (pathDragStartRef.current) {
              const dragDist = Math.hypot(newStartX - pathDragStartRef.current.startX, 
                                         newStartY - pathDragStartRef.current.startY);
              const maxDist = dsWidth * 3;
              const t = Math.min(1, dragDist / maxDist);
              
              finalControlX = pathDragStartRef.current.controlX * (1 - t) + bestControlX * t;
              finalControlY = pathDragStartRef.current.controlY * (1 - t) + bestControlY * t;
            }
            
            return { ...el, paths: [{ ...path, x: newStartX, y: newStartY, controlX: finalControlX, controlY: finalControlY }] };
          }
        } else if (handleInfo.type === 'end') {
          // SMART ENDPOINT DRAGGING:
          // When dragging end point: keep START fixed, adjust control points to maintain length
          
          let newEndX = world.x;
          let newEndY = world.y;
          
          // SNAP TO POINT: Check if near any snap points
          if (snapEnabled) {
            const snapPoint = findNearestSnapPoint(world.x, world.y, handleInfo.elementId);
            if (snapPoint) {
              newEndX = snapPoint.x;
              newEndY = snapPoint.y;
            }
          }
          
          // CLAMP: Prevent dragging beyond target length (prevents infinite stretching)
          const dx = newEndX - path.x;
          const dy = newEndY - path.y;
          const straightLineDist = Math.hypot(dx, dy);
          
          if (straightLineDist > targetLength) {
            // Clamp to target length
            const angle = Math.atan2(dy, dx);
            newEndX = path.x + Math.cos(angle) * targetLength;
            newEndY = path.y + Math.sin(angle) * targetLength;
          }
          
          if (path.type === 'cubic') {
            // For cubic bezier: adjust both control points proportionally
            const midX = (path.x + newEndX) / 2;
            const midY = (path.y + newEndY) / 2;
            const dx = newEndX - path.x;
            const dy = newEndY - path.y;
            const perpX = -dy;
            const perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            
            if (perpLen === 0) {
              return { ...el, paths: [{ ...path, endX: newEndX, endY: newEndY }] };
            }
            
            // Calculate average perpendicular offset of old control points
            const oldMidX = (path.x + path.endX) / 2;
            const oldMidY = (path.y + path.endY) / 2;
            const oldOffset1X = path.control1X - oldMidX;
            const oldOffset1Y = path.control1Y - oldMidY;
            const oldOffset2X = path.control2X - oldMidX;
            const oldOffset2Y = path.control2Y - oldMidY;
            const avgDepth = ((oldOffset1X * perpX + oldOffset1Y * perpY) + 
                             (oldOffset2X * perpX + oldOffset2Y * perpY)) / (2 * perpLen);
            const oldSide = Math.sign(avgDepth) || 1;
            
            // Binary search for control point depth
            let minDepth = 0;
            let maxDepth = targetLength;
            let bestControl1X = midX, bestControl1Y = midY;
            let bestControl2X = midX, bestControl2Y = midY;
            
            for (let iter = 0; iter < 15; iter++) {
              const tryDepth = (minDepth + maxDepth) / 2;
              const perpDirX = (perpX / perpLen) * tryDepth * oldSide;
              const perpDirY = (perpY / perpLen) * tryDepth * oldSide;
              
              // Position control points at 1/3 and 2/3 along the line, plus perpendicular offset
              const tryControl1X = path.x + dx * 0.33 + perpDirX;
              const tryControl1Y = path.y + dy * 0.33 + perpDirY;
              const tryControl2X = path.x + dx * 0.67 + perpDirX;
              const tryControl2Y = path.y + dy * 0.67 + perpDirY;
              
              const tryPath = {
                type: 'cubic',
                x: path.x,
                y: path.y,
                endX: newEndX,
                endY: newEndY,
                control1X: tryControl1X,
                control1Y: tryControl1Y,
                control2X: tryControl2X,
                control2Y: tryControl2Y
              };
              const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
              
              if (Math.abs(tryLength - targetLength) < tolerance * 0.5) {
                bestControl1X = tryControl1X;
                bestControl1Y = tryControl1Y;
                bestControl2X = tryControl2X;
                bestControl2Y = tryControl2Y;
                break;
              }
              
              if (tryLength < targetLength) {
                minDepth = tryDepth;
              } else {
                maxDepth = tryDepth;
              }
              
              bestControl1X = tryControl1X;
              bestControl1Y = tryControl1Y;
              bestControl2X = tryControl2X;
              bestControl2Y = tryControl2Y;
            }
            
            // SMOOTH INTERPOLATION: blend between initial and target control points
            let finalControl1X = bestControl1X;
            let finalControl1Y = bestControl1Y;
            let finalControl2X = bestControl2X;
            let finalControl2Y = bestControl2Y;
            
            if (pathDragStartRef.current) {
              const dragDist = Math.hypot(newEndX - pathDragStartRef.current.startX, 
                                         newEndY - pathDragStartRef.current.startY);
              const maxDist = dsWidth * 3;
              const t = Math.min(1, dragDist / maxDist);
              
              finalControl1X = pathDragStartRef.current.control1X * (1 - t) + bestControl1X * t;
              finalControl1Y = pathDragStartRef.current.control1Y * (1 - t) + bestControl1Y * t;
              finalControl2X = pathDragStartRef.current.control2X * (1 - t) + bestControl2X * t;
              finalControl2Y = pathDragStartRef.current.control2Y * (1 - t) + bestControl2Y * t;
            }
            
            return { 
              ...el, 
              paths: [{ 
                ...path, 
                endX: newEndX, 
                endY: newEndY, 
                control1X: finalControl1X, 
                control1Y: finalControl1Y,
                control2X: finalControl2X,
                control2Y: finalControl2Y
              }] 
            };
            
          } else {
            // Quadratic bezier (legacy)
            const midX = (path.x + newEndX) / 2;
            const midY = (path.y + newEndY) / 2;
            const dx = newEndX - path.x;
            const dy = newEndY - path.y;
            const perpX = -dy;
            const perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            
            if (perpLen === 0) {
              return { ...el, paths: [{ ...path, endX: newEndX, endY: newEndY }] };
            }
            
            const oldMidX = (path.x + path.endX) / 2;
            const oldMidY = (path.y + path.endY) / 2;
            const oldOffsetX = path.controlX - oldMidX;
            const oldOffsetY = path.controlY - oldMidY;
            const oldSide = Math.sign(oldOffsetX * perpX + oldOffsetY * perpY) || 1;
            
            let minDepth = 0;
            let maxDepth = targetLength;
            let bestControlX = midX;
            let bestControlY = midY;
            
            for (let iter = 0; iter < 15; iter++) {
              const tryDepth = (minDepth + maxDepth) / 2;
              const tryControlX = midX + (perpX / perpLen) * tryDepth * oldSide;
              const tryControlY = midY + (perpY / perpLen) * tryDepth * oldSide;
              
              const tryPath = {
                x: path.x,
                y: path.y,
                endX: newEndX,
                endY: newEndY,
                controlX: tryControlX,
                controlY: tryControlY
              };
              const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
              
              if (Math.abs(tryLength - targetLength) < tolerance * 0.5) {
                bestControlX = tryControlX;
                bestControlY = tryControlY;
                break;
              }
              
              if (tryLength < targetLength) {
                minDepth = tryDepth;
              } else {
                maxDepth = tryDepth;
              }
              
              bestControlX = tryControlX;
              bestControlY = tryControlY;
            }
            
            // SMOOTH INTERPOLATION: blend between initial and target control point
            let finalControlX = bestControlX;
            let finalControlY = bestControlY;
            
            if (pathDragStartRef.current) {
              const dragDist = Math.hypot(newEndX - pathDragStartRef.current.startX, 
                                         newEndY - pathDragStartRef.current.startY);
              const maxDist = dsWidth * 3;
              const t = Math.min(1, dragDist / maxDist);
              
              finalControlX = pathDragStartRef.current.controlX * (1 - t) + bestControlX * t;
              finalControlY = pathDragStartRef.current.controlY * (1 - t) + bestControlY * t;
            }
            
            return { ...el, paths: [{ ...path, endX: newEndX, endY: newEndY, controlX: finalControlX, controlY: finalControlY }] };
          }
        } else if (handleInfo.type === 'control' || handleInfo.type === 'control1' || handleInfo.type === 'control2') {
          // CUBIC BEZIER SMART BENDING:
          // For cubic bezier, we have 2 control points
          // - control1: closer to start, adjust end point to maintain length
          // - control2: closer to end, adjust start point to maintain length
          // For quadratic (legacy): single control point, adjust end point
          
          const newControlX = world.x;
          const newControlY = world.y;
          
          if (path.type === 'cubic') {
            if (handleInfo.type === 'control1') {
              // SIMPLIFIED STABLE APPROACH:
              // - User drags control1 to a new position
              // - Start point stays FIXED
              // - End point stays FIXED initially
              // - Adjust control2 to maintain path length
              
              const P0 = { x: path.x, y: path.y };
              const P3 = { x: path.endX, y: path.endY };
              const P1_new = { x: newControlX, y: newControlY };
              
              // Calculate control1's handle vector (from start)
              const handle1_dx = P1_new.x - P0.x;
              const handle1_dy = P1_new.y - P0.y;
              const handle1_length = Math.hypot(handle1_dx, handle1_dy);
              const handle1_angle = Math.atan2(handle1_dy, handle1_dx);
              
              // Get old control2's handle vector (from end) - we'll preserve its angle
              const old_c2_dx = path.control2X - P3.x;
              const old_c2_dy = path.control2Y - P3.y;
              const old_c2_angle = Math.atan2(old_c2_dy, old_c2_dx);
              
              // Binary search for control2 handle length that maintains total path length
              let minLen = 0;
              let maxLen = targetLength;
              let bestP2 = { x: path.control2X, y: path.control2Y };
              let bestLengthDiff = Infinity;
              
              for (let iter = 0; iter < 20; iter++) {
                const c2_length = (minLen + maxLen) / 2;
                const P2_try = {
                  x: P3.x + Math.cos(old_c2_angle) * c2_length,
                  y: P3.y + Math.sin(old_c2_angle) * c2_length
                };
                
                const tryPath = {
                  type: 'cubic',
                  x: P0.x, y: P0.y,
                  control1X: P1_new.x, control1Y: P1_new.y,
                  control2X: P2_try.x, control2Y: P2_try.y,
                  endX: P3.x, endY: P3.y
                };
                const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
                const lengthDiff = Math.abs(tryLength - targetLength);
                
                if (lengthDiff < bestLengthDiff) {
                  bestLengthDiff = lengthDiff;
                  bestP2 = P2_try;
                }
                
                if (lengthDiff < tolerance * 0.5) break;
                
                if (tryLength < targetLength) {
                  minLen = c2_length;
                } else {
                  maxLen = c2_length;
                }
              }
              
              return {
                ...el,
                paths: [{
                  ...path,
                  control1X: P1_new.x,
                  control1Y: P1_new.y,
                  control2X: bestP2.x,
                  control2Y: bestP2.y
                }]
              };
              
            } else if (handleInfo.type === 'control2') {
              // SIMPLIFIED STABLE APPROACH (mirrored for control2):
              // - User drags control2 to a new position
              // - End point stays FIXED
              // - Start point stays FIXED initially
              // - Adjust control1 to maintain path length
              
              const P0 = { x: path.x, y: path.y };
              const P3 = { x: path.endX, y: path.endY };
              const P2_new = { x: newControlX, y: newControlY };
              
              // Get old control1's handle vector (from start) - we'll preserve its angle
              const old_c1_dx = path.control1X - P0.x;
              const old_c1_dy = path.control1Y - P0.y;
              const old_c1_angle = Math.atan2(old_c1_dy, old_c1_dx);
              
              // Binary search for control1 handle length that maintains total path length
              let minLen = 0;
              let maxLen = targetLength;
              let bestP1 = { x: path.control1X, y: path.control1Y };
              let bestLengthDiff = Infinity;
              
              for (let iter = 0; iter < 20; iter++) {
                const c1_length = (minLen + maxLen) / 2;
                const P1_try = {
                  x: P0.x + Math.cos(old_c1_angle) * c1_length,
                  y: P0.y + Math.sin(old_c1_angle) * c1_length
                };
                
                const tryPath = {
                  type: 'cubic',
                  x: P0.x, y: P0.y,
                  control1X: P1_try.x, control1Y: P1_try.y,
                  control2X: P2_new.x, control2Y: P2_new.y,
                  endX: P3.x, endY: P3.y
                };
                const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
                const lengthDiff = Math.abs(tryLength - targetLength);
                
                if (lengthDiff < bestLengthDiff) {
                  bestLengthDiff = lengthDiff;
                  bestP1 = P1_try;
                }
                
                if (lengthDiff < tolerance * 0.5) break;
                
                if (tryLength < targetLength) {
                  minLen = c1_length;
                } else {
                  maxLen = c1_length;
                }
              }
              
              return {
                ...el,
                paths: [{
                  ...path,
                  control1X: bestP1.x,
                  control1Y: bestP1.y,
                  control2X: P2_new.x,
                  control2Y: P2_new.y
                }]
              };
            }
          } else if (path.type === 'quadratic') {
            // QUADRATIC BEZIER (legacy) - single control point adjusts end
            const dx = newControlX - path.x;
            const dy = newControlY - path.y;
            const perpX = -dy;
            const perpY = dx;
            const perpLen = Math.hypot(perpX, perpY);
            
            if (perpLen < 1) {
              return { ...el, paths: [{ ...path, controlX: newControlX, controlY: newControlY }] };
            }
            
            const perpDirX = perpX / perpLen;
            const perpDirY = perpY / perpLen;
            const oldOffsetX = path.endX - path.x;
            const oldOffsetY = path.endY - path.y;
            const oldSide = Math.sign(oldOffsetX * perpDirX + oldOffsetY * perpDirY) || 1;
            
            let minDist = 0;
            let maxDist = targetLength * 2;
            let bestEndX = path.endX;
            let bestEndY = path.endY;
            let bestLengthDiff = Infinity;
            
            for (let iter = 0; iter < 20; iter++) {
              const tryDist = (minDist + maxDist) / 2;
              const tryEndX = path.x + perpDirX * tryDist * oldSide;
              const tryEndY = path.y + perpDirY * tryDist * oldSide;
              
              const tryPath = {
                x: path.x,
                y: path.y,
                endX: tryEndX,
                endY: tryEndY,
                controlX: newControlX,
                controlY: newControlY
              };
              const tryLength = calculatePathLength(sampleBezierPath(tryPath, 20));
              const lengthDiff = Math.abs(tryLength - targetLength);
              
              if (lengthDiff < bestLengthDiff) {
                bestLengthDiff = lengthDiff;
                bestEndX = tryEndX;
                bestEndY = tryEndY;
              }
              
              if (lengthDiff < tolerance * 0.5) break;
              
              if (tryLength < targetLength) {
                minDist = tryDist;
              } else {
                maxDist = tryDist;
              }
            }
            
            return { 
              ...el, 
              paths: [{ 
                ...path, 
                controlX: newControlX, 
                controlY: newControlY,
                endX: bestEndX,
                endY: bestEndY
              }] 
            };
          }
        }
        return el;
      }));

      lastMousePosRef.current = { x: world.x, y: world.y };
      return; // Don't process other tools while dragging handle
    }
    
    // Pan mode - middle-click or Pan tool (check BEFORE other tools)
    if (isDragging && dragStart) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setCamera(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setDragStart({ x: e.clientX, y: e.clientY });
      return; // Don't process other tools while panning
    }
    
    if (currentTool === 'select') {
      if (draggedElement && lastMousePosRef.current) {
        let deltaX = world.x - lastMousePosRef.current.x;
        let deltaY = world.y - lastMousePosRef.current.y;
        
        // Ortho lock: constrain to dominant axis (Shift key held OR toggle active)
        if (orthoLock || isShiftHeld) {
          const origin = dragOriginRef.current;
          if (origin) {
            const totalDX = world.x - origin.x;
            const totalDY = world.y - origin.y;
            if (Math.abs(totalDX) >= Math.abs(totalDY)) {
              deltaY = 0; // Lock to X axis
            } else {
              deltaX = 0; // Lock to Y axis
            }
          }
        }
        
        // NOTE: Mid-drag snap was removed — it conflicted with the drag-via-refs pattern.
        // dragOffsetRef accumulates total offset, but the old snap block used only the
        // per-frame deltaX/deltaY against the original element position, causing snap targets
        // near the origin to override the delta and pull the element backward (opposite direction).
        // Snapping is now handled correctly in one shot on mouseup (snap-on-drop).
        
        // PERFORMANCE: Accumulate drag offset in a ref instead of mutating elements state
        // every frame. The SVG transform below handles the visual update. setElements is
        // called once on mouseup — so stitchCache/elementById stay valid all drag long.
        dragOffsetRef.current.dx += deltaX;
        dragOffsetRef.current.dy += deltaY;
        dragOffsetRef.current.active = true;
        lastMousePosRef.current = { x: world.x, y: world.y };
        setDragTick(t => t + 1); // lightweight re-render trigger (no useMemo invalidation)
      } else if (selectionBox) {
        setSelectionBox({ ...selectionBox, width: world.x - selectionBox.x, height: world.y - selectionBox.y });
      }
    } else if (currentTool === 'picotJoin' || currentTool === 'beading') {
      // Update selection box for picot join / beading modes
      if (selectionBox) {
        setSelectionBox({ ...selectionBox, width: world.x - selectionBox.x, height: world.y - selectionBox.y });
      }
    }
  };
  // Keep ref pointing at the latest version of this function.
  // The RAF in handleMouseMove captures a stale closure; routing through this ref
  // ensures it always calls the current version with fresh state/memos.
  handleMouseMoveInternalRef.current = handleMouseMoveInternal;

  const handleMouseUp = (e) => {
    if (selectionBox) {
      const minX = Math.min(selectionBox.x, selectionBox.x + selectionBox.width);
      const maxX = Math.max(selectionBox.x, selectionBox.x + selectionBox.width);
      const minY = Math.min(selectionBox.y, selectionBox.y + selectionBox.height);
      const maxY = Math.max(selectionBox.y, selectionBox.y + selectionBox.height);
      
      if (currentTool === 'beading') {
        // Select BE picots in drag rect
        const boxBEs = [];
        elements.forEach(el => {
          (el.picots || []).forEach(p => {
            if (p.beadType !== 'be') return;
            const pos = getPicotPosition(el, p, true);
            if (!pos) return;
            if (pos.x >= minX - 5 && pos.x <= maxX + 5 && pos.y >= minY - 5 && pos.y <= maxY + 5) {
              boxBEs.push({ elementId: el.id, picotId: p.id });
            }
          });
        });
        const boxW = Math.abs(selectionBox.width);
        const boxH = Math.abs(selectionBox.height);
        const isClick = boxW < 15 && boxH < 15;
        const hasModifier = e?.shiftKey || e?.ctrlKey || e?.metaKey;
        if (!isClick) {
          if (hasModifier) {
            setSelectedBEs(prev => {
              const merged = [...prev];
              boxBEs.forEach(nb => { if (!merged.some(s => s.elementId === nb.elementId && s.picotId === nb.picotId)) merged.push(nb); });
              return merged;
            });
          } else {
            setSelectedBEs(boxBEs);
          }
        } else if (!hasModifier && boxBEs.length === 0) {
          setSelectedBEs([]); // click on empty = deselect all
        }
      } else if (currentTool === 'picotJoin') {
        // NEW: Select joint picots in box
        const selectedJointPicots = [];
        
        elements.forEach(el => {
          if (!el.picots) return;
          
          el.picots.forEach(picot => {
            if (!picot.isJoint) return; // Only joint picots
            
            // Get picot TIP position
            const picotPos = getPicotPosition(el, picot);
            if (!picotPos) return;
            
            // Check if in selection box (with a bit of tolerance)
            const tolerance = 5; // Make selection easier
            if (picotPos.x >= minX - tolerance && picotPos.x <= maxX + tolerance && 
                picotPos.y >= minY - tolerance && picotPos.y <= maxY + tolerance) {
              selectedJointPicots.push({ elementId: el.id, picotId: picot.id });
            }
          });
        });
        
        // Check if this was a click (small box) vs drag
        // Use 15px threshold — mobile fingers can drift during a tap
        const boxWidth = Math.abs(selectionBox.width);
        const boxHeight = Math.abs(selectionBox.height);
        const isClick = boxWidth < 15 && boxHeight < 15;
        const hasModifier = e?.shiftKey || e?.ctrlKey || e?.metaKey;
        
        if (isClick && selectedJointPicots.length > 0 && hasModifier) {
          // Shift/Ctrl+Click: Toggle selection
          const clickedPicot = selectedJointPicots[0];
          const alreadySelected = selectedPicots.some(sp => 
            sp.elementId === clickedPicot.elementId && sp.picotId === clickedPicot.picotId
          );
          
          if (alreadySelected) {
            // Remove from selection
            setSelectedPicots(selectedPicots.filter(sp => 
              !(sp.elementId === clickedPicot.elementId && sp.picotId === clickedPicot.picotId)
            ));
          } else {
            // Add to selection
            setSelectedPicots([...selectedPicots, clickedPicot]);
          }
        } else if (!isClick && hasModifier) {
          // Shift/Ctrl+Drag: Add to selection
          setSelectedPicots([...selectedPicots, ...selectedJointPicots.filter(sp => 
            !selectedPicots.some(existing => 
              existing.elementId === sp.elementId && existing.picotId === sp.picotId
            )
          )]);
        } else {
          // Normal click/drag: Replace selection
          setSelectedPicots(selectedJointPicots);
        }
      } else {
        // Regular element selection
        const boxSelected = elements.filter(el => 
          el.center.x >= minX && el.center.x <= maxX && el.center.y >= minY && el.center.y <= maxY
        ).map(el => el.id);
        setSelectedIds(prev => [...new Set([...prev, ...boxSelected])]);
      }
      
      setSelectionBox(null);
    }
    
    // If we were interacting and changes were made, push to history
    if (isInteractingRef.current && needsHistoryPushRef.current) {
      // Get current history state from refs
      const currentHistory = historyRef.current;
      const currentIndex = historyIndexRef.current;
      const currentState = currentHistory[currentIndex];
      
      // Check if the new state is different from current history state
      const newStateStr = JSON.stringify({ elements, connections: picotConnections });
      const oldStateStr = currentState ? JSON.stringify(currentState) : null;
      
      if (oldStateStr !== newStateStr) {
        // Deep clone the state
        const cloned = {
          elements: JSON.parse(JSON.stringify(elements)),
          connections: JSON.parse(JSON.stringify(picotConnections))
        };
        
        // Remove any history after current index
        const newHistory = currentHistory.slice(0, currentIndex + 1);
        
        // Add new state
        newHistory.push(cloned);
        
        console.log('History:', newHistory.length - 1, 'states');
        
        // Limit history to 50 states
        if (newHistory.length > 50) {
          newHistory.shift();
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
        } else {
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
        }
      }
    }
    
    // Reset interaction flags
    isInteractingRef.current = false;
    needsHistoryPushRef.current = false;
    
    setIsDragging(false);
    setDragStart(null);
    // PERFORMANCE: Commit accumulated drag offset to elements state on mouseup (one write per drag)
    if (dragOffsetRef.current.active) {
      let { dx, dy } = dragOffsetRef.current;

      // SNAP-ON-DROP: check if any snap point of the dragged element lands near a target snap point.
      // We only do this for single-element drags (multi-element drags keep freeform position).
      if (snapEnabled && selectedIdsRef.current.length === 1) {
        const draggedEl = elementsRef.current.find(e => e.id === selectedIdsRef.current[0]);
        if (draggedEl) {
          // Build the element's snap points at their new (post-drag) position
          const movedEl = {
            ...draggedEl,
            center: { x: draggedEl.center.x + dx, y: draggedEl.center.y + dy },
            paths: draggedEl.paths.map(p => p.type === 'cubic'
              ? { ...p, x: p.x+dx, y: p.y+dy, endX: p.endX+dx, endY: p.endY+dy,
                  control1X: p.control1X+dx, control1Y: p.control1Y+dy,
                  control2X: p.control2X+dx, control2Y: p.control2Y+dy }
              : { ...p, x: p.x+dx, y: p.y+dy, endX: p.endX+dx, endY: p.endY+dy,
                  controlX: p.controlX+dx, controlY: p.controlY+dy }),
          };
          const mySnapPoints = getSnapPoints(movedEl);
          const excludedIds = new Set(selectedIdsRef.current);
          const effectiveSnapRadius = snapRadius / zoomRef.current;
          let bestSnapDx = 0, bestSnapDy = 0, bestDist = effectiveSnapRadius;
          for (const myPt of mySnapPoints) {
            const target = findNearestSnapPoint(myPt.x, myPt.y, excludedIds);
            if (target) {
              const dist = Math.hypot(target.x - myPt.x, target.y - myPt.y);
              if (dist < bestDist) {
                bestDist = dist;
                bestSnapDx = target.x - myPt.x;
                bestSnapDy = target.y - myPt.y;
              }
            }
          }
          dx += bestSnapDx;
          dy += bestSnapDy;
        }
      }

      setElements(prev => prev.map(el => {
        if (!selectedIdsRef.current.includes(el.id)) return el;
        const newPaths = el.paths.map(path => path.type === 'cubic'
          ? { ...path, x: path.x+dx, y: path.y+dy, endX: path.endX+dx, endY: path.endY+dy,
              control1X: path.control1X+dx, control1Y: path.control1Y+dy,
              control2X: path.control2X+dx, control2Y: path.control2Y+dy }
          : { ...path, x: path.x+dx, y: path.y+dy, endX: path.endX+dx, endY: path.endY+dy,
              controlX: path.controlX+dx, controlY: path.controlY+dy });
        return { ...el, center: { x: el.center.x+dx, y: el.center.y+dy }, paths: newPaths };
      }));
      dragOffsetRef.current = { active: false, dx: 0, dy: 0 };
    }
    lastMousePosRef.current = null;
    dragTouchIdRef.current = null;
    setDraggedElement(null);
    draggedHandleRef.current = null; // NEW: clear path edit handle
    pathDragStartRef.current = null; // Clear interpolation start data
    setRotationHandle(null);         // NEW: clear rotation handle
    setMovingPivot(false);           // NEW: clear pivot movement
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Undo: Ctrl+Z (not Shift)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      
      // Redo: Shift+Z
      if ((e.key === 'z' || e.key === 'Z') && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        redo();
        return;
      }
      
      // Group: Ctrl+G (not Shift)
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        groupSelected();
        return;
      }
      
      // Ungroup: Shift+G
      if ((e.key === 'g' || e.key === 'G') && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        ungroupSelected();
        return;
      }
      
      // New: Ctrl+N
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        newCanvas();
        return;
      }
      
      // Save: Ctrl+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProject();
        return;
      }
      
      // Toggle render mode: V key (WITHOUT Ctrl/Cmd)
      if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setRenderMode(prev => {
          const next = prev === 'schematic' ? 'realistic' : 'schematic';
          if (next === 'realistic') setCurrentTool('pan');
          return next;
        });
        return;
      }

      // Select All: Ctrl+A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(elementsRef.current.map(el => el.id));
        return;
      }

      // Zoom in/out: + / - (no modifier needed)
      if ((e.key === '+' || e.key === '=') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomToCenter(0.1);
        return;
      }
      if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        zoomToCenter(-0.1);
        return;
      }
      
      // Fit all elements: F key (WITHOUT Ctrl/Cmd)
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        fitAllElements();
        return;
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setCurrentTool(prev => prev === 'pan' ? 'select' : 'pan');
      } else if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        duplicateInPlace();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        // Copy selected elements using refs
        if (selectedIdsRef.current.length > 0) {
          const selectedElements = elementsRef.current.filter(el => selectedIdsRef.current.includes(el.id));
          const cloned = JSON.parse(JSON.stringify(selectedElements)); // Deep clone
          setClipboard(cloned);
          console.log('Copied:', cloned.length, 'elements');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        // Paste elements with offset using current clipboard state
        if (clipboard.length > 0) {
          const offset = 30;
          
          // Create a map of old groupIds to new groupIds
          const groupIdMap = new Map();
          clipboard.forEach(el => {
            if (el.groupId && !groupIdMap.has(el.groupId)) {
              groupIdMap.set(el.groupId, Date.now() + Math.random());
            }
          });
          
          // Create a map of old element IDs to new element IDs
          const elementIdMap = new Map();
          
          const newElements = clipboard.map(el => {
            const newEl = JSON.parse(JSON.stringify(el)); // Deep clone
            const newId = Date.now() + Math.random();
            elementIdMap.set(el.id, newId);
            newEl.id = newId;
            
            // Preserve group membership with new groupId
            if (el.groupId) {
              newEl.groupId = groupIdMap.get(el.groupId);
            }
            
            newEl.center = { x: el.center.x + offset, y: el.center.y + offset };
            newEl.paths = el.paths.map(path => {
              const newPath = { ...path };
              newPath.x = path.x + offset;
              newPath.y = path.y + offset;
              newPath.endX = path.endX + offset;
              newPath.endY = path.endY + offset;
              if (path.type === 'cubic') {
                newPath.control1X = path.control1X + offset;
                newPath.control1Y = path.control1Y + offset;
                newPath.control2X = path.control2X + offset;
                newPath.control2Y = path.control2Y + offset;
              } else {
                newPath.controlX = path.controlX + offset;
                newPath.controlY = path.controlY + offset;
              }
              return newPath;
            });
            
            // Clear order number to avoid conflicts
            delete newEl.orderNumber;
            
            return newEl;
          });
          
          // Handle picot connections: only preserve if ALL connected elements are in clipboard
          const clipboardElementIds = clipboard.map(el => el.id);
          const relevantConnections = picotConnections.filter(conn => {
            // Check if all picots in this connection belong to clipboard elements
            return conn.picots.every(p => clipboardElementIds.includes(p.elementId));
          });
          
          // Create new connections with updated element IDs
          const newConnections = relevantConnections.map(conn => ({
            id: Date.now() + Math.random(),
            picots: conn.picots.map(p => ({
              elementId: elementIdMap.get(p.elementId),
              picotId: p.picotId // Picot IDs stay the same since they're generated with the element
            }))
          }));
          
          setElements(prev => [...prev, ...newElements]);
          setPicotConnections(prev => [...prev, ...newConnections]);
          setSelectedIds(newElements.map(el => el.id));
          console.log('Pasted:', newElements.length, 'elements', newConnections.length, 'connections');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [clipboard]);

  const updateNotation = (notation, notationB = null) => {
    if (selectedIds.length !== 1) return;
    const parsed = parseNotation(notation);
    if (!parsed) return;

    setElements(prev => prev.map(el => {
      if (el.id !== selectedIds[0]) return el;
      
      // Handle split ring notation update
      if (el.isSplitRing) {
        const notationAText = notation.replace(/^sr:\s*/, '');
        const notationBText = notationB || el.notationB || '5ds';
        
        const parsedA = parseNotation(`sr: ${notationAText}`);
        const parsedB = parseNotation(`sr: ${notationBText}`);
        
        if (!parsedA || !parsedB) return el;
        
        const stitchCountA = parsedA.stitchCount;
        const stitchCountB = parsedB.stitchCount;
        const totalStitches = stitchCountA + stitchCountB;
        const targetLength = totalStitches * dsWidth;
        const squeeze = el.squeeze || 0.1;
        
        const pathData = createSplitRingPath(el.center.x, el.center.y, targetLength, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
        
        // Apply rotation if needed
        let finalPaths = pathData.paths;
        if (el.rotation && el.rotation !== 0) {
          const rad = el.rotation * Math.PI / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const cx = el.center.x;
          const cy = el.center.y;
          
          const rotatePoint = (px, py) => {
            const dx = px - cx;
            const dy = py - cy;
            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
          };
          
          finalPaths = finalPaths.map(path => {
            const start = rotatePoint(path.x, path.y);
            const end = rotatePoint(path.endX, path.endY);
            const c1 = rotatePoint(path.control1X, path.control1Y);
            const c2 = rotatePoint(path.control2X, path.control2Y);
            return {
              ...path,
              x: start.x, y: start.y,
              endX: end.x, endY: end.y,
              control1X: c1.x, control1Y: c1.y,
              control2X: c2.x, control2Y: c2.y
            };
          });
        }
        
        // Merge picots from both sections
        const allPicots = [...parsedA.picots, ...parsedB.picots.map(p => ({
          ...p,
          stitchesBefore: p.stitchesBefore + stitchCountA
        }))];
        
        return {
          ...el,
          notation: `sr: ${notationAText}`,
          notationB: notationBText,
          stitchCount: totalStitches,
          picots: allPicots,
          paths: finalPaths,
          splitPosition: stitchCountA
        };
      }
      
      // If it's a closed path (ring), regenerate the path with new stitch count
      let newPathData = {};
      if (el.isClosed) {
        const targetLength = parsed.stitchCount * dsWidth;
        const squeeze = el.squeeze || 0; // Use existing squeeze value
        const tempPathData = el.shapeStyle === 'circle' 
          ? createCirclePath(el.center.x, el.center.y, targetLength, squeeze)
          : createTeardropPath(el.center.x, el.center.y, targetLength, squeeze);
        
        // If element has rotation, apply it to the new paths
        if (el.rotation && el.rotation !== 0) {
          const rad = el.rotation * Math.PI / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const cx = el.center.x;
          const cy = el.center.y;
          
          const rotatePoint = (px, py) => {
            const dx = px - cx;
            const dy = py - cy;
            return {
              x: cx + dx * cos - dy * sin,
              y: cy + dx * sin + dy * cos
            };
          };
          
          tempPathData.paths = tempPathData.paths.map(path => {
            if (path.type === 'cubic') {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const c1 = rotatePoint(path.control1X, path.control1Y);
              const c2 = rotatePoint(path.control2X, path.control2Y);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                control1X: c1.x, control1Y: c1.y,
                control2X: c2.x, control2Y: c2.y
              };
            } else {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const ctrl = rotatePoint(path.controlX, path.controlY);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                controlX: ctrl.x, controlY: ctrl.y
              };
            }
          });
        }
        
        newPathData = tempPathData;
      } else {
        // For open paths (chains), scale the path to match new stitch count
        if (el.paths && el.paths.length > 0) {
          const oldLength = el.stitchCount * dsWidth;
          const newLength = parsed.stitchCount * dsWidth;
          const scaleFactor = newLength / oldLength;
          
          // Get the start point (first point of first path)
          const startX = el.paths[0].x;
          const startY = el.paths[0].y;
          
          // Scale all paths relative to start point
          const scaledPaths = el.paths.map(path => {
            if (path.type === 'cubic') {
              return {
                ...path,
                endX: startX + (path.endX - startX) * scaleFactor,
                endY: startY + (path.endY - startY) * scaleFactor,
                control1X: startX + (path.control1X - startX) * scaleFactor,
                control1Y: startY + (path.control1Y - startY) * scaleFactor,
                control2X: startX + (path.control2X - startX) * scaleFactor,
                control2Y: startY + (path.control2Y - startY) * scaleFactor,
              };
            } else {
              return {
                ...path,
                endX: startX + (path.endX - startX) * scaleFactor,
                endY: startY + (path.endY - startY) * scaleFactor,
                controlX: startX + (path.controlX - startX) * scaleFactor,
                controlY: startY + (path.controlY - startY) * scaleFactor,
              };
            }
          });
          
          newPathData = { paths: scaledPaths };
        }
      }
      
      // Preserve IDs for joint picots so picotConnections references survive re-parse.
      // Match old joint picots to new ones by stitchesBefore position.
      const oldJointById = {};
      (el.picots || []).forEach(p => {
        if (p.isJoint) oldJointById[p.stitchesBefore] = p;
      });
      const mergedPicots = parsed.picots.map(p => {
        if (p.isJoint && oldJointById[p.stitchesBefore]) {
          return { ...p, id: oldJointById[p.stitchesBefore].id };
        }
        return p;
      });

      return { 
        ...el, 
        notation, 
        stitchCount: parsed.stitchCount, 
        picots: mergedPicots,
        ...(Object.keys(newPathData).length > 0 ? newPathData : {})
      };
    }));
  };

  const toggleShape = () => {
    if (selectedIds.length !== 1) return;
    
    setElements(prev => prev.map(el => {
      if (el.id === selectedIds[0] && el.isClosed) {
        const newStyle = el.shapeStyle === 'circle' ? 'teardrop' : 'circle';
        const targetLength = el.stitchCount * dsWidth;
        const squeeze = el.squeeze || 0; // Use existing squeeze value
        const tempPathData = newStyle === 'circle'
          ? createCirclePath(el.center.x, el.center.y, targetLength, squeeze)
          : createTeardropPath(el.center.x, el.center.y, targetLength, squeeze);
        
        // Preserve rotation when toggling shape
        if (el.rotation && el.rotation !== 0) {
          const rad = el.rotation * Math.PI / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const cx = el.center.x;
          const cy = el.center.y;
          
          const rotatePoint = (px, py) => {
            const dx = px - cx;
            const dy = py - cy;
            return {
              x: cx + dx * cos - dy * sin,
              y: cy + dx * sin + dy * cos
            };
          };
          
          tempPathData.paths = tempPathData.paths.map(path => {
            if (path.type === 'cubic') {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const c1 = rotatePoint(path.control1X, path.control1Y);
              const c2 = rotatePoint(path.control2X, path.control2Y);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                control1X: c1.x, control1Y: c1.y,
                control2X: c2.x, control2Y: c2.y
              };
            } else {
              const start = rotatePoint(path.x, path.y);
              const end = rotatePoint(path.endX, path.endY);
              const ctrl = rotatePoint(path.controlX, path.controlY);
              return {
                ...path,
                x: start.x, y: start.y,
                endX: end.x, endY: end.y,
                controlX: ctrl.x, controlY: ctrl.y
              };
            }
          });
        }
        
        return { ...el, shapeStyle: newStyle, ...tempPathData };
      }
      return el;
    }));
  };

  const toggleLabelsInside = useCallback(() => {
    const currentSelectedIds = selectedIdsRef.current; // Use ref to avoid stale closure
    if (currentSelectedIds.length === 0) return;
    
    setElements(prev => prev.map(el => {
      if (currentSelectedIds.includes(el.id)) {
        // Cycle through 3 states: undefined/true (inside) → 'onPath' → false (outside) → back to undefined
        const current = el.labelsInside;
        let next;
        if (current === 'onPath') {
          next = false; // onPath → outside
        } else if (current === false) {
          next = undefined; // outside → inside (default)
        } else {
          next = 'onPath'; // inside → onPath
        }
        return { ...el, labelsInside: next };
      }
      return el;
    }));
  }, []); // No dependencies - uses refs

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, GIF, etc.)');
      return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      alert('Image file is too large. Maximum size is 10MB.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setReferenceImage(event.target.result);
      // Position image at current viewport center in world coordinates
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const worldCenterX = (rect.width / 2 - camera.x) / zoom;
        const worldCenterY = (rect.height / 2 - camera.y) / zoom;
        setRefImageProps(prev => ({ ...prev, x: worldCenterX, y: worldCenterY }));
      }
    };
    reader.onerror = () => {
      alert('Error reading image file. Please try a different file.');
    };
    reader.readAsDataURL(file);
  };

  // Helper function to get picot position in world coordinates (for selection/connections)
  // Joint picots (jp): returns BASE position (on path/ring)
  // jpg (isJoint+isGuide): returns TIP by default for snapping, BASE when baseOnly=true (for connection lines)
  // Regular picots: returns TIP position (end of handle)
  const getPicotPosition = (element, picot, baseOnly = false) => {
    if (!element.picots || !picot) return null;
    
    const picotSize = { small: 13, medium: 20, large: 26 };
    const len = picotSize[picot.length] || 20;
    const sideMultiplier = element.picotSideMultiplier || 1; // Default to 1 if not set
    
    // Special handling for circles
    if (element.isClosed && element.shapeStyle === 'circle') {
      const targetCircumference = element.stitchCount * dsWidth;
      const radius = targetCircumference / (2 * Math.PI);
      const _sb1 = (picot.beadType === 'bc' || picot.beadType === 'bcp') ? picot.stitchesBefore + 0.5 : picot.stitchesBefore;
      const baseAngle = (_sb1 / element.stitchCount) * Math.PI * 2 - Math.PI / 2;
      const rotation = (element.rotation || 0) * Math.PI / 180; // Convert to radians
      const angle = baseAngle + rotation; // Apply rotation
      
      // jp and jpg when baseOnly: return BASE position (on ring edge)
      if ((picot.isJoint && !picot.isGuide) || baseOnly) {
        return {
          x: element.center.x + Math.cos(angle) * radius,
          y: element.center.y + Math.sin(angle) * radius
        };
      }
      // Guide Point (gp): return BASE position (on ring edge)
      if (picot.isGuidePoint) {
        return {
          x: element.center.x + Math.cos(angle) * radius,
          y: element.center.y + Math.sin(angle) * radius
        };
      }
      
      // Regular picots: return TIP position (end of handle)
      const adjustedRadius = radius + (len * sideMultiplier);
      return {
        x: element.center.x + Math.cos(angle) * adjustedRadius,
        y: element.center.y + Math.sin(angle) * adjustedRadius
      };
    }
    
    // Path-based rendering for teardrops and chains
    let totalLength = 0;
    const pathLengths = [];
    for (let path of element.paths) {
      const points = sampleBezierPath(path, 20);
      const length = calculatePathLength(points);
      pathLengths.push(length);
      totalLength += length;
    }
    
    const _sb2 = (picot.beadType === 'bc' || picot.beadType === 'bcp') ? picot.stitchesBefore + 0.5 : picot.stitchesBefore;
    const targetDist = (_sb2 / element.stitchCount) * totalLength;
    let accum = 0;
    let pathIndex = 0;
    let localT = 0;
    
    for (let i = 0; i < pathLengths.length; i++) {
      if (accum + pathLengths[i] >= targetDist) {
        pathIndex = i;
        localT = (targetDist - accum) / pathLengths[i];
        break;
      }
      accum += pathLengths[i];
    }
    
    const path = element.paths[pathIndex];
    const t = localT;
    
    let x, y, dx, dy;
    if (path.type === 'cubic') {
      x = (1-t)*(1-t)*(1-t)*path.x + 
          3*(1-t)*(1-t)*t*path.control1X + 
          3*(1-t)*t*t*path.control2X + 
          t*t*t*path.endX;
      y = (1-t)*(1-t)*(1-t)*path.y + 
          3*(1-t)*(1-t)*t*path.control1Y + 
          3*(1-t)*t*t*path.control2Y + 
          t*t*t*path.endY;
      dx = 3*(1-t)*(1-t)*(path.control1X - path.x) + 
           6*(1-t)*t*(path.control2X - path.control1X) + 
           3*t*t*(path.endX - path.control2X);
      dy = 3*(1-t)*(1-t)*(path.control1Y - path.y) + 
           6*(1-t)*t*(path.control2Y - path.control1Y) + 
           3*t*t*(path.endY - path.control2Y);
    } else if (path.type === 'quadratic') {
      x = (1-t)*(1-t)*path.x + 2*(1-t)*t*path.controlX + t*t*path.endX;
      y = (1-t)*(1-t)*path.y + 2*(1-t)*t*path.controlY + t*t*path.endY;
      dx = 2*(1-t)*(path.controlX - path.x) + 2*t*(path.endX - path.controlX);
      dy = 2*(1-t)*(path.controlY - path.y) + 2*t*(path.endY - path.controlY);
    }
    
    // jp only (not jpg) OR baseOnly: return BASE position (on path)
    if ((picot.isJoint && !picot.isGuide) || picot.isGuidePoint || baseOnly) {
      return { x, y };
    }
    
    // Regular picots: return TIP position (end of handle)
    const sideOffset = sideMultiplier === -1 ? Math.PI : 0; // Flip to other side if multiplier is -1
    const perpAngle = Math.atan2(dy, dx) - Math.PI / 2 + sideOffset;
    return {
      x: x + Math.cos(perpAngle) * len,
      y: y + Math.sin(perpAngle) * len
    };
  };


  // ── Beaded picot helpers ────────────────────────────────────────────────────
  // Bead sizes: dsMultiplier * dsWidth = total diameter (incl. stroke)
  // brad() returns radius = diameter/2 - strokeWidth/2
  const BEAD_SIZES_DEFAULT = {
    Y: dsWidth * beadSettings.Y.dsMultiplier,
    Z: dsWidth * beadSettings.Z.dsMultiplier,
    V: dsWidth * beadSettings.V.dsMultiplier,
  };
  // Helper: diameter → radius (subtract 1px for stroke on each side)
  const beadRadius = (diameter) => Math.max(2, diameter / 2 - 1);

  // Parse bead sequence string "YZY", "2V", "YZV" → array of size chars
  const parseBeadSeq = (seq) => {
    const beads = [];
    let i = 0;
    while (i < seq.length) {
      let count = 1;
      if (/\d/.test(seq[i])) { count = parseInt(seq[i]); i++; }
      if (i < seq.length && /[YZV]/i.test(seq[i])) {
        const s = seq[i].toUpperCase();
        for (let j = 0; j < count; j++) beads.push(s);
        i++;
      } else { i++; }
    }
    return beads;
  };

  // Build bead positions relative to a picot root (rootX,rootY) pointing in direction perpAngle
  // Returns array of {x, y, size} and array of line segments {x1,y1,x2,y2}
  const buildBeadPicotGeometry = (rootX, rootY, perpAngle, beads, sizes, picotLen) => {
    const n = beads.length;
    if (n === 0) return { beadPos: [], lines: [] };

    const brad = (s) => beadRadius(sizes[s] ?? sizes.Y);
    // Spacing proportional to the largest bead in the group
    const maxR = Math.max(...beads.map(b => brad(b)));
    const rowH = n === 1
      ? (picotLen ?? maxR * 3) * 0.5  // single bead: halfway along picot
      : maxR * 2.4;                    // multi bead: proportional to bead size
    const spread = maxR * 2.0;         // lateral spread proportional to bead size

    // Unit vectors: along picot (outward) and lateral
    const ax = Math.cos(perpAngle), ay = Math.sin(perpAngle);
    const lx = Math.cos(perpAngle + Math.PI / 2), ly = Math.sin(perpAngle + Math.PI / 2);

    const pt = (along, lateral) => ({
      x: rootX + ax * along + lx * lateral,
      y: rootY + ay * along + ly * lateral,
    });

    let pts = [];
    if (n === 1) {
      pts = [pt(rowH, 0)];
    } else if (n === 2) {
      pts = [pt(rowH, -spread), pt(rowH, spread)];
    } else if (n === 3) {
      pts = [pt(rowH, -spread), pt(rowH * 2, 0), pt(rowH, spread)];
    } else if (n === 4) {
      pts = [pt(rowH, -spread), pt(rowH, spread), pt(rowH * 2, -spread), pt(rowH * 2, spread)];
    } else {
      pts = [
        pt(rowH, -spread), pt(rowH, spread),
        pt(rowH * 1.8, -spread * 0.6), pt(rowH * 1.8, spread * 0.6),
        pt(rowH * 2.6, 0),
      ];
    }

    const stem = { x: rootX, y: rootY };
    const lines = [];
    if (n === 1) {
      lines.push([stem, pts[0]]);
    } else if (n === 2) {
      lines.push([stem, pts[0]]); lines.push([stem, pts[1]]); lines.push([pts[0], pts[1]]);
    } else if (n === 3) {
      lines.push([stem, pts[0]]); lines.push([stem, pts[2]]);
      lines.push([pts[0], pts[1]]); lines.push([pts[2], pts[1]]);
    } else if (n === 4) {
      lines.push([stem, pts[0]]); lines.push([stem, pts[1]]);
      lines.push([pts[0], pts[2]]); lines.push([pts[1], pts[3]]); lines.push([pts[2], pts[3]]);
    } else {
      lines.push([stem, pts[0]]); lines.push([stem, pts[1]]);
      lines.push([pts[0], pts[2]]); lines.push([pts[1], pts[3]]);
      lines.push([pts[2], pts[4]]); lines.push([pts[3], pts[4]]);
    }

    const beadPos = pts.map((p, i) => ({ ...p, size: beads[i] }));
    return { beadPos, lines };
  };

  // Render beaded picot SVG given root position and perp angle
  const renderBeadedPicot = (key, rootX, rootY, perpAngle, beadSeq, color, picotLen) => {
    const sizes = BEAD_SIZES_DEFAULT;
    const beads = parseBeadSeq(beadSeq);
    const { beadPos, lines } = buildBeadPicotGeometry(rootX, rootY, perpAngle, beads, sizes, picotLen);
    const BEAD_FILL = {
      Y: beadSettings.Y.color,
      Z: beadSettings.Z.color,
      V: beadSettings.V.color,
    };
    return (
      <g key={key}>
        {lines.map((l, i) => (
          <line key={i} x1={l[0].x} y1={l[0].y} x2={l[1].x} y2={l[1].y}
            stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        ))}
        {beadPos.map((p, i) => {
          const rad = beadRadius(sizes[p.size] ?? sizes.Y);
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={rad + 1} fill="rgba(0,0,0,0.3)" />
              <circle cx={p.x} cy={p.y} r={rad} fill={BEAD_FILL[p.size] || color} stroke="#111" strokeWidth="1" />
              <ellipse cx={p.x - rad * 0.28} cy={p.y - rad * 0.3} rx={rad * 0.3} ry={rad * 0.18} fill="rgba(255,255,255,0.4)" />
            </g>
          );
        })}
      </g>
    );
  };



  // ── Core+Picot bead (bcp:) rendering ────────────────────────────────────────
  // Draws one core bead centered on the path, then picot beads branching
  // from the outer edge of the core bead (perpendicular, outward).
  // Extract BE configs from picots as { ordinalIndex: {beStructure, beIsJoint, coreBeads, picotBeads} }
  // Keyed by position among BE tokens so they survive notation edits.
  const extractBEConfigs = (picots) => {
    const configs = {};
    let idx = 0;
    (picots || []).forEach(p => {
      if (p.beadType !== 'be') return;
      configs[idx] = {
        beStructure: p.beStructure,
        beIsJoint:   p.beIsJoint,
        coreBeads:   p.coreBeads,
        picotBeads:  p.picotBeads,
      };
      idx++;
    });
    return configs;
  };

  // Restore BE configs into freshly-parsed picots by ordinal index.
  // If new notation has fewer BEs, extras are silently dropped.
  // If more, new ones start with defaults.
  const restoreBEConfigs = (newPicots, configs) => {
    if (!configs || Object.keys(configs).length === 0) return newPicots;
    let idx = 0;
    return newPicots.map(p => {
      if (p.beadType !== 'be') return p;
      const cfg = configs[idx++];
      return cfg ? { ...p, ...cfg } : p;
    });
  };

  // Merge BE bead configs after notation reversal (flip operations).
  // After reversal the nth BE in new picots = (total-1-n)th BE in old picots.
  const mergeBEConfigs = (newPicots, oldPicots) => {
    const oldBEs = (oldPicots || []).filter(p => p.beadType === 'be');
    if (oldBEs.length === 0) return newPicots;
    let beIdx = 0;
    return newPicots.map(p => {
      if (p.beadType !== 'be') return p;
      const oldBE = oldBEs[oldBEs.length - 1 - beIdx];
      beIdx++;
      if (!oldBE) return p;
      return { ...p, beStructure: oldBE.beStructure, beIsJoint: oldBE.beIsJoint, coreBeads: oldBE.coreBeads, picotBeads: oldBE.picotBeads };
    });
  };

  // ── BE (Bead Element) rendering ─────────────────────────────────────────────
  const renderBE = (picot, cx, cy, perpAngle, threadColor, len, isSelected) => {
    const key = picot.id;
    const struct = picot.beStructure || 'core';

    // Resolve bead library entries → [{size, color}]
    const resolveBeads = (slots) =>
      (slots || []).filter(Boolean).map(id => {
        const b = beadLibrary.find(b => b.id === id);
        return b ? { size: b.size, color: b.color } : { size: 'Y', color: '#ef4444' };
      });

    const coreBeadList  = resolveBeads(picot.coreBeads);
    const picotBeadList = resolveBeads(picot.picotBeads);
    const ax = Math.cos(perpAngle), ay = Math.sin(perpAngle);
    const inBeadingMode = currentTool === 'beading';
    const isThisSel = inBeadingMode && selectedBEs.some(s => s.picotId === picot.id);

    // ── Pink diamond — visible unless realistic mode with beads filled in ───
    // In realistic mode, once beads are configured the bead geometry speaks for
    // itself — no need for the pink placeholder marker on top.
    // Still always shown in beading mode (so you can select it).
    const hasContent = (() => {
      if (struct === 'core') return coreBeadList.length > 0;
      if (struct === 'core+picot') return coreBeadList.length > 0;
      if (struct === 'core+beaded') return coreBeadList.length > 0 || picotBeadList.length > 0;
      // spike / suspended: need at least one picot bead
      return picotBeadList.length > 0;
    })();
    const hideDiamond = renderMode === 'realistic' && hasContent && !inBeadingMode;

    const diamondR = isThisSel ? 7/zoom : 5/zoom;
    const diamondColor = isThisSel ? '#38bdf8'   // selected: cyan
                       : inBeadingMode ? '#f472b6' // beading mode: bright pink
                       : '#ec4899';                 // normal: pink
    const diamond = hideDiamond ? null : (
      <rect
        transform={`rotate(45, ${cx}, ${cy})`}
        x={cx - diamondR} y={cy - diamondR}
        width={diamondR * 2} height={diamondR * 2}
        fill={diamondColor}
        stroke={isThisSel ? '#fff' : '#111'}
        strokeWidth={isThisSel ? 1.5/zoom : 1/zoom}
        style={inBeadingMode ? { cursor: 'pointer' } : undefined}
      />
    );

    // ── Helper: one bead circle ───────────────────────────────────────────────
    const beadCircle = (bx, by, b, ki) => {
      const rad = beadRadius(BEAD_SIZES_DEFAULT[b.size] ?? BEAD_SIZES_DEFAULT.Y);
      return (
        <g key={ki}>
          <circle cx={bx} cy={by} r={rad+1} fill="rgba(0,0,0,0.3)" />
          <circle cx={bx} cy={by} r={rad} fill={b.color} stroke="#111" strokeWidth="1" />
          <ellipse cx={bx-rad*0.28} cy={by-rad*0.3} rx={rad*0.3} ry={rad*0.18} fill="rgba(255,255,255,0.4)" />
        </g>
      );
    };

    // ── Core bead (single, centred on path) ──────────────────────────────────
    const renderCoreBead_BE = () => {
      if (coreBeadList.length === 0) return null; // diamond alone is enough as placeholder
      const b = coreBeadList[0];
      return beadCircle(cx, cy, b, 'core');
    };

    // ── Picot arm (plain or beaded) ──────────────────────────────────────────
    const renderPicotArm = () => {
      const coreRad = coreBeadList.length > 0
        ? beadRadius(BEAD_SIZES_DEFAULT[coreBeadList[0].size] ?? BEAD_SIZES_DEFAULT.Y) : 0;
      const branchX = cx + ax * coreRad;
      const branchY = cy + ay * coreRad;
      if (picotBeadList.length === 0) {
        return <line x1={branchX} y1={branchY} x2={branchX + ax*len} y2={branchY + ay*len}
          stroke={threadColor} strokeWidth="2" />;
      }
      // Use the same geometry as renderBeadedPicot — 1 centered, 2 side-by-side, 3 triangle, etc.
      const beadSizes = picotBeadList.map(b => b.size);
      const { beadPos, lines } = buildBeadPicotGeometry(branchX, branchY, perpAngle, beadSizes, BEAD_SIZES_DEFAULT, len);
      return (
        <g key={`${key}-picot-arm`}>
          {lines.map((l, i) => (
            <line key={i} x1={l[0].x} y1={l[0].y} x2={l[1].x} y2={l[1].y}
              stroke={threadColor} strokeWidth="1.5" strokeLinecap="round" />
          ))}
          {beadPos.map((p, i) => beadCircle(p.x, p.y, picotBeadList[i], `p${i}`))}
        </g>
      );
    };

    // ── Spike: beads stacked in a straight line outward ─────────────────────
    const renderSpike = () => {
      if (picotBeadList.length === 0) {
        return <line x1={cx} y1={cy} x2={cx+ax*len} y2={cy+ay*len}
          stroke={threadColor} strokeWidth="2" strokeDasharray="3,3" />;
      }
      let offset = 0;
      const positions = picotBeadList.map(b => {
        const rad = beadRadius(BEAD_SIZES_DEFAULT[b.size] ?? BEAD_SIZES_DEFAULT.Y);
        offset += rad;
        const bx = cx + ax * offset, by = cy + ay * offset;
        offset += rad;
        return { bx, by, rad, b };
      });
      const last = positions[positions.length - 1];
      const tipX = last.bx + ax * last.rad, tipY = last.by + ay * last.rad;
      return (
        <g key={`${key}-spike`}>
          <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke={threadColor} strokeWidth="1.5" strokeLinecap="round" />
          {positions.map((p, i) => beadCircle(p.bx, p.by, p.b, `sp${i}`))}
        </g>
      );
    };

    // ── Suspended / beaded-only (no core) ────────────────────────────────────
    const renderSuspended = () => {
      if (picotBeadList.length === 0) {
        return <line x1={cx} y1={cy} x2={cx+ax*len} y2={cy+ay*len}
          stroke={threadColor} strokeWidth="2" strokeDasharray="3,3" />;
      }
      const beadSizes = picotBeadList.map(b => b.size);
      const { beadPos, lines } = buildBeadPicotGeometry(cx, cy, perpAngle, beadSizes, BEAD_SIZES_DEFAULT, len);
      return (
        <g key={`${key}-suspended`}>
          {lines.map((l, i) => (
            <line key={i} x1={l[0].x} y1={l[0].y} x2={l[1].x} y2={l[1].y}
              stroke={threadColor} strokeWidth="1.5" strokeLinecap="round" />
          ))}
          {beadPos.map((p, i) => beadCircle(p.x, p.y, picotBeadList[i], `s${i}`))}
        </g>
      );
    };

    return (
      <g key={key}>
        {/* Bead geometry first, diamond on top */}
        {struct === 'spike'
          ? renderSpike()
          : struct === 'suspended'
          ? renderSuspended()
          : <>
              {renderCoreBead_BE()}
              {(struct === 'core+picot' || struct === 'core+beaded') && renderPicotArm()}
            </>
        }
        {diamond}
      </g>
    );
  };

  const renderBcpBead = (key, cx, cy, perpAngle, coreSize, beadSeq, color, plainPicotLen = 20) => {
    const sizes = BEAD_SIZES_DEFAULT;
    const coreRad = beadRadius(sizes[coreSize] ?? sizes.Y);
    const ax = Math.cos(perpAngle), ay = Math.sin(perpAngle);
    // Picot branch starts at outer edge of core bead
    const branchX = cx + ax * coreRad;
    const branchY = cy + ay * coreRad;
    // Plain picot arm when no bead sequence
    const picotArm = !beadSeq
      ? (() => {
          const tipX = branchX + ax * plainPicotLen;
          const tipY = branchY + ay * plainPicotLen;
          return (
            <line x1={branchX} y1={branchY} x2={tipX} y2={tipY}
              stroke={color} strokeWidth="2" />
          );
        })()
      : renderBeadedPicot(`${key}-picot`, branchX, branchY, perpAngle, beadSeq, color, coreRad * 3);
    return (
      <g key={key}>
        {renderCoreBead(`${key}-core`, cx, cy, coreSize, color, perpAngle)}
        {picotArm}
      </g>
    );
  };

  // ── Suspended bead (sb:) rendering ──────────────────────────────────────────
  // Beads stacked in a straight column perpendicular to the path (outward).
  // rootX/rootY = point on path, perpAngle = outward direction.


  // ── Clustered beads (bjp:) rendering ────────────────────────────────────────
  // Beads arranged in a tight cluster at (cx, cy) — used for beaded joint picots.
  // 1 bead: centered. 2 beads: side by side. 3+: circular cluster.
  const renderClusteredBeads = (key, cx, cy, beadSeq) => {
    const sizes = BEAD_SIZES_DEFAULT;
    const beads = parseBeadSeq(beadSeq);
    if (beads.length === 0) return null;
    const BEAD_FILL = {
      Y: beadSettings.Y.color,
      Z: beadSettings.Z.color,
      V: beadSettings.V.color,
    };
    const maxR = Math.max(...beads.map(b => beadRadius(sizes[b] ?? sizes.Y)));

    const positions = beads.map((size, i) => {
      const rad = beadRadius(sizes[size] ?? sizes.Y);
      let bx = cx, by = cy;
      if (beads.length === 1) {
        bx = cx; by = cy;
      } else if (beads.length === 2) {
        bx = cx + (i === 0 ? -maxR : maxR);
        by = cy;
      } else {
        const angle = (i / beads.length) * Math.PI * 2 - Math.PI / 2;
        bx = cx + Math.cos(angle) * maxR * 1.1;
        by = cy + Math.sin(angle) * maxR * 1.1;
      }
      return { bx, by, rad, size };
    });

    return (
      <g key={key}>
        {positions.map((p, i) => (
          <g key={i}>
            <circle cx={p.bx} cy={p.by} r={p.rad + 1} fill="rgba(0,0,0,0.3)" />
            <circle cx={p.bx} cy={p.by} r={p.rad}
              fill={BEAD_FILL[p.size] || '#ef4444'} stroke="#111" strokeWidth="1" />
            <ellipse
              cx={p.bx - p.rad * 0.28} cy={p.by - p.rad * 0.3}
              rx={p.rad * 0.3} ry={p.rad * 0.18}
              fill="rgba(255,255,255,0.4)"
            />
          </g>
        ))}
      </g>
    );
  };

  // ── Core bead (bc:) rendering ───────────────────────────────────────────────
  // Single bead centered ON the path (inline on thread).
  // Thread line is drawn behind; bead sits on top with a gap in the line.
  const renderCoreBead = (key, cx, cy, size, color, perpAngle) => {
    const sizes = BEAD_SIZES_DEFAULT;
    const rad = beadRadius(sizes[size] ?? sizes.Y);
    const BEAD_FILL = {
      Y: beadSettings.Y.color,
      Z: beadSettings.Z.color,
      V: beadSettings.V.color,
    };
    // Plain arch over the bead (tight, no beads) — only when perpAngle is provided
    const arch = perpAngle != null ? (() => {
      const tx = Math.cos(perpAngle - Math.PI / 2); // tangent along path
      const ty = Math.sin(perpAngle - Math.PI / 2);
      const nx = Math.cos(perpAngle); // outward normal
      const ny = Math.sin(perpAngle);
      const x1 = cx - tx * rad, y1 = cy - ty * rad; // left anchor on bead edge
      const x2 = cx + tx * rad, y2 = cy + ty * rad; // right anchor on bead edge
      const cpx = cx + nx * rad * 1.7, cpy = cy + ny * rad * 1.7; // arch peak
      return (
        <path
          d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
          stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"
        />
      );
    })() : null;
    return (
      <g key={key}>
        {arch}
        <circle cx={cx} cy={cy} r={rad + 1} fill="rgba(0,0,0,0.3)" />
        <circle cx={cx} cy={cy} r={rad}
          fill={BEAD_FILL[size] || color} stroke="#111" strokeWidth="1" />
        <ellipse
          cx={cx - rad * 0.28} cy={cy - rad * 0.3}
          rx={rad * 0.3} ry={rad * 0.18}
          fill="rgba(255,255,255,0.4)"
        />
      </g>
    );
  };

  const renderSuspendedBead = (key, rootX, rootY, perpAngle, beadSeq, color) => {
    const sizes = BEAD_SIZES_DEFAULT;
    const beads = parseBeadSeq(beadSeq);
    if (beads.length === 0) return null;

    const BEAD_FILL = {
      Y: beadSettings.Y.color,
      Z: beadSettings.Z.color,
      V: beadSettings.V.color,
    };

    const ax = Math.cos(perpAngle), ay = Math.sin(perpAngle);

    // Stack beads outward: each bead center placed so beads touch edge-to-edge
    const positions = [];
    let offset = 0;
    for (let i = 0; i < beads.length; i++) {
      const rad = beadRadius(sizes[beads[i]] ?? sizes.Y);
      offset += rad; // move to center of this bead
      positions.push({ x: rootX + ax * offset, y: rootY + ay * offset, rad, size: beads[i] });
      offset += rad; // past this bead
    }

    // Spike line from path to tip of last bead
    const tip = positions[positions.length - 1];
    const tipEdge = { x: tip.x + ax * tip.rad, y: tip.y + ay * tip.rad };

    return (
      <g key={key}>
        <line
          x1={rootX} y1={rootY}
          x2={tipEdge.x} y2={tipEdge.y}
          stroke={color} strokeWidth="1.5" strokeLinecap="round"
        />
        {positions.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.rad + 1} fill="rgba(0,0,0,0.3)" />
            <circle cx={p.x} cy={p.y} r={p.rad}
              fill={BEAD_FILL[p.size] || color} stroke="#111" strokeWidth="1" />
            <ellipse
              cx={p.x - p.rad * 0.28} cy={p.y - p.rad * 0.3}
              rx={p.rad * 0.3} ry={p.rad * 0.18}
              fill="rgba(255,255,255,0.4)"
            />
          </g>
        ))}
      </g>
    );
  };

  const renderPicots = (element, beadAndJointOnly = false) => {
    if (!element.picots || element.picots.length === 0) return null;
    const picotSize = { small: 13, medium: 20, large: 26 };
    const sideMultiplier = element.picotSideMultiplier || 1; // Default to 1 if not set

    // Special handling for circles (rendered as SVG circle, not paths)
    if (element.isClosed && element.shapeStyle === 'circle') {
      const targetCircumference = element.stitchCount * dsWidth;
      const radius = targetCircumference / (2 * Math.PI);
      const rotation = (element.rotation || 0) * Math.PI / 180; // Convert to radians
      
      return element.picots.map(p => {
        const _sb3 = (p.beadType === 'bc' || p.beadType === 'bcp' || p.beadType === 'be') ? p.stitchesBefore + 0.5 : p.stitchesBefore;
        const baseAngle = (_sb3 / element.stitchCount) * Math.PI * 2 - Math.PI / 2;
        const angle = baseAngle + rotation; // Apply rotation
        const startX = element.center.x + Math.cos(angle) * radius;
        const startY = element.center.y + Math.sin(angle) * radius;
        const len = picotSize[p.length] || 20;
        // Adjust based on side multiplier
        const adjustedRadius = radius + (len * sideMultiplier);
        const endX = element.center.x + Math.cos(angle) * adjustedRadius;
        const endY = element.center.y + Math.sin(angle) * adjustedRadius;
        
        const isSelected = selectedPicots.some(sp => sp.elementId === element.id && sp.picotId === p.id);
        const isConnected = p.isJoint && picotConnections.some(conn => conn.picots.some(cp => cp.elementId === element.id && cp.picotId === p.id));
        // jpg (isJoint+isGuide) = green arm; jp = green dot → yellow when connected → pink when selected
        const color = (p.isJoint && p.isGuide)
          ? (isSelected ? theme.jpgArmSelected : theme.jpgArm)    // jpg: green arm
          : p.isJoint
          ? (isSelected ? theme.jpSelected : isConnected ? theme.jpConnected : theme.jpUnconnected)
          : p.isGuidePoint
          ? theme.gpDiamond                                // gp: yellow-green diamond
          : getSolidColor(element);
        const strokeWidth = isSelected ? "4" : "2";
        
        // BE: render based on beStructure config (beading mode)
        if (p.beadType === 'be') {
          const bePerpAngle = Math.atan2(endY - startY, endX - startX);
          return renderBE(p, startX, startY, bePerpAngle, color, len, isSelected);
        }

        // bcjp: core bead on path + joint dot indicator (selectable in join mode)
        if (p.beadType === 'bcjp') {
          const bcjpPerpAngle = Math.atan2(endY - startY, endX - startX);
          const jointDotR = isSelected ? 6/zoom : 4/zoom;
          return (
            <g key={p.id}>
              {renderCoreBead(`${p.id}-core`, startX, startY, p.coreSize || 'Y', color, bcjpPerpAngle)}
              {renderMode !== 'realistic' && (
                <circle cx={startX} cy={startY} r={jointDotR} fill={color} stroke="#000" strokeWidth={2/zoom} opacity={0.7} />
              )}
            </g>
          );
        }

        // jp only (not jpg): dot on path — hidden in realistic mode
        if (p.isJoint && !p.isGuide) {
          if (renderMode === 'realistic') return null;
          return (
            <g key={p.id}>
              <circle cx={startX} cy={startY} r={isSelected ? 6/zoom : 4.5/zoom} fill={color} stroke="#000" strokeWidth={2/zoom} />
            </g>
          );
        }

        // Guide Point (gp): diamond marker on path, no arm — schematic only
        if (p.isGuidePoint) {
          if (renderMode !== 'schematic') return null;
          return (
            <g key={p.id}>
              <rect transform={`rotate(45, ${startX}, ${startY})`} x={startX - 4} y={startY - 4} width="8" height="8" fill={color} stroke="#000" strokeWidth="1.5" />
            </g>
          );
        }

        // Core+Picot bead (bcp:) — inline core with picot branch
        if (p.beadType === 'bcp') {
          const perpAngle = Math.atan2(endY - startY, endX - startX);
          return renderBcpBead(p.id, startX, startY, perpAngle, p.coreSize, p.beadSeq, color, len);
        }
        // Core bead (bc:) — inline on path
        if (p.beadType === 'bc') {
          const bcPerpAngle = Math.atan2(endY - startY, endX - startX);
          return renderCoreBead(p.id, startX, startY, p.beadSize, color, bcPerpAngle);
        }
        // Suspended bead (sb:SEQ) — straight spike outward
        if (p.beadType === 'sb' && p.beadSeq) {
          const perpAngle = Math.atan2(endY - startY, endX - startX);
          return renderSuspendedBead(p.id, startX, startY, perpAngle, p.beadSeq, color);
        }
        // Beaded picot (bp:SEQ)
        if (p.beadSeq) {
          const perpAngle = Math.atan2(endY - startY, endX - startX);
          return renderBeadedPicot(p.id, startX, startY, perpAngle, p.beadSeq, color, len);
        }

        if (beadAndJointOnly) return null; // realistic: bezier handles regular picots
        return (
          <g key={p.id} className={p.isGuide ? 'guide-picot' : undefined}>
            <line x1={startX} y1={startY} x2={endX} y2={endY} stroke={color} strokeWidth={strokeWidth} />
            {p.isGuide && renderMode === 'schematic' && <rect className="guide-picot-marker" x={endX - 3} y={endY - 3} width="6" height="6" fill={color} stroke="#FFF" strokeWidth="1" />}
          </g>
        );
      });
    }

    // Split ring: section-local arc placement
    if (element.isSplitRing) {
      const splitPos = element.splitPosition || Math.floor(element.stitchCount / 2);
      const countA = splitPos;
      const countB = element.stitchCount - splitPos;
      const pathA = element.paths[0];
      const pathB = element.paths[1];
      if (!pathA || !pathB) return null;

      const samplesA = sampleBezierPath(pathA, 60);
      const samplesB = sampleBezierPath(pathB, 60);
      const lenA = calculatePathLength(samplesA);
      const lenB = calculatePathLength(samplesB);

      return element.picots.map(p => {
        // Determine which section this picot belongs to
        const _sb4 = (p.beadType === 'bc' || p.beadType === 'bcp' || p.beadType === 'be') ? p.stitchesBefore + 0.5 : p.stitchesBefore;
        const inA = p.stitchesBefore <= splitPos;
        const localFrac = inA
          ? _sb4 / countA
          : (_sb4 - splitPos) / countB;
        const samples = inA ? samplesA : samplesB;
        const pathLen = inA ? lenA : lenB;
        const path = inA ? pathA : pathB;

        const targetDist = localFrac * pathLen;
        let accum = 0, localT = 0;
        for (let i = 1; i < samples.length; i++) {
          const seg = Math.hypot(samples[i].x - samples[i-1].x, samples[i].y - samples[i-1].y);
          if (accum + seg >= targetDist) {
            localT = (i - 1 + (targetDist - accum) / seg) / (samples.length - 1);
            break;
          }
          accum += seg;
        }
        const t = localT;

        let x, y, dx, dy;
        if (path.type === 'cubic') {
          x = (1-t)*(1-t)*(1-t)*path.x + 3*(1-t)*(1-t)*t*path.control1X + 3*(1-t)*t*t*path.control2X + t*t*t*path.endX;
          y = (1-t)*(1-t)*(1-t)*path.y + 3*(1-t)*(1-t)*t*path.control1Y + 3*(1-t)*t*t*path.control2Y + t*t*t*path.endY;
          dx = 3*(1-t)*(1-t)*(path.control1X-path.x) + 6*(1-t)*t*(path.control2X-path.control1X) + 3*t*t*(path.endX-path.control2X);
          dy = 3*(1-t)*(1-t)*(path.control1Y-path.y) + 6*(1-t)*t*(path.control2Y-path.control1Y) + 3*t*t*(path.endY-path.control2Y);
        }

        const sideMultiplier = element.picotSideMultiplier || 1;
        const sideOffset = sideMultiplier === -1 ? Math.PI : 0;
        const perpAngle = Math.atan2(dy, dx) - Math.PI / 2 + sideOffset;
        const len = picotSize[p.length] || 20;
        const endX = x + Math.cos(perpAngle) * len;
        const endY = y + Math.sin(perpAngle) * len;

        const isSelected = selectedPicots.some(sp => sp.elementId === element.id && sp.picotId === p.id);
        const isConnected = p.isJoint && picotConnections.some(conn => conn.picots.some(cp => cp.elementId === element.id && cp.picotId === p.id));
        const color = (p.isJoint && p.isGuide)
          ? (isSelected ? theme.jpgArmSelected : theme.jpgArm)    // jpg: green arm
          : p.isJoint
          ? (isSelected ? theme.jpSelected : isConnected ? theme.jpConnected : theme.jpUnconnected)
          : p.isGuidePoint
          ? theme.gpDiamond                                // gp: yellow-green diamond
          : getSolidColor(element);
        const strokeWidth = isSelected ? "4" : "2";

        // BE: render based on beStructure config
        if (p.beadType === 'be') {
          return renderBE(p, x, y, perpAngle, color, len, isSelected);
        }

        // bcjp: core bead on path + joint dot indicator
        if (p.beadType === 'bcjp') {
          const bcjpPerpAngle = perpAngle;
          const jointDotR = isSelected ? 6/zoom : 4/zoom;
          return (
            <g key={p.id}>
              {renderCoreBead(`${p.id}-core`, x, y, p.coreSize || 'Y', color, bcjpPerpAngle)}
              {renderMode !== 'realistic' && (
                <circle cx={x} cy={y} r={jointDotR} fill={color} stroke="#000" strokeWidth={2/zoom} opacity={0.7} />
              )}
            </g>
          );
        }

        if (p.isJoint && !p.isGuide) {
          if (renderMode === 'realistic') return null;
          return <g key={p.id}><circle cx={x} cy={y} r={isSelected ? 6/zoom : 4.5/zoom} fill={color} stroke="#000" strokeWidth={2/zoom} /></g>;
        }
        if (p.isGuidePoint) {
          if (renderMode !== 'schematic') return null;
          return (
            <g key={p.id}>
              <rect transform={`rotate(45, ${x}, ${y})`} x={x - 4} y={y - 4} width="8" height="8" fill={color} stroke="#000" strokeWidth="1.5" />
            </g>
          );
        }
        if (p.beadType === 'bcp') {
          return renderBcpBead(p.id, x, y, perpAngle, p.coreSize, p.beadSeq, color, len);
        }
        if (p.beadType === 'bc') {
          return renderCoreBead(p.id, x, y, p.beadSize, color, perpAngle);
        }
        if (p.beadType === 'sb' && p.beadSeq) {
          return renderSuspendedBead(p.id, x, y, perpAngle, p.beadSeq, color);
        }
        if (p.beadSeq) {
          return renderBeadedPicot(p.id, x, y, perpAngle, p.beadSeq, color, len);
        }
        if (beadAndJointOnly) return null;
        return (
          <g key={p.id} className={p.isGuide ? 'guide-picot' : undefined}>
            <line x1={x} y1={y} x2={endX} y2={endY} stroke={color} strokeWidth={strokeWidth} />
            {p.isGuide && renderMode === 'schematic' && <rect className="guide-picot-marker" x={endX - 3} y={endY - 3} width="6" height="6" fill={color} stroke="#FFF" strokeWidth="1" />}
          </g>
        );
      });
    }

    // Path-based rendering for teardrops and chains
    // Calculate total path length
    let totalLength = 0;
    const pathLengths = [];
    for (let path of element.paths) {
      const points = sampleBezierPath(path, 20);
      const len = calculatePathLength(points);
      pathLengths.push(len);
      totalLength += len;
    }

    return element.picots.map(p => {
      // Find position along combined path  
      const _sb5 = (p.beadType === 'bc' || p.beadType === 'bcp' || p.beadType === 'be') ? p.stitchesBefore + 0.5 : p.stitchesBefore;
      const targetDist = (_sb5 / element.stitchCount) * totalLength;
      let accum = 0;
      let pathIndex = 0;
      let localT = 0;

      for (let i = 0; i < pathLengths.length; i++) {
        if (accum + pathLengths[i] >= targetDist) {
          pathIndex = i;
          localT = (targetDist - accum) / pathLengths[i];
          break;
        }
        accum += pathLengths[i];
      }

      const path = element.paths[pathIndex];
      const t = localT;
      
      let x, y, dx, dy;
      if (path.type === 'cubic') {
        // Cubic Bezier position and derivative
        x = (1-t)*(1-t)*(1-t)*path.x + 
            3*(1-t)*(1-t)*t*path.control1X + 
            3*(1-t)*t*t*path.control2X + 
            t*t*t*path.endX;
        y = (1-t)*(1-t)*(1-t)*path.y + 
            3*(1-t)*(1-t)*t*path.control1Y + 
            3*(1-t)*t*t*path.control2Y + 
            t*t*t*path.endY;
        dx = 3*(1-t)*(1-t)*(path.control1X - path.x) + 
             6*(1-t)*t*(path.control2X - path.control1X) + 
             3*t*t*(path.endX - path.control2X);
        dy = 3*(1-t)*(1-t)*(path.control1Y - path.y) + 
             6*(1-t)*t*(path.control2Y - path.control1Y) + 
             3*t*t*(path.endY - path.control2Y);
      } else if (path.type === 'quadratic') {
        // Quadratic Bezier position and derivative
        x = (1-t)*(1-t)*path.x + 2*(1-t)*t*path.controlX + t*t*path.endX;
        y = (1-t)*(1-t)*path.y + 2*(1-t)*t*path.controlY + t*t*path.endY;
        dx = 2*(1-t)*(path.controlX - path.x) + 2*t*(path.endX - path.controlX);
        dy = 2*(1-t)*(path.controlY - path.y) + 2*t*(path.endY - path.controlY);
      }

      // Calculate perpendicular angle from path tangent
      // (paths are already rotated, so this automatically accounts for element rotation)
      const sideOffset = sideMultiplier === -1 ? Math.PI : 0;
      let perpAngle;
      const _isHalfway = element.isClosed && Math.abs(p.stitchesBefore - element.stitchCount / 2) < 1.5;
      if (_isHalfway && element.paths && element.paths[0]) {
        // Stable axis: vector from join point (path start) → current position
        const joinX = element.paths[0].x, joinY = element.paths[0].y;
        const axDx = x - joinX, axDy = y - joinY;
        const axLen = Math.sqrt(axDx*axDx + axDy*axDy) || 1;
        perpAngle = Math.atan2(axDy / axLen, axDx / axLen) + sideOffset;
      } else {
        perpAngle = Math.atan2(dy, dx) - Math.PI / 2 + sideOffset;
      }
      
      const len = picotSize[p.length] || 20;
      const endX = x + Math.cos(perpAngle) * len;
      const endY = y + Math.sin(perpAngle) * len;
      
      const isSelected = selectedPicots.some(sp => sp.elementId === element.id && sp.picotId === p.id);
      const isConnected = p.isJoint && picotConnections.some(conn => conn.picots.some(cp => cp.elementId === element.id && cp.picotId === p.id));
      // jpg (isJoint+isGuide) = green arm; jp = green dot → yellow when connected → pink when selected
      const color = (p.isJoint && p.isGuide)
        ? (isSelected ? theme.jpgArmSelected : theme.jpgArm)    // jpg: green arm
        : p.isJoint
        ? (isSelected ? theme.jpSelected : isConnected ? theme.jpConnected : theme.jpUnconnected)
        : p.isGuidePoint
        ? theme.gpDiamond                                // gp: yellow-green diamond
        : getSolidColor(element);
      const strokeWidth = isSelected ? "4" : "2";

      // BE: render based on beStructure config — always show diamond
      if (p.beadType === 'be') {
        return renderBE(p, x, y, perpAngle, color, len, isSelected);
      }
      
      // jp only (not jpg): dot on path — hidden in realistic mode
      if (p.isJoint && !p.isGuide) {
        if (renderMode === 'realistic') return null;
        return (
          <g key={p.id}>
            <circle cx={x} cy={y} r={isSelected ? 6/zoom : 4.5/zoom} fill={color} stroke="#000" strokeWidth={2/zoom} />
          </g>
        );
      }

      // Guide Point (gp): diamond marker on path, no arm — schematic only
      if (p.isGuidePoint) {
        if (renderMode !== 'schematic') return null;
        return (
          <g key={p.id}>
            <rect transform={`rotate(45, ${x}, ${y})`} x={x - 4} y={y - 4} width="8" height="8" fill={color} stroke="#000" strokeWidth="1.5" />
          </g>
        );
      }

      // Beaded picot (bp:SEQ)
      if (p.beadType === 'bcp') {
        return renderBcpBead(p.id, x, y, perpAngle, p.coreSize, p.beadSeq, color, len);
      }
      if (p.beadType === 'bc') {
        return renderCoreBead(p.id, x, y, p.beadSize, color, perpAngle);
      }
      if (p.beadType === 'sb' && p.beadSeq) {
        return renderSuspendedBead(p.id, x, y, perpAngle, p.beadSeq, color);
      }
      if (p.beadSeq) {
        return renderBeadedPicot(p.id, x, y, perpAngle, p.beadSeq, color, len);
      }

      if (beadAndJointOnly) return null;
      return (
        <g key={p.id} className={p.isGuide ? 'guide-picot' : undefined}>
          <line x1={x} y1={y} x2={endX} y2={endY} stroke={color} strokeWidth={strokeWidth} />
          {p.isGuide && renderMode === 'schematic' && <rect className="guide-picot-marker" x={endX - 3} y={endY - 3} width="6" height="6" fill={color} stroke="#FFF" strokeWidth="1" />}
        </g>
      );
    });
  };

  // Notation label font sizes
  const NOTATION_FONT_SIZES = { small: 11, medium: 14, large: 18 };
  const notationFS = NOTATION_FONT_SIZES[notationFontSize] || 14;

  const renderStitchLabels = (element) => {
    // Count actual stitches from notation (not DS equivalent)
    const actualStitchCount = countActualStitches(element.notation || '');
    
    // Always show at least the total stitch count if no picots
    if (!element.picots || element.picots.length === 0) {
      const solidColor = getSolidColor(element);
      
      // Show total stitch count for elements without picots
      if (element.isClosed && element.shapeStyle === 'circle') {
        const targetCircumference = element.stitchCount * dsWidth;
        const radius = targetCircumference / (2 * Math.PI);
        const labelsInside = element.labelsInside;
        
        // Position: inside (default), onPath, or outside
        let textY;
        if (labelsInside === 'onPath') {
          textY = element.center.y - radius - 8; // On the path (slightly above top)
        } else if (labelsInside === false) {
          textY = element.center.y + radius + 25; // Outside
        } else {
          textY = element.center.y; // Inside (default)
        }
        
        return (
          <text
            x={element.center.x}
            y={textY}
            fill="white"
            fontSize={notationFS}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
            stroke="#000000"
            strokeWidth="4"
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {actualStitchCount === 0 ? null : actualStitchCount}
          </text>
        );
      } else if (element.isSplitRing) {
        // Split ring no-picot: show section A count on left curve, section B count on right curve
        if (!element.paths || element.paths.length < 2) return null;
        const splitPos = element.splitPosition || Math.floor(element.stitchCount / 2);
        const countA = countActualStitches(element.notation || '');
        const countB = countActualStitches(`sr: ${element.notationB || '5ds'}`);
        const labelsInside = element.labelsInside;
        const offset = labelsInside === 'onPath' ? 8 : labelsInside === false ? 22 : -14;
        const labels = [];
        // Place each count at midpoint of its respective path, offset outward
        for (const [pathIdx, count] of [[0, countA], [1, countB]]) {
          const p = element.paths[pathIdx];
          const t = 0.5;
          let mx, my, mdx, mdy;
          mx = (1-t)*(1-t)*(1-t)*p.x + 3*(1-t)*(1-t)*t*p.control1X + 3*(1-t)*t*t*p.control2X + t*t*t*p.endX;
          my = (1-t)*(1-t)*(1-t)*p.y + 3*(1-t)*(1-t)*t*p.control1Y + 3*(1-t)*t*t*p.control2Y + t*t*t*p.endY;
          mdx = 3*(1-t)*(1-t)*(p.control1X-p.x) + 6*(1-t)*t*(p.control2X-p.control1X) + 3*t*t*(p.endX-p.control2X);
          mdy = 3*(1-t)*(1-t)*(p.control1Y-p.y) + 6*(1-t)*t*(p.control2Y-p.control1Y) + 3*t*t*(p.endY-p.control2Y);
          const perpAngle = Math.atan2(mdy, mdx) - Math.PI / 2;
          labels.push(
            <text
              key={`label-${element.id}-sr${pathIdx}`}
              x={mx + Math.cos(perpAngle) * offset}
              y={my + Math.sin(perpAngle) * offset}
              fill="white"
              fontSize={notationFS}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              stroke="#000000"
              strokeWidth="4"
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {count}
            </text>
          );
        }
        return labels;
      } else {
        // For teardrops and chains with no picots: respect labelsInside toggle
        // Sample the path midpoint and offset perpendicular to the curve
        if (!element.paths || element.paths.length === 0) return null;

        let totalLength = 0;
        const pathLengths = [];
        for (let path of element.paths) {
          const points = sampleBezierPath(path, 20);
          const len = calculatePathLength(points);
          pathLengths.push(len);
          totalLength += len;
        }

        const targetDist = totalLength * 0.5;
        let accum = 0, pathIndex = 0, localT = 0.5;
        for (let j = 0; j < pathLengths.length; j++) {
          if (accum + pathLengths[j] >= targetDist) {
            pathIndex = j;
            localT = pathLengths[j] > 0 ? (targetDist - accum) / pathLengths[j] : 0.5;
            break;
          }
          accum += pathLengths[j];
        }

        const midPath = element.paths[pathIndex];
        const t = localT;
        let mx, my, mdx, mdy;
        if (midPath.type === 'cubic') {
          mx = (1-t)*(1-t)*(1-t)*midPath.x + 3*(1-t)*(1-t)*t*midPath.control1X + 3*(1-t)*t*t*midPath.control2X + t*t*t*midPath.endX;
          my = (1-t)*(1-t)*(1-t)*midPath.y + 3*(1-t)*(1-t)*t*midPath.control1Y + 3*(1-t)*t*t*midPath.control2Y + t*t*t*midPath.endY;
          mdx = 3*(1-t)*(1-t)*(midPath.control1X - midPath.x) + 6*(1-t)*t*(midPath.control2X - midPath.control1X) + 3*t*t*(midPath.endX - midPath.control2X);
          mdy = 3*(1-t)*(1-t)*(midPath.control1Y - midPath.y) + 6*(1-t)*t*(midPath.control2Y - midPath.control1Y) + 3*t*t*(midPath.endY - midPath.control2Y);
        } else {
          mx = (1-t)*(1-t)*midPath.x + 2*(1-t)*t*midPath.controlX + t*t*midPath.endX;
          my = (1-t)*(1-t)*midPath.y + 2*(1-t)*t*midPath.controlY + t*t*midPath.endY;
          mdx = 2*(1-t)*(midPath.controlX - midPath.x) + 2*t*(midPath.endX - midPath.controlX);
          mdy = 2*(1-t)*(midPath.controlY - midPath.y) + 2*t*(midPath.endY - midPath.controlY);
        }

        const perpAngle = Math.atan2(mdy, mdx) - Math.PI / 2;
        const labelsInside = element.labelsInside;
        let offset;
        if (labelsInside === 'onPath') {
          offset = 8;
        } else if (labelsInside === false) {
          offset = element.isClosed ? 25 : 25;
        } else {
          offset = element.isClosed ? -15 : -15;
        }

        return (
          <text
            x={mx + Math.cos(perpAngle) * offset}
            y={my + Math.sin(perpAngle) * offset}
            fill="white"
            fontSize={notationFS}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
            stroke="#000000"
            strokeWidth="4"
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {actualStitchCount === 0 ? null : actualStitchCount}
          </text>
        );
      }
    }

    // Has picots - show segments between picots
    const solidColor = getSolidColor(element);
    const segments = [];
    let lastPos = 0;
    
    for (let i = 0; i <= element.picots.length; i++) {
      const endPos = i < element.picots.length ? element.picots[i].stitchesBefore : element.stitchCount;
      const count = endPos - lastPos;
      if (count > 0) {
        segments.push({ start: lastPos, count });
      }
      lastPos = endPos;
    }

    if (segments.length === 0) return null;

    // Special handling for circles (rendered as SVG circle, not paths)
    if (element.isClosed && element.shapeStyle === 'circle') {
      const targetCircumference = element.stitchCount * dsWidth;
      const radius = targetCircumference / (2 * Math.PI);
      const labelsInside = element.labelsInside;
      
      // Position: inside, onPath, or outside
      let textRadius;
      if (labelsInside === 'onPath') {
        textRadius = radius + 8; // On path (slightly outside the circle line)
      } else if (labelsInside === false) {
        textRadius = radius + 25; // Outside
      } else {
        textRadius = radius * 0.65; // Inside (default)
      }
      
      return segments.map((seg, i) => {
        const angleMid = ((seg.start + seg.count / 2) / element.stitchCount) * Math.PI * 2 - Math.PI / 2;
        const actualCount = countStitchesInRange(element.notation || '', seg.start, seg.start + seg.count);
        
        if (actualCount === 0) return null;
        return (
          <text
            key={`label-${element.id}-${i}`}
            x={element.center.x + Math.cos(angleMid) * textRadius}
            y={element.center.y + Math.sin(angleMid) * textRadius}
            fill="white"
            fontSize={notationFS}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
            stroke="#000000"
            strokeWidth="4"
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {actualCount}
          </text>
        );
      });
    }

    // Split ring: handle A and B sections separately on their own paths
    if (element.isSplitRing) {
      const splitPos = element.splitPosition || Math.floor(element.stitchCount / 2);
      const labelsInside = element.labelsInside;
      const offset = labelsInside === 'onPath' ? 8 : labelsInside === false ? 22 : -14;
      const labels = [];

      // Section A: picots where stitchesBefore < splitPos → labels on path[0]
      const picotsA = (element.picots || []).filter(p => p.stitchesBefore <= splitPos);
      const segmentsA = [];
      let lastA = 0;
      for (let i = 0; i <= picotsA.length; i++) {
        const endPos = i < picotsA.length ? picotsA[i].stitchesBefore : splitPos;
        const cnt = endPos - lastA;
        if (cnt > 0) segmentsA.push({ start: lastA, count: cnt });
        lastA = endPos;
      }

      // Section B: picots where stitchesBefore > splitPos → labels on path[1]
      const picotsB = (element.picots || []).filter(p => p.stitchesBefore > splitPos);
      const stitchCountB = element.stitchCount - splitPos;
      const segmentsB = [];
      let lastB = 0;
      for (let i = 0; i <= picotsB.length; i++) {
        const endPos = i < picotsB.length ? picotsB[i].stitchesBefore - splitPos : stitchCountB;
        const cnt = endPos - lastB;
        if (cnt > 0) segmentsB.push({ start: lastB, count: cnt });
        lastB = endPos;
      }

      const renderSectionLabels = (segs, pathCurve, sectionStitchCount, sectionNotation, sectionId) => {
        const sampleSet = [sampleBezierPath(pathCurve, 20)];
        const lenSet = [calculatePathLength(sampleSet[0])];
        const totalLen = lenSet[0];
        segs.forEach((seg, i) => {
          const dist = ((seg.start + seg.count / 2) / sectionStitchCount) * totalLen;
          const { x, y, angle } = getPointAndAngleAtDistanceFast(sampleSet, lenSet, dist);
          const perpAngle = angle - Math.PI / 2;
          const actualCount = countStitchesInRange(sectionNotation, seg.start, seg.start + seg.count);
          labels.push(
            <text
              key={`label-${element.id}-sr${sectionId}-${i}`}
              x={x + Math.cos(perpAngle) * offset}
              y={y + Math.sin(perpAngle) * offset}
              fill="white"
              fontSize={notationFS}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              stroke="#000000"
              strokeWidth="4"
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {actualCount}
            </text>
          );
        });
      };

      if (element.paths[0]) renderSectionLabels(segmentsA, element.paths[0], splitPos, element.notation || 'sr: 5ds', 'A');
      if (element.paths[1]) renderSectionLabels(segmentsB, element.paths[1], stitchCountB, `sr: ${element.notationB || '5ds'}`, 'B');
      return labels.length > 0 ? labels : null;
    }

    // Path-based rendering for teardrops and chains
    // Pre-sample once for performance
    const allSamplesL = element.paths.map(p => sampleBezierPath(p, 20));
    const pathLengths = allSamplesL.map(s => calculatePathLength(s));
    const totalLength = pathLengths.reduce((a, b) => a + b, 0);

    return segments.map((seg, i) => {
      // Position label at midpoint of the segment using pre-sampled data
      const targetDist = ((seg.start + seg.count / 2) / element.stitchCount) * totalLength;
      const actualCount = countStitchesInRange(element.notation || '', seg.start, seg.start + seg.count);

      const { x, y, angle: rawAngle } = getPointAndAngleAtDistanceFast(allSamplesL, pathLengths, targetDist);
      const perpAngle = rawAngle - Math.PI / 2;
      const labelsInside = element.labelsInside;
      
      // Position: inside, onPath, or outside
      let offset;
      if (labelsInside === 'onPath') {
        offset = 8; // On path (slightly above the path line)
      } else if (labelsInside === false) {
        offset = element.isClosed ? 25 : 25; // Outside
      } else {
        offset = element.isClosed ? -15 : -15; // Inside (default)
      }
      
      return (
        <text
          key={`label-${element.id}-${i}`}
          x={x + Math.cos(perpAngle) * offset}
          y={y + Math.sin(perpAngle) * offset}
          fill="white"
          fontSize={notationFS}
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="middle"
          stroke="#000000"
          strokeWidth="4"
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {actualCount}
        </text>
      );
    });
  };

  // Memoize selectedElement to avoid recalculation on every render
  const selectedElement = useMemo(() => {
    return selectedIds.length === 1 ? elementById.get(selectedIds[0]) : null;
  }, [selectedIds, elements]);

  // PERFORMANCE OPTIMIZATION: Separate solid colors from gradients (static calculation)
  const solidColors = useMemo(() => {
    return dmcColors.filter(c => c.type !== 'gradient');
  }, [dmcColors]);

  const gradientColors = useMemo(() => {
    return dmcColors.filter(c => c.type === 'gradient');
  }, [dmcColors]);

  // PERFORMANCE OPTIMIZATION: Memoize color filtering (expensive operation)
  const filteredSolidColors = useMemo(() => {
    return solidColors.filter(color => {
      // Search filter
      if (dmcSearchTerm) {
        const search = dmcSearchTerm.toLowerCase();
        if (!color.id.toLowerCase().includes(search) && 
            !color.name.toLowerCase().includes(search)) {
          return false;
        }
      }
      
      // Category filter (implemented in render, but we can pre-filter here later)
      return true;
    });
  }, [solidColors, dmcSearchTerm]);

  // PERFORMANCE OPTIMIZATION: Memoize bounding box calculation
  const selectedBoundingBox = useMemo(() => {
    if (selectedIds.length === 0) return null;
    return getBoundingBox(selectedIds);
  }, [selectedIds, elements]); // Recalculate when selection or elements change

  // PERFORMANCE: Per-element world-space bounding boxes for viewport culling.
  // Simple/conservative AABB — slightly oversized is fine, the goal is to skip clearly off-screen elements.
  const elementBoundsCache = useMemo(() => {
    const map = new Map();
    const PICOT_MARGIN = 40; // px world-space margin for picots/beads
    for (const el of elements) {
      if (el.isClosed && el.shapeStyle === 'circle') {
        const r = (el.stitchCount * dsWidth) / (2 * Math.PI) + PICOT_MARGIN;
        map.set(el.id, { minX: el.center.x - r, minY: el.center.y - r, maxX: el.center.x + r, maxY: el.center.y + r });
      } else if (el.paths && el.paths.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const path of el.paths) {
          // Use bezier control points as conservative hull (cheaper than sampling)
          const pts = path.type === 'cubic'
            ? [{ x: path.x, y: path.y }, { x: path.control1X, y: path.control1Y },
               { x: path.control2X, y: path.control2Y }, { x: path.endX, y: path.endY }]
            : [{ x: path.x, y: path.y }, { x: path.controlX ?? path.control1X, y: path.controlY ?? path.control1Y },
               { x: path.endX, y: path.endY }];
          for (const p of pts) {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
          }
        }
        map.set(el.id, { minX: minX - PICOT_MARGIN, minY: minY - PICOT_MARGIN,
                         maxX: maxX + PICOT_MARGIN, maxY: maxY + PICOT_MARGIN });
      }
    }
    return map;
  }, [elements, dsWidth]);

  // Returns true if an element's bounding box overlaps the current camera viewport.
  // Always returns true for selected elements (avoid disappearing while dragging off-edge).
  const isInViewport = (el) => {
    if (selectedIds.includes(el.id)) return true; // never cull selected
    const bounds = elementBoundsCache.get(el.id);
    if (!bounds) return true; // no bounds = render to be safe
    const { width: cw, height: ch } = canvasSizeRef.current;
    // Convert viewport screen corners to world coords
    const vMinX = -camera.x / zoom;
    const vMinY = -camera.y / zoom;
    const vMaxX = (cw - camera.x) / zoom;
    const vMaxY = (ch - camera.y) / zoom;
    // AABB overlap test (with a small extra margin so elements don't pop at exact edge)
    const MARGIN = 50 / zoom;
    return bounds.maxX > vMinX - MARGIN && bounds.minX < vMaxX + MARGIN &&
           bounds.maxY > vMinY - MARGIN && bounds.minY < vMaxY + MARGIN;
  };

  // PERFORMANCE OPTIMIZATION: Memoize rotation handles visibility
  const shouldShowRotationHandles = useMemo(() => {
    return isShiftHeld || showRotationHandles;
  }, [isShiftHeld, showRotationHandles]);

  // PERFORMANCE OPTIMIZATION: Debounced search for DMC colors
  // Prevents expensive filtering on every keystroke
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(dmcSearchTerm);
    }, 300); // 300ms delay
    
    return () => clearTimeout(timerId);
  }, [dmcSearchTerm]);

  // Track last selected element's material for use on new elements
  useEffect(() => {
    if (selectedIds.length > 0) {
      const lastSelected = elementById.get(selectedIds[selectedIds.length - 1]);
      if (lastSelected) {
        lastUsedMaterialIdRef.current = lastSelected.materialId || 'default';
      }
    }
  }, [selectedIds]);

  // ESC key closes modal windows
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (renderMode === 'realistic') { setRenderMode('schematic'); return; }
      if (showColorPicker) { setShowColorPicker(false); setPickerCallback(null); setPickerGradientCallback(null); return; }
      if (showMaterialsPanel) { setShowMaterialsPanel(false); return; }
      if (showHelp) { setShowHelp(false); return; }
      if (showSaveDialog) { setShowSaveDialog(false); return; }
      if (showThreadProperties) { setShowThreadProperties(false); return; }
      if (currentTool === 'picotJoin') { setCurrentTool('select'); setShowJoinTip(false); return; }
      if (currentTool === 'beading') { setCurrentTool('select'); setSelectedBEs([]); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showColorPicker, showMaterialsPanel, showHelp, showSaveDialog, showThreadProperties, currentTool, renderMode]);

  // Update filteredSolidColors to use debounced search
  const filteredSolidColorsDebounced = useMemo(() => {
    return solidColors.filter(color => {
      // Search filter with debounced term
      if (debouncedSearchTerm) {
        const search = debouncedSearchTerm.toLowerCase();
        if (!color.id.toLowerCase().includes(search) && 
            !color.name.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [solidColors, debouncedSearchTerm]);

  // Helper function to get a solid color for picots and labels when element has gradient
  // Get the effective color for an element — material override takes priority
  const getElementColor = (element) => {
    const mat = materialsById.get(element.materialId && element.materialId !== 'default'
      ? element.materialId : 'default');
    if (mat) {
      if (mat.isGradient && mat.color) return { isGradient: true, id: mat.color };
      if (mat.color) return { isGradient: false, color: mat.color };
    }
    // No material match — use element's own color
    return { isGradient: element.isGradient || false, color: element.color };
  };

  // PERFORMANCE OPTIMIZATION: Memoize all stitch geometry calculations.
  // calculateCircleStitches / calculatePathStitches / calculateSplitRingStitches are
  // expensive (Bézier sampling, trig per stitch) and must NOT run on every React render.
  // Placed here because it depends on getElementColor (defined just above).
  // This cache recomputes only when elements, renderMode, or dsWidth actually change.
  const stitchCache = useMemo(() => {
    const map = new Map();
    if (renderMode !== 'realistic') return map; // schematic mode needs nothing
    for (const el of elements) {
      if (el.isClosed && el.shapeStyle === 'circle') {
        map.set(el.id, calculateCircleStitches(el));
      } else if (el.isSplitRing) {
        map.set(el.id, calculateSplitRingStitches(el));
      } else if (el.type === 'chain' || el.type === 'ring') {
        map.set(el.id, calculatePathStitches(el));
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, renderMode, dsWidth]);

  const getSolidColor = (element) => {
    const mat = materialsById.get(element.materialId || 'default');
    if (mat && !mat.isGradient) return mat.color;
    if (mat && mat.isGradient) {
      const gradientColor = dmcColors.find(c => c.id === mat.color);
      if (gradientColor?.stops) {
        if (typeof gradientColor.stops === 'string') return gradientColor.stops.split(',')[0].split(':')[1];
        if (Array.isArray(gradientColor.stops) && gradientColor.stops.length > 0) return gradientColor.stops[0].color;
      }
    }
    if (!element.isGradient) return element.color;
    
    // Element has gradient - get first color from gradient stops
    const gradientColor = dmcColors.find(c => c.id === element.color);
    if (!gradientColor || !gradientColor.stops) return '#FFFFFF'; // Fallback
    
    // Parse stops to get first color
    if (typeof gradientColor.stops === 'string') {
      const firstStop = gradientColor.stops.split(',')[0];
      const color = firstStop.split(':')[1];
      return color;
    } else if (Array.isArray(gradientColor.stops) && gradientColor.stops.length > 0) {
      return gradientColor.stops[0].color;
    }
    
    return '#FFFFFF'; // Fallback
  };

  // Get snap points for an element
  const getSnapPoints = (element) => {
    const points = [];
    
    if (element.type === 'line') {
      // Lines: 2 endpoints (start and end)
      if (element.paths && element.paths.length > 0) {
        const path = element.paths[0];
        points.push({ x: path.x,    y: path.y,    type: 'line-start', elementId: element.id });
        points.push({ x: path.endX, y: path.endY, type: 'line-end',   elementId: element.id });
      }
    } else if (element.type === 'chain') {
      // Chains: 2 endpoints
      if (element.paths && element.paths.length > 0) {
        const firstPath = element.paths[0];
        const lastPath = element.paths[element.paths.length - 1];
        
        points.push({
          x: firstPath.x,
          y: firstPath.y,
          type: 'chain-start',
          elementId: element.id
        });
        
        points.push({
          x: lastPath.endX,
          y: lastPath.endY,
          type: 'chain-end',
          elementId: element.id
        });
      }
    } else if (element.type === 'ring' && element.isClosed) {
      if (element.shapeStyle === 'circle') {
        // Circle: top point (12 o'clock) - MUST account for rotation
        const targetCircumference = element.stitchCount * dsWidth;
        const radius = targetCircumference / (2 * Math.PI);
        const rotation = (element.rotation || 0) * Math.PI / 180; // Convert to radians
        
        // Calculate top point with rotation applied
        const topX = element.center.x + Math.sin(rotation) * radius;
        const topY = element.center.y - Math.cos(rotation) * radius;
        
        points.push({
          x: topX,
          y: topY,
          type: 'ring-top',
          elementId: element.id
        });
      } else if (element.isSplitRing) {
        // Split ring: top and bottom guide points along the height line
        if (element.paths && element.paths.length >= 2) {
          // Top point (paths[0] ends here after drawing from bottom to top)
          points.push({
            x: element.paths[0].endX,
            y: element.paths[0].endY,
            type: 'split-ring-top',
            elementId: element.id
          });
          // Bottom point (paths[0] starts here)
          points.push({
            x: element.paths[0].x,
            y: element.paths[0].y,
            type: 'split-ring-bottom',
            elementId: element.id
          });
        }
      } else {
        // Teardrop: use the tip point (first path's starting point - already rotated)
        if (element.paths && element.paths.length > 0) {
          const firstPath = element.paths[0];
          points.push({
            x: firstPath.x,
            y: firstPath.y,
            type: 'ring-top',
            elementId: element.id
          });
        }
      }
    }
    
    // Add snap points for guide joined picots (jpg) and guide points (gp)
    if (element.picots && element.picots.length > 0) {
      element.picots.forEach(picot => {
        // Both gp and jpg have isGuide=true — snap at base for gp, tip for jpg (handled by getPicotPosition)
        if (picot.isGuide) {
          const picotPos = getPicotPosition(element, picot);
          if (picotPos) {
            points.push({
              x: picotPos.x,
              y: picotPos.y,
              type: 'picot-guide',
              elementId: element.id,
              picotId: picot.id
            });
          }
        }
      });
    }
    
    return points;
  };

  // Find nearest snap point to given world coordinates
  const findNearestSnapPoint = (worldX, worldY, excludeIds = null) => {
    if (!snapEnabled) return null;
    
    // Normalise excludeIds to a Set for O(1) lookup
    const excluded = excludeIds instanceof Set ? excludeIds
      : excludeIds != null ? new Set([excludeIds])
      : new Set();
    
    let nearestPoint = null;
    const effectiveSnapRadius = snapRadius / zoom; // screen-pixel-constant
    let nearestDist = effectiveSnapRadius;
    
    elements.forEach(el => {
      if (excluded.has(el.id)) return;
      
      // Spatial pre-filter: rough bound on element size (largest rings ~200px radius at high stitch counts)
      // Skip if element center is clearly too far to have any snap point within snapRadius
      const centerDist = Math.hypot(el.center.x - worldX, el.center.y - worldY);
      if (centerDist > effectiveSnapRadius + 400) return; // 400px covers even very large elements
      
      const snapPoints = getSnapPoints(el);
      snapPoints.forEach(point => {
        const dist = Math.hypot(point.x - worldX, point.y - worldY);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestPoint = point;
        }
      });
    });
    
    return nearestPoint;
  };

  return (
    <>
      {/* Load notification toast */}
      {loadMsg && (
        <div
          className="fixed top-6 left-1/2 pointer-events-none"
          style={{ transform: 'translateX(-50%)', zIndex: 2147483647 }}
        >
          <div className={`flex items-center gap-3 px-5 py-3 rounded-lg shadow-2xl text-white font-semibold text-sm border ${
            loadMsg.type === 'success'
              ? 'bg-green-700 border-green-500'
              : 'bg-red-800 border-red-500'
          }`}>
            <span>{loadMsg.type === 'success' ? '✓' : '✕'}</span>
            <span>{loadMsg.text}</span>
          </div>
        </div>
      )}

      <style>{`
        /* Prevent browser interference with gestures */
        body {
          overscroll-behavior: none; /* Prevent pull-to-refresh on mobile */
          touch-action: none; /* Prevent browser zoom gestures */
        }
        
        /* Mobile responsive styles */
        /* Property bar: consistent button + input heights on ALL screen sizes */
        .top-row-properties button {
          height: 1.75rem;
          min-height: 1.75rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 0.4rem;
          white-space: nowrap;
          box-sizing: border-box;
        }
        .top-row-properties input[type="text"],
        .top-row-properties input[type="number"] {
          height: 1.75rem;
          min-height: 1.75rem;
          box-sizing: border-box;
          padding: 0 0.3rem;
        }
        .top-row-properties input[type="range"] {
          height: 1.75rem;
        }
        
        @media (max-width: 768px) {
          /* Scale Row 1 buttons aggressively on mobile */
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.85) !important;
            padding: 0.15rem 0.3rem !important;
          }
          .top-row-buttons {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
          }
          /* Hide dividers on mobile */
          .top-row-buttons .w-px {
            display: none !important;
          }
          .top-row-buttons .ml-auto {
            display: none !important;
          }
          
          .mobile-no-padding {
            padding-left: 0.5rem !important;
            padding-right: 0.5rem !important;
          }
          
          .mobile-toolbar-compact {
            left: 1.5rem !important; /* Was 0.25rem - moved away from unclickable edge */
            top: 0.25rem !important;
            padding: 0.25rem !important;
          }
          
          /* Row 2: Properties bar - NO GAP OVERRIDES, just sizing */
          .top-row-properties {
            flex-wrap: wrap !important;
            overflow-x: hidden !important;
            justify-content: flex-start !important;
            padding: 0.25rem 0.5rem !important;
            row-gap: 0.2rem !important;
          }
          
          .top-row-properties > div,
          .top-row-properties .flex {
            flex-shrink: 0 !important;
          }
          
          /* Disable scaling for properties on mobile WIDTH (we handle sizing manually) */
          .top-row-properties .top-toolbar-scalable {
            transform: none !important;
          }
          
          /* Remove spinner arrows from ALL number inputs - reclaims ~16px width */
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type="number"] {
            -moz-appearance: textfield;
          }

          .top-row-properties input[type="text"],
          .top-row-properties input[type="number"] {
            padding: 0.2rem 0.3rem !important;
            font-size: 0.7rem !important;
            min-width: 0 !important;
            flex-shrink: 0 !important;
          }
          
          .top-row-properties input.notation-input {
            width: 105px !important; /* 70px * 1.5 = 105px */
          }
          
          .top-row-properties input[type="number"] {
            width: 44px !important;
          }
          
          .top-row-properties input[type="range"] {
            width: 40px !important;
          }
          
          .top-row-properties .w-16 {
            width: 2.5rem !important;
          }
          
          .top-row-properties .w-24 {
            width: 2.5rem !important;
          }
          
          .top-row-properties button {
            padding: 0 0.35rem !important;
            height: 1.6rem !important;
            font-size: 0.7rem !important;
            min-width: 0 !important;
            flex-shrink: 0 !important;
            white-space: nowrap !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .top-row-properties input[type="text"],
          .top-row-properties input[type="number"] {
            height: 1.6rem !important;
          }
          
          .top-row-properties .text-xs {
            font-size: 0.65rem !important;
          }
          
          .top-row-properties label.text-xs {
            display: none !important;
          }
          
          .top-row-properties .w-8 {
            width: 1.5rem !important;
          }
          
          .top-row-properties svg {
            width: 14px !important;
            height: 14px !important;
          }
        }
        
        /* Even more aggressive for very narrow screens */
        @media (max-width: 480px) {
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.75) !important;
            padding: 0.1rem 0.2rem !important;
          }
        }
        
        @media (max-width: 380px) {
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.7) !important;
            padding: 0.1rem 0.15rem !important;
          }
        }
        
        @media (max-width: 768px) {
          .mobile-toolbar-compact-right {
            right: 1.5rem !important; /* Was 0.25rem - moved away from unclickable edge */
            top: 0.25rem !important;
            padding: 0.25rem !important;
          }
          .mobile-gap-small {
            gap: 0.25rem !important;
          }
          /* Hide text labels on mobile to save space */
          .hide-label-mobile {
            display: none !important;
          }
          /* Make properties panel inputs smaller on mobile to fit 2 lines */
          .top-toolbar-scalable input[type="text"],
          .top-toolbar-scalable input[type="number"] {
            font-size: 0.75rem !important;
            padding: 0.25rem 0.5rem !important;
          }
          .top-toolbar-scalable button {
            padding: 0.25rem !important;
          }
          .top-toolbar-scalable .text-xs {
            font-size: 0.65rem !important;
          }
        }
        
        /* Scale down side toolbars on narrow screens (mobile width) */
        @media (max-width: 768px) {
          .toolbar-scalable-left {
            transform: scale(0.75) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.75) !important;
            transform-origin: top right !important;
          }
        }
        
        @media (max-width: 480px) {
          .toolbar-scalable-left {
            transform: scale(0.65) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.65) !important;
            transform-origin: top right !important;
          }
        }
        
        @media (max-width: 380px) {
          .toolbar-scalable-left {
            transform: scale(0.55) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.55) !important;
            transform-origin: top right !important;
          }
        }
        
        /* Scale down ALL toolbars when not enough vertical space */
        @media (max-height: 700px) {
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.85) !important;
            padding: 0.15rem 0.3rem !important;
          }
          
          .toolbar-scalable {
            transform: scale(0.68) !important;
          }
          .toolbar-scalable-left {
            transform: scale(0.68) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.68) !important;
            transform-origin: top right !important;
          }
          .toolbar-scalable-bottom {
            transform: translateX(-50%) scale(0.68) !important;
            transform-origin: bottom center !important;
          }
          .top-toolbar-scalable {
            transform: scale(0.68) !important;
            transform-origin: left center !important;
          }
          /* Hide text labels when scaled */
          .hide-label-scaled {
            display: none !important;
          }
        }
        @media (max-height: 600px) {
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.75) !important;
            padding: 0.1rem 0.2rem !important;
          }
          
          .toolbar-scalable {
            transform: scale(0.6) !important;
          }
          .toolbar-scalable-left {
            transform: scale(0.6) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.6) !important;
            transform-origin: top right !important;
          }
          .toolbar-scalable-bottom {
            transform: translateX(-50%) scale(0.6) !important;
            transform-origin: bottom center !important;
          }
          .top-toolbar-scalable {
            transform: scale(0.6) !important;
            transform-origin: left center !important;
          }
          .hide-label-scaled {
            display: none !important;
          }
        }
        @media (max-height: 500px) {
          .top-row-buttons button,
          .top-row-buttons .relative {
            transform: scale(0.7) !important;
            padding: 0.1rem 0.15rem !important;
          }
          
          .toolbar-scalable {
            transform: scale(0.5) !important;
          }
          .toolbar-scalable-left {
            transform: scale(0.5) !important;
            transform-origin: top left !important;
          }
          .toolbar-scalable-right {
            transform: scale(0.5) !important;
            transform-origin: top right !important;
          }
          .toolbar-scalable-bottom {
            transform: translateX(-50%) scale(0.5) !important;
            transform-origin: bottom center !important;
          }
          .top-toolbar-scalable {
            transform: scale(0.5) !important;
            transform-origin: left center !important;
          }
          .hide-label-scaled {
            display: none !important;
          }
        }
        
        /* Default notation input width on desktop */
        .notation-input {
          width: 340px; /* 2× original for big screens */
        }

        /* ── Large UI Scale ───────────────────────────────────────────
           Boosts all toolbars by 1.25×. The media-query scale-downs still
           apply on top of this (they use !important), so small screens
           still shrink to fit — they just start from a larger base.
        ── */
        .ui-large .toolbar-scalable-left  { transform: scale(1.25) !important; transform-origin: top left   !important; }
        .ui-large .toolbar-scalable-right { transform: scale(1.25) !important; transform-origin: top right  !important; }
        .ui-large .top-toolbar-scalable   { transform: scale(1.25) !important; transform-origin: left center !important; }
        .ui-large .top-row-buttons button,
        .ui-large .top-row-buttons .relative { transform: scale(1.25) !important; }

        /* On narrow screens, reduce the large-scale factor so toolbars still fit */
        @media (max-width: 768px) {
          .ui-large .toolbar-scalable-left  { transform: scale(0.95) !important; }
          .ui-large .toolbar-scalable-right { transform: scale(0.95) !important; }
          .ui-large .top-toolbar-scalable   { transform: scale(0.95) !important; }
        }
        @media (max-height: 700px) {
          .ui-large .toolbar-scalable-left  { transform: scale(0.85) !important; }
          .ui-large .toolbar-scalable-right { transform: scale(0.85) !important; }
          .ui-large .top-toolbar-scalable   { transform: scale(0.85) !important; }
        }
      `}</style>
      <div className={`w-full h-screen flex flex-col${uiScale === 'large' ? ' ui-large' : ''}`} style={{ backgroundColor: bgColor }}>
      {/* Two-row header */}
      <div className="bg-gray-800 text-white">
        {/* Row 1: Main Commands */}
        <div className="top-row-buttons min-h-12 flex flex-wrap items-center px-4 mobile-no-padding gap-1 md:gap-4 border-b border-gray-700 py-1 md:py-2">
          {/* File operations dropdown menu */}
          <div className="relative" style={{ overflow: 'visible' }}>
            <button
              ref={fileButtonRef}
              onClick={() => setShowFileMenu(!showFileMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              style={{ height: '44px' }}
              title={t('menuFileTitle')}
            >
              <IconMenu size={18} />
              <span className="text-sm font-semibold hide-label-mobile">{t('menuFile')}</span>
              <IconChevronDown size={14} />
            </button>
          </div>
          
          {/* View menu */}
          <div className="relative" style={{ overflow: 'visible' }}>
            <button
              ref={viewButtonRef}
              onClick={() => setShowViewMenu(!showViewMenu)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 justify-center"
              style={{ height: '44px', width: window.innerWidth <= 768 ? '44px' : 'auto' }}
              title="View options"
            >
              <IconEyeOn size={18} />
              <span className="text-sm font-medium hide-label-mobile">View</span>
              <IconChevronDown size={14} className="hide-label-mobile" />
            </button>
          </div>
          
          {/* Divider */}
          <div className="w-px h-8 bg-gray-600"></div>
          
          {/* Spacer to push utility buttons to the right */}
          <div className="ml-auto"></div>
          
          {/* Utility buttons - moved from left toolbar */}
          <button 
            onClick={undo} 
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnUndo')}
            disabled={historyIndex === 0}
          >
            <IconUndo size={20} />
          </button>
          <button 
            onClick={redo} 
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnRedo')}
            disabled={historyIndex >= history.length - 1}
          >
            <IconRedo size={20} />
          </button>
          
          <button 
            onClick={copySelected} 
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnCopy')}
            disabled={selectedIds.length === 0}
          >
            <IconCopy size={20} />
          </button>
          
          <button 
            onClick={pasteFromClipboard} 
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnPaste')}
            disabled={clipboard.length === 0}
          >
            <IconPaste size={20} />
          </button>
          
          <button 
            onClick={fitAllElements} 
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('btnFitAll')}
            disabled={elements.length === 0}
          >
            <IconFitView size={20} />
          </button>
          
          {/* Arrange menu (Duplicate + Alignment) */}
          <button
            ref={arrangeButtonRef}
            onClick={() => setShowArrangeMenu(!showArrangeMenu)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 justify-center"
            style={{ height: '44px', width: window.innerWidth <= 768 ? '44px' : 'auto' }}
            title={t('menuArrangeTitle')}
          >
            <IconGridOn size={18} />
            <span className="text-sm font-medium hide-label-mobile">{t('menuArrange')}</span>
            <IconChevronDown size={14} className="hide-label-mobile" />
          </button>
          
          {/* Divider */}
          <div className="w-px h-8 bg-gray-600"></div>
          
          {/* Options menu (BG, Grid, Snap) */}
          <button
            ref={optionsButtonRef}
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 justify-center"
            style={{ height: '44px', width: window.innerWidth <= 768 ? '44px' : 'auto' }}
            title={t('menuOptionsTitle')}
          >
            <IconSettings size={18} />
            <span className="text-sm font-medium hide-label-mobile">{t('menuOptions')}</span>
            <IconChevronDown size={14} className="hide-label-mobile" />
          </button>
          
          {/* Divider */}
          <div className="w-px h-8 bg-gray-600"></div>
          
          {/* Help button */}
          <button
            onClick={() => setShowHelp(true)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center"
            style={{ width: '44px', height: '44px' }}
            title={t('menuHelp')}
          >
            <span className="text-xl font-bold">?</span>
          </button>
        </div>
        
        {/* Row 2: Properties (always visible) */}
        <div className="top-row-properties flex flex-wrap items-center content-start px-4 mobile-no-padding gap-0.5 md:gap-3 bg-gray-750 py-1 md:py-2 justify-start" style={{
          minHeight: '6.5rem',
        }}>
          {currentTool === 'beading' ? (() => {
            // ── Beading mode property bar ─────────────────────────────────
            // Use last selected as reference for property display; updates apply to all
            const lastBERef = selectedBEs[selectedBEs.length - 1] || null;
            const bePicot = (() => {
              if (!lastBERef) return null;
              const el = elements.find(e => e.id === lastBERef.elementId);
              return el?.picots?.find(p => p.id === lastBERef.picotId) || null;
            })();

            const updateBEPicot = (updates) => {
              if (selectedBEs.length === 0) return;
              setElements(prev => prev.map(el => {
                const toUpdate = selectedBEs.filter(s => s.elementId === el.id);
                if (toUpdate.length === 0) return el;
                const newPicots = (el.picots||[]).map(p =>
                  toUpdate.some(s => s.picotId === p.id) ? {...p,...updates} : p
                );
                // Persist configs so notation edits don't wipe them
                return { ...el, picots: newPicots, beConfigs: extractBEConfigs(newPicots) };
              }));
            };

            const STRUCTURES = [
              { id: 'core',        icon: '●',    desc: 'Core only' },
              { id: 'core+picot',  icon: '●╷',   desc: 'Core + plain picot' },
              { id: 'core+beaded', icon: '●╷◇',  desc: 'Core + beaded picot' },
              { id: 'spike',       icon: '↑●●',  desc: 'Spike — beads stacked in a straight line outward' },
              { id: 'suspended',   icon: '↑◇',   desc: 'Suspended — beads fanned out' },
            ];

            const coreBeadsEnabled = bePicot && bePicot.beStructure !== 'suspended' && bePicot.beStructure !== 'beaded';
            const picotBeadsEnabled = bePicot && (bePicot.beStructure === 'core+beaded' || bePicot.beStructure === 'spike' || bePicot.beStructure === 'suspended');

            const BeadSlot = ({ slotIdx, beadIds, field }) => {
              const currentId = (beadIds || [])[slotIdx];
              const bead = beadLibrary.find(b => b.id === currentId);
              return (
                <div className="flex items-center gap-1">
                  {bead && <div className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-500" style={{backgroundColor: bead.color}} />}
                  <select
                    value={currentId || ''}
                    onChange={e => { const ids = [...(beadIds||[null,null,null])]; ids[slotIdx] = e.target.value||null; updateBEPicot({[field]:ids}); }}
                    className="bg-gray-700 text-white text-xs rounded px-1 py-0.5 border border-gray-600 max-w-28"
                    style={{touchAction:'manipulation'}}
                  >
                    <option value="">— none —</option>
                    {beadLibrary.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              );
            };

            return (
              <div className="flex flex-wrap items-start gap-3 w-full py-1 top-toolbar-scalable">
                {/* Mode label */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-purple-300 font-bold text-xs">BEAD MODE</span>
                  {selectedBEs.length === 0 && <span className="text-gray-500 text-xs">tap or drag-select ◆ diamonds</span>}
                  {selectedBEs.length > 1 && <span className="text-purple-400 text-xs">{selectedBEs.length} selected</span>}
                </div>

                {bePicot && <>
                  {/* Structure buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-gray-400 text-xs mr-1">Structure:</span>
                    {STRUCTURES.map(s => (
                      <button key={s.id}
                        onClick={() => updateBEPicot({beStructure: s.id})}
                        title={s.desc}
                        className={`px-2 py-0.5 rounded text-xs font-mono border top-toolbar-scalable ${bePicot.beStructure === s.id ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                        style={{touchAction:'manipulation'}}
                      >{s.icon}</button>
                    ))}
                    <button
                      onClick={() => updateBEPicot({beIsJoint: !bePicot.beIsJoint})}
                      title="Connectable join point"
                      className={`px-2 py-0.5 rounded text-xs border ml-1 top-toolbar-scalable ${bePicot.beIsJoint ? 'bg-yellow-600 border-yellow-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-400'}`}
                      style={{touchAction:'manipulation'}}
                    >🔗</button>
                  </div>

                  {/* Core bead */}
                  {coreBeadsEnabled && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-gray-400 text-xs">Core:</span>
                      <BeadSlot slotIdx={0} beadIds={bePicot.coreBeads} field="coreBeads" />
                    </div>
                  )}

                  {/* Picot beads (up to 3) */}
                  {picotBeadsEnabled && (
                    <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                      <span className="text-gray-400 text-xs">Picot:</span>
                      {[0,1,2].map(i => (
                        <BeadSlot key={i} slotIdx={i} beadIds={bePicot.picotBeads} field="picotBeads" />
                      ))}
                    </div>
                  )}

                  {/* Add bead to library */}
                  <button
                    onClick={() => {
                      const name = prompt('Bead name:'); if (!name) return;
                      const sz = prompt('Size: S, M, or L','S');
                      const sizeKey = sz?.toUpperCase()==='M'?'Z':sz?.toUpperCase()==='L'?'V':'Y';
                      const color = prompt('Color hex:','#3b82f6'); if (!color) return;
                      setBeadLibrary(prev => [...prev, {id:`bead_${Date.now()}`,name,size:sizeKey,color}]);
                    }}
                    className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded border border-gray-600 flex-shrink-0 top-toolbar-scalable"
                    style={{touchAction:'manipulation'}}
                    title="Add bead to library"
                  >+ Bead</button>
                </>}
              </div>
            );
          })() : selectedElement ? (
            <>
              {selectedElement.type === 'line' ? (
                /* Line properties: order number + optional bead notation */
                <div className="flex items-center gap-0.5 md:gap-3">
                  <span className="text-xs text-gray-400 px-2">Line</span>
                  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                    <label className="text-xs text-gray-400 hide-label-mobile">Order:</label>
                    <input
                      type="text"
                      value={selectedElement.orderNumber || ''}
                      onChange={(e) => {
                        const newOrderNum = e.target.value.trim();
                        setElements(prev => {
                          const conflict = prev.find(el =>
                            el.id !== selectedElement.id &&
                            el.orderNumber &&
                            el.orderNumber.toString().trim() === newOrderNum &&
                            newOrderNum !== ''
                          );
                          if (conflict) {
                            const usedNumbers = prev
                              .filter(el => el.id !== conflict.id && el.orderNumber)
                              .map(el => parseInt(el.orderNumber))
                              .filter(n => !isNaN(n));
                            let nextNum = 1;
                            while (usedNumbers.includes(nextNum)) nextNum++;
                            return prev.map(el => {
                              if (el.id === selectedElement.id) return { ...el, orderNumber: newOrderNum };
                              if (el.id === conflict.id) return { ...el, orderNumber: nextNum.toString() };
                              return el;
                            });
                          }
                          return prev.map(el =>
                            el.id === selectedElement.id ? { ...el, orderNumber: newOrderNum } : el
                          );
                        });
                      }}
                      className="px-2 py-1 bg-gray-700 rounded border border-gray-600 w-16 text-sm"
                      placeholder="#"
                    />
                    <label className="text-xs text-gray-400 hide-label-mobile ml-2">Beads:</label>
                    <input
                      type="text"
                      value={selectedElement.lineBeads || ''}
                      onChange={(e) => {
                        setElements(prev => prev.map(el =>
                          el.id === selectedElement.id
                            ? { ...el, lineBeads: e.target.value.trim() }
                            : el
                        ));
                      }}
                      className="px-2 py-1 bg-gray-700 rounded border border-gray-600 w-24 text-sm font-mono"
                      placeholder="e.g. 3Y"
                    />
                  </div>
                </div>
              ) : (
              <>
              {/* Notation input - dual for split rings */}
              {selectedElement.isSplitRing ? (
                <div className="flex items-center gap-1 top-toolbar-scalable">
                  <span className="text-xs text-gray-400">A:</span>
                  <input
                    key={`${selectedElement.id}-A`}
                    type="text"
                    defaultValue={selectedElement.notation.replace(/^sr:\s*/, '')}
                    onBlur={(e) => {
                      const notationA = e.target.value.trim();
                      const currentElement = elementById.get(selectedElement.id);
                      if (!currentElement) return;
                      
                      const parsedA = parseNotation(`sr: ${notationA}`);
                      if (parsedA && parsedA.stitchCount > 0) {
                        updateNotation(`sr: ${notationA}`, currentElement.notationB);
                      } else {
                        e.target.value = currentElement.notation.replace(/^sr:\s*/, '');
                        alert('Invalid notation for section A');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.blur();
                      else if (e.key === 'Escape') {
                        const currentElement = elementById.get(selectedElement.id);
                        if (currentElement) {
                          e.target.value = currentElement.notation.replace(/^sr:\s*/, '');
                          e.target.blur();
                        }
                      }
                    }}
                    className="notation-input px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm w-20"
                    placeholder="5ds"
                  />
                  <span className="text-xs text-gray-400">B:</span>
                  <input
                    key={`${selectedElement.id}-B`}
                    type="text"
                    defaultValue={selectedElement.notationB || '5ds'}
                    onBlur={(e) => {
                      const notationB = e.target.value.trim();
                      const currentElement = elementById.get(selectedElement.id);
                      if (!currentElement) return;
                      
                      const parsedB = parseNotation(`sr: ${notationB}`);
                      if (parsedB && parsedB.stitchCount > 0) {
                        updateNotation(currentElement.notation, notationB);
                      } else {
                        e.target.value = currentElement.notationB || '5ds';
                        alert('Invalid notation for section B');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.blur();
                      else if (e.key === 'Escape') {
                        const currentElement = elementById.get(selectedElement.id);
                        if (currentElement) {
                          e.target.value = currentElement.notationB || '5ds';
                          e.target.blur();
                        }
                      }
                    }}
                    className="notation-input px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm w-20"
                    placeholder="5ds"
                  />
                  <span className="text-xs text-gray-400">({selectedElement.stitchCount})</span>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                  {/* Label removed - icon/placeholder is sufficient */}
                  <input
                    key={selectedElement.id} 
                    type="text"
                    defaultValue={selectedElement.notation}
                    onBlur={(e) => {
                      const notation = e.target.value.trim();
                      const parsed = parseNotation(notation);
                      
                      // Get current element (not stale selectedElement)
                      const currentElement = elementById.get(selectedElement.id);
                      if (!currentElement) return;
                      
                      // Only update if notation is valid and has at least 1 stitch
                      if (parsed && parsed.stitchCount > 0) {
                        updateNotation(notation);
                      } else {
                        // Reset to current notation if invalid
                        e.target.value = currentElement.notation;
                        if (parsed && parsed.stitchCount === 0) {
                          alert('Element must have at least 1 stitch');
                        } else if (!parsed) {
                          alert('Invalid notation format');
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.target.blur(); // Trigger onBlur when pressing Enter
                      } else if (e.key === 'Escape') {
                        // Reset to original value on Escape
                        const currentElement = elementById.get(selectedElement.id);
                        if (currentElement) {
                          e.target.value = currentElement.notation;
                          e.target.blur();
                        }
                      }
                    }}
                    className={`notation-input px-2 py-1 bg-gray-700 rounded border text-sm ${notationError ? 'border-red-500' : 'border-gray-600'}`}
                    placeholder="r: 20ds"
                  />
                </div>
              )}
              
              
              {/* Rotation input */}
              <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                {/* Label removed - icons are self-explanatory */}
                <button
                  onClick={() => {
                    const currentRotation = selectedElement.rotation || 0;
                    const newRotation = currentRotation - 90;
                    const delta = -90;
                    
                    const rad = delta * Math.PI / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    
                    setElements(prev => prev.map(el => {
                      if (el.id !== selectedElement.id) return el;
                      
                      const cx = el.center.x;
                      const cy = el.center.y;
                      
                      const newPaths = el.paths.map(path => {
                        const rotatePoint = (px, py) => {
                          const dx = px - cx;
                          const dy = py - cy;
                          return {
                            x: cx + dx * cos - dy * sin,
                            y: cy + dx * sin + dy * cos
                          };
                        };
                        
                        if (path.type === 'cubic') {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const c1 = rotatePoint(path.control1X, path.control1Y);
                          const c2 = rotatePoint(path.control2X, path.control2Y);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            control1X: c1.x, control1Y: c1.y,
                            control2X: c2.x, control2Y: c2.y
                          };
                        } else {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const ctrl = rotatePoint(path.controlX, path.controlY);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            controlX: ctrl.x, controlY: ctrl.y
                          };
                        }
                      });
                      
                      return { ...el, paths: newPaths, rotation: newRotation };
                    }));
                  }}
                  className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                  title={t('propRotateMinus90')}
                >
                  <IconRotateCCW size={16} />
                </button>
                <input
                  type="number"
                  value={Math.round(selectedElement.rotation || 0)}
                  onChange={(e) => {
                    const newRotation = parseFloat(e.target.value) || 0;
                    const oldRotation = selectedElement.rotation || 0;
                    const delta = newRotation - oldRotation;
                    
                    if (delta === 0) return;
                    
                    const rad = delta * Math.PI / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    
                    setElements(prev => prev.map(el => {
                      if (el.id !== selectedElement.id) return el;
                      
                      const cx = el.center.x;
                      const cy = el.center.y;
                      
                      const newPaths = el.paths.map(path => {
                        const rotatePoint = (px, py) => {
                          const dx = px - cx;
                          const dy = py - cy;
                          return {
                            x: cx + dx * cos - dy * sin,
                            y: cy + dx * sin + dy * cos
                          };
                        };
                        
                        if (path.type === 'cubic') {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const c1 = rotatePoint(path.control1X, path.control1Y);
                          const c2 = rotatePoint(path.control2X, path.control2Y);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            control1X: c1.x, control1Y: c1.y,
                            control2X: c2.x, control2Y: c2.y
                          };
                        } else {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const ctrl = rotatePoint(path.controlX, path.controlY);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            controlX: ctrl.x, controlY: ctrl.y
                          };
                        }
                      });
                      
                      return { ...el, paths: newPaths, rotation: newRotation };
                    }));
                  }}
                  className="px-2 py-1 bg-gray-700 rounded border border-gray-600 w-16 text-sm"
                  style={{minWidth:'3.2rem'}}
                  placeholder="0"
                />
                <button
                  onClick={() => {
                    const currentRotation = selectedElement.rotation || 0;
                    const newRotation = currentRotation + 90;
                    const delta = 90;
                    
                    const rad = delta * Math.PI / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    
                    setElements(prev => prev.map(el => {
                      if (el.id !== selectedElement.id) return el;
                      
                      const cx = el.center.x;
                      const cy = el.center.y;
                      
                      const newPaths = el.paths.map(path => {
                        const rotatePoint = (px, py) => {
                          const dx = px - cx;
                          const dy = py - cy;
                          return {
                            x: cx + dx * cos - dy * sin,
                            y: cy + dx * sin + dy * cos
                          };
                        };
                        
                        if (path.type === 'cubic') {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const c1 = rotatePoint(path.control1X, path.control1Y);
                          const c2 = rotatePoint(path.control2X, path.control2Y);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            control1X: c1.x, control1Y: c1.y,
                            control2X: c2.x, control2Y: c2.y
                          };
                        } else {
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const ctrl = rotatePoint(path.controlX, path.controlY);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            controlX: ctrl.x, controlY: ctrl.y
                          };
                        }
                      });
                      
                      return { ...el, paths: newPaths, rotation: newRotation };
                    }));
                  }}
                  className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                  title={t('propRotatePlus90')}
                >
                  <IconRotateCW size={16} />
                </button>
                
                {/* Flip buttons */}
                <button
                  onClick={() => {
                    // Flip horizontally: reverse notation + apply "fake mirror" rotation
                    setElements(prev => prev.map(el => {
                      if (el.id !== selectedElement.id) return el;
                      
                      // Step 1: Handle split rings specially (swap notations)
                      if (el.isSplitRing) {
                        const notationAText = el.notation.replace(/^sr:\s*/, '');
                        const notationBText = el.notationB || '5ds';
                        
                        // Reverse each notation and swap A ↔ B
                        const reversedA = reverseNotation(`sr: ${notationAText}`).replace(/^sr:\s*/, '');
                        const reversedB = reverseNotation(`sr: ${notationBText}`).replace(/^sr:\s*/, '');
                        
                        const parsedA = parseNotation(`sr: ${reversedB}`); // Swap!
                        const parsedB = parseNotation(`sr: ${reversedA}`); // Swap!
                        
                        if (!parsedA || !parsedB) {
                          console.error('Failed to parse split ring notations');
                          return el;
                        }
                        
                        const stitchCountA = parsedA.stitchCount;
                        const stitchCountB = parsedB.stitchCount;
                        const totalStitches = stitchCountA + stitchCountB;
                        const targetLength = totalStitches * dsWidth;
                        const squeeze = el.squeeze || 0.1;
                        
                        const pathData = createSplitRingPath(el.center.x, el.center.y, targetLength, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
                        let newPaths = pathData.paths;
                        
                        // Apply mirror rotation
                        const currentAngle = el.rotation || 0;
                        const newAngle = 180 - currentAngle;
                        const rad = (newAngle * Math.PI) / 180;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);
                        const cx = el.center.x;
                        const cy = el.center.y;
                        
                        newPaths = newPaths.map(path => {
                          const rotatePoint = (px, py) => {
                            const dx = px - cx;
                            const dy = py - cy;
                            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
                          };
                          
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const c1 = rotatePoint(path.control1X, path.control1Y);
                          const c2 = rotatePoint(path.control2X, path.control2Y);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            control1X: c1.x, control1Y: c1.y,
                            control2X: c2.x, control2Y: c2.y
                          };
                        });
                        
                        // Merge picots from both swapped sections
                        const allPicots = [...parsedA.picots, ...parsedB.picots.map(p => ({
                          ...p,
                          stitchesBefore: p.stitchesBefore + stitchCountA
                        }))];
                        
                        return {
                          ...el,
                          notation: `sr: ${reversedB}`, // Swapped!
                          notationB: reversedA, // Swapped!
                          stitchCount: totalStitches,
                          picots: allPicots,
                          paths: newPaths,
                          rotation: ((newAngle % 360) + 360) % 360,
                          splitPosition: stitchCountA
                        };
                      }
                      
                      // Step 1: Reverse notation (regular rings/chains)
                      const reversedNotation = reverseNotation(el.notation);
                      const parsed = parseNotation(reversedNotation);
                      
                      if (!parsed) {
                        console.error('Failed to parse reversed notation');
                        return el;
                      }
                      
                      // Step 2: Calculate mirror rotation
                      // Vertical mirror (left-right flip): newAngle = 180° - θ
                      const currentAngle = el.rotation || 0;
                      const newAngle = 180 - currentAngle;
                      
                      // Step 3: Generate or rotate paths
                      let newPaths;
                      if (el.type === 'ring' && (el.shapeStyle === 'teardrop' || (el.squeeze !== undefined && el.squeeze > 0))) {
                        // Regenerate teardrop/squeezed path
                        const targetLength = parsed.stitchCount * dsWidth;
                        const squeeze = el.squeeze !== undefined ? el.squeeze : 0;
                        const pathData = createTeardropPath(el.center.x, el.center.y, targetLength, squeeze);
                        newPaths = pathData.paths; // Extract paths array
                        
                        // Apply rotation
                        const rad = (newAngle * Math.PI) / 180;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);
                        const cx = el.center.x;
                        const cy = el.center.y;
                        
                        newPaths = newPaths.map(path => {
                          const rotatePoint = (px, py) => {
                            const dx = px - cx;
                            const dy = py - cy;
                            return {
                              x: cx + dx * cos - dy * sin,
                              y: cy + dx * sin + dy * cos
                            };
                          };
                          
                          if (path.type === 'cubic') {
                            const start = rotatePoint(path.x, path.y);
                            const end = rotatePoint(path.endX, path.endY);
                            const c1 = rotatePoint(path.control1X, path.control1Y);
                            const c2 = rotatePoint(path.control2X, path.control2Y);
                            return {
                              ...path,
                              x: start.x, y: start.y,
                              endX: end.x, endY: end.y,
                              control1X: c1.x, control1Y: c1.y,
                              control2X: c2.x, control2Y: c2.y
                            };
                          } else {
                            const start = rotatePoint(path.x, path.y);
                            const end = rotatePoint(path.endX, path.endY);
                            const ctrl = rotatePoint(path.controlX, path.controlY);
                            return {
                              ...path,
                              x: start.x, y: start.y,
                              endX: end.x, endY: end.y,
                              controlX: ctrl.x, controlY: ctrl.y
                            };
                          }
                        });
                      } else {
                        // Rotate paths for chains and circles
                        const deltaAngle = newAngle - currentAngle;
                        const cx = el.center.x;
                        const cy = el.center.y;
                        const rad = (deltaAngle * Math.PI) / 180;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);
                        
                        newPaths = el.paths.map(path => {
                          const rotatePoint = (px, py) => {
                            const dx = px - cx;
                            const dy = py - cy;
                            return {
                              x: cx + dx * cos - dy * sin,
                              y: cy + dx * sin + dy * cos
                            };
                          };
                          
                          if (path.type === 'cubic') {
                            const start = rotatePoint(path.x, path.y);
                            const end = rotatePoint(path.endX, path.endY);
                            const c1 = rotatePoint(path.control1X, path.control1Y);
                            const c2 = rotatePoint(path.control2X, path.control2Y);
                            return {
                              ...path,
                              x: start.x, y: start.y,
                              endX: end.x, endY: end.y,
                              control1X: c1.x, control1Y: c1.y,
                              control2X: c2.x, control2Y: c2.y
                            };
                          } else {
                            const start = rotatePoint(path.x, path.y);
                            const end = rotatePoint(path.endX, path.endY);
                            const ctrl = rotatePoint(path.controlX, path.controlY);
                            return {
                              ...path,
                              x: start.x, y: start.y,
                              endX: end.x, endY: end.y,
                              controlX: ctrl.x, controlY: ctrl.y
                            };
                          }
                        });
                      }
                      
                      // Step 4: Update element with new notation, picots, and rotation
                      // Preserve joint picot IDs for connection stability
                        const _oldJoints2 = {};
                        (el.picots || []).forEach(p => { if (p.isJoint) _oldJoints2[p.stitchesBefore] = p; });
                        const _mergedPicots2 = mergeBEConfigs(parsed.picots.map(p =>
                          (p.isJoint && _oldJoints2[p.stitchesBefore]) ? { ...p, id: _oldJoints2[p.stitchesBefore].id } : p
                        ), el.picots);
                      return {
                        ...el,
                        notation: reversedNotation,
                        picots: _mergedPicots2,
                        stitchCount: parsed.stitchCount,
                        paths: newPaths,
                        rotation: ((newAngle % 360) + 360) % 360  // Keep in 0-360 range
                      };
                    }));
                  }}
                  className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                  title={t('propFlipH')}
                >
                  <IconFlipV size={16} />
                </button>
                
                <button
                  onClick={() => {
                    // Flip vertically: reverse notation + apply "fake mirror" rotation
                    setElements(prev => prev.map(el => {
                      if (el.id !== selectedElement.id) return el;
                      
                      // Step 1: Handle split rings specially (swap notations)
                      if (el.isSplitRing) {
                        const notationAText = el.notation.replace(/^sr:\s*/, '');
                        const notationBText = el.notationB || '5ds';
                        
                        // Reverse each notation and swap A ↔ B
                        const reversedA = reverseNotation(`sr: ${notationAText}`).replace(/^sr:\s*/, '');
                        const reversedB = reverseNotation(`sr: ${notationBText}`).replace(/^sr:\s*/, '');
                        
                        const parsedA = parseNotation(`sr: ${reversedB}`); // Swap!
                        const parsedB = parseNotation(`sr: ${reversedA}`); // Swap!
                        
                        if (!parsedA || !parsedB) {
                          console.error('Failed to parse split ring notations');
                          return el;
                        }
                        
                        const stitchCountA = parsedA.stitchCount;
                        const stitchCountB = parsedB.stitchCount;
                        const totalStitches = stitchCountA + stitchCountB;
                        const targetLength = totalStitches * dsWidth;
                        const squeeze = el.squeeze || 0.1;
                        
                        const pathData = createSplitRingPath(el.center.x, el.center.y, targetLength, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
                        let newPaths = pathData.paths;
                        
                        // Apply mirror rotation
                        const currentAngle = el.rotation || 0;
                        const newAngle = -currentAngle;
                        const rad = (newAngle * Math.PI) / 180;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);
                        const cx = el.center.x;
                        const cy = el.center.y;
                        
                        newPaths = newPaths.map(path => {
                          const rotatePoint = (px, py) => {
                            const dx = px - cx;
                            const dy = py - cy;
                            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
                          };
                          
                          const start = rotatePoint(path.x, path.y);
                          const end = rotatePoint(path.endX, path.endY);
                          const c1 = rotatePoint(path.control1X, path.control1Y);
                          const c2 = rotatePoint(path.control2X, path.control2Y);
                          return {
                            ...path,
                            x: start.x, y: start.y,
                            endX: end.x, endY: end.y,
                            control1X: c1.x, control1Y: c1.y,
                            control2X: c2.x, control2Y: c2.y
                          };
                        });
                        
                        // Merge picots from both swapped sections
                        const allPicots = [...parsedA.picots, ...parsedB.picots.map(p => ({
                          ...p,
                          stitchesBefore: p.stitchesBefore + stitchCountA
                        }))];
                        
                        return {
                          ...el,
                          notation: `sr: ${reversedB}`, // Swapped!
                          notationB: reversedA, // Swapped!
                          stitchCount: totalStitches,
                          picots: allPicots,
                          paths: newPaths,
                          rotation: ((newAngle % 360) + 360) % 360,
                          splitPosition: stitchCountA
                        };
                      }
                      
                      // Step 1: Reverse notation (regular rings/chains)
                      const reversedNotation = reverseNotation(el.notation);
                      const parsed = parseNotation(reversedNotation);
                      
                      if (!parsed) {
                        console.error('Failed to parse reversed notation');
                        return el;
                      }
                      
                      // Step 2: Calculate mirror rotation
                      // Horizontal mirror (top-bottom flip): newAngle = -θ
                      const currentAngle = el.rotation || 0;
                      const newAngle = -currentAngle;
                      
                      // Step 3: Generate or rotate paths
                      let newPaths;
                      if (el.type === 'ring' && (el.shapeStyle === 'teardrop' || (el.squeeze !== undefined && el.squeeze > 0))) {
                        // Regenerate teardrop/squeezed path
                        const targetLength = parsed.stitchCount * dsWidth;
                        const squeeze = el.squeeze !== undefined ? el.squeeze : 0;
                        const pathData = createTeardropPath(el.center.x, el.center.y, targetLength, squeeze);
                        newPaths = pathData.paths; // Extract paths array
                        
                        // Apply rotation
                        const rad = (newAngle * Math.PI) / 180;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);
                        const cx = el.center.x;
                        const cy = el.center.y;
                        
                        newPaths = newPaths.map(path => {
                          const rotatePoint = (px, py) => {
                            const dx = px - cx;
                            const dy = py - cy;
                            return {
                              x: cx + dx * cos - dy * sin,
                              y: cy + dx * sin + dy * cos
                            };
                          };
                          
                          if (path.type === 'cubic') {
                            const start = rotatePoint(path.x, path.y);
                            const end = rotatePoint(path.endX, path.endY);
                            const c1 = rotatePoint(path.control1X, path.control1Y);
                            const c2 = rotatePoint(path.control2X, path.control2Y);
                            return {
                              ...path,
                              x: start.x, y: start.y,
                              endX: end.x, endY: end.y,
                              control1X: c1.x, control1Y: c1.y,
                              control2X: c2.x, control2Y: c2.y
                            };
                          } else {
                            const start = rotatePoint(path.x, path.y);
                            const end = rotatePoint(path.endX, path.endY);
                            const ctrl = rotatePoint(path.controlX, path.controlY);
                            return {
                              ...path,
                              x: start.x, y: start.y,
                              endX: end.x, endY: end.y,
                              controlX: ctrl.x, controlY: ctrl.y
                            };
                          }
                        });
                      } else {
                        // Rotate paths for chains and circles
                        const deltaAngle = newAngle - currentAngle;
                        const cx = el.center.x;
                        const cy = el.center.y;
                        const rad = (deltaAngle * Math.PI) / 180;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);
                        
                        newPaths = el.paths.map(path => {
                          const rotatePoint = (px, py) => {
                            const dx = px - cx;
                            const dy = py - cy;
                            return {
                              x: cx + dx * cos - dy * sin,
                              y: cy + dx * sin + dy * cos
                            };
                          };
                          
                          if (path.type === 'cubic') {
                            const start = rotatePoint(path.x, path.y);
                            const end = rotatePoint(path.endX, path.endY);
                            const c1 = rotatePoint(path.control1X, path.control1Y);
                            const c2 = rotatePoint(path.control2X, path.control2Y);
                            return {
                              ...path,
                              x: start.x, y: start.y,
                              endX: end.x, endY: end.y,
                              control1X: c1.x, control1Y: c1.y,
                              control2X: c2.x, control2Y: c2.y
                            };
                          } else {
                            const start = rotatePoint(path.x, path.y);
                            const end = rotatePoint(path.endX, path.endY);
                            const ctrl = rotatePoint(path.controlX, path.controlY);
                            return {
                              ...path,
                              x: start.x, y: start.y,
                              endX: end.x, endY: end.y,
                              controlX: ctrl.x, controlY: ctrl.y
                            };
                          }
                        });
                      }
                      
                      // Step 4: Update element with new notation, picots, and rotation
                      // Preserve joint picot IDs for connection stability
                      const _oldJoints3 = {};
                      (el.picots || []).forEach(p => { if (p.isJoint) _oldJoints3[p.stitchesBefore] = p; });
                      const _mergedPicots3 = mergeBEConfigs(parsed.picots.map(p =>
                        (p.isJoint && _oldJoints3[p.stitchesBefore]) ? { ...p, id: _oldJoints3[p.stitchesBefore].id } : p
                      ), el.picots);
                      return {
                        ...el,
                        notation: reversedNotation,
                        picots: _mergedPicots3,
                        stitchCount: parsed.stitchCount,
                        paths: newPaths,
                        rotation: ((newAngle % 360) + 360) % 360  // Keep in 0-360 range
                      };
                    }));
                  }}
                  className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                  title={t('propFlipV')}
                >
                  <IconFlipH size={16} />
                </button>

                {/* Notation position toggle - inside/onPath/outside */}
                <button
                  onClick={toggleLabelsInside}
                  className={`px-2 py-1 rounded text-sm font-bold ${
                    elements.filter(e => selectedIds.includes(e.id)).every(e => e.labelsInside !== false && e.labelsInside !== 'onPath')
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : elements.filter(e => selectedIds.includes(e.id)).every(e => e.labelsInside === 'onPath')
                      ? 'bg-green-600 hover:bg-green-700'
                      : elements.filter(e => selectedIds.includes(e.id)).every(e => e.labelsInside === false)
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  title={t('propNotationPos')}
                >
                  {elements.filter(e => selectedIds.includes(e.id)).every(e => e.labelsInside !== false && e.labelsInside !== 'onPath') ? '20↓' :
                   elements.filter(e => selectedIds.includes(e.id)).every(e => e.labelsInside === 'onPath') ? '20—' :
                   elements.filter(e => selectedIds.includes(e.id)).every(e => e.labelsInside === false) ? '20↑' :
                   '20~'}
                </button>
              </div>

              {/* ── Row 2 starts here ── */}
              <div className="w-full" />

              {/* Order number - for all elements (rings and chains) */}
              <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                <label className="text-xs text-gray-400 hide-label-mobile">Order:</label>
                <input
                  type="text"
                  value={selectedElement.orderNumber || ''}
                  onChange={(e) => {
                    const newOrderNum = e.target.value.trim();
                    setElements(prev => {
                      // Check if this order number is already used by another element
                      const conflict = prev.find(el => 
                        el.id !== selectedElement.id && 
                        el.orderNumber && 
                        el.orderNumber.toString().trim() === newOrderNum &&
                        newOrderNum !== ''
                      );
                      
                      if (conflict) {
                        // Find next available order number
                        const usedNumbers = prev
                          .filter(el => el.id !== conflict.id && el.orderNumber)
                          .map(el => parseInt(el.orderNumber))
                          .filter(n => !isNaN(n));
                        
                        let nextNum = 1;
                        while (usedNumbers.includes(nextNum)) {
                          nextNum++;
                        }
                        
                        // Reassign conflict to next available number
                        return prev.map(el => {
                          if (el.id === selectedElement.id) {
                            return { ...el, orderNumber: newOrderNum };
                          } else if (el.id === conflict.id) {
                            return { ...el, orderNumber: nextNum.toString() };
                          }
                          return el;
                        });
                      }
                      
                      // No conflict, just update
                      return prev.map(el => 
                        el.id === selectedElement.id ? { ...el, orderNumber: newOrderNum } : el
                      );
                    });
                  }}
                  className="px-2 py-1 bg-gray-700 rounded border border-gray-600 w-16 text-sm"
                  placeholder="#"
                />
              </div>
              
              {/* Ring-specific properties */}
              {selectedElement.isClosed && (
                <>
                  {/* Shape toggle - hide for split rings */}
                  {!selectedElement.isSplitRing && (
                    <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                      <label className="text-xs text-gray-400 hide-label-mobile">Shape:</label>
                      <button
                        onClick={toggleShape}
                        className="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 flex items-center gap-1"
                        title={t('propToggleShape')}
                      >
                        {selectedElement.shapeStyle === 'circle' ? <IconShapeCircle size={16} /> : <IconShapeTeardrop size={16} />}
                      </button>
                    </div>
                  )}
                  
                  {/* Squeeze sliders */}
                  {selectedElement.isSplitRing ? (
                    /* Split ring: Sq=squash, CA=C-shape section A, CB=C-shape section B */
                    <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable flex-wrap">
                      <label className="text-xs text-gray-400 hide-label-mobile">Sq:</label>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={selectedElement.squeeze ?? 0.25}
                        onMouseDown={() => { isInteractingRef.current = true; }}
                        onTouchStart={() => { isInteractingRef.current = true; }}
                        onChange={(e) => {
                          const squeeze = parseFloat(e.target.value);
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const stitchCountA = el.splitPosition || Math.floor(el.stitchCount / 2);
                            const stitchCountB = el.stitchCount - stitchCountA;
                            const newPathData = createSplitRingPath(el.center.x, el.center.y, el.stitchCount * dsWidth, stitchCountA, stitchCountB, squeeze, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
                            return applyRotationToPathData({ ...el, squeeze }, newPathData);
                          }));
                        }}
                        onMouseUp={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        onTouchEnd={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        className="w-14"
                      />
                      <span className="text-xs text-gray-400 w-6">{(selectedElement.squeeze ?? 0.25).toFixed(2)}</span>
                      <label className="text-xs text-gray-400 hide-label-mobile">CA:</label>
                      <input
                        type="range" min="0" max="3" step="0.05"
                        value={selectedElement.squeezeCA ?? 0.75}
                        onMouseDown={() => { isInteractingRef.current = true; }}
                        onTouchStart={() => { isInteractingRef.current = true; }}
                        onChange={(e) => {
                          const squeezeCA = parseFloat(e.target.value);
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const stitchCountA = el.splitPosition || Math.floor(el.stitchCount / 2);
                            const stitchCountB = el.stitchCount - stitchCountA;
                            const newPathData = createSplitRingPath(el.center.x, el.center.y, el.stitchCount * dsWidth, stitchCountA, stitchCountB, el.squeeze ?? 0.25, squeezeCA, el.squeezeCB ?? 0.75);
                            return applyRotationToPathData({ ...el, squeezeCA }, newPathData);
                          }));
                        }}
                        onMouseUp={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        onTouchEnd={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        className="w-14"
                      />
                      <span className="text-xs text-gray-400 w-6">{(selectedElement.squeezeCA ?? 0.75).toFixed(2)}</span>
                      <label className="text-xs text-gray-400 hide-label-mobile">CB:</label>
                      <input
                        type="range" min="0" max="3" step="0.05"
                        value={selectedElement.squeezeCB ?? 0.75}
                        onMouseDown={() => { isInteractingRef.current = true; }}
                        onTouchStart={() => { isInteractingRef.current = true; }}
                        onChange={(e) => {
                          const squeezeCB = parseFloat(e.target.value);
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const stitchCountA = el.splitPosition || Math.floor(el.stitchCount / 2);
                            const stitchCountB = el.stitchCount - stitchCountA;
                            const newPathData = createSplitRingPath(el.center.x, el.center.y, el.stitchCount * dsWidth, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, squeezeCB);
                            return applyRotationToPathData({ ...el, squeezeCB }, newPathData);
                          }));
                        }}
                        onMouseUp={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        onTouchEnd={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        className="w-14"
                      />
                      <span className="text-xs text-gray-400 w-6">{(selectedElement.squeezeCB ?? 0.75).toFixed(2)}</span>
                      <button
                        onClick={() => {
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const stitchCountA = el.splitPosition || Math.floor(el.stitchCount / 2);
                            const stitchCountB = el.stitchCount - stitchCountA;
                            const newPathData = createSplitRingPath(el.center.x, el.center.y, el.stitchCount * dsWidth, stitchCountA, stitchCountB, 0.25, 0.75, 0.75);
                            return { ...el, squeeze: 0.25, squeezeCA: 0.75, squeezeCB: 0.75, rotation: 0, ...newPathData };
                          }));
                        }}
                        className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                        title={t('propResetSqueeze')}
                      >Reset</button>
                    </div>
                  ) : (
                    /* Regular ring: single squeeze slider */
                    <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                      <label className="text-xs text-gray-400 hide-label-mobile">Squeeze:</label>
                      <input
                        type="range" min="-0.5" max="0.5" step="0.1"
                        value={selectedElement.squeeze || 0}
                        onMouseDown={() => { isInteractingRef.current = true; }}
                        onTouchStart={() => { isInteractingRef.current = true; }}
                        onChange={(e) => {
                          const squeeze = parseFloat(e.target.value);
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const targetLength = el.stitchCount * dsWidth;
                            const newPathData = el.shapeStyle === 'circle'
                              ? createCirclePath(el.center.x, el.center.y, targetLength, squeeze)
                              : createTeardropPath(el.center.x, el.center.y, targetLength, squeeze);
                            return applyRotationToPathData({ ...el, squeeze }, newPathData);
                          }));
                        }}
                        onMouseUp={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        onTouchEnd={() => { isInteractingRef.current = false; needsHistoryPushRef.current = true; }}
                        className="w-24"
                      />
                      <span className="text-xs text-gray-400 w-8">{(selectedElement.squeeze || 0).toFixed(1)}</span>
                      <button
                        onClick={() => {
                          setElements(prev => prev.map(el => {
                            if (el.id !== selectedElement.id) return el;
                            const targetLength = el.stitchCount * dsWidth;
                            const newPathData = el.shapeStyle === 'circle'
                              ? createCirclePath(el.center.x, el.center.y, targetLength, 0)
                              : createTeardropPath(el.center.x, el.center.y, targetLength, 0);
                            return { ...el, squeeze: 0, rotation: 0, ...newPathData };
                          }));
                        }}
                        className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                        title={t('propResetSqueeze')}
                      >Reset</button>
                    </div>
                  )}
                </>
              )}
              </>
              )}
              {/* Material assignment dropdown — end of property bar */}
              <div className="w-px h-6 bg-gray-600 mx-1 hide-label-mobile" />
              <div className="flex items-center gap-1 top-toolbar-scalable">
                <label className="text-xs text-gray-400 hide-label-mobile">Material:</label>
                <select
                  value={selectedElement.materialId || 'default'}
                  onChange={(e) => {
                    const matId = e.target.value;
                    if (matId === '__edit__') { setShowMaterialsPanel(true); return; }
                    setElements(prev => prev.map(el =>
                      selectedIds.includes(el.id) ? { ...el, materialId: matId } : el
                    ));
                  }}
                  className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
                  style={{ maxWidth: '120px' }}
                >
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                  <option disabled>──────</option>
                  <option value="__edit__">Edit materials…</option>
                </select>
                {(() => {
                  const mat = materials.find(m => m.id === (selectedElement.materialId || 'default'));
                  if (!mat) return null;
                  return (
                    <div
                      className="w-5 h-5 rounded border border-gray-500 flex-shrink-0 relative overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: mat.isGradient ? getGradientColorAtPosition(mat.color, 0.5) : mat.color }}
                      title={mat.name}
                    >
                      {mat.isGradient && <span style={{ fontSize:'9px', fontWeight:'bold', color:'white', textShadow:'0 0 2px black,0 0 2px black', lineHeight:1 }}>G</span>}
                    </div>
                  );
                })()}
              </div>
               {/* Material B selector — split rings only, right after Material A */}
               {selectedElement.isSplitRing && (
                 <>
                   <div className="w-px h-6 bg-gray-600 mx-1" />
                   <div className="flex items-center gap-1 top-toolbar-scalable">
                     <label className="text-xs text-gray-400 hide-label-mobile">Mat B:</label>
                     <select
                       value={selectedElement.materialIdB || selectedElement.materialId || 'default'}
                       onChange={(e) => {
                         const matId = e.target.value;
                         if (matId === '__edit__') { setShowMaterialsPanel(true); return; }
                         setElements(prev => prev.map(el =>
                           selectedIds.includes(el.id) ? { ...el, materialIdB: matId } : el
                         ));
                       }}
                       className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
                       style={{ maxWidth: '110px' }}
                     >
                       {materials.map(m => (
                         <option key={m.id} value={m.id}>{m.name}</option>
                       ))}
                       <option disabled>──────────</option>
                       <option value="__edit__">Edit materials…</option>
                     </select>
                     {(() => {
                       const matB = materials.find(m => m.id === (selectedElement.materialIdB || selectedElement.materialId || 'default'));
                       if (!matB) return null;
                       return (
                         <div
                           className="w-5 h-5 rounded border border-gray-500 flex-shrink-0 relative overflow-hidden flex items-center justify-center"
                           style={{ backgroundColor: matB.isGradient ? getGradientColorAtPosition(matB.color, 0.5) : matB.color }}
                           title={matB.name}
                         >
                           {matB.isGradient && <span style={{ fontSize:'9px', fontWeight:'bold', color:'white', textShadow:'0 0 2px black,0 0 2px black', lineHeight:1 }}>G</span>}
                         </div>
                       );
                     })()}
                   </div>
                 </>
               )}

            </>
          ) : (
            <>
              {selectedIds.length > 0 && (() => {
                // Check if a group is selected (multiple elements with same groupId)
                const firstElement = elementById.get(selectedIds[0]);
                if (firstElement && firstElement.groupId) {
                  const groupElements = elements.filter(e => e.groupId === firstElement.groupId);
                  if (groupElements.length > 1) {
                    // Group is selected - show group controls
                    return (
                    <>
                      <div className="text-sm text-gray-300 px-2">
                        Group Selected ({groupElements.length} elements)
                      </div>
                      
                      {/* Group Rotation + Flip — same cluster as single elements */}
                      <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                        <button
                          onClick={() => {
                            const delta = -90;
                            const rad = delta * Math.PI / 180;
                            const cos = Math.cos(rad);
                            const sin = Math.sin(rad);
                            
                            // Calculate group center
                            const groupCenterX = groupElements.reduce((sum, el) => sum + el.center.x, 0) / groupElements.length;
                            const groupCenterY = groupElements.reduce((sum, el) => sum + el.center.y, 0) / groupElements.length;
                            
                            setElements(prev => prev.map(el => {
                              if (!selectedIds.includes(el.id)) return el;
                              
                              // Rotate element center around group center
                              const dx = el.center.x - groupCenterX;
                              const dy = el.center.y - groupCenterY;
                              const newCenterX = groupCenterX + dx * cos - dy * sin;
                              const newCenterY = groupCenterY + dx * sin + dy * cos;
                              
                              // Rotate all path points around group center
                              const newPaths = el.paths.map(path => {
                                const rotatePoint = (px, py) => {
                                  const pdx = px - groupCenterX;
                                  const pdy = py - groupCenterY;
                                  return {
                                    x: groupCenterX + pdx * cos - pdy * sin,
                                    y: groupCenterY + pdx * sin + pdy * cos
                                  };
                                };
                                
                                if (path.type === 'cubic') {
                                  const start = rotatePoint(path.x, path.y);
                                  const end = rotatePoint(path.endX, path.endY);
                                  const c1 = rotatePoint(path.control1X, path.control1Y);
                                  const c2 = rotatePoint(path.control2X, path.control2Y);
                                  return {
                                    ...path,
                                    x: start.x, y: start.y,
                                    endX: end.x, endY: end.y,
                                    control1X: c1.x, control1Y: c1.y,
                                    control2X: c2.x, control2Y: c2.y
                                  };
                                } else {
                                  const start = rotatePoint(path.x, path.y);
                                  const end = rotatePoint(path.endX, path.endY);
                                  const ctrl = rotatePoint(path.controlX, path.controlY);
                                  return {
                                    ...path,
                                    x: start.x, y: start.y,
                                    endX: end.x, endY: end.y,
                                    controlX: ctrl.x, controlY: ctrl.y
                                  };
                                }
                              });
                              
                              // Update rotation value for ALL elements (so it shows correctly after ungrouping)
                              const newRotation = ((el.rotation || 0) + delta) % 360;
                              
                              return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: newRotation };
                            }));
                            
                            // Clear input after rotation
                            setGroupRotationInput('');
                          }}
                          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                          title={t('propRotateGroupMinus90')}
                        >
                          <IconRotateCCW size={16} />
                        </button>
                        <input
                          type="number"
                          value={groupRotationInput !== '' ? groupRotationInput : Math.round(groupElements[0]?.rotation || 0)}
                          onChange={(e) => {
                            setGroupRotationInput(e.target.value);
                          }}
                          onBlur={(e) => {
                            const inputValue = e.target.value;
                            if (inputValue !== '') {
                              const targetRotation = parseFloat(inputValue) || 0;
                              applyGroupRotation(targetRotation);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const inputValue = e.currentTarget.value;
                              if (inputValue !== '') {
                                const targetRotation = parseFloat(inputValue) || 0;
                                applyGroupRotation(targetRotation);
                              }
                              e.currentTarget.blur();
                            }
                          }}
                          className="px-2 py-1 bg-gray-700 rounded border border-gray-600 w-16 text-sm"
                          style={{minWidth:'3.2rem'}}
                          placeholder="0"
                        />
                        <button
                          onClick={() => {
                            const delta = 90;
                            const rad = delta * Math.PI / 180;
                            const cos = Math.cos(rad);
                            const sin = Math.sin(rad);
                            
                            // Calculate group center
                            const groupCenterX = groupElements.reduce((sum, el) => sum + el.center.x, 0) / groupElements.length;
                            const groupCenterY = groupElements.reduce((sum, el) => sum + el.center.y, 0) / groupElements.length;
                            
                            setElements(prev => prev.map(el => {
                              if (!selectedIds.includes(el.id)) return el;
                              
                              // Rotate element center around group center
                              const dx = el.center.x - groupCenterX;
                              const dy = el.center.y - groupCenterY;
                              const newCenterX = groupCenterX + dx * cos - dy * sin;
                              const newCenterY = groupCenterY + dx * sin + dy * cos;
                              
                              // Rotate all path points around group center
                              const newPaths = el.paths.map(path => {
                                const rotatePoint = (px, py) => {
                                  const pdx = px - groupCenterX;
                                  const pdy = py - groupCenterY;
                                  return {
                                    x: groupCenterX + pdx * cos - pdy * sin,
                                    y: groupCenterY + pdx * sin + pdy * cos
                                  };
                                };
                                
                                if (path.type === 'cubic') {
                                  const start = rotatePoint(path.x, path.y);
                                  const end = rotatePoint(path.endX, path.endY);
                                  const c1 = rotatePoint(path.control1X, path.control1Y);
                                  const c2 = rotatePoint(path.control2X, path.control2Y);
                                  return {
                                    ...path,
                                    x: start.x, y: start.y,
                                    endX: end.x, endY: end.y,
                                    control1X: c1.x, control1Y: c1.y,
                                    control2X: c2.x, control2Y: c2.y
                                  };
                                } else {
                                  const start = rotatePoint(path.x, path.y);
                                  const end = rotatePoint(path.endX, path.endY);
                                  const ctrl = rotatePoint(path.controlX, path.controlY);
                                  return {
                                    ...path,
                                    x: start.x, y: start.y,
                                    endX: end.x, endY: end.y,
                                    controlX: ctrl.x, controlY: ctrl.y
                                  };
                                }
                              });
                              
                              // Update rotation value for ALL elements (so it shows correctly after ungrouping)
                              const newRotation = ((el.rotation || 0) + delta) % 360;
                              
                              return { ...el, center: { x: newCenterX, y: newCenterY }, paths: newPaths, rotation: newRotation };
                            }));
                            
                            // Clear input after rotation
                            setGroupRotationInput('');
                          }}
                          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                          title={t('propRotateGroupPlus90')}
                        >
                          <IconRotateCW size={16} />
                        </button>
                        <button
                          onClick={() => {
                            // Horizontal flip = mirror across vertical axis through group center
                            const groupCenterX = groupElements.reduce((sum, el) => sum + el.center.x, 0) / groupElements.length;
                            
                            setElements(prev => prev.map(el => {
                              if (!selectedIds.includes(el.id)) return el;
                              
                              const newCenterX = 2 * groupCenterX - el.center.x;
                              const currentAngle = el.rotation || 0;

                              // Split rings: regenerate at mirrored center + rotation trick + swap notations
                              if (el.isSplitRing) {
                                const notationAText = el.notation.replace(/^sr:\s*/, '');
                                const notationBText = el.notationB || '5ds';
                                const reversedA = reverseNotation(`sr: ${notationAText}`).replace(/^sr:\s*/, '');
                                const reversedB = reverseNotation(`sr: ${notationBText}`).replace(/^sr:\s*/, '');
                                const parsedA = parseNotation(`sr: ${reversedB}`); // Swap!
                                const parsedB = parseNotation(`sr: ${reversedA}`); // Swap!
                                if (!parsedA || !parsedB) return el;

                                const stitchCountA = parsedA.stitchCount;
                                const stitchCountB = parsedB.stitchCount;
                                const totalStitches = stitchCountA + stitchCountB;
                                const squeeze = el.squeeze || 0;
                                const pathData = createSplitRingPath(newCenterX, el.center.y, totalStitches * dsWidth, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);

                                const newAngle = 180 - currentAngle;
                                const rad = (newAngle * Math.PI) / 180;
                                const cos = Math.cos(rad), sin = Math.sin(rad);
                                const cx = newCenterX, cy = el.center.y;
                                const rotatePt = (px, py) => {
                                  const dx = px - cx, dy = py - cy;
                                  return { x: cx + dx*cos - dy*sin, y: cy + dx*sin + dy*cos };
                                };
                                const newPaths = pathData.paths.map(path => {
                                  const s = rotatePt(path.x, path.y);
                                  const e = rotatePt(path.endX, path.endY);
                                  const c1 = rotatePt(path.control1X, path.control1Y);
                                  const c2 = rotatePt(path.control2X, path.control2Y);
                                  return { ...path, x: s.x, y: s.y, endX: e.x, endY: e.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
                                });
                                const allPicots = [...parsedA.picots, ...parsedB.picots.map(p => ({ ...p, stitchesBefore: p.stitchesBefore + stitchCountA }))];
                                return { ...el, center: { x: newCenterX, y: el.center.y }, paths: newPaths, notation: `sr: ${reversedB}`, notationB: reversedA, stitchCount: totalStitches, picots: allPicots, rotation: ((newAngle % 360) + 360) % 360, splitPosition: stitchCountA };
                              }

                              // For all other elements: mirror X coords AND reverse traversal direction.
                              // Mirroring alone flips the path's travel direction, which makes picots and
                              // labels appear on the wrong side. Reversing start↔end restores correct direction.
                              // We also reverse the array order so multi-segment paths stay connected.
                              const mirrorX = (px) => 2 * groupCenterX - px;
                              const newPaths = el.paths.map(path => {
                                if (path.type === 'cubic') {
                                  return {
                                    ...path,
                                    x: mirrorX(path.endX), y: path.endY,
                                    control1X: mirrorX(path.control2X), control1Y: path.control2Y,
                                    control2X: mirrorX(path.control1X), control2Y: path.control1Y,
                                    endX: mirrorX(path.x), endY: path.y
                                  };
                                } else {
                                  return {
                                    ...path,
                                    x: mirrorX(path.endX), y: path.endY,
                                    controlX: mirrorX(path.controlX), controlY: path.controlY,
                                    endX: mirrorX(path.x), endY: path.y
                                  };
                                }
                              }).reverse();

                              // Update rotation to match the flip (same formula as single-element H-flip)
                              const newAngle = ((180 - currentAngle) % 360 + 360) % 360;

                              // Reverse notation
                              let reversedNotation = el.notation;
                              let picots = el.picots;
                              if (el.type !== 'line' && el.notation && el.notation !== 'line') {
                                reversedNotation = reverseNotation(el.notation);
                                const parsed = parseNotation(reversedNotation);
                                if (parsed) picots = parsed.picots.map((p, _i, _arr) => { if (p.beadType !== 'be') return p; const oldBEs = (el.picots||[]).filter(x=>x.beadType==='be'); const rIdx = oldBEs.length-1-_arr.filter((x,j)=>j<_i&&x.beadType==='be').length; const src=oldBEs[rIdx]; return src?{...p,beStructure:src.beStructure,beIsJoint:src.beIsJoint,coreBeads:src.coreBeads,picotBeads:src.picotBeads}:p; });
                              }

                              return { ...el, center: { x: newCenterX, y: el.center.y }, paths: newPaths, notation: reversedNotation, picots, rotation: newAngle };
                            }));
                          }}
                          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                          title={t('propFlipGroupH')}
                        >
                          <IconFlipH size={16} />
                        </button>
                        <button
                          onClick={() => {
                            // Vertical flip = mirror across horizontal axis through group center
                            const groupCenterY = groupElements.reduce((sum, el) => sum + el.center.y, 0) / groupElements.length;
                            
                            setElements(prev => prev.map(el => {
                              if (!selectedIds.includes(el.id)) return el;
                              
                              const newCenterY = 2 * groupCenterY - el.center.y;
                              const currentAngle = el.rotation || 0;

                              // Split rings: regenerate at mirrored center + rotation trick + swap notations
                              if (el.isSplitRing) {
                                const notationAText = el.notation.replace(/^sr:\s*/, '');
                                const notationBText = el.notationB || '5ds';
                                const reversedA = reverseNotation(`sr: ${notationAText}`).replace(/^sr:\s*/, '');
                                const reversedB = reverseNotation(`sr: ${notationBText}`).replace(/^sr:\s*/, '');
                                const parsedA = parseNotation(`sr: ${reversedB}`); // Swap!
                                const parsedB = parseNotation(`sr: ${reversedA}`); // Swap!
                                if (!parsedA || !parsedB) return el;

                                const stitchCountA = parsedA.stitchCount;
                                const stitchCountB = parsedB.stitchCount;
                                const totalStitches = stitchCountA + stitchCountB;
                                const squeeze = el.squeeze || 0;
                                const pathData = createSplitRingPath(el.center.x, newCenterY, totalStitches * dsWidth, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);

                                const newAngle = -currentAngle;
                                const rad = (newAngle * Math.PI) / 180;
                                const cos = Math.cos(rad), sin = Math.sin(rad);
                                const cx = el.center.x, cy = newCenterY;
                                const rotatePt = (px, py) => {
                                  const dx = px - cx, dy = py - cy;
                                  return { x: cx + dx*cos - dy*sin, y: cy + dx*sin + dy*cos };
                                };
                                const newPaths = pathData.paths.map(path => {
                                  const s = rotatePt(path.x, path.y);
                                  const e = rotatePt(path.endX, path.endY);
                                  const c1 = rotatePt(path.control1X, path.control1Y);
                                  const c2 = rotatePt(path.control2X, path.control2Y);
                                  return { ...path, x: s.x, y: s.y, endX: e.x, endY: e.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y };
                                });
                                const allPicots = [...parsedA.picots, ...parsedB.picots.map(p => ({ ...p, stitchesBefore: p.stitchesBefore + stitchCountA }))];
                                return { ...el, center: { x: el.center.x, y: newCenterY }, paths: newPaths, notation: `sr: ${reversedB}`, notationB: reversedA, stitchCount: totalStitches, picots: allPicots, rotation: ((newAngle % 360) + 360) % 360, splitPosition: stitchCountA };
                              }

                              // For all other elements: mirror Y coords AND reverse traversal direction.
                              // Mirroring alone flips the path's travel direction, which makes picots and
                              // labels appear on the wrong side. Reversing start↔end restores correct direction.
                              // We also reverse the array order so multi-segment paths stay connected.
                              const mirrorY = (py) => 2 * groupCenterY - py;
                              const newPaths = el.paths.map(path => {
                                if (path.type === 'cubic') {
                                  return {
                                    ...path,
                                    x: path.endX, y: mirrorY(path.endY),
                                    control1X: path.control2X, control1Y: mirrorY(path.control2Y),
                                    control2X: path.control1X, control2Y: mirrorY(path.control1Y),
                                    endX: path.x, endY: mirrorY(path.y)
                                  };
                                } else {
                                  return {
                                    ...path,
                                    x: path.endX, y: mirrorY(path.endY),
                                    controlX: path.controlX, controlY: mirrorY(path.controlY),
                                    endX: path.x, endY: mirrorY(path.y)
                                  };
                                }
                              }).reverse();

                              // Update rotation to match the flip (same formula as single-element V-flip)
                              const newAngle = ((-currentAngle) % 360 + 360) % 360;

                              // Reverse notation
                              let reversedNotation = el.notation;
                              let picots = el.picots;
                              if (el.type !== 'line' && el.notation && el.notation !== 'line') {
                                reversedNotation = reverseNotation(el.notation);
                                const parsed = parseNotation(reversedNotation);
                                if (parsed) picots = parsed.picots.map((p, _i, _arr) => { if (p.beadType !== 'be') return p; const oldBEs = (el.picots||[]).filter(x=>x.beadType==='be'); const rIdx = oldBEs.length-1-_arr.filter((x,j)=>j<_i&&x.beadType==='be').length; const src=oldBEs[rIdx]; return src?{...p,beStructure:src.beStructure,beIsJoint:src.beIsJoint,coreBeads:src.coreBeads,picotBeads:src.picotBeads}:p; });
                              }

                              return { ...el, center: { x: el.center.x, y: newCenterY }, paths: newPaths, notation: reversedNotation, picots, rotation: newAngle };
                            }));
                          }}
                          className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
                          title={t('propFlipGroupV')}
                        >
                          <IconFlipV size={16} />
                        </button>
                      </div>
                    </>
                  );
                }
              }
              // ── Free multi-select bar (no groupId) ──────────────────────────
              if (selectedIds.length > 1) {
                const selEls = elements.filter(e => selectedIds.includes(e.id));

                // Classify each element: 'r', 'c', 'sr', 'line', or null
                const getElType = (el) => {
                  if (el.type === 'line') return 'line';
                  if (el.isSplitRing) return 'sr';
                  if (el.type === 'ring') return 'r';
                  if (el.type === 'chain') return 'c';
                  return null;
                };

                const nonLines = selEls.filter(e => getElType(e) !== 'line');
                const types = [...new Set(nonLines.map(getElType).filter(Boolean))];
                const allSameType = types.length === 1;
                const sameType = allSameType ? types[0] : null;

                // Check if all share exact same notation (for prefill)
                const prefillNotation = (() => {
                  if (!allSameType || nonLines.length === 0) return null;
                  const first = nonLines[0].notation || '';
                  return nonLines.every(e => (e.notation || '') === first) ? first : null;
                })();

                // Centroid of ALL selected (for transforms)
                const cxAll = selEls.reduce((s, e) => s + e.center.x, 0) / selEls.length;
                const cyAll = selEls.reduce((s, e) => s + e.center.y, 0) / selEls.length;

                // Flip H (mirror across vertical axis through centroid)
                const doFlipH = () => {
                  setElements(prev => prev.map(el => {
                    if (!selectedIds.includes(el.id)) return el;
                    const newCenterX = 2 * cxAll - el.center.x;
                    const currentAngle = el.rotation || 0;
                    if (el.isSplitRing) {
                      const notationAText = el.notation.replace(/^sr:\s*/, '');
                      const notationBText = el.notationB || '5ds';
                      const reversedA = reverseNotation(`sr: ${notationAText}`).replace(/^sr:\s*/, '');
                      const reversedB = reverseNotation(`sr: ${notationBText}`).replace(/^sr:\s*/, '');
                      const parsedA = parseNotation(`sr: ${reversedB}`);
                      const parsedB = parseNotation(`sr: ${reversedA}`);
                      if (!parsedA || !parsedB) return el;
                      const sca = parsedA.stitchCount, scb = parsedB.stitchCount;
                      const pathData = createSplitRingPath(newCenterX, el.center.y, (sca + scb) * dsWidth, sca, scb, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
                      const newAngle = 180 - currentAngle;
                      const rad = newAngle * Math.PI / 180, rc = Math.cos(rad), rs = Math.sin(rad);
                      const rot = (px, py) => { const dx = px - newCenterX, dy = py - el.center.y; return { x: newCenterX + dx*rc - dy*rs, y: el.center.y + dx*rs + dy*rc }; };
                      const newPaths = pathData.paths.map(p => { const s = rot(p.x, p.y), e2 = rot(p.endX, p.endY), c1 = rot(p.control1X, p.control1Y), c2 = rot(p.control2X, p.control2Y); return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y }; });
                      const allPicots = [...parsedA.picots, ...parsedB.picots.map(p => ({ ...p, stitchesBefore: p.stitchesBefore + sca }))];
                      return { ...el, center: { x: newCenterX, y: el.center.y }, paths: newPaths, notation: `sr: ${reversedB}`, notationB: reversedA, stitchCount: sca + scb, picots: allPicots, rotation: ((newAngle % 360) + 360) % 360, splitPosition: sca };
                    }
                    const mirrorX = (px) => 2 * cxAll - px;
                    const newPaths = el.paths.map(path => {
                      if (path.type === 'cubic') return { ...path, x: mirrorX(path.endX), y: path.endY, control1X: mirrorX(path.control2X), control1Y: path.control2Y, control2X: mirrorX(path.control1X), control2Y: path.control1Y, endX: mirrorX(path.x), endY: path.y };
                      return { ...path, x: mirrorX(path.endX), y: path.endY, controlX: mirrorX(path.controlX), controlY: path.controlY, endX: mirrorX(path.x), endY: path.y };
                    }).reverse();
                    const newAngle = ((180 - currentAngle) % 360 + 360) % 360;
                    let reversedNotation = el.notation, picots = el.picots;
                    if (el.type !== 'line' && el.notation) { reversedNotation = reverseNotation(el.notation); const parsed = parseNotation(reversedNotation); if (parsed) picots = mergeBEConfigs(parsed.picots, el.picots); }
                    return { ...el, center: { x: newCenterX, y: el.center.y }, paths: newPaths, notation: reversedNotation, picots, rotation: newAngle };
                  }));
                };

                // Flip V (mirror across horizontal axis through centroid)
                const doFlipV = () => {
                  setElements(prev => prev.map(el => {
                    if (!selectedIds.includes(el.id)) return el;
                    const newCenterY = 2 * cyAll - el.center.y;
                    const currentAngle = el.rotation || 0;
                    if (el.isSplitRing) {
                      const notationAText = el.notation.replace(/^sr:\s*/, '');
                      const notationBText = el.notationB || '5ds';
                      const reversedA = reverseNotation(`sr: ${notationAText}`).replace(/^sr:\s*/, '');
                      const reversedB = reverseNotation(`sr: ${notationBText}`).replace(/^sr:\s*/, '');
                      const parsedA = parseNotation(`sr: ${reversedB}`);
                      const parsedB = parseNotation(`sr: ${reversedA}`);
                      if (!parsedA || !parsedB) return el;
                      const sca = parsedA.stitchCount, scb = parsedB.stitchCount;
                      const pathData = createSplitRingPath(el.center.x, newCenterY, (sca + scb) * dsWidth, sca, scb, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
                      const newAngle = -currentAngle;
                      const rad = newAngle * Math.PI / 180, rc = Math.cos(rad), rs = Math.sin(rad);
                      const rot = (px, py) => { const dx = px - el.center.x, dy = py - newCenterY; return { x: el.center.x + dx*rc - dy*rs, y: newCenterY + dx*rs + dy*rc }; };
                      const newPaths = pathData.paths.map(p => { const s = rot(p.x, p.y), e2 = rot(p.endX, p.endY), c1 = rot(p.control1X, p.control1Y), c2 = rot(p.control2X, p.control2Y); return { ...p, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y }; });
                      const allPicots = [...parsedA.picots, ...parsedB.picots.map(p => ({ ...p, stitchesBefore: p.stitchesBefore + sca }))];
                      return { ...el, center: { x: el.center.x, y: newCenterY }, paths: newPaths, notation: `sr: ${reversedB}`, notationB: reversedA, stitchCount: sca + scb, picots: allPicots, rotation: ((newAngle % 360) + 360) % 360, splitPosition: sca };
                    }
                    const mirrorY = (py) => 2 * cyAll - py;
                    const newPaths = el.paths.map(path => {
                      if (path.type === 'cubic') return { ...path, x: path.endX, y: mirrorY(path.endY), control1X: path.control2X, control1Y: mirrorY(path.control2Y), control2X: path.control1X, control2Y: mirrorY(path.control1Y), endX: path.x, endY: mirrorY(path.y) };
                      return { ...path, x: path.endX, y: mirrorY(path.endY), controlX: path.controlX, controlY: mirrorY(path.controlY), endX: path.x, endY: mirrorY(path.y) };
                    }).reverse();
                    const newAngle = ((-currentAngle) % 360 + 360) % 360;
                    let reversedNotation = el.notation, picots = el.picots;
                    if (el.type !== 'line' && el.notation) { reversedNotation = reverseNotation(el.notation); const parsed = parseNotation(reversedNotation); if (parsed) picots = mergeBEConfigs(parsed.picots, el.picots); }
                    return { ...el, center: { x: el.center.x, y: newCenterY }, paths: newPaths, notation: reversedNotation, picots, rotation: newAngle };
                  }));
                };

                // Type label
                const typeLabel = sameType === 'r' ? 'Rings' : sameType === 'c' ? 'Chains' : sameType === 'sr' ? 'Split Rings' : null;

                return (
                  <>
                    {/* Label */}
                    <div className="text-sm text-gray-300 px-2 flex-shrink-0">
                      {selEls.length} {typeLabel ?? 'Mixed'} selected
                    </div>

                    {/* Notation input — only for non-line same-type selections */}
                    {nonLines.length > 0 && (
                      <div className="flex items-center gap-1 top-toolbar-scalable">
                        <input
                          key={selectedIds.join(',')}
                          type="text"
                          defaultValue={prefillNotation ?? ''}
                          disabled={!allSameType}
                          placeholder={allSameType ? (sameType === 'r' ? 'r: 5ds-p-5ds' : sameType === 'c' ? 'c: 5ds-p-5ds' : 'sr: 5ds-p-5ds') : 'Mixed types'}
                          title={allSameType ? 'Apply notation to all selected' : 'Select same-type elements to edit notation'}
                          onBlur={(e) => {
                            if (!allSameType) return;
                            const notation = e.target.value.trim();
                            if (!notation) return;
                            const parsed = parseNotation(notation);
                            if (!parsed || parsed.stitchCount === 0) { e.target.value = prefillNotation ?? ''; return; }
                            setElements(prev => prev.map(el => {
                              if (!selectedIds.includes(el.id)) return el;
                              if (getElType(el) === 'line') return el;
                              if (el.isSplitRing) {
                                // For split rings, apply as notation A, keep notationB
                                const newParsed = parseNotation(notation);
                                if (!newParsed) return el;
                                const stitchCountA = el.splitPosition || Math.floor(el.stitchCount / 2);
                                const stitchCountB = el.stitchCount - stitchCountA;
                                const pathData = createSplitRingPath(el.center.x, el.center.y, newParsed.stitchCount * dsWidth, stitchCountA, stitchCountB, el.squeeze ?? 0.25, el.squeezeCA ?? 0.75, el.squeezeCB ?? 0.75);
                                return { ...el, notation, stitchCount: newParsed.stitchCount, picots: restoreBEConfigs(newParsed.picots, el.beConfigs), paths: pathData.paths };
                              }
                              const newParsed = parseNotation(notation);
                              if (!newParsed) return el;
                              const targetLength = newParsed.stitchCount * dsWidth;
                              let newPaths;
                              if (el.type === 'ring') {
                                const pathData = el.shapeStyle === 'teardrop'
                                  ? createTeardropPath(el.center.x, el.center.y, targetLength, el.squeeze ?? 0)
                                  : createTeardropPath(el.center.x, el.center.y, targetLength, 0);
                                newPaths = pathData.paths;
                                // Re-apply rotation
                                if (el.rotation) {
                                  const r = el.rotation * Math.PI / 180, rc = Math.cos(r), rs = Math.sin(r);
                                  const rot = (px, py) => { const dx = px - el.center.x, dy = py - el.center.y; return { x: el.center.x + dx*rc - dy*rs, y: el.center.y + dx*rs + dy*rc }; };
                                  newPaths = newPaths.map(path => {
                                    if (path.type === 'cubic') { const s = rot(path.x, path.y), e2 = rot(path.endX, path.endY), c1 = rot(path.control1X, path.control1Y), c2 = rot(path.control2X, path.control2Y); return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, control1X: c1.x, control1Y: c1.y, control2X: c2.x, control2Y: c2.y }; }
                                    const s = rot(path.x, path.y), e2 = rot(path.endX, path.endY), ctrl = rot(path.controlX, path.controlY); return { ...path, x: s.x, y: s.y, endX: e2.x, endY: e2.y, controlX: ctrl.x, controlY: ctrl.y };
                                  });
                                }
                              } else {
                                newPaths = el.paths; // Chains: keep existing path shape, just update notation
                              }
                              return { ...el, notation, stitchCount: newParsed.stitchCount, picots: restoreBEConfigs(newParsed.picots, el.beConfigs), paths: newPaths ?? el.paths };
                            }));
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = prefillNotation ?? ''; e.target.blur(); } }}
                          className={`notation-input px-2 py-1 rounded border text-sm ${allSameType ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'}`}
                          style={{ width: '140px' }}
                        />
                      </div>
                    )}

                    {/* Rotate + Flip */}
                    <div className="flex items-center gap-0.5 md:gap-1 top-toolbar-scalable">
                      <button onClick={() => applyMultiSelectRotationDelta(-90)} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title="Rotate -90°"><IconRotateCCW size={16} /></button>
                      <input
                        type="number"
                        value={groupRotationInput}
                        onChange={(e) => setGroupRotationInput(e.target.value)}
                        onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { applyMultiSelectRotationDelta(v); } setGroupRotationInput(''); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { const v = parseFloat(e.currentTarget.value); if (!isNaN(v)) applyMultiSelectRotationDelta(v); setGroupRotationInput(''); e.currentTarget.blur(); } }}
                        className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
                        style={{ width: '3.4rem' }}
                        placeholder="Δ°"
                      />
                      <button onClick={() => applyMultiSelectRotationDelta(90)} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title="Rotate +90°"><IconRotateCW size={16} /></button>
                      <button onClick={doFlipH} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title="Flip Horizontal"><IconFlipH size={16} /></button>
                      <button onClick={doFlipV} className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs" title="Flip Vertical"><IconFlipV size={16} /></button>
                    </div>

                    {/* Material */}
                    <div className="w-px h-6 bg-gray-600 mx-1 hide-label-mobile" />
                    <div className="flex items-center gap-1 top-toolbar-scalable">
                      <label className="text-xs text-gray-400 hide-label-mobile">Material:</label>
                      <select
                        defaultValue="default"
                        onChange={(e) => {
                          const matId = e.target.value;
                          if (matId === '__edit__') { setShowMaterialsPanel(true); return; }
                          setElements(prev => prev.map(el => {
                            if (!selectedIds.includes(el.id)) return el;
                            // Split rings: set both A and B
                            if (el.isSplitRing) return { ...el, materialId: matId, materialIdB: matId };
                            return { ...el, materialId: matId };
                          }));
                        }}
                        className="px-2 py-1 bg-gray-700 rounded border border-gray-600 text-sm text-white"
                        style={{ maxWidth: '120px' }}
                      >
                        {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        <option disabled>──────</option>
                        <option value="__edit__">Edit materials…</option>
                      </select>
                    </div>
                  </>
                );
              }

              return null;
            })()}
            
            {/* Empty-state placeholder: keeps bar visually non-blank and stabilises layout */}
            {!selectedElement && selectedIds.length === 0 && currentTool !== 'image' && (
              <span style={{color:'#4b5563', fontSize:'0.75rem', padding:'0.25rem 0.5rem', userSelect:'none'}}>
                Select an element to edit its properties
              </span>
            )}
            
            {currentTool === 'image' && (
              <>
              {/* Reference image controls when Image tool is selected */}
              {/* Upload button */}
              <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2"
                  title={t('propUploadImage')}
                >
                  <IconLoad size={18} />
                  <span className="text-sm hide-label-mobile">Upload Image</span>
                </button>
              </div>
              
              {referenceImage && (
                <>
                  {/* Opacity slider */}
                  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                    <label className="text-xs text-gray-400 hide-label-mobile">Opacity:</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={refImageProps.opacity}
                      onChange={(e) => setRefImageProps({...refImageProps, opacity: parseFloat(e.target.value)})}
                      className="w-24"
                    />
                    <span className="text-xs text-gray-400 w-8">{Math.round(refImageProps.opacity * 100)}%</span>
                  </div>
                  
                  {/* Scale slider */}
                  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                    <label className="text-xs text-gray-400 hide-label-mobile">Scale:</label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={refImageProps.scale}
                      onChange={(e) => setRefImageProps({...refImageProps, scale: parseFloat(e.target.value)})}
                      className="w-24"
                    />
                    <span className="text-xs text-gray-400 w-8">{refImageProps.scale.toFixed(1)}x</span>
                  </div>
                  
                  {/* Rotation slider */}
                  <div className="flex items-center gap-0.5 md:gap-2 top-toolbar-scalable">
                    <label className="text-xs text-gray-400 hide-label-mobile">Rotate:</label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="15"
                      value={refImageProps.rotation}
                      onChange={(e) => setRefImageProps({...refImageProps, rotation: parseFloat(e.target.value)})}
                      className="w-24"
                    />
                    <span className="text-xs text-gray-400 w-8">{refImageProps.rotation}°</span>
                  </div>
                  
                  {/* Visibility toggle */}
                  <button
                    onClick={() => setRefImageProps({...refImageProps, visible: !refImageProps.visible})}
                    className={`px-3 py-2 rounded flex items-center gap-2 ${refImageProps.visible ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-500'}`}
                    title={t('propToggleVisibility')}
                  >
                    <IconEyeOn size={18} />
                    <span className="text-xs hide-label-mobile">{refImageProps.visible ? 'Visible' : 'Hidden'}</span>
                  </button>
                  
                  {/* Remove button */}
                  <button
                    onClick={() => setShowRemoveConfirm(true)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded flex items-center gap-2"
                    title={t('propRemoveImage')}
                  >
                    <IconDelete size={18} />
                    <span className="text-xs hide-label-mobile">Remove</span>
                  </button>
                </>
              )}
            </>
            )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 relative">

        {/* ── Notes Drawer ─────────────────────────────────────── */}
        {notesOpen && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '320px',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#111827',
              borderRight: '1px solid #374151',
              boxShadow: '4px 0 16px rgba(0,0,0,0.6)',
              pointerEvents: 'auto',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#1F2937',
              borderBottom: '1px solid #374151',
              flexShrink: 0,
            }}>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>{t('notesTitle')}</span>
              <button
                onClick={() => {
                  // Flush textarea content before closing
                  if (notesTextareaRef.current) setPatternNotes(notesTextareaRef.current.value);
                  setNotesOpen(false);
                }}
                title={t('notesClose')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  touchAction: 'manipulation',
                }}
                onMouseOver={e => e.currentTarget.style.color = '#fff'}
                onMouseOut={e => e.currentTarget.style.color = '#9CA3AF'}
              >
                <IconClose size={18} />
              </button>
            </div>

            {/* Textarea */}
            <textarea
              ref={notesTextareaRef}
              defaultValue={patternNotes}
              onBlur={e => setPatternNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              spellCheck={true}
              style={{
                flex: 1,
                backgroundColor: '#111827',
                color: '#F9FAFB',
                padding: '16px',
                resize: 'none',
                border: 'none',
                outline: 'none',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontSize: '1rem',
                lineHeight: '1.6',
                WebkitUserSelect: 'text',
                userSelect: 'text',
              }}
            />

            {/* Footer */}
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#1F2937',
              borderTop: '1px solid #374151',
              flexShrink: 0,
            }}>
              <span style={{ color: '#6B7280', fontSize: '0.75rem' }}>{t('notesFooter')}</span>
            </div>
          </div>
        )}
        {/* ── End Notes Drawer ──────────────────────────────────── */}
        <div className="absolute left-4 top-4 mobile-toolbar-compact toolbar-scalable-left bg-gray-800 text-white p-2 rounded z-10 grid grid-cols-2 gap-1 pointer-events-none" style={{ width: '100px', touchAction: 'none' }}>
          {renderMode === 'realistic' && (
            <>
              {/* Realistic mode: Pan only — editing disabled */}
              <button onClick={() => setCurrentTool('pan')} className="p-2 rounded col-span-2 pointer-events-auto bg-blue-600" style={{ touchAction: 'manipulation' }} title="Pan (only mode in realistic view)">
                <IconPan size={20} />
              </button>
              <div className="col-span-2 text-center text-gray-400 text-xs leading-tight px-1 py-0.5">
                Pan &amp; scroll<br/>only
              </div>
            </>
          )}
          {renderMode !== 'realistic' && <>
          {/* Row 1: Pan and Select */}
          <button onClick={() => setCurrentTool('pan')} className={`p-2 rounded pointer-events-auto touch-action-manipulation ${currentTool === 'pan' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`} style={{ touchAction: 'manipulation' }}>
            <IconPan size={20} />
          </button>
          <button onClick={() => setCurrentTool('select')} className={`p-2 rounded pointer-events-auto ${currentTool === 'select' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`} style={{ touchAction: 'manipulation' }}>
            <IconSelect size={20} />
          </button>
          
          {/* Row 2: Rotation Handles and Ortho Lock */}
          <button 
            onClick={() => setShowRotationHandles(!showRotationHandles)} 
            className={`p-2 rounded pointer-events-auto ${showRotationHandles ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`} 
            style={{ touchAction: 'manipulation' }}
            title={showRotationHandles ? "Hide rotation handles (or release Shift)" : "Show rotation handles (or hold Shift)"}
          >
            <IconRotateMode size={20} />
          </button>
          <button
            onClick={() => setOrthoLock(v => !v)}
            className={`p-2 rounded pointer-events-auto ${orthoLock ? 'bg-orange-600' : 'bg-gray-700 active:bg-gray-600'}`}
            style={{ touchAction: 'manipulation' }}
            title={t('toolOrthoLock')}
          >
            <IconMove size={20} />
          </button>

          {/* Row 3: Path Edit and Picot Join */}
          <button onClick={() => setCurrentTool('path')} className={`p-2 rounded pointer-events-auto ${currentTool === 'path' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`} style={{ touchAction: 'manipulation' }} title={t('toolPathEdit')}>
            <IconPathEdit size={20} />
          </button>
          
          {/* Picot Join button */}
          <button 
            onClick={() => {
              if (currentTool === 'picotJoin') {
                setCurrentTool('select');
              } else {
                setCurrentTool('picotJoin');
                if (localStorage.getItem('tcad_seen_join_tip') !== '1') setShowJoinTip(true);
                setSelectedIds([]);
              }
            }}
            className={`p-2 rounded col-span-2 pointer-events-auto flex items-center justify-center ${currentTool === 'picotJoin' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`}
            style={{ touchAction: 'manipulation' }}
            title={t('toolPicotJoin')}
          >
            <span className="text-[0.5rem] font-bold leading-tight">Join<br/>Picots</span>
          </button>
          {/* Beading mode button */}
          <button
            onClick={() => {
              if (currentTool === 'beading') {
                setCurrentTool('select');
                setSelectedBEs([]);
              } else {
                setCurrentTool('beading');
                setSelectedIds([]);
                setSelectedBEs([]);
              }
            }}
            className={`p-2 rounded col-span-2 pointer-events-auto flex items-center justify-center ${currentTool === 'beading' ? 'bg-purple-600' : 'bg-gray-700 active:bg-gray-600'}`}
            style={{ touchAction: 'manipulation' }}
            title="Beading mode — select BE elements to configure beads"
          >
            <span className="text-[0.5rem] font-bold leading-tight">Bead<br/>Mode</span>
          </button>

          {/* Join/Break buttons - only show in picotJoin mode */}
          {currentTool === 'picotJoin' && (
            <>
              <button 
                onClick={joinSelectedPicots} 
                className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto"
                style={{ touchAction: 'manipulation' }}
                title={t('toolJoinPicots')}
                disabled={selectedPicots.length < 2}
              >
                <IconLink size={20} />
              </button>
              <button 
                onClick={breakSelectedPicots} 
                className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto"
                style={{ touchAction: 'manipulation' }}
                title={t('toolBreakPicots')}
                disabled={selectedPicots.length === 0}
              >
                <IconUnlink size={20} />
              </button>
            </>
          )}
          <button onClick={addRing} className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto" style={{ touchAction: 'manipulation' }} title={t('toolAddRing')}>
            <IconAddRing size={20} />
          </button>
          <button onClick={addSplitRing} className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto" style={{ touchAction: 'manipulation' }} title={t('toolAddSplitRing')}>
            <IconAddSplitRing size={20} />
          </button>
          <button onClick={() => setCurrentTool('line')} className={`p-2 rounded pointer-events-auto ${currentTool === 'line' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`} style={{ touchAction: 'manipulation' }} title={t('toolLineTool')}>
            <IconAddLine size={20} />
          </button>
          <button onClick={addChain} className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto" style={{ touchAction: 'manipulation' }} title={t('toolAddChain')}>
            <IconAddChain size={20} />
          </button>
          <button onClick={deleteSelected} className="p-2 bg-gray-700 active:bg-gray-600 rounded col-span-2 pointer-events-auto" style={{ touchAction: 'manipulation' }}><IconDelete size={20} /></button>
          <button 
            onClick={groupSelected} 
            className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto"
            style={{ touchAction: 'manipulation' }}
            title={t('toolGroup')}
            disabled={selectedIds.length < 2}
          >
            <IconGroup size={20} />
          </button>
          <button 
            onClick={ungroupSelected} 
            className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto"
            style={{ touchAction: 'manipulation' }}
            title={t('toolUngroup')}
            disabled={selectedIds.length === 0}
          >
            <IconUngroup size={20} />
          </button>
          <button 
            onClick={() => zoomToCenter(-0.1)} 
            className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto"
            style={{ touchAction: 'manipulation' }}
          >
            <IconZoomOut size={20} />
          </button>
          <button 
            onClick={() => zoomToCenter(0.1)} 
            className="p-2 bg-gray-700 active:bg-gray-600 rounded pointer-events-auto"
            style={{ touchAction: 'manipulation' }}
          >
            <IconZoomIn size={20} />
          </button>
          <button 
            onClick={() => setCurrentTool(currentTool === 'image' ? 'pan' : 'image')} 
            className={`p-2 rounded col-span-2 pointer-events-auto ${currentTool === 'image' ? 'bg-blue-600' : 'bg-gray-700 active:bg-gray-600'}`}
            style={{ touchAction: 'manipulation' }}
            title={t('toolRefImage')}
          >
            <IconImage size={20} />
          </button>
          
          {/* Reference controls removed from here - now in top property bar */}

          {/* Notes toggle — bottom of left toolbar */}
          <button
            onClick={() => setNotesOpen(v => !v)}
            className={`p-2 rounded col-span-2 pointer-events-auto flex items-center justify-center gap-1 text-xs font-semibold ${notesOpen ? 'bg-amber-600' : 'bg-gray-700 active:bg-gray-600'}`}
            style={{ touchAction: 'manipulation' }}
            title={notesOpen ? 'Close pattern notes' : 'Open pattern notes'}
          >
            <IconNotes size={16} />
            <span>{t('toolNotes')}</span>
          </button>
          </>}
        </div>
        
        {/* Remove confirmation dialog */}
        {showRemoveConfirm && (
          <>
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setShowRemoveConfirm(false)}
            ></div>
            
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white rounded z-50 shadow-xl p-4" style={{ width: '280px' }}>
              <h3 className="font-semibold mb-3">Remove Reference Image?</h3>
              <p className="text-sm text-gray-400 mb-4">This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setReferenceImage(null);
                    setShowRemoveConfirm(false);
                  }}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded"
                >
                  Remove
                </button>
              </div>
            </div>
          </>
        )}

        {/* REMOVED: Floating reference toolbar - now inline in left toolbar */}

        {/* Hidden file input for reference image */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        
        {/* Hidden file input for loading projects */}
        <input
          ref={loadInputRef}
          type="file"
          accept=".json"
          onChange={loadProject}
          className="hidden"
        />

        {/* Hidden file input for loading themes */}
        <input
          ref={themeInputRef}
          type="file"
          accept=".json"
          onChange={loadTheme}
          className="hidden"
        />


                {/* Info Bar - Bottom (Full Width) */}
        <div 
          className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-4 py-2 z-10 pointer-events-none"
          style={{ 
            fontSize: '12px',
            fontFamily: 'monospace'
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-gray-300">
            {/* Left side - Selection info */}
            <div className="flex flex-wrap items-center gap-2">
              <span>
                {selectedIds.length === 0 
                  ? 'No selection' 
                  : selectedIds.length === 1 
                    ? `1 object selected` 
                    : `${selectedIds.length} objects selected`}
              </span>
              
              {selectedIds.length === 1 && (() => {
                const selected = elementById.get(selectedIds[0]);
                if (!selected) return null;
                
                // Get color info
                let colorInfo = '';
                if (selected.isGradient) {
                  const gradient = dmcColors.find(c => c.id === selected.color && c.type === 'gradient');
                  if (gradient) {
                    colorInfo = `Color: ${gradient.name} (${gradient.id})`;
                  } else {
                    colorInfo = `Color: Gradient ${selected.color}`;
                  }
                } else {
                  // Solid color - try to find DMC name
                  const dmcSolid = dmcColors.find(c => c.hex === selected.color && c.type !== 'gradient');
                  if (dmcSolid) {
                    colorInfo = `Color: ${dmcSolid.name} (${dmcSolid.id}) - ${selected.color}`;
                  } else {
                    colorInfo = `Color: ${selected.color}`;
                  }
                }
                
                return (
                  <>
                    <span className="text-gray-500">|</span>
                    <span>{selected.type === 'ring' ? 'Ring' : 'Chain'}</span>
                    <span className="text-gray-500">|</span>
                    <span>{selected.stitchCount} DS</span>
                    <span className="text-gray-500">|</span>
                    <span>{colorInfo}</span>
                  </>
                );
              })()}
            </div>
            
            {/* Right side - General info */}
            <div className="flex flex-wrap items-center gap-2">
              <span>Elements: {elements.length}</span>
              <span className="text-gray-500">|</span>
              <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
              <span className="text-gray-500">|</span>
              <span>{renderMode === 'realistic' ? 'Realistic' : 'Schematic'}</span>
            </div>
          </div>
        </div>

        <div
          ref={canvasRef}
          className="w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={(e) => {
            // Path tool: double click on empty canvas exits to select tool
            if (currentTool === 'path') {
              const world = screenToWorld(e.clientX, e.clientY);
              const clicked = findClosestElement(world.x, world.y);
              if (!clicked) setCurrentTool('select');
            }
          }}
          onContextMenu={(e) => e.preventDefault()} // Prevent context menu on middle-click
          onTouchStart={(e) => {
            const touches = e.touches;
            if (touches.length === 2) {
              e.preventDefault();
              // If a drag is in progress, lock it — ignore the second finger entirely.
              // This prevents the element teleporting to the second touch position.
              if (dragOffsetRef.current.active) return;
              // Otherwise abort any other interaction and start pinch.
              handleMouseUp(null);
              const dist = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
              );
              const centerX = (touches[0].clientX + touches[1].clientX) / 2;
              const centerY = (touches[0].clientY + touches[1].clientY) / 2;
              setTouchState({ dist, zoom, centerX, centerY });
            } else if (touches.length === 1) {
              // Single touch - normal pan/select behavior
              const touch = touches[0];
              dragTouchIdRef.current = touch.identifier; // remember which finger started this
              handleMouseDown({ button: 0, clientX: touch.clientX, clientY: touch.clientY });
            }
          }}
          onTouchMove={(e) => {
            const touches = e.touches;
            // While dragging: track ONLY the finger that started the drag (by identifier).
            // This prevents teleporting when a second finger joins or the dragging finger lifts.
            if (dragOffsetRef.current.active) {
              const tracked = dragTouchIdRef.current !== null
                ? Array.from(touches).find(t => t.identifier === dragTouchIdRef.current)
                : null;
              if (tracked) {
                handleMouseMove({ clientX: tracked.clientX, clientY: tracked.clientY });
              }
              // If tracked finger is gone (lifted), do nothing — touchEnd will commit.
              return;
            }
            if (touches.length === 2) {
              // Two-finger pinch zoom
              e.preventDefault();
              if (!touchState.dist) return; // guard against zero dist
              const dist = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
              );
              const scale = dist / touchState.dist;
              const newZoom = touchState.zoom * scale;
              
              // Clamp zoom between 0.3x and 3x (reasonable limits to prevent losing work)
              const clampedZoom = Math.max(0.3, Math.min(3, newZoom));
              
              // Zoom towards the pinch center point
              const centerX = (touches[0].clientX + touches[1].clientX) / 2;
              const centerY = (touches[0].clientY + touches[1].clientY) / 2;
              
              if (canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                
                // Convert screen coords to canvas coords
                const canvasX = centerX - rect.left;
                const canvasY = centerY - rect.top;
                
                // Get world point at pinch center BEFORE zoom
                const worldX = (canvasX - camera.x) / zoom;
                const worldY = (canvasY - camera.y) / zoom;
                
                // Calculate new camera position to keep world point at same screen position
                const newCameraX = canvasX - worldX * clampedZoom;
                const newCameraY = canvasY - worldY * clampedZoom;
                
                setZoom(clampedZoom);
                setCamera({ x: newCameraX, y: newCameraY });
              }
            } else if (touches.length === 1) {
              // Single touch — only forward to mouse handler if we are NOT coming
              // down from a pinch. touchState.dist > 0 means a pinch was active.
              if (touchState.dist > 0) return;
              const touch = touches[0];
              handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            }
          }}
          onTouchEnd={(e) => {
            if (dragOffsetRef.current.active) {
              // Drag in progress: commit only when the tracked drag finger lifts.
              const trackedStillDown = dragTouchIdRef.current !== null
                && Array.from(e.touches).some(t => t.identifier === dragTouchIdRef.current);
              if (!trackedStillDown) {
                // Dragging finger lifted — commit and clear
                dragTouchIdRef.current = null;
                handleMouseUp(null);
              }
              // If other (non-drag) fingers lifted, ignore — drag continues.
              return;
            }
            if (e.touches.length < 2) {
              // Pinch ended — clear pinch state
              if (touchState.dist > 0) {
                handleMouseUp(null);
              }
              setTouchState({ dist: 0, zoom: zoom, centerX: 0, centerY: 0 });
            }
            if (e.touches.length === 0) {
              handleMouseUp(null);
            }
          }}
        >
          <svg width="100%" height="100%" style={{ backgroundColor: bgColor, userSelect: 'none' }}>
            <defs>
              {/* Grid pattern */}
              <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke={bgColor === '#FFFFFF' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'} strokeWidth="1" />
              </pattern>
              
              {/* Pink glow filter for highlighting unnumbered elements */}
              <filter id="pink-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#FF1493" floodOpacity="1"/>
              </filter>
              
              {/* NEW: Realistic rendering stitch patterns */}
              <g id="ds-stitch">
                <path
                  d={DS_STITCH_PATH}
                  fill="currentColor"
                  stroke="black"
                  strokeWidth="0.05"
                  strokeLinecap="square"
                  strokeMiterlimit="4.7"
                />
              </g>
              
              {/* Single Stitch (SS) - half width */}
              <g id="ss-stitch">
                <path
                  d={SS_STITCH_PATH}
                  fill="currentColor"
                  stroke="black"
                  strokeWidth="0.05"
                  strokeLinecap="square"
                  strokeMiterlimit="4.7"
                />
              </g>
              
              {/* Reinforced Double Stitch (RDS) - double width */}
              <g id="rds-stitch">
                <path
                  d={RDS_STITCH_PATH}
                  fill="currentColor"
                  stroke="black"
                  strokeWidth="0.05"
                  strokeLinecap="square"
                  strokeMiterlimit="4.7"
                />
              </g>
              
              {/* Picot arches - just the loops */}
              <g id="picot-p">
                <path
                  d="m -0.13569,-0.003 c -0.13569,-0.0033 -0.248864,0.07618 -0.314453,0.171875 -0.06639,0.09687 -0.101883,0.211718 -0.126954,0.322266 -0.05014,0.221095 -0.05078,0.435547 -0.05078,0.435547 v 0.125 l 0.25,0.002 v -0.125 c 0,0 0.0027,-0.196536 0.04492,-0.382813 0.02112,-0.09314 0.05339,-0.181178 0.08984,-0.234375 0.03646,-0.0532 0.0576,-0.06815 0.101562,-0.06641 h 0.0059 0.0039 c 0.04396,-0.0017 0.06706,0.01321 0.103516,0.06641 0.03646,0.0532 0.06872,0.141237 0.08984,0.234375 0.04224,0.186277 0.04492,0.382813 0.04492,0.382813 v 0.125 l 0.25,-0.002 v -0.125 c 0,0 -6.4e-4,-0.214453 -0.05078,-0.435547 -0.02507,-0.110547 -0.06056,-0.225401 -0.126953,-0.322266 -0.06528,-0.09525 -0.179621,-0.174369 -0.314453,-0.171875 z"
                  fill="white"
                  fillOpacity="1"
                  stroke="black"
                  strokeWidth="0.05"
                />
              </g>
              
              <g id="picot-sp">
                <path
                  d="m -0.13573,0 c -0.13573,0 -0.248864,0.07618 -0.314453,0.171875 -0.06639,0.09687 -0.101883,0.211718 -0.126954,0.322266 -0.04775,0.151308 -0.04251,0.271159 -0.04251,0.271159 l 0.25,0.002 c 0,0 0.0121,-0.08271 0.03665,-0.218425 0.02112,-0.09314 0.05339,-0.181178 0.08984,-0.234375 0.03646,-0.0532 0.0576,-0.06815 0.106461,-0.06813 0.04886,2e-5 0.07196,0.01493 0.108417,0.06813 0.03646,0.0532 0.0713,0.14069 0.08984,0.234375 0.02083,0.105233 0.05319,0.218425 0.05319,0.218425 l 0.25,-0.002 c 0,0 -0.03078,-0.118243 -0.05905,-0.271159 -0.02507,-0.110547 -0.06056,-0.225401 -0.126953,-0.322266 -0.06528,-0.09525 -0.179598,-0.171875 -0.314453,-0.171875 z"
                  fill="white"
                  fillOpacity="1"
                  stroke="black"
                  strokeWidth="0.05"
                />
              </g>
              
              <g id="picot-lp">
                <path
                  d="m -0.13573,0 c -0.13573,0 -0.248864,0.07618 -0.314453,0.171875 -0.06639,0.09687 -0.101883,0.211718 -0.126954,0.322266 -0.05014,0.221095 -0.06247,1.105031 -0.06247,1.105031 v 0.125 l 0.25,0.002 v -0.125 c 0,0 0.01439,-0.86602 0.05661,-1.052297 0.02112,-0.09314 0.05339,-0.181178 0.08984,-0.234375 0.03646,-0.0532 0.0576,-0.06815 0.101562,-0.06641 h 0.0059 0.0039 c 0.04396,-0.0017 0.06706,0.01321 0.103516,0.06641 0.03646,0.0532 0.06872,0.141237 0.08984,0.234375 0.04224,0.186277 0.03323,1.052297 0.03323,1.052297 v 0.125 l 0.25,-0.002 v -0.125 c 0,0 0.01105,-0.883937 -0.03909,-1.105031 -0.02507,-0.110547 -0.06056,-0.225401 -0.126953,-0.322266 -0.06528,-0.09525 -0.179598,-0.171875 -0.314453,-0.171875 z"
                  fill="white"
                  fillOpacity="1"
                  stroke="black"
                  strokeWidth="0.05"
                />
              </g>
              
              {/* DMC Gradient definitions */}
              {dmcColors
                .filter(c => c.type === 'gradient')
                .map(color => {
                  // Parse stops if they're in string format "offset:color,offset:color,..."
                  let stops = color.stops;
                  if (typeof color.stops === 'string') {
                    stops = color.stops.split(',').map(stop => {
                      const [offset, colorHex] = stop.split(':');
                      return { offset: `${offset}%`, color: colorHex };
                    });
                  }
                  
                  if (color.gradientType === 'linear' || !color.gradientType) {
                    return (
                      <linearGradient key={color.id} id={`gradient-${color.id}`} x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="objectBoundingBox">
                        {stops.map((stop, i) => (
                          <stop key={i} offset={stop.offset} stopColor={stop.color} />
                        ))}
                      </linearGradient>
                    );
                  } else if (color.gradientType === 'pattern') {
                    return (
                      <pattern 
                        key={color.id} 
                        id={`gradient-${color.id}`} 
                        patternUnits="userSpaceOnUse" 
                        width={color.patternWidth || 20} 
                        height="20"
                      >
                        {color.stripes.map((stripe, i) => (
                          <rect 
                            key={i} 
                            x={stripe.x} 
                            y="0" 
                            width={stripe.width} 
                            height="20" 
                            fill={stripe.color} 
                          />
                        ))}
                      </pattern>
                    );
                  }
                  return null;
                })}
            </defs>

            <g transform={`translate(${camera.x}, ${camera.y}) scale(${zoom})`}>
              {gridEnabled && <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#grid)" />}

              {/* Reference Image */}
              {referenceImage && refImageProps.visible && (
                <image
                  href={referenceImage}
                  x={refImageProps.x - 500}
                  y={refImageProps.y - 500}
                  width="1000"
                  height="1000"
                  opacity={refImageProps.opacity}
                  transform={`rotate(${refImageProps.rotation} ${refImageProps.x} ${refImageProps.y}) scale(${refImageProps.scale})`}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}

              {/* NEW: Render joint picot connection lines */}
              {picotConnections.map(conn => {
                if (conn.picots.length < 2) return null;
                
                // Get positions of all connected picots
                const positions = conn.picots.map(p => {
                  const el = elementById.get(p.elementId);
                  if (!el) return null;
                  const picot = el.picots?.find(pic => pic.id === p.picotId);
                  if (!picot || !picot.isJoint) return null;
                  return getPicotPosition(el, picot, true); // baseOnly: connection starts at path, not arm tip
                }).filter(Boolean);
                
                if (positions.length < 2) return null;
                
                // All lines meet at the centroid of the connected picots
                const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
                const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
                
                if (renderMode === 'realistic') {
                  // Realistic mode: each picot → center, solid color + black outline
                  const firstEl = elementById.get(conn.picots[0].elementId);
                  const lineColor = firstEl?.color || '#FF8C00';
                  const lineWidth = firstEl?.lineWidth || 2;
                  const beadSeqForConnR = (() => {
                    for (const p of conn.picots) {
                      const el = elementById.get(p.elementId);
                      const picot = el?.picots?.find(pic => pic.id === p.picotId);
                      if ((picot?.beadType === 'bjp' || picot?.beadType === 'bcjp') && picot?.beadSeq) return picot.beadSeq;
                    }
                    return null;
                  })();
                  return (
                    <g key={conn.id}>
                      {positions.map((pos, i) => (
                        <g key={`${conn.id}-${i}`}>
                          <line x1={pos.x} y1={pos.y} x2={cx} y2={cy}
                            stroke="black" strokeWidth={lineWidth + 2} strokeLinecap="round" />
                          <line x1={pos.x} y1={pos.y} x2={cx} y2={cy}
                            stroke={lineColor} strokeWidth={lineWidth} strokeLinecap="round" />
                        </g>
                      ))}
                      {/* Beads at center or center dot */}
                      {beadSeqForConnR
                        ? renderClusteredBeads(`conn-r-${conn.id}`, cx, cy, beadSeqForConnR)
                        : <circle cx={cx} cy={cy} r={lineWidth + 1} fill={lineColor} stroke="black" strokeWidth="1" />
                      }
                    </g>
                  );
                } else {
                  // Schematic mode: each picot → center, dotted orange
                  const beadSeqForConn = (() => {
                    for (const p of conn.picots) {
                      const el = elementById.get(p.elementId);
                      const picot = el?.picots?.find(pic => pic.id === p.picotId);
                      if ((picot?.beadType === 'bjp' || picot?.beadType === 'bcjp') && picot?.beadSeq) return picot.beadSeq;
                    }
                    return null;
                  })();
                  return (
                    <g key={conn.id}>
                      {positions.map((pos, i) => (
                        <line
                          key={`${conn.id}-${i}`}
                          x1={pos.x} y1={pos.y} x2={cx} y2={cy}
                          stroke={theme.connectionLine} strokeWidth="3"
                          strokeDasharray="5,5" opacity="0.7"
                        />
                      ))}
                      {/* Beads at center or center dot */}
                      {beadSeqForConn
                        ? renderClusteredBeads(`conn-${conn.id}`, cx, cy, beadSeqForConn)
                        : <circle cx={cx} cy={cy} r={4/zoom} fill={theme.connectionDot} opacity="0.9" />
                      }
                    </g>
                  );
                }
              })}

              {/* picotJoin/beading dim overlay wraps all path elements */}
              <g opacity={(currentTool === 'picotJoin' || currentTool === 'beading') ? 0.25 : 1}>
              {[...elements].sort((a, b) => {
                // Rings always render on top of chains/lines.
                // Sort: lines = 0, chains = 1, rings = 2.
                // Only the draw order changes — elements state is untouched,
                // so snap points, joint picots, and hit-testing are unaffected.
                const tier = el => el.type === 'ring' ? 2 : el.type === 'chain' ? 1 : 0;
                return tier(a) - tier(b);
              }).map(el => {
                // PERFORMANCE: Skip elements entirely outside the visible viewport
                if (!isInViewport(el)) return null;

                const isSelected = selectedIds.includes(el.id);
                const isUnnumbered = !el.orderNumber || el.orderNumber.toString().trim() === '';
                const shouldHighlight = showUnnumbered && isUnnumbered;
                // PERFORMANCE: During translate-drag, apply offset via SVG transform instead of
                // mutating element state. Keeps stitchCache valid throughout the drag.
                const dragTransform = (isSelected && dragOffsetRef.current.active)
                  ? `translate(${dragOffsetRef.current.dx}, ${dragOffsetRef.current.dy})`
                  : undefined;
                // PERFORMANCE: getElementColor once per element, reused for stroke + picots
                const elColor = getElementColor(el);
                const elStrokeVal = elColor.isGradient ? `url(#gradient-${elColor.id})` : elColor.color;
                // Split ring section B color (only relevant for split rings)
                const elColorB = el.isSplitRing ? getElementColor({...el, materialId: el.materialIdB || el.materialId}) : elColor;
                const elStrokeValB = elColorB.isGradient ? `url(#gradient-${elColorB.id})` : elColorB.color;
                
                // Render circles as SVG circle element for smooth rendering
                if (el.isClosed && el.shapeStyle === 'circle') {
                  const targetCircumference = el.stitchCount * dsWidth;
                  const radius = targetCircumference / (2 * Math.PI);
                  
                  // NEW: Realistic rendering mode
                  if (renderMode === 'realistic') {
                    const stitches = stitchCache.get(el.id);
                    if (!stitches || stitches.length === 0) return null;
                    
                    const scale = calculateStitchScale();
                     const offsetAmount = dsWidth * 0.125 + 5;
                     const PICOT_TIP_H = { sp: 1.2, p: 2.0, lp: 3.2, medium: 2.0, small: 1.2, large: 3.2 };
                     const PICOT_BASE_OFF = 0.6; // × dsWidth half-offset each side
                     const picotSideDir = (el.picotSideMultiplier || 1); // +1 outside, -1 inside

                     return (
                       <g key={el.id} filter={shouldHighlight ? 'url(#pink-glow)' : undefined} transform={dragTransform}>
                         {/* Render all picots first (behind stitches) */}
                         {(el.picots || []).filter(picot => !picot.isJoint && !picot.beadType).map(picot => {
                           const elRot = (el.rotation || 0) * Math.PI / 180;
                           const R = el.stitchCount * dsWidth / (2 * Math.PI);
                           const tipH = (PICOT_TIP_H[picot.length] || 2.0) * dsWidth;
                           const baseOff = PICOT_BASE_OFF * dsWidth;
                           const tipMult = picotSideDir;

                           // Radial angle at picot position
                           const angleBase  = (picot.stitchesBefore / el.stitchCount) * 2 * Math.PI - Math.PI / 2 + elRot;
                           const angleLeft  = ((picot.stitchesBefore - PICOT_BASE_OFF) / el.stitchCount) * 2 * Math.PI - Math.PI / 2 + elRot;
                           const angleRight = ((picot.stitchesBefore + PICOT_BASE_OFF) / el.stitchCount) * 2 * Math.PI - Math.PI / 2 + elRot;

                           const bL = { x: el.center.x + Math.cos(angleLeft)  * R, y: el.center.y + Math.sin(angleLeft)  * R };
                           const bR = { x: el.center.x + Math.cos(angleRight) * R, y: el.center.y + Math.sin(angleRight) * R };
                           const tipR = R + tipMult * tipH;
                           const tip = { x: el.center.x + Math.cos(angleBase) * tipR, y: el.center.y + Math.sin(angleBase) * tipR };

                           // Bezier control point so curve passes through tip at t=0.5
                           const cpx = 2 * tip.x - 0.5 * (bL.x + bR.x);
                           const cpy = 2 * tip.y - 0.5 * (bL.y + bR.y);

                           const picotColor = elColor.isGradient ? getGradientColorAtPosition(elColor.id, picot.stitchesBefore / el.stitchCount) : elColor.color;
                           const lw = el.lineWidth || 2;
                           const d = `M ${bL.x.toFixed(2)} ${bL.y.toFixed(2)} Q ${cpx.toFixed(2)} ${cpy.toFixed(2)} ${bR.x.toFixed(2)} ${bR.y.toFixed(2)}`;

                           return (
                             <g key={`picot-${picot.id}`}>
                               <path d={d} stroke="black" strokeWidth={lw + 2} fill="none" strokeLinecap="round" />
                               <path d={d} stroke={picotColor} strokeWidth={lw} fill="none" strokeLinecap="round" />
                             </g>
                           );
                         })}

                         {/* Render stitches as wedge trapezoids — paths merged per color to minimise SVG nodes */}
                         {(() => {
                           const strokeW = 0.05 * scale;
                           // Accumulate d-strings per fill color
                           const buckets = new Map();
                           for (const stitch of stitches) {
                             const stitchTypes = Array.isArray(stitch.type) ? stitch.type : [stitch.type];
                             for (let subIdx = 0; subIdx < stitchTypes.length; subIdx++) {
                               const type = stitchTypes[subIdx];
                               const N = el.stitchCount;
                               const quarterArc = (Math.PI * 2 / N) * 0.25;
                               const shiftedCenterPolar = subIdx === 0
                                 ? stitch.centerPolarAngle - quarterArc * (stitchTypes.length > 1 ? 1 : 0)
                                 : stitch.centerPolarAngle + quarterArc;
                               const stitchForWedge = stitchTypes.length > 1
                                 ? { ...stitch, centerPolarAngle: shiftedCenterPolar }
                                 : stitch;
                               const wedgePaths = renderWedgeRingShapes(stitchForWedge, el, scale, offsetAmount, type);
                               const existing = buckets.get(stitch.color) || [];
                               buckets.set(stitch.color, existing.concat(wedgePaths));
                             }
                           }
                           // One <path> per distinct fill color
                           return Array.from(buckets.entries()).map(([color, dParts]) => (
                             <path
                               key={color}
                               d={dParts.join(' ')}
                               fill={color}
                               stroke="black"
                               strokeWidth={strokeW}
                               strokeLinejoin="miter"
                             />
                           ));
                         })()}
                        
                        {/* Beads — rendered same as schematic for realistic mode */}
                        {renderPicots(el, true)}
                        {/* Selection indicator */}
                        {isSelected && (
                          <circle
                            cx={el.center.x}
                            cy={el.center.y}
                            r={radius + 5}
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                          />
                        )}
                        
                        {/* Keep group and order indicators */}
                        {el.groupId && (
                          <text
                            x={el.center.x}
                            y={el.center.y + radius + 20}
                            fill="#10B981"
                            fontSize={notationFS}
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            G
                          </text>
                        )}
                        {showUnnumbered && el.orderNumber && (
                          <text
                            x={el.center.x}
                            y={el.center.y}
                            fill="#FFD700"
                            fontSize={Math.round(notationFS * 1.57)}
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            stroke="#000000"
                            strokeWidth="3"
                            paintOrder="stroke"
                          >
                            {el.orderNumber}
                          </text>
                        )}
                      </g>
                    );
                  }
                  
                  // Original schematic rendering
                  return (
                    <g key={el.id} filter={shouldHighlight ? 'url(#pink-glow)' : undefined} transform={dragTransform}>
                      <circle
                        cx={el.center.x}
                        cy={el.center.y}
                        r={radius}
                        fill="none"
                        stroke={elStrokeVal}
                        strokeWidth="3.75"
                        opacity={isSelected ? 0.7 : 1}
                      />
                      {renderPicots(el)}
                      {isSelected && (
                        <circle
                          cx={el.center.x}
                          cy={el.center.y}
                          r={radius + 5}
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                        />
                      )}
                      {el.groupId && (
                        <text
                          x={el.center.x}
                          y={el.center.y + radius + 20}
                          fill="#10B981"
                          fontSize={notationFS}
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          G
                        </text>
                      )}
                      <g key={`${el.id}-labels`}>{renderStitchLabels(el)}</g>
                      {showUnnumbered && el.orderNumber && (
                        <text
                          x={el.center.x}
                          y={el.center.y}
                          fill="#FFD700"
                          fontSize={Math.round(notationFS * 1.57)}
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          stroke="#000000"
                          strokeWidth="3"
                          paintOrder="stroke"
                        >
                          {el.orderNumber}
                        </text>
                      )}
                    </g>
                  );
                }
                
                // Render everything else (teardrops, chains, and lines) using paths
                return (
                  <g key={el.id} filter={shouldHighlight ? 'url(#pink-glow)' : undefined} transform={dragTransform}>
                    {/* Line rendering - simple bezier with black outline */}
                    {el.type === 'line' ? (
                      <>
                        {el.paths.map((path, i) => {
                          let pathD;
                          if (path.type === 'cubic') {
                            pathD = `M ${path.x},${path.y} C ${path.control1X},${path.control1Y} ${path.control2X},${path.control2Y} ${path.endX},${path.endY}`;
                          } else {
                            pathD = `M ${path.x},${path.y} Q ${path.controlX},${path.controlY} ${path.endX},${path.endY}`;
                          }
                          return (
                            <g key={i}>
                              {/* Black outline */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke="#000000"
                                strokeWidth={(el.lineWidth || 2) + 2}
                                opacity={isSelected ? 0.7 : 1}
                              />
                              {/* Colored line on top */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke={elStrokeVal}
                                strokeWidth={el.lineWidth || 2}
                                opacity={isSelected ? 0.7 : 1}
                              />
                            </g>
                          );
                        })}
                        {/* Selection indicator */}
                        {isSelected && el.paths.map((path, i) => {
                          let pathD;
                          if (path.type === 'cubic') {
                            pathD = `M ${path.x},${path.y} C ${path.control1X},${path.control1Y} ${path.control2X},${path.control2Y} ${path.endX},${path.endY}`;
                          } else {
                            pathD = `M ${path.x},${path.y} Q ${path.controlX},${path.controlY} ${path.endX},${path.endY}`;
                          }
                          return (
                            <path
                              key={`select-${i}`}
                              d={pathD}
                              fill="none"
                              stroke="#3B82F6"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                            />
                          );
                        })}
                        {/* Beaded line — render beads evenly along path */}
                        {el.lineBeads && (() => {
                          const beads = parseBeadSeq(el.lineBeads.toUpperCase());
                          if (beads.length === 0) return null;
                          const allSamples = el.paths.map(p => sampleBezierPath(p, 40));
                          const allLens = allSamples.map(s => calculatePathLength(s));
                          const totalLen = allLens.reduce((a, b) => a + b, 0);
                          return beads.map((size, bi) => {
                            const t = (bi + 0.5) / beads.length;
                            const dist = t * totalLen;
                            let accum = 0;
                            let pathIdx = 0, localDist = dist;
                            for (let j = 0; j < allLens.length; j++) {
                              if (accum + allLens[j] >= dist) { pathIdx = j; localDist = dist - accum; break; }
                              accum += allLens[j];
                            }
                            const samples = allSamples[pathIdx];
                            let bx = samples[0].x, by = samples[0].y;
                            let acc2 = 0;
                            for (let k = 1; k < samples.length; k++) {
                              const seg = Math.hypot(samples[k].x - samples[k-1].x, samples[k].y - samples[k-1].y);
                              if (acc2 + seg >= localDist) {
                                const frac = (localDist - acc2) / seg;
                                bx = samples[k-1].x + frac * (samples[k].x - samples[k-1].x);
                                by = samples[k-1].y + frac * (samples[k].y - samples[k-1].y);
                                break;
                              }
                              acc2 += seg;
                            }
                            return renderCoreBead(`lb-${el.id}-${bi}`, bx, by, size, el.color, undefined);
                          });
                        })()}
                      </>
                    ) : (
                    /* Chains and teardrops */
                    <>
                    {/* NEW: Realistic rendering mode */}
                    {renderMode === 'realistic' ? (() => {
                      const cached = stitchCache.get(el.id);
                      // For path elements, cache stores {stitches, allSamples, pathLengths, totalLength}
                      const stitches = cached?.stitches ?? cached;
                      if (!stitches || stitches.length === 0) return null;
                      
                       const scale = calculateStitchScale();
                       const offsetAmount = dsWidth * 0.125 + 5;
                       const PICOT_TIP_H = { sp: 1.2, p: 2.0, lp: 3.2, medium: 2.0, small: 1.2, large: 3.2 };
                       const PICOT_BASE_OFF = 0.6; // DS units half-offset each side
                       const picotSideDir = (el.picotSideMultiplier || 1);
                       // PERFORMANCE: reuse pre-sampled path data from stitchCache — no sampleBezierPath here
                       const totalPathLength = cached?.allSamples
                         ? { allSamples: cached.allSamples, pathLengths: cached.pathLengths, totalLength: cached.totalLength }
                         : (() => {
                             const allSamples = (el.paths || []).map(p => sampleBezierPath(p, 50));
                             const pathLengths = allSamples.map(s => calculatePathLength(s));
                             return { allSamples, pathLengths, totalLength: pathLengths.reduce((a,b) => a+b, 0) };
                           })();

                       return (
                         <>
                           {/* Render all picots first (behind stitches) */}
                           {(el.picots || []).filter(picot => !picot.isJoint && !picot.beadType).map(picot => {
                             const N = el.stitchCount;
                             const tMid   = picot.stitchesBefore / N;
                             const tLeft  = Math.max(0, (picot.stitchesBefore - PICOT_BASE_OFF) / N);
                             const tRight = Math.min(1, (picot.stitchesBefore + PICOT_BASE_OFF) / N);
                             const tipH = (PICOT_TIP_H[picot.length] || 2.0) * dsWidth;

                             const ptAt = (frac) => {
                               const { allSamples, pathLengths, totalLength } = totalPathLength;
                               return getPointAndAngleAtDistanceFast(allSamples, pathLengths, frac * totalLength);
                             };

                             const ptMid   = ptAt(tMid);
                             const ptLeft  = ptAt(tLeft);
                             const ptRight = ptAt(tRight);

                             // For closed rings near the halfway point, path tangent is unstable.
                             // Use stable axis: vector from join point (ptAt(0)) → midpoint.
                             let nx, ny;
                             const isHalfway = el.isClosed && Math.abs(picot.stitchesBefore - N / 2) < 1.5;
                             if (isHalfway) {
                               const ptJoin = ptAt(0);
                               const ax = ptMid.x - ptJoin.x, ay = ptMid.y - ptJoin.y;
                               const al = Math.sqrt(ax*ax + ay*ay) || 1;
                               nx = (ax / al) * picotSideDir;
                               ny = (ay / al) * picotSideDir;
                             } else {
                               // Normal perpendicular to path — matches schematic: atan2(dy,dx) - PI/2
                               nx = Math.sin(ptMid.angle) * picotSideDir;
                               ny = -Math.cos(ptMid.angle) * picotSideDir;
                             }

                             const bL  = { x: ptLeft.x,  y: ptLeft.y  };
                             const bR  = { x: ptRight.x, y: ptRight.y };
                             const tip = { x: ptMid.x + nx * tipH, y: ptMid.y + ny * tipH };

                             const cpx = 2 * tip.x - 0.5 * (bL.x + bR.x);
                             const cpy = 2 * tip.y - 0.5 * (bL.y + bR.y);

                             const picotColor = (() => {
                               return elColor.isGradient ? getGradientColorAtPosition(elColor.id, tMid) : elColor.color;
                             })();
                             const lw = el.lineWidth || 2;
                             const d = `M ${bL.x.toFixed(2)} ${bL.y.toFixed(2)} Q ${cpx.toFixed(2)} ${cpy.toFixed(2)} ${bR.x.toFixed(2)} ${bR.y.toFixed(2)}`;

                             return (
                               <g key={`picot-${picot.id}`}>
                                 <path d={d} stroke="black" strokeWidth={lw + 2} fill="none" strokeLinecap="round" />
                                 <path d={d} stroke={picotColor} strokeWidth={lw} fill="none" strokeLinecap="round" />
                               </g>
                             );
                           })}

                            {/* Render stitches — paths merged per color to minimise SVG nodes */}
                            {(() => {
                              const strokeW = 0.05 * scale;
                              const buckets = new Map();
                              for (let i = 0; i < stitches.length; i++) {
                                const stitch = stitches[i];
                                const stitchTypes = Array.isArray(stitch.type) ? stitch.type : [stitch.type];
                                for (let subIdx = 0; subIdx < stitchTypes.length; subIdx++) {
                                  const type = stitchTypes[subIdx];
                                  const effectiveIndex = stitchTypes.length > 1
                                    ? i + (subIdx / stitchTypes.length)
                                    : i;
                                  const wedgePaths = el.isClosed
                                    ? renderWedgeTeardropShapes(stitch, el, scale, offsetAmount, type, effectiveIndex, stitchTypes.length)
                                    : renderWedgeChainShapes(stitch, el, scale, offsetAmount, type, effectiveIndex);
                                  const existing = buckets.get(stitch.color) || [];
                                  buckets.set(stitch.color, existing.concat(wedgePaths));
                                }
                              }
                              return Array.from(buckets.entries()).map(([color, dParts]) => (
                                <path
                                  key={color}
                                  d={dParts.join(' ')}
                                  fill={color}
                                  stroke="black"
                                  strokeWidth={strokeW}
                                  strokeLinejoin="miter"
                                />
                              ));
                            })()}
                          
                          {/* Beads — rendered same as schematic for realistic mode */}
                          {renderPicots(el, true)}
                          {/* Selection indicator */}
                          {isSelected && el.paths.map((path, i) => {
                            let pathD;
                            if (path.type === 'cubic') {
                              pathD = `M ${path.x},${path.y} C ${path.control1X},${path.control1Y} ${path.control2X},${path.control2Y} ${path.endX},${path.endY}`;
                            } else {
                              pathD = `M ${path.x},${path.y} Q ${path.controlX},${path.controlY} ${path.endX},${path.endY}`;
                            }
                            return (
                              <path
                                key={`select-${i}`}
                                d={pathD}
                                fill="none"
                                stroke="#3B82F6"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                              />
                            );
                          })}
                          
                          {/* Keep order number and group indicator */}
                          {showUnnumbered && el.orderNumber && (() => {
                            let ox = el.center.x, oy = el.center.y;
                            if (el.type === 'chain' && el.paths && el.paths.length > 0) {
                              const allPts: {x:number,y:number}[] = [];
                              el.paths.forEach(p => {
                                for (let i = 0; i <= 40; i++) {
                                  const t = i / 40, u = 1 - t;
                                  if (p.type === 'cubic') {
                                    allPts.push({ x: u*u*u*p.x+3*u*u*t*p.control1X+3*u*t*t*p.control2X+t*t*t*p.endX, y: u*u*u*p.y+3*u*u*t*p.control1Y+3*u*t*t*p.control2Y+t*t*t*p.endY });
                                  } else {
                                    allPts.push({ x: u*u*p.x+2*u*t*p.controlX+t*t*p.endX, y: u*u*p.y+2*u*t*p.controlY+t*t*p.endY });
                                  }
                                }
                              });
                              let total = 0;
                              for (let i = 1; i < allPts.length; i++) total += Math.hypot(allPts[i].x-allPts[i-1].x, allPts[i].y-allPts[i-1].y);
                              let acc = 0, half = total / 2;
                              for (let i = 1; i < allPts.length; i++) {
                                const seg = Math.hypot(allPts[i].x-allPts[i-1].x, allPts[i].y-allPts[i-1].y);
                                if (acc + seg >= half) { const f=(half-acc)/seg; ox=allPts[i-1].x+(allPts[i].x-allPts[i-1].x)*f; oy=allPts[i-1].y+(allPts[i].y-allPts[i-1].y)*f; break; }
                                acc += seg;
                              }
                            }
                            return <text x={ox} y={oy} fill="#FFD700" fontSize={Math.round(notationFS * 1.57)} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" stroke="#000000" strokeWidth="3" paintOrder="stroke">{el.orderNumber}</text>;
                          })()}
                          {el.groupId && (
                            <text
                              x={el.center.x}
                              y={el.center.y + 60}
                              fill="#10B981"
                              fontSize={notationFS}
                              fontWeight="bold"
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              G
                            </text>
                          )}
                        </>
                      );
                    })() : el.type === 'line' ? (
                      // Line rendering - simple bezier path without stitches
                      <>
                        {el.paths.map((path, i) => {
                          let pathD;
                          if (path.type === 'cubic') {
                            pathD = `M ${path.x},${path.y} C ${path.control1X},${path.control1Y} ${path.control2X},${path.control2Y} ${path.endX},${path.endY}`;
                          } else {
                            pathD = `M ${path.x},${path.y} Q ${path.controlX},${path.controlY} ${path.endX},${path.endY}`;
                          }
                          return (
                            <g key={i}>
                              {/* Black outline */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke="#000000"
                                strokeWidth={(el.lineWidth || 2) + 2}
                                opacity={isSelected ? 0.7 : 1}
                              />
                              {/* Colored line on top */}
                              <path
                                d={pathD}
                                fill="none"
                                stroke={elStrokeVal}
                                strokeWidth={el.lineWidth || 2}
                                opacity={isSelected ? 0.7 : 1}
                              />
                            </g>
                          );
                        })}
                        {/* Selection indicator */}
                        {isSelected && el.paths.map((path, i) => {
                          let pathD;
                          if (path.type === 'cubic') {
                            pathD = `M ${path.x},${path.y} C ${path.control1X},${path.control1Y} ${path.control2X},${path.control2Y} ${path.endX},${path.endY}`;
                          } else {
                            pathD = `M ${path.x},${path.y} Q ${path.controlX},${path.controlY} ${path.endX},${path.endY}`;
                          }
                          return (
                            <path
                              key={`select-${i}`}
                              d={pathD}
                              fill="none"
                              stroke="#3B82F6"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                            />
                          );
                        })}
                        {/* Beaded line — render beads evenly along path */}
                        {el.lineBeads && (() => {
                          const beads = parseBeadSeq(el.lineBeads.toUpperCase());
                          if (beads.length === 0) return null;
                          const allSamples = el.paths.map(p => sampleBezierPath(p, 40));
                          const allLens = allSamples.map(s => calculatePathLength(s));
                          const totalLen = allLens.reduce((a, b) => a + b, 0);
                          return beads.map((size, bi) => {
                            const t = (bi + 0.5) / beads.length;
                            const dist = t * totalLen;
                            let accum = 0;
                            let pathIdx = 0, localDist = dist;
                            for (let j = 0; j < allLens.length; j++) {
                              if (accum + allLens[j] >= dist) { pathIdx = j; localDist = dist - accum; break; }
                              accum += allLens[j];
                            }
                            const samples = allSamples[pathIdx];
                            let bx = samples[0].x, by = samples[0].y;
                            let acc2 = 0;
                            for (let k = 1; k < samples.length; k++) {
                              const seg = Math.hypot(samples[k].x - samples[k-1].x, samples[k].y - samples[k-1].y);
                              if (acc2 + seg >= localDist) {
                                const frac = (localDist - acc2) / seg;
                                bx = samples[k-1].x + frac * (samples[k].x - samples[k-1].x);
                                by = samples[k-1].y + frac * (samples[k].y - samples[k-1].y);
                                break;
                              }
                              acc2 += seg;
                            }
                            return renderCoreBead(`lb2-${el.id}-${bi}`, bx, by, size, el.color, undefined);
                          });
                        })()}
                      </>
                    ) : (
                      // Original schematic rendering
                      <>
                        {el.paths.map((path, i) => {
                          // Use path directly (curveType system removed)
                          const renderPath = path;
                          
                          let pathD;
                          if (renderPath.type === 'cubic') {
                            pathD = `M ${renderPath.x},${renderPath.y} C ${renderPath.control1X},${renderPath.control1Y} ${renderPath.control2X},${renderPath.control2Y} ${renderPath.endX},${renderPath.endY}`;
                          } else {
                            pathD = `M ${renderPath.x},${renderPath.y} Q ${renderPath.controlX},${renderPath.controlY} ${renderPath.endX},${renderPath.endY}`;
                          }
                          return (
                            <path
                              key={i}
                              d={pathD}
                              fill="none"
                              stroke={(i === 1 && el.isSplitRing && el.materialIdB) ? elStrokeValB : elStrokeVal}
                              strokeWidth="3.75"
                              opacity={isSelected ? 0.7 : 1}
                            />
                          );
                        })}
                        {/* Dashed connection line for split rings - along height line */}
                        {el.isSplitRing && el.paths.length >= 2 && (
                          <>
                            <line
                              x1={el.paths[0].endX}
                              y1={el.paths[0].endY}
                              x2={el.paths[0].x}
                              y2={el.paths[0].y}
                              stroke="#000000"
                              strokeWidth={(el.lineWidth || 2) + 2}
                              strokeDasharray="5,5"
                              opacity={isSelected ? 0.7 : 1}
                            />
                            <line
                              x1={el.paths[0].endX}
                              y1={el.paths[0].endY}
                              x2={el.paths[0].x}
                              y2={el.paths[0].y}
                              stroke={elStrokeValB}
                              strokeWidth={el.lineWidth || 2}
                              strokeDasharray="5,5"
                              opacity={isSelected ? 0.7 : 1}
                            />
                          </>
                        )}
                        {renderPicots(el)}
                        {isSelected && (
                          <g>
                            {el.paths.map((path, i) => {
                              // Use path directly (curveType system removed)
                              const renderPath = path;
                              
                              let pathD;
                              if (renderPath.type === 'cubic') {
                                pathD = `M ${renderPath.x},${renderPath.y} C ${renderPath.control1X},${renderPath.control1Y} ${renderPath.control2X},${renderPath.control2Y} ${renderPath.endX},${renderPath.endY}`;
                              } else {
                                pathD = `M ${renderPath.x},${renderPath.y} Q ${renderPath.controlX},${renderPath.controlY} ${renderPath.endX},${renderPath.endY}`;
                              }
                              return (
                                <path
                                  key={`select-${i}`}
                                  d={pathD}
                                  fill="none"
                                  stroke="#3B82F6"
                                  strokeWidth="2"
                                  strokeDasharray="5,5"
                                />
                              );
                            })}
                          </g>
                        )}
                        <g key={`${el.id}-labels`}>{renderStitchLabels(el)}</g>
{showUnnumbered && el.orderNumber && (() => {
                          let ox = el.center.x, oy = el.center.y;
                          if (el.type === 'chain' && el.paths && el.paths.length > 0) {
                            const allPts: {x:number,y:number}[] = [];
                            el.paths.forEach(p => {
                              for (let i = 0; i <= 40; i++) {
                                const t = i / 40, u = 1 - t;
                                if (p.type === 'cubic') {
                                  allPts.push({ x: u*u*u*p.x+3*u*u*t*p.control1X+3*u*t*t*p.control2X+t*t*t*p.endX, y: u*u*u*p.y+3*u*u*t*p.control1Y+3*u*t*t*p.control2Y+t*t*t*p.endY });
                                } else {
                                  allPts.push({ x: u*u*p.x+2*u*t*p.controlX+t*t*p.endX, y: u*u*p.y+2*u*t*p.controlY+t*t*p.endY });
                                }
                              }
                            });
                            let total = 0;
                            for (let i = 1; i < allPts.length; i++) total += Math.hypot(allPts[i].x-allPts[i-1].x, allPts[i].y-allPts[i-1].y);
                            let acc = 0, half = total / 2;
                            for (let i = 1; i < allPts.length; i++) {
                              const seg = Math.hypot(allPts[i].x-allPts[i-1].x, allPts[i].y-allPts[i-1].y);
                              if (acc + seg >= half) { const f=(half-acc)/seg; ox=allPts[i-1].x+(allPts[i].x-allPts[i-1].x)*f; oy=allPts[i-1].y+(allPts[i].y-allPts[i-1].y)*f; break; }
                              acc += seg;
                            }
                          }
                          return <text x={ox} y={oy} fill="#FFD700" fontSize={Math.round(notationFS * 1.57)} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" stroke="#000000" strokeWidth="3" paintOrder="stroke">{el.orderNumber}</text>;
                        })()}
                        {el.groupId && (
                          <text
                            x={el.center.x}
                            y={el.center.y + 60}
                            fill="#10B981"
                            fontSize={notationFS}
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            G
                          </text>
                        )}
                      </>
                    )}
                    </>
                    )}
                  </g>
                );
              })}

              </g>
              {/* Joint picots rendered OUTSIDE the dim group so they stay full brightness in picotJoin mode */}
              {currentTool === 'picotJoin' && elements.map(el => {
                const jpDragTransform = (selectedIds.includes(el.id) && dragOffsetRef.current.active)
                  ? `translate(${dragOffsetRef.current.dx}, ${dragOffsetRef.current.dy})` : undefined;
                return <g key={`jp-overlay-${el.id}`} transform={jpDragTransform}>{renderPicots(el, true)}</g>;
              })}
              {/* In picotJoin mode: full-size transparent rect to catch stray clicks */}
              {currentTool === 'picotJoin' && (
                <rect x="-5000" y="-5000" width="10000" height="10000" fill="transparent" style={{ pointerEvents: 'none' }} />
              )}
              {/* Beading mode: BE picots rendered at full brightness */}
              {currentTool === 'beading' && elements.map(el => {
                const beDragTransform = (selectedIds.includes(el.id) && dragOffsetRef.current.active)
                  ? `translate(${dragOffsetRef.current.dx}, ${dragOffsetRef.current.dy})` : undefined;
                return <g key={`be-overlay-${el.id}`} transform={beDragTransform}>{renderPicots(el, true)}</g>;
              })}
              {/* NEW: Path edit handles - show when in path mode with a chain selected */}
              {currentTool === 'path' && selectedIds.length === 1 && (() => {
                const chain = (() => { const _e = elementById.get(selectedIds[0]); return _e?.type === 'chain' ? _e : undefined; })();
                if (!chain || !chain.paths || chain.paths.length === 0) return null;
                const path = chain.paths[0];
                
                if (path.type === 'cubic') {
                  // Cubic bezier - show 2 control points
                  return (
                    <>
                      {/* Start point - green */}
                      <circle cx={path.x} cy={path.y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.x} cy={path.y} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* End point - green */}
                      <circle cx={path.endX} cy={path.endY} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.endX} cy={path.endY} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Control point 1 - blue */}
                      <circle cx={path.control1X} cy={path.control1Y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.control1X} cy={path.control1Y} r={12/zoom} fill={theme.handleControl1} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Control point 2 - cyan */}
                      <circle cx={path.control2X} cy={path.control2Y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.control2X} cy={path.control2Y} r={12/zoom} fill={theme.handleControl2} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Helper lines */}
                      <line x1={path.x} y1={path.y} x2={path.control1X} y2={path.control1Y} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                      <line x1={path.control2X} y1={path.control2Y} x2={path.endX} y2={path.endY} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                    </>
                  );
                } else {
                  // Quadratic bezier - show 1 control point (legacy support)
                  return (
                    <>
                      {/* Start point - green */}
                      <circle cx={path.x} cy={path.y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.x} cy={path.y} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* End point - green */}
                      <circle cx={path.endX} cy={path.endY} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.endX} cy={path.endY} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Control point - blue */}
                      <circle cx={path.controlX} cy={path.controlY} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.controlX} cy={path.controlY} r={12/zoom} fill={theme.handleControl1} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Helper lines */}
                      <line x1={path.x} y1={path.y} x2={path.controlX} y2={path.controlY} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                      <line x1={path.endX} y1={path.endY} x2={path.controlX} y2={path.controlY} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                    </>
                  );
                }
              })()}
              
              {/* Line tool handles - show control points for editing */}
              {currentTool === 'line' && selectedIds.length === 1 && (() => {
                const line = (() => { const _e = elementById.get(selectedIds[0]); return _e?.type === 'line' ? _e : undefined; })();
                if (!line || !line.paths || line.paths.length === 0) return null;
                const path = line.paths[0];
                
                if (path.type === 'cubic') {
                  return (
                    <>
                      {/* Start point - green */}
                      <circle cx={path.x} cy={path.y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.x} cy={path.y} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* End point - green */}
                      <circle cx={path.endX} cy={path.endY} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.endX} cy={path.endY} r={12/zoom} fill={theme.handleStart} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Control point 1 - blue */}
                      <circle cx={path.control1X} cy={path.control1Y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.control1X} cy={path.control1Y} r={12/zoom} fill={theme.handleControl1} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Control point 2 - cyan */}
                      <circle cx={path.control2X} cy={path.control2Y} r={22/zoom} fill="transparent" stroke="none" style={{ cursor: 'move' }} />
                      <circle cx={path.control2X} cy={path.control2Y} r={12/zoom} fill={theme.handleControl2} stroke={theme.handleStroke} strokeWidth={2/zoom} style={{ cursor: 'move' }} />
                      
                      {/* Helper lines */}
                      <line x1={path.x} y1={path.y} x2={path.control1X} y2={path.control1Y} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                      <line x1={path.control2X} y1={path.control2Y} x2={path.endX} y2={path.endY} stroke="#888" strokeWidth="1" strokeDasharray="3,3" />
                    </>
                  );
                }
                return null;
              })()}

              {/* Snap point indicators - hidden in realistic mode, dimmed in picotJoin mode */}
              {snapEnabled && renderMode !== 'realistic' && (() => {
                // Show snap points for all non-selected elements
                return elements
                  .filter(el => !selectedIds.includes(el.id))
                  .map(el => {
                    const points = getSnapPoints(el);
                    return points.map((point, i) => (
                      <g key={`snap-${el.id}-${i}`} opacity={(currentTool === 'picotJoin' || currentTool === 'beading') ? 0.15 : 1}>
                        {/* Outer circle for visibility - fixed screen size */}
                        <circle 
                          cx={point.x} 
                          cy={point.y} 
                          r={10/zoom} 
                          fill={`rgba(${parseInt(theme.snapOuter.slice(1,3),16)},${parseInt(theme.snapOuter.slice(3,5),16)},${parseInt(theme.snapOuter.slice(5,7),16)},0.2)`} 
                          stroke={theme.snapOuter} 
                          strokeWidth={2/zoom}
                        />
                        {/* Inner dot - fixed screen size */}
                        <circle 
                          cx={point.x} 
                          cy={point.y} 
                          r={3.75/zoom} 
                          fill={theme.snapInner}
                        />
                      </g>
                    ));
                  });
              })()}

              {selectionBox && (
                <rect
                  x={Math.min(selectionBox.x, selectionBox.x + selectionBox.width)}
                  y={Math.min(selectionBox.y, selectionBox.y + selectionBox.height)}
                  width={Math.abs(selectionBox.width)}
                  height={Math.abs(selectionBox.height)}
                  fill="rgba(59, 130, 246, 0.1)"
                  stroke="#3B82F6"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              )}

              {/* Bounding box with rotation handles and pivot */}
              {(() => {
                if (currentTool !== 'select' || selectedIds.length === 0) return null;
                const bbox = getBoundingBox(selectedIds);
                if (!bbox) return null;
                
                const pivotX = bbox.centerX + pivotOffset.x;
                const pivotY = bbox.centerY + pivotOffset.y;
                
                // Show rotation handles when Shift is held OR manual toggle is on (for mobile)
                const shouldShowRotationHandles = isShiftHeld || showRotationHandles;
                
                return (
                  <>
                    {/* Bounding box */}
                    <rect
                      x={bbox.x}
                      y={bbox.y}
                      width={bbox.width}
                      height={bbox.height}
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="1"
                      strokeDasharray="5,5"
                    />
                    
                    {/* Rotation handles at corners - show when Shift is held OR toggle is on */}
                    {shouldShowRotationHandles && (
                      <>
                        <circle cx={bbox.x} cy={bbox.y} r="8" fill="#3B82F6" stroke="#FFF" strokeWidth="2" className="cursor-grab" />
                        <circle cx={bbox.x + bbox.width} cy={bbox.y} r="8" fill="#3B82F6" stroke="#FFF" strokeWidth="2" className="cursor-grab" />
                        <circle cx={bbox.x + bbox.width} cy={bbox.y + bbox.height} r="8" fill="#3B82F6" stroke="#FFF" strokeWidth="2" className="cursor-grab" />
                        <circle cx={bbox.x} cy={bbox.y + bbox.height} r="8" fill="#3B82F6" stroke="#FFF" strokeWidth="2" className="cursor-grab" />
                      </>
                    )}
                    
                    {/* Pivot point (orange with crosshairs) - show when Shift is held OR toggle is on */}
                    {shouldShowRotationHandles && (
                      <>
                        <circle 
                          cx={pivotX} 
                          cy={pivotY} 
                          r="6" 
                          fill="#FF8C00" 
                          stroke="#FFF"
                          strokeWidth="2"
                          className="cursor-move"
                        />
                        <line 
                          x1={pivotX - 10} 
                          y1={pivotY} 
                          x2={pivotX + 10} 
                          y2={pivotY} 
                          stroke="#FFF"
                          strokeWidth="2"
                        />
                        <line 
                          x1={pivotX} 
                          y1={pivotY - 10} 
                          x2={pivotX} 
                          y2={pivotY + 10} 
                          stroke="#FFF"
                          strokeWidth="2"
                        />
                      </>
                    )}
                  </>
                );
              })()}
            </g>
          </svg>
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4" onClick={() => setShowHelp(false)}>
          <div
            className="bg-gray-800 rounded-lg w-full max-w-full md:max-w-3xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ height: window.innerWidth <= 768 ? '92vh' : '82vh', maxHeight: '92vh' }}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-3 md:p-4 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-white text-lg md:text-xl font-bold">Help</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open('./tatting-help.html', '_blank')}
                  className="text-xs px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded"
                  title="Open help in a new browser tab"
                >↗ Open in browser</button>
                <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
              </div>
            </div>
            {/* Help content — loaded from tatting-help.html */}
            <iframe
              src="./tatting-help.html"
              className="flex-1 w-full rounded-b-lg"
              style={{ border: 'none', minHeight: 0 }}
              title="Tatting Pattern Designer Help"
            />
          </div>
        </div>
      )}


      {showColorPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{zIndex:10002}}>
          <div className="bg-gray-800 rounded-lg flex flex-col" style={{
            width: '100%',
            maxWidth: '28rem',
            height: 'min(92vh, 610px)',
          }}>
            {/* ── Header: tabs (flex-shrink-0) ── */}
            <div className="px-6 pt-4 pb-0 flex-shrink-0 border-b border-gray-700">
            <div className="flex gap-2">
              <button
                onClick={() => setColorPickerTab('picker')}
                className={`px-4 py-2 text-sm font-medium ${
                  colorPickerTab === 'picker'
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Color Picker
              </button>
              <button
                onClick={() => setColorPickerTab('swatches')}
                className={`px-4 py-2 text-sm font-medium ${
                  colorPickerTab === 'swatches'
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                DMC Colors
              </button>
              <button
                onClick={() => setColorPickerTab('gradients')}
                className={`px-4 py-2 text-sm font-medium ${
                  colorPickerTab === 'gradients'
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Gradients
              </button>
            </div>
            </div>{/* end header */}

            {/* ── Body: scrollable tab content (flex-1) ── */}
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
            
            {/* Color Picker Tab - iOS-style Grid */}
            {colorPickerTab === 'picker' && (
              <>
                {/* Saturation/Brightness Grid */}
                <div className="mb-3 relative">
                  <div 
                    className="w-full h-36 sm:h-48 rounded-lg cursor-crosshair border-2 border-gray-600"
                    style={{
                      background: `
                        linear-gradient(to top, black, transparent),
                        linear-gradient(to right, white, hsl(${(() => {
                          // Extract hue from current color
                          const hex = pickerColor.replace('#', '');
                          const r = parseInt(hex.substr(0, 2), 16) / 255;
                          const g = parseInt(hex.substr(2, 2), 16) / 255;
                          const b = parseInt(hex.substr(4, 2), 16) / 255;
                          const max = Math.max(r, g, b);
                          const min = Math.min(r, g, b);
                          const delta = max - min;
                          let h = 0;
                          if (delta !== 0) {
                            if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
                            else if (max === g) h = ((b - r) / delta + 2) / 6;
                            else h = ((r - g) / delta + 4) / 6;
                          }
                          return Math.round(h * 360);
                        })()}, 100%, 50%))
                      `,
                      touchAction: 'none'
                    }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = (e.clientX - rect.left) / rect.width;
                      const y = 1 - (e.clientY - rect.top) / rect.height;
                      
                      // Get current hue
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      const delta = max - min;
                      let h = 0;
                      if (delta !== 0) {
                        if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
                        else if (max === g) h = ((b - r) / delta + 2) / 6;
                        else h = ((r - g) / delta + 4) / 6;
                      }
                      
                      // Convert HSV to RGB
                      const s = x;
                      const v = y;
                      const c = v * s;
                      const hPrime = h * 6;
                      const x2 = c * (1 - Math.abs((hPrime % 2) - 1));
                      const m = v - c;
                      
                      let rNew, gNew, bNew;
                      if (hPrime < 1) { rNew = c; gNew = x2; bNew = 0; }
                      else if (hPrime < 2) { rNew = x2; gNew = c; bNew = 0; }
                      else if (hPrime < 3) { rNew = 0; gNew = c; bNew = x2; }
                      else if (hPrime < 4) { rNew = 0; gNew = x2; bNew = c; }
                      else if (hPrime < 5) { rNew = x2; gNew = 0; bNew = c; }
                      else { rNew = c; gNew = 0; bNew = x2; }
                      
                      const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
                      setPickerColor(`#${toHex(rNew)}${toHex(gNew)}${toHex(bNew)}`);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault(); // prevent scroll/zoom while picking
                      const touch = e.touches[0];
                      const rect = e.currentTarget.getBoundingClientRect();
                      // Clamp to [0,1] so touches outside the element don't sample wrong colors
                      const x = Math.min(1, Math.max(0, (touch.clientX - rect.left) / rect.width));
                      const y = Math.min(1, Math.max(0, 1 - (touch.clientY - rect.top) / rect.height));
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min;
                      let h = 0;
                      if (delta !== 0) {
                        if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
                        else if (max === g) h = ((b - r) / delta + 2) / 6;
                        else h = ((r - g) / delta + 4) / 6;
                      }
                      const s = x; const v = y; const c = v * s;
                      const hPrime = h * 6; const x2 = c * (1 - Math.abs((hPrime % 2) - 1)); const m = v - c;
                      let rNew, gNew, bNew;
                      if (hPrime < 1) { rNew = c; gNew = x2; bNew = 0; }
                      else if (hPrime < 2) { rNew = x2; gNew = c; bNew = 0; }
                      else if (hPrime < 3) { rNew = 0; gNew = c; bNew = x2; }
                      else if (hPrime < 4) { rNew = 0; gNew = x2; bNew = c; }
                      else if (hPrime < 5) { rNew = x2; gNew = 0; bNew = c; }
                      else { rNew = c; gNew = 0; bNew = x2; }
                      const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
                      setPickerColor(`#${toHex(rNew)}${toHex(gNew)}${toHex(bNew)}`);
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault(); // prevent scroll while dragging
                      const touch = e.touches[0];
                      const rect = e.currentTarget.getBoundingClientRect();
                      // Clamp: dragging outside the box still samples edge color, not random
                      const x = Math.min(1, Math.max(0, (touch.clientX - rect.left) / rect.width));
                      const y = Math.min(1, Math.max(0, 1 - (touch.clientY - rect.top) / rect.height));
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min;
                      let h = 0;
                      if (delta !== 0) {
                        if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
                        else if (max === g) h = ((b - r) / delta + 2) / 6;
                        else h = ((r - g) / delta + 4) / 6;
                      }
                      const s = x; const v = y; const c = v * s;
                      const hPrime = h * 6; const x2 = c * (1 - Math.abs((hPrime % 2) - 1)); const m = v - c;
                      let rNew, gNew, bNew;
                      if (hPrime < 1) { rNew = c; gNew = x2; bNew = 0; }
                      else if (hPrime < 2) { rNew = x2; gNew = c; bNew = 0; }
                      else if (hPrime < 3) { rNew = 0; gNew = c; bNew = x2; }
                      else if (hPrime < 4) { rNew = 0; gNew = x2; bNew = c; }
                      else if (hPrime < 5) { rNew = x2; gNew = 0; bNew = c; }
                      else { rNew = c; gNew = 0; bNew = x2; }
                      const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
                      setPickerColor(`#${toHex(rNew)}${toHex(gNew)}${toHex(bNew)}`);
                    }}
                  >
                    {/* Color indicator dot */}
                    {(() => {
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      const s = max === 0 ? 0 : (max - min) / max;
                      const v = max;
                      return (
                        <div 
                          className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg pointer-events-none"
                          style={{
                            left: `${s * 100}%`,
                            top: `${(1 - v) * 100}%`,
                            transform: 'translate(-50%, -50%)',
                            boxShadow: '0 0 0 1px black, 0 2px 4px rgba(0,0,0,0.3)'
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
                
                {/* Hue Slider */}
                <div className="mb-3 relative">
                  <style>{`
                    .hue-slider::-webkit-slider-thumb {
                      appearance: none;
                      width: 24px;
                      height: 24px;
                      border-radius: 50%;
                      background: white;
                      border: 3px solid white;
                      box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2);
                      cursor: pointer;
                    }
                    .hue-slider::-moz-range-thumb {
                      width: 24px;
                      height: 24px;
                      border-radius: 50%;
                      background: white;
                      border: 3px solid white;
                      box-shadow: 0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.2);
                      cursor: pointer;
                    }
                  `}</style>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    className="hue-slider w-full h-4 sm:h-8 rounded-lg cursor-pointer"
                    value={(() => {
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      const delta = max - min;
                      let h = 0;
                      if (delta !== 0) {
                        if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
                        else if (max === g) h = ((b - r) / delta + 2) / 6;
                        else h = ((r - g) / delta + 4) / 6;
                      }
                      return Math.round(h * 360);
                    })()}
                    onChange={(e) => {
                      const h = parseInt(e.target.value) / 360;
                      
                      // Get current saturation and value
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      const s = max === 0 ? 0 : (max - min) / max;
                      const v = max;
                      
                      // Convert HSV to RGB
                      const c = v * s;
                      const hPrime = h * 6;
                      const x = c * (1 - Math.abs((hPrime % 2) - 1));
                      const m = v - c;
                      
                      let rNew, gNew, bNew;
                      if (hPrime < 1) { rNew = c; gNew = x; bNew = 0; }
                      else if (hPrime < 2) { rNew = x; gNew = c; bNew = 0; }
                      else if (hPrime < 3) { rNew = 0; gNew = c; bNew = x; }
                      else if (hPrime < 4) { rNew = 0; gNew = x; bNew = c; }
                      else if (hPrime < 5) { rNew = x; gNew = 0; bNew = c; }
                      else { rNew = c; gNew = 0; bNew = x; }
                      
                      const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
                      setPickerColor(`#${toHex(rNew)}${toHex(gNew)}${toHex(bNew)}`);
                    }}
                    onInput={(e) => {
                      // Same logic as onChange - ensures touch events work
                      const h = parseInt(e.target.value) / 360;
                      
                      const hex = pickerColor.replace('#', '');
                      const r = parseInt(hex.substr(0, 2), 16) / 255;
                      const g = parseInt(hex.substr(2, 2), 16) / 255;
                      const b = parseInt(hex.substr(4, 2), 16) / 255;
                      const max = Math.max(r, g, b);
                      const min = Math.min(r, g, b);
                      const s = max === 0 ? 0 : (max - min) / max;
                      const v = max;
                      
                      const c = v * s;
                      const hPrime = h * 6;
                      const x = c * (1 - Math.abs((hPrime % 2) - 1));
                      const m = v - c;
                      
                      let rNew, gNew, bNew;
                      if (hPrime < 1) { rNew = c; gNew = x; bNew = 0; }
                      else if (hPrime < 2) { rNew = x; gNew = c; bNew = 0; }
                      else if (hPrime < 3) { rNew = 0; gNew = c; bNew = x; }
                      else if (hPrime < 4) { rNew = 0; gNew = x; bNew = c; }
                      else if (hPrime < 5) { rNew = x; gNew = 0; bNew = c; }
                      else { rNew = c; gNew = 0; bNew = x; }
                      
                      const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
                      setPickerColor(`#${toHex(rNew)}${toHex(gNew)}${toHex(bNew)}`);
                    }}
                    style={{
                      background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                      touchAction: 'manipulation'
                    }}
                  />
                </div>
                
                {/* Base color swatches */}
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {[...COLORS, ...customColors].map((color, i) => (
                    <div
                      key={i}
                      onClick={() => setPickerColor(color)}
                      className="rounded cursor-pointer border-2 border-gray-600 hover:border-white"
                      style={{ backgroundColor: color, width: '100%', paddingBottom: '100%', position: 'relative' }}
                      title={color}
                    />
                  ))}
                </div>

                {/* Hex Input */}
                <input 
                  type="text" 
                  value={pickerColor} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      setPickerColor(val);
                    }
                  }} 
                  className="px-3 py-2 bg-gray-700 text-white rounded w-full mb-2 uppercase font-mono text-center" 
                  placeholder="#FFFFFF"
                  maxLength={7}
                />
              </>
            )}
            
            {/* Swatches Tab - DMC Colors */}
            {colorPickerTab === 'swatches' && (
              <div>
                {dmcColors.length === 0 ? (
                  <div className="bg-gray-700 rounded p-6 text-center">
                    <p className="text-gray-400">Loading DMC colors...</p>
                  </div>
                ) : (
                  <>
                    {/* Search field */}
                    <div className="mb-3">
                      <input
                        type="text"
                        placeholder={t('colorSearchPlaceholder')}
                        value={dmcSearchTerm}
                        onChange={(e) => {
                          setDmcSearchTerm(e.target.value);
                          setDmcPage(0); // Reset to first page on search
                        }}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                      />
                    </div>
                    
                    {/* Category tabs - derived dynamically from loaded JSON groups */}
                    {(() => {
                      const solidColors = dmcColors.filter(c => c.type !== 'gradient');
                      const groups = ['all', ...Array.from(new Set(solidColors.map(c => c.group).filter(Boolean))).sort()];
                      return (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {groups.map(cat => (
                            <button
                              key={cat}
                              onClick={() => {
                                setDmcCategory(cat);
                                setDmcPage(0);
                                setDmcSearchTerm('');
                              }}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                dmcCategory === cat
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {cat === 'all' ? 'All' : cat}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    
                    {(() => {
                      // Filter colors with category support
                      const filteredColors = dmcColors.filter(color => {
                        // NEVER show gradients in the solid color picker
                        if (color.type === 'gradient') return false;
                        
                        // Search filter
                        if (dmcSearchTerm) {
                          const search = dmcSearchTerm.toLowerCase();
                          if (!color.id.toLowerCase().includes(search) && 
                              !color.name.toLowerCase().includes(search)) {
                            return false;
                          }
                        }
                        
                        // Category filter - use group field directly, fall back to categorizeColor
                        if (dmcCategory !== 'all') {
                          const colorGroup = color.group || categorizeColor(color);
                          return colorGroup === dmcCategory;
                        }
                        
                        return true;
                      });
                      
                      // Pagination
                      const colorsPerPage = 18;
                      const totalPages = Math.ceil(filteredColors.length / colorsPerPage);
                      const startIdx = dmcPage * colorsPerPage;
                      const endIdx = startIdx + colorsPerPage;
                      const pageColors = filteredColors.slice(startIdx, endIdx);
                      
                      return (
                        <>
                          {/* Color grid - fixed height, swatches maintain size */}
                          <div className="grid grid-cols-6 gap-2 p-2 bg-gray-700 rounded mb-3" style={{ height: '164px', alignContent: 'start' }}>
                            {pageColors.map((color) => (
                              <div
                                key={color.id}
                                onClick={() => {
                                  setSelectedDmcColor(color);
                                  // For gradients, extract first color
                                  if (color.type === 'gradient' && color.stops) {
                                    if (typeof color.stops === 'string') {
                                      const firstStop = color.stops.split(',')[0];
                                      const firstColor = firstStop.split(':')[1];
                                      setPickerColor(firstColor);
                                    } else if (Array.isArray(color.stops) && color.stops.length > 0) {
                                      setPickerColor(color.stops[0].color);
                                    }
                                  } else {
                                    setPickerColor(color.hex);
                                  }
                                }}
                                className={`cursor-pointer rounded overflow-hidden transition-all h-11 ${
                                  selectedDmcColor?.id === color.id
                                    ? 'ring-4 ring-blue-500'
                                    : 'hover:ring-2 hover:ring-gray-400'
                                }`}
                                title={color.name}
                                style={{ touchAction: 'manipulation' }}
                              >
                                <div
                                  className="w-full h-full flex items-center justify-center border-2 border-black relative"
                                  style={{ 
                                    background: color.type === 'gradient' 
                                      ? 'transparent'
                                      : color.hex 
                                  }}
                                >
                                  {color.type === 'gradient' && (
                                    <>
                                      <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} preserveAspectRatio="none">
                                        <defs>
                                          <linearGradient id={`swatch-gradient-${color.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                            {(() => {
                                              let stops = color.stops;
                                              if (typeof color.stops === 'string') {
                                                stops = color.stops.split(',').map(stop => {
                                                  const [offset, colorHex] = stop.split(':');
                                                  return { offset: `${offset}%`, color: colorHex };
                                                });
                                              }
                                              return stops.map((stop, i) => (
                                                <stop key={i} offset={stop.offset} stopColor={stop.color} />
                                              ));
                                            })()}
                                          </linearGradient>
                                        </defs>
                                        <rect x="0" y="0" width="100%" height="100%" fill={`url(#swatch-gradient-${color.id})`} />
                                      </svg>
                                    </>
                                  )}
                                  <span 
                                    className="text-white font-bold text-xs px-1 py-0.5 rounded"
                                    style={{ 
                                      textShadow: '0 0 3px black, 0 0 5px black',
                                      backgroundColor: 'rgba(0,0,0,0.3)',
                                      position: 'relative',
                                      zIndex: 1
                                    }}
                                  >
                                    {color.id}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Pagination controls - always visible */}
                          <div className="flex items-center justify-center gap-2 mb-3">
                            <button
                              onClick={() => setDmcPage(Math.max(0, dmcPage - 1))}
                              disabled={dmcPage === 0}
                              className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-600 disabled:hover:bg-gray-700"
                            >
                              ← Prev
                            </button>
                            
                            <span className="text-gray-400 text-sm">
                              Page {dmcPage + 1} of {Math.max(1, totalPages)} ({filteredColors.length} colors)
                            </span>
                            
                            <button
                              onClick={() => setDmcPage(Math.min(totalPages - 1, dmcPage + 1))}
                              disabled={dmcPage >= totalPages - 1}
                              className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-600 disabled:hover:bg-gray-700"
                            >
                              Next →
                            </button>
                          </div>
                          
                          {/* Color preview section - under the grid */}
                          <div className="bg-gray-700 rounded p-3 border-2 border-gray-600">
                            <div className="flex items-center gap-3 h-16">
                              <div
                                className="w-16 h-16 rounded border-2 border-black flex-shrink-0 relative overflow-hidden"
                                style={{ backgroundColor: selectedDmcColor ? (selectedDmcColor.type === 'gradient' ? 'transparent' : selectedDmcColor.hex) : '#374151' }}
                              >
                                {selectedDmcColor?.type === 'gradient' && (
                                  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} preserveAspectRatio="none">
                                    <defs>
                                      <linearGradient id={`preview-gradient-${selectedDmcColor.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                        {(() => {
                                          let stops = selectedDmcColor.stops;
                                          if (typeof selectedDmcColor.stops === 'string') {
                                            stops = selectedDmcColor.stops.split(',').map(stop => {
                                              const [offset, colorHex] = stop.split(':');
                                              return { offset: `${offset}%`, color: colorHex };
                                            });
                                          }
                                          return stops.map((stop, i) => (
                                            <stop key={i} offset={stop.offset} stopColor={stop.color} />
                                          ));
                                        })()}
                                      </linearGradient>
                                    </defs>
                                    <rect x="0" y="0" width="100%" height="100%" fill={`url(#preview-gradient-${selectedDmcColor.id})`} />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {selectedDmcColor ? (
                                  <>
                                    <p className="text-white font-bold text-base mb-1">
                                      {selectedDmcColor.name}
                                    </p>
                                    <p className="text-gray-300 font-mono text-xs">
                                      ID: {selectedDmcColor.id} · {selectedDmcColor.type === 'gradient' ? 'Variegated' : selectedDmcColor.hex}
                                    </p>

                                  </>
                                ) : (
                                  <p className="text-gray-400 text-sm">
                                    Click a color swatch to preview
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {colorPickerTab === 'gradients' && (
              <div>
                {/* Search bar */}
                <input
                  type="text"
                  placeholder="Search gradients by name or ID..."
                  value={gradientSearchTerm}
                  onChange={(e) => { setGradientSearchTerm(e.target.value); setGradientPage(0); }}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                {/* Thread line filter */}
                {(() => {
                  const allGradients = dmcColors.filter(c => c.type === 'gradient');
                  const threadLines = ['all', ...Array.from(new Set(allGradients.map(c => c.group).filter(Boolean)))];
                  return (
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {threadLines.map(line => (
                        <button
                          key={line}
                          onClick={() => { setGradientCategory(line); setGradientPage(0); }}
                          className={`px-3 py-1 rounded text-xs ${gradientCategory === line ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                        >
                          {line === 'all' ? 'All' : line}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {/* Grid + pagination */}
                {(() => {
                  const allGradients = dmcColors.filter(c => c.type === 'gradient');
                  const filtered = allGradients.filter(color => {
                    if (gradientSearchTerm) {
                      const s = gradientSearchTerm.toLowerCase();
                      if (!color.id.toLowerCase().includes(s) && !color.name.toLowerCase().includes(s)) return false;
                    }
                    if (gradientCategory !== 'all') return color.group === gradientCategory;
                    return true;
                  });
                  const perPage = 24;
                  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
                  const pageItems = filtered.slice(gradientPage * perPage, (gradientPage + 1) * perPage);
                  return (
                    <>
                      <div className="grid grid-cols-6 gap-2 p-2 bg-gray-700 rounded mb-2" style={{ height: '216px', alignContent: 'start' }}>
                        {pageItems.map((color) => (
                          <div
                            key={color.id}
                            onClick={() => setSelectedGradient(color)}
                            className={`cursor-pointer rounded overflow-hidden transition-all h-11 ${selectedGradient?.id === color.id ? 'ring-4 ring-blue-500' : 'hover:ring-2 hover:ring-gray-400'}`}
                            title={color.name}
                          >
                            <div className="w-full h-full relative border-2 border-black">
                              <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id={`cpicker-gradient-${color.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                    {(() => {
                                      let stops = color.stops;
                                      if (typeof color.stops === 'string') {
                                        stops = color.stops.split(',').map(stop => {
                                          const [offset, colorHex] = stop.split(':');
                                          return { offset: `${offset}%`, color: colorHex };
                                        });
                                      }
                                      return stops.map((stop, i) => <stop key={i} offset={stop.offset} stopColor={stop.color} />);
                                    })()}
                                  </linearGradient>
                                </defs>
                                <rect x="0" y="0" width="100%" height="100%" fill={`url(#cpicker-gradient-${color.id})`} />
                              </svg>
                              <span className="text-white font-bold text-xs px-1 py-0.5 rounded" style={{ textShadow: '0 0 3px black', backgroundColor: 'rgba(0,0,0,0.3)', position: 'relative', zIndex: 1 }}>
                                {color.id}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-center gap-2 mb-3" style={{ height: '2rem' }}>
                        <button onClick={() => setGradientPage(p => Math.max(0, p - 1))} disabled={gradientPage === 0} className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 hover:bg-gray-600">← Prev</button>
                        <span className="text-gray-400 text-sm">Page {gradientPage + 1} of {totalPages} ({filtered.length})</span>
                        <button onClick={() => setGradientPage(p => Math.min(totalPages - 1, p + 1))} disabled={gradientPage >= totalPages - 1} className="px-3 py-1 bg-gray-700 text-white rounded text-sm disabled:opacity-30 hover:bg-gray-600">Next →</button>
                      </div>
                      {/* Preview */}
                      <div className="bg-gray-700 rounded p-3 border-2 border-gray-600">
                        <div className="flex items-center gap-3 h-16">
                          <div className="w-16 h-16 rounded border-2 border-black flex-shrink-0 relative overflow-hidden" style={{ backgroundColor: selectedGradient ? 'transparent' : '#374151' }}>
                            {selectedGradient && (
                              <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id={`cpicker-preview-${selectedGradient.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                    {(() => {
                                      let stops = selectedGradient.stops;
                                      if (typeof selectedGradient.stops === 'string') {
                                        stops = selectedGradient.stops.split(',').map(stop => {
                                          const [offset, colorHex] = stop.split(':');
                                          return { offset: `${offset}%`, color: colorHex };
                                        });
                                      }
                                      return stops.map((stop, i) => <stop key={i} offset={stop.offset} stopColor={stop.color} />);
                                    })()}
                                  </linearGradient>
                                </defs>
                                <rect x="0" y="0" width="100%" height="100%" fill={`url(#cpicker-preview-${selectedGradient.id})`} />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {selectedGradient ? (
                              <>
                                <p className="text-white font-bold text-base mb-1">{selectedGradient.name}</p>
                                <p className="text-gray-300 font-mono text-xs mb-2">ID: {selectedGradient.id} · {selectedGradient.group || 'Gradient'}</p>
                              </>
                            ) : (
                              <p className="text-gray-400 text-sm">Click a gradient to preview</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            
            </div>{/* end body */}

            {/* ── Footer: OK/Cancel (flex-shrink-0) ── */}
            <div className="px-6 pb-4 pt-3 flex-shrink-0 border-t border-gray-700">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (colorPickerTab === 'gradients' && selectedGradient && pickerGradientCallback) {
                    pickerGradientCallback(selectedGradient.id);
                    setPickerGradientCallback(null);
                    setPickerCallback(null);
                    setSelectedGradient(null);
                  } else if (pickerCallback) {
                    // Called from bead settings or other non-swatch context
                    pickerCallback(pickerColor);
                    setPickerCallback(null);
                  } else {
                    const oldColor = allColors[editingColorIndex];
                    if (editingColorIndex >= COLORS.length) {
                      const customIndex = editingColorIndex - COLORS.length;
                      const newCustom = [...customColors];
                      newCustom[customIndex] = pickerColor;
                      setCustomColors(newCustom);
                    } else {
                      setCustomColors([...customColors, pickerColor]);
                    }
                    if (oldColor) {
                      setElements(prev => prev.map(e => e.color === oldColor ? { ...e, color: pickerColor } : e));
                    }
                  }
                  setShowColorPicker(false);
                  setColorPickerTab('picker');
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                OK
              </button>
              <button
                onClick={() => {
                  setPickerCallback(null);
                  setShowColorPicker(false);
                  setColorPickerTab('picker');
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
            </div>{/* end footer */}
          </div>
        </div>
      )}
      

      {/* Save Dialog Modal */}
      {/* New Canvas Confirmation Dialog */}
      {/* Join Picots Mode Tip */}
      {showJoinTip && currentTool === 'picotJoin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 2147483647 }}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-blue-500 shadow-2xl">
            <h2 className="text-lg font-bold text-blue-400 mb-3">Picot Join Mode</h2>
            <div className="text-gray-200 text-sm space-y-2 mb-5">
              <p>You are now in <strong className="text-white">Picot Join mode</strong>. Elements are dimmed so you can focus on the join points.</p>
              <p>Click a <strong className="text-orange-400">joint picot</strong> (orange dot) to select it, then click another to connect them. Click a connected pair to disconnect.</p>
              <p>Press <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">Esc</kbd> or click the Join Picots button again to exit.</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-gray-400 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) localStorage.setItem('tcad_seen_join_tip', '1');
                    else localStorage.removeItem('tcad_seen_join_tip');
                  }}
                  className="w-4 h-4"
                />
                Don't show again
              </label>
              <button
                onClick={() => setShowJoinTip(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
                autoFocus
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewCanvasDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4" style={{ zIndex: 2147483647 }}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-600 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">New Canvas</h2>
            <p className="text-gray-300 text-sm mb-5">This will discard all current work. Make sure to save first if you want to keep it.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewCanvasDialog(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                autoFocus
              >
                Cancel
              </button>
              <button
                onClick={confirmNewCanvas}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
              >
                Discard &amp; New
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4" style={{ zIndex: 2147483647 }}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-600 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">Load Project</h2>
            <p className="text-gray-300 text-sm mb-5">This will replace the current canvas. Make sure to save first if you want to keep it.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLoadConfirmDialog(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
                autoFocus
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLoadConfirmDialog(false);
                  loadInputRef.current?.click();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
              >
                Discard &amp; Load
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">{t('saveDialogTitle')}</h2>
            <label className="block text-gray-300 text-sm mb-2">{t('saveDialogLabel')}</label>
            <input
              type="text"
              value={saveDialogName}
              onChange={(e) => setSaveDialogName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') performSave();
                if (e.key === 'Escape') setShowSaveDialog(false);
              }}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none mb-4"
              placeholder={t('saveDialogPlaceholder')}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded"
              >
                {t('saveDialogCancel')}
              </button>
              <button
                onClick={performSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                {t('saveDialogSave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer Modal - Shows on startup */}
      {showDisclaimer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-3">
          <div className="bg-gray-800 rounded-lg max-w-sm w-full border-2 border-yellow-500 flex flex-col"
            style={{ padding: '16px' }}>
            <h2 className="text-lg font-bold text-yellow-400 mb-1 text-center">{t('disclaimerTitle')}</h2>
            <p className="text-center text-gray-400 text-xs mb-3">{t('disclaimerVersion')}</p>
            <div className="text-gray-200 space-y-1 mb-4 leading-snug text-sm">
              <p>{t('disclaimerBody2')}</p>
              <p className="text-red-300 font-semibold">{t('disclaimerBody3')}</p>
              <p>{t('disclaimerBody4')}</p>
              <p className="text-gray-400 text-xs text-center mt-2">{t('disclaimerCopyright')}</p>
            </div>
            {/* Don't show again checkbox */}
            <label className="flex items-center gap-2 mb-3 cursor-pointer text-gray-300 text-sm select-none">
              <input
                type="checkbox"
                id="disclaimer-skip"
                className="w-4 h-4 accent-blue-500"
                onChange={(e) => {
                  if (e.target.checked) {
                    localStorage.setItem('tcad_seen_version', APP_VERSION);
                  } else {
                    localStorage.removeItem('tcad_seen_version');
                  }
                }}
              />
              {t('disclaimerDontShow')}
            </label>
            <button
              onClick={() => setShowDisclaimer(false)}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-semibold text-sm"
              style={{ minHeight: '44px', touchAction: 'manipulation' }}
            >
              {t('disclaimerContinue')}
            </button>
          </div>
        </div>
      )}
    </div>
    
    {/* File dropdown menu - rendered at top level to avoid clipping */}
    {showFileMenu && (
      <>
        {/* Click overlay to close menu - allows clicks through to dropdown */}
        <div 
          className="fixed inset-0"
          style={{ zIndex: 9998, pointerEvents: 'auto' }}
          onClick={() => setShowFileMenu(false)}
        ></div>
        
        {/* Dropdown menu - extremely high z-index to be above everything */}
        <div 
          className="fixed bg-gray-700 rounded shadow-xl min-w-[200px] max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          style={(() => {
            const rect = fileButtonRef.current?.getBoundingClientRect();
            const menuWidth = 200;
            const spaceRight = rect ? window.innerWidth - rect.left : 0;
            return {
              zIndex: 9999,
              top: rect ? `${rect.bottom + 4}px` : '4rem',
              ...(rect && spaceRight < menuWidth
                ? { right: `${window.innerWidth - rect.right}px` }
                : { left: rect ? `${rect.left}px` : '1rem' }),
              pointerEvents: 'auto',
            };
          })()}
        >
          <button
            onClick={() => {
              newCanvas();
              setShowFileMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <IconNew size={16} />
            <span>{t('fileNew')}</span>
            <span className="ml-auto text-xs text-gray-400">Ctrl+N</span>
          </button>
          <div className="border-t border-gray-600 my-1"></div>
          <button
            onClick={() => {
              saveProject();
              setShowFileMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <IconSave size={16} />
            <span>{t('fileSave')}</span>
            <span className="ml-auto text-xs text-gray-400">Ctrl+S</span>
          </button>
          <button
            onClick={() => {
              setShowFileMenu(false);
              if (elements.length > 0) {
                setShowLoadConfirmDialog(true);
              } else {
                loadInputRef.current?.click();
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <IconLoad size={16} />
            <span>{t('fileLoad')}</span>
          </button>
          <div className="border-t border-gray-600 my-1"></div>
          <button
            onClick={() => {
              exportSVG();
              setShowFileMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
            title={t('fileExportSvgTitle')}
          >
            <IconExport size={16} />
            <span>{t('fileExportSvg')}</span>
            <span className="ml-auto text-xs text-gray-400">→ PNG</span>
          </button>
          <button
            onClick={() => {
              generatePattern();
              setShowFileMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <IconDownload size={16} />
            <span>{t('fileOutputNotation')}</span>
          </button>
        </div>
      </>
    )}
    
    {/* Arrange dropdown menu - rendered at top level to avoid clipping */}
    {showArrangeMenu && (
      <>
        {/* Click overlay to close menu */}
        <div 
          className="fixed inset-0"
          style={{ zIndex: 9998, pointerEvents: 'auto' }}
          onClick={() => setShowArrangeMenu(false)}
        ></div>
        
        {/* Dropdown menu */}
        <div 
          className="fixed bg-gray-700 rounded shadow-xl min-w-[220px] max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          style={(() => {
            const rect = arrangeButtonRef.current?.getBoundingClientRect();
            const menuWidth = 220;
            const spaceRight = rect ? window.innerWidth - rect.left : 0;
            return {
              zIndex: 9999,
              top: rect ? `${rect.bottom + 4}px` : '4rem',
              ...(rect && spaceRight < menuWidth
                ? { right: `${window.innerWidth - rect.right}px` }
                : { left: rect ? `${rect.left}px` : '1rem' }),
              pointerEvents: 'auto',
            };
          })()}
        >
          {/* Duplicate */}
          <button
            onClick={() => {
              duplicateInPlace();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white ${
              selectedIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length === 0}
          >
            <IconCopy size={16} />
            <span>{t('arrangeDuplicate')}</span>
            <span className="ml-auto text-xs text-gray-400">D</span>
          </button>
          
          <div className="border-t border-gray-600 my-1"></div>
          
          {/* Alignment options */}
          <div className="px-3 py-1 text-xs text-gray-400 font-semibold">{t('arrangeAlignHeader')}</div>
          
          <button
            onClick={() => {
              alignLeft();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignLeft size={16} />
            <span>{t('arrangeAlignLeft')}</span>
          </button>
          
          <button
            onClick={() => {
              alignCenterHorizontal();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignCenter size={16} />
            <span>{t('arrangeAlignCenterH')}</span>
          </button>
          
          <button
            onClick={() => {
              alignRight();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignRight size={16} />
            <span>{t('arrangeAlignRight')}</span>
          </button>
          
          <div className="border-t border-gray-600 my-1"></div>
          
          <button
            onClick={() => {
              alignTop();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignTop size={16} />
            <span>{t('arrangeAlignTop')}</span>
          </button>
          
          <button
            onClick={() => {
              alignCenterVertical();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignMiddle size={16} />
            <span>{t('arrangeAlignCenterV')}</span>
          </button>
          
          <button
            onClick={() => {
              alignBottom();
              setShowArrangeMenu(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white ${
              selectedIds.length < 2 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={selectedIds.length < 2}
          >
            <IconAlignBottom size={16} />
            <span>{t('arrangeAlignBottom')}</span>
          </button>
        </div>
      </>
    )}
    

    {/* View dropdown menu - rendered at top level to avoid clipping */}
    {showViewMenu && (
      <>
        {/* Click overlay to close menu */}
        <div
          className="fixed inset-0"
          style={{ zIndex: 9998, pointerEvents: 'auto' }}
          onClick={() => setShowViewMenu(false)}
        ></div>

        {/* Dropdown menu */}
        <div
          className="fixed bg-gray-700 rounded shadow-xl min-w-[200px]"
          onClick={(e) => e.stopPropagation()}
          style={(() => {
            const rect = viewButtonRef.current?.getBoundingClientRect();
            const menuWidth = 200;
            const spaceRight = rect ? window.innerWidth - rect.left : 0;
            return {
              zIndex: 9999,
              top: rect ? `${rect.bottom + 4}px` : '4rem',
              ...(rect && spaceRight < menuWidth
                ? { right: `${window.innerWidth - rect.right}px` }
                : { left: rect ? `${rect.left}px` : '1rem' }),
              pointerEvents: 'auto',
            };
          })()}
        >
          {/* Realistic / Schematic toggle */}
          <button
            onClick={() => {
              setRenderMode(prev => {
                const next = prev === 'schematic' ? 'realistic' : 'schematic';
                if (next === 'realistic') setCurrentTool('pan');
                return next;
              });
              setShowViewMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <IconEyeOn size={16} />
            <span>{renderMode === 'schematic' ? 'Switch to Realistic' : 'Switch to Schematic'}</span>
            <span className="ml-auto text-xs text-gray-400">{renderMode === 'realistic' ? '✓ Realistic' : 'Schematic'}</span>
          </button>

          <div className="border-t border-gray-600 my-1"></div>

          {/* Show Unnumbered */}
          <button
            onClick={() => {
              setShowUnnumbered(!showUnnumbered);
              setShowViewMenu(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <IconEyeOn size={16} />
            <span>{t('fileShowUnnumbered')}</span>
            {showUnnumbered && <span className="ml-auto text-blue-400">✓</span>}
          </button>

          <div className="border-t border-gray-600 my-1"></div>

          {/* Background Color */}
          <button
            onClick={() => {
              setBgColor(BG_COLORS[(BG_COLORS.indexOf(bgColor) + 1) % BG_COLORS.length]);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <div className="w-4 h-4 rounded border border-gray-500" style={{ backgroundColor: bgColor }}></div>
            <span>{t('optionsBgColor')}</span>
          </button>

          {/* Grid Toggle */}
          <button
            onClick={() => {
              setGridEnabled(!gridEnabled);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <IconGridOn size={16} />
            <span>{t('optionsGrid')}</span>
            {gridEnabled && <span className="ml-auto text-blue-400">✓</span>}
          </button>
        </div>
      </>
    )}

    {/* Options dropdown menu - rendered at top level to avoid clipping */}
    {showOptionsMenu && (
      <>
        {/* Click overlay to close menu */}
        <div 
          className="fixed inset-0"
          style={{ zIndex: 9998, pointerEvents: 'auto' }}
          onClick={() => setShowOptionsMenu(false)}
        ></div>
        
        {/* Dropdown menu */}
        <div 
          className="fixed bg-gray-700 rounded shadow-xl min-w-[200px] max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          style={(() => {
            const rect = optionsButtonRef.current?.getBoundingClientRect();
            const menuWidth = 200;
            const spaceRight = rect ? window.innerWidth - rect.left : 0;
            return {
              zIndex: 9999,
              top: rect ? `${rect.bottom + 4}px` : '4rem',
              ...(rect && spaceRight < menuWidth
                ? { right: `${window.innerWidth - rect.right}px` }
                : { left: rect ? `${rect.left}px` : '1rem' }),
              pointerEvents: 'auto',
            };
          })()}
        >
          {/* Materials Manager */}
          <button
            onClick={() => { setShowMaterialsPanel(true); setShowOptionsMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <div className="w-4 h-4 rounded-full border-2 border-gray-400 flex items-center justify-center" style={{background:'linear-gradient(135deg,#fff 50%,#aaa 50%)'}}/> 
            <span>Materials…</span>
          </button>

          {/* Thread Properties */}
          <button
            onClick={() => { setShowThreadProperties(true); setShowOptionsMenu(false); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <IconBeadCore size={16} />
            <span>Thread Properties…</span>
          </button>

          {/* Notation Font Size */}
          <div className="px-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-white" style={{fontSize:'13px'}}>A</span>
              <span className="text-white text-sm">{t('optionsNotationSize')}</span>
            </div>
            <div className="flex gap-1">
              {(['small', 'medium', 'large']).map(size => (
                <button
                  key={size}
                  onClick={() => setNotationFontSize(size)}
                  className={`flex-1 py-1 rounded text-xs font-medium ${
                    notationFontSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {size === 'small' ? t('optionsSizeSmall') : size === 'medium' ? t('optionsSizeMedium') : t('optionsSizeLarge')}
                </button>
              ))}
            </div>
          </div>
          {/* UI Scale */}
          <div className="px-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">⬜</span>
              <span className="text-white text-sm">UI Scale</span>
            </div>
            <div className="flex gap-1">
              {(['normal', 'large'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setUiScale(s)}
                  className={`flex-1 py-1 rounded text-xs font-medium ${
                    uiScale === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {s === 'normal' ? 'Normal' : 'Large'}
                </button>
              ))}
            </div>
          </div>

          {/* Snap Toggle */}
          <button
            onClick={() => {
              setSnapEnabled(!snapEnabled);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <IconSnapOn size={16} />
            <span>{t('optionsSnap')}</span>
            {snapEnabled && <span className="ml-auto text-blue-400">✓</span>}
          </button>

          <div className="border-t border-gray-600 my-1"></div>

          {/* Bead Sizes */}
          <div className="px-4 py-2">
            <div className="flex items-center gap-2 mb-2">
              <IconBeadCore size={16} />
              <span className="text-white text-sm font-medium">Bead Sizes</span>
            </div>
            {['Y', 'Z', 'V'].map(key => (
              <div key={key} className="flex items-center gap-2 mb-2">
                {/* Color swatch — opens the shared color picker */}
                <div
                  className="w-5 h-5 rounded-full border-2 border-gray-500 cursor-pointer hover:border-white flex-shrink-0"
                  style={{ backgroundColor: beadSettings[key].color }}
                  title="Click to change bead color"
                  onClick={() => {
                    setPickerColor(beadSettings[key].color);
                    setColorPickerTab('picker');
                    setPickerCallback(() => (color) => {
                      setBeadSettings(prev => ({ ...prev, [key]: { ...prev[key], color } }));
                    });
                    setShowOptionsMenu(false);
                    setShowColorPicker(true);
                  }}
                />
                {/* Label */}
                <span className="text-white text-xs font-bold w-4">{key}</span>
                {/* DS multiplier input */}
                <input
                  type="number"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={beadSettings[key].dsMultiplier}
                  onChange={e => setBeadSettings(prev => ({
                    ...prev,
                    [key]: { ...prev[key], dsMultiplier: parseFloat(e.target.value) || 1 }
                  }))}
                  className="w-16 px-2 py-0.5 bg-gray-600 text-white text-xs rounded border border-gray-500 text-center"
                />
                <span className="text-gray-400 text-xs">ds</span>
                <span className="text-gray-500 text-xs ml-auto">≈{Math.round(dsWidth * beadSettings[key].dsMultiplier)}px</span>
              </div>
            ))}
          </div>

          {/* Language — only show if more than one language is available */}
          {Object.keys(availableLanguages).length > 1 && (
            <>
              <div className="border-t border-gray-600 my-1"></div>
              <div className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <IconLanguage size={16} />
                  <span className="text-white text-sm">{t('languagePickerLabel')}</span>
                </div>
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    localStorage.setItem('tcad_language', e.target.value);
                  }}
                  className="mt-1 w-full bg-gray-600 text-white text-sm rounded px-2 py-1 border border-gray-500"
                  style={{ cursor: 'pointer' }}
                >
                  {Object.entries(availableLanguages).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {/* Theme */}
          <div className="border-t border-gray-600 my-1"></div>
          <button
            onClick={() => { setShowOptionsMenu(false); themeInputRef.current?.click(); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <IconLoad size={16} />
            <span>Load Theme…</span>
          </button>
          <button
            onClick={() => { setTheme(DEFAULT_THEME); setShowOptionsMenu(false); showLoadMsg('success', 'Theme reset to default.'); }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-600 text-left text-white"
          >
            <span className="text-base">↩️</span>
            <span>Reset Theme</span>
          </button>
          <div className="px-4 py-1 pb-2">
            <p className="text-gray-500 text-xs">Edit indicator colors via <code className="bg-gray-600 px-1 rounded">tatting-theme.json</code> — see Help → Tips for details.</p>
          </div>

        </div>
      </>
    )}
    {/* ── Materials Manager Panel ─────────────────────────────── */}
    {showMaterialsPanel && (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-60" style={{zIndex:10000}} onClick={() => setShowMaterialsPanel(false)} />
        <div className="fixed bg-gray-800 rounded-xl shadow-2xl border border-gray-600"
          style={{zIndex:10001, top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'min(420px, 95vw)', maxHeight:'85dvh', overflowY:'auto'}}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-600">
            <h2 className="text-white font-bold text-lg">Materials</h2>
            <button onClick={() => setShowMaterialsPanel(false)} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
          </div>

          <div className="px-5 py-4 space-y-3">
            {materials.map((mat, idx) => (
              <div key={mat.id} className="flex flex-wrap items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
                {/* Color swatch / picker trigger */}
                <div
                  className="w-8 h-8 rounded border-2 border-gray-500 cursor-pointer flex-shrink-0 hover:border-white relative overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: mat.isGradient ? getGradientColorAtPosition(mat.color, 0.5) : mat.color }}
                  title="Click to change color"
                  onClick={() => {
                    setPickerColor(mat.isGradient ? '#FFFFFF' : mat.color);
                    setColorPickerTab('picker');
                    setShowColorPicker(true);
                    setPickerCallback(() => (color) => {
                      setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, color, isGradient: false } : m));
                    });
                    setPickerGradientCallback(() => (gradientId) => {
                      setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, color: gradientId, isGradient: true } : m));
                    });
                  }}
                >
                  {mat.isGradient && <span style={{ fontSize:'11px', fontWeight:'bold', color:'white', textShadow:'0 0 3px black,0 0 3px black', lineHeight:1, pointerEvents:'none' }}>G</span>}
                </div>

                {/* Name input */}
                <input
                  type="text"
                  value={mat.name}
                  disabled={mat.id === 'default'}
                  onChange={(e) => setMaterials(prev => prev.map((m, i) => i === idx ? { ...m, name: e.target.value } : m))}
                  className="flex-1 min-w-0 bg-gray-600 text-white px-2 py-1 rounded text-sm border border-gray-500 disabled:opacity-50"
                  style={{minWidth:'80px'}}
                />

                {/* Count badge */}
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {elements.filter(el => (el.materialId || 'default') === mat.id || (el.isSplitRing && (el.materialIdB || el.materialId || 'default') === mat.id)).length}×
                </span>

                {/* Select all */}
                <button
                  onClick={() => {
                    const ids = elements.filter(el => (el.materialId || 'default') === mat.id || (el.isSplitRing && (el.materialIdB || el.materialId || 'default') === mat.id)).map(el => el.id);
                    setSelectedIds(ids);
                    setShowMaterialsPanel(false);
                  }}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded flex-shrink-0"
                  title="Select all elements with this material"
                >
                  Select all
                </button>

                {/* Delete (not for default) */}
                {mat.id !== 'default' && (
                  <button
                    onClick={() => {
                      setMaterials(prev => prev.filter((_, i) => i !== idx));
                      setElements(prev => prev.map(el => el.materialId === mat.id ? { ...el, materialId: 'default' } : el));
                    }}
                    className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded flex-shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {/* Add material */}
            {materials.length < 10 && (
              <button
                onClick={() => {
                  const id = `mat_${Date.now()}`;
                  setMaterials(prev => [...prev, { id, name: `Material ${prev.length}`, color: '#AAAAAA', isGradient: false }]);
                  if (selectedIds.length > 0) {
                    setElements(prev => prev.map(el =>
                      selectedIds.includes(el.id) ? { ...el, materialId: id } : el
                    ));
                  }
                }}
                className="w-full py-2 rounded-lg border-2 border-dashed border-gray-500 text-gray-400 hover:border-white hover:text-white text-sm"
              >
                + Add Material
              </button>
            )}
          </div>

          <div className="px-5 pb-4">
            <p className="text-xs text-gray-500">Click a color swatch to change color. All elements with that material update instantly.</p>
          </div>
        </div>
      </>
    )}

    {/* ── Thread Properties Panel ─────────────────────────────── */}
    {showThreadProperties && (() => {
      const activePreset = threadPresets.find(p => p.id === activePresetId) || threadPresets[0] || { ...DEFAULT_THREAD_PRESET };
      const updatePreset = (id, changes) => {
        setThreadPresets(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
        localStorage.setItem('tcad_thread_presets', JSON.stringify(
          threadPresets.map(p => p.id === id ? { ...p, ...changes } : p)
        ));
      };
      const selectPreset = (id) => {
        setActivePresetId(id);
        localStorage.setItem('tcad_active_preset_id', id);
      };
      const addPreset = () => {
        const newId = 'preset_' + Date.now();
        const newPreset = { ...DEFAULT_THREAD_PRESET, id: newId, name: 'New Preset' };
        const updated = [...threadPresets, newPreset];
        setThreadPresets(updated);
        setActivePresetId(newId);
        localStorage.setItem('tcad_thread_presets', JSON.stringify(updated));
        localStorage.setItem('tcad_active_preset_id', newId);
      };
      const deletePreset = (id) => {
        if (threadPresets.length <= 1) return;
        const updated = threadPresets.filter(p => p.id !== id);
        setThreadPresets(updated);
        const newActive = updated[0].id;
        setActivePresetId(newActive);
        localStorage.setItem('tcad_thread_presets', JSON.stringify(updated));
        localStorage.setItem('tcad_active_preset_id', newActive);
      };

      return (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-50" style={{ zIndex: 2147483640 }} onClick={() => setShowThreadProperties(false)} />
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483641 }}>
            <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-600 pointer-events-auto flex flex-col sm:flex-row"
              style={{ width: 'min(700px, 95vw)', maxHeight: '85vh', overflowY: 'auto' }}>

              {/* Left: Preset list */}
              <div className="sm:w-48 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-gray-600 flex flex-col" style={{ minWidth: 0 }}>
                <div className="px-3 py-3 border-b border-gray-600">
                  <span className="text-white font-semibold text-sm">🧵 Thread Presets</span>
                </div>
                <div className="flex-1 overflow-y-auto sm:overflow-y-auto overflow-x-auto sm:overflow-x-hidden flex sm:flex-col flex-row">
                  {threadPresets.map(p => (
                    <button key={p.id}
                      onClick={() => selectPreset(p.id)}
                      className={`w-full text-left px-3 py-2 text-sm truncate ${p.id === activePresetId ? 'bg-blue-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                    >{p.id === activePresetId ? '▶ ' : ''}{p.name}</button>
                  ))}
                </div>
                <div className="p-2 border-t border-gray-600 flex gap-1">
                  <button onClick={addPreset}
                    className="flex-1 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-white">+ Add</button>
                  {threadPresets.length > 1 && (
                    <button onClick={() => deletePreset(activePresetId)}
                      className="flex-1 py-1 rounded text-xs bg-red-800 hover:bg-red-700 text-white">Delete</button>
                  )}
                </div>
              </div>

              {/* Right: Edit form */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600">
                  <input
                    className="bg-transparent text-white font-semibold text-base border-b border-transparent hover:border-gray-400 focus:border-blue-400 outline-none"
                    value={activePreset.name}
                    onChange={e => updatePreset(activePreset.id, { name: e.target.value })}
                    placeholder="Preset name"
                  />
                  <button onClick={() => setShowThreadProperties(false)}
                    className="text-gray-400 hover:text-white text-xl ml-4">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">

                  {/* Core measurements */}
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Measurements</div>
                  <ThreadPropertiesNumInput label="20 DS working thread" value={activePreset.ds20Working}
                    onChange={v => updatePreset(activePreset.id, { ds20Working: v })} />
                  <ThreadPropertiesNumInput label="20 DS core thread" value={activePreset.ds20Core}
                    onChange={v => updatePreset(activePreset.id, { ds20Core: v })} />

                  <div className="border-t border-gray-600 my-3" />

                  {/* Picot lengths */}
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Picot Lengths</div>
                  <ThreadPropertiesNumInput label="Regular picot" value={activePreset.picotRegular}
                    onChange={v => updatePreset(activePreset.id, { picotRegular: v })} />
                  <ThreadPropertiesNumInput label="Long picot (auto: 2×)" value={activePreset.picotRegular * 2} readOnly hint="= 2 × regular" />
                  <ThreadPropertiesNumInput label="Short picot (auto: ½×)" value={activePreset.picotShort ?? activePreset.picotRegular * 0.5} readOnly hint={activePreset.picotShort ? "= from sample" : "= ½ × regular"} />
                  <ThreadPropertiesNumInput label="Joined picot" value={activePreset.picotJoined}
                    onChange={v => updatePreset(activePreset.id, { picotJoined: v })} />

                  <div className="border-t border-gray-600 my-3" />

                  {/* Alternative calculation */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Alternative Calculation</div>
                    <span className="text-xs bg-yellow-700 text-yellow-200 px-1.5 py-0.5 rounded font-medium">Alternative</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-3 leading-relaxed">
                    Measure a test sample of 20 DS + 10 picots. Enter total length used.
                    Picot size = (sample − {activePreset.ds20Working} mm) ÷ 10, using your "20 DS working" value above.
                  </div>

                  {/* Alternative sample inputs */}
                  <ThreadPropertiesNumInput
                    label="20 DS + 10 regular picots sample"
                    value={activePreset.sample20DS10Regular ?? ''}
                    onChange={v => {
                      const picotR = Math.round((v - activePreset.ds20Working) / 10 * 10) / 10;
                      updatePreset(activePreset.id, { sample20DS10Regular: v, picotRegular: picotR > 0 ? picotR : activePreset.picotRegular });
                    }}
                    hint={activePreset.sample20DS10Regular ? `→ regular picot = ${Math.round((activePreset.sample20DS10Regular - activePreset.ds20Working) / 10 * 10) / 10} mm` : 'optional'}
                  />
                  <ThreadPropertiesNumInput
                    label="20 DS + 10 short picots sample"
                    value={activePreset.sample20DS10Short ?? ''}
                    onChange={v => {
                      const picotSh = Math.round((v - activePreset.ds20Working) / 10 * 10) / 10;
                      updatePreset(activePreset.id, { sample20DS10Short: v, picotShort: picotSh > 0 ? picotSh : undefined });
                    }}
                    hint={activePreset.sample20DS10Short ? `→ short picot = ${Math.round((activePreset.sample20DS10Short - activePreset.ds20Working) / 10 * 10) / 10} mm` : 'optional'}
                  />

                  <div className="border-t border-gray-600 my-3" />

                  {/* Calculated summary */}
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Per-Stitch Summary</div>
                  <div className="bg-gray-700 rounded p-3 text-xs text-gray-300 space-y-1 font-mono">
                    <div>Working per DS = {(activePreset.ds20Working / 20).toFixed(2)} mm</div>
                    <div>Working per SS = {(activePreset.ds20Working / 40).toFixed(2)} mm</div>
                    <div>Core per DS   = {(activePreset.ds20Core / 20).toFixed(2)} mm</div>
                    <div className="pt-1 border-t border-gray-600">Regular picot = {activePreset.picotRegular} mm</div>
                    <div>Long picot    = {(activePreset.picotRegular * 2).toFixed(1)} mm</div>
                    <div>Short picot   = {(activePreset.picotShort ?? activePreset.picotRegular * 0.5).toFixed(1)} mm{activePreset.picotShort ? ' (from sample)' : ' (½× regular)'}</div>
                    <div>Joined picot  = {activePreset.picotJoined} mm</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      );
    })()}

    </>
  );
};

export default TattingDesigner;
