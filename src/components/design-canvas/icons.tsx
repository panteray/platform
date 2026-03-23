// Design Canvas — SVG Icon Registry
// Ported from CASDEX — 25 device SVGs (64x64, stroke #000 for Fabric.js tinting)
// Exports:
//   DEVICE_SVG_STRINGS — raw SVG strings for Fabric.js loadSVGFromString()
//   CATEGORY_TO_ICON — map device sub-type to SVG key
//   SidebarIcons — JSX elements for icon tab bar (20x20)
//   ToolbarIcons — JSX elements for toolbar (16x16)
//   ActionIcons — JSX elements for action buttons (16x16)

import React from 'react'

// ---- Device SVG strings for Fabric.js canvas rendering ----
// Stroke uses #000 which gets replaced with device color_hex at render time
export const DEVICE_SVG_STRINGS: Record<string, string> = {
  dome_camera: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><path d="M16 38 A16 16 0 0 1 48 38" stroke="#000" stroke-width="2.5"/><line x1="14" y1="38" x2="50" y2="38" stroke="#000" stroke-width="2.5"/><circle cx="32" cy="34" r="4" stroke="#000" stroke-width="2" fill="none"/></svg>`,

  bullet_camera: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="12" y="22" width="32" height="20" rx="4" stroke="#000" stroke-width="2.5"/><circle cx="36" cy="32" r="5" stroke="#000" stroke-width="2" fill="none"/><circle cx="36" cy="32" r="2" fill="#000"/></svg>`,

  turret_camera: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><path d="M16 36 Q16 16 32 12 Q48 16 48 36 Z" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="32" cy="28" r="5" stroke="#000" stroke-width="2" fill="none"/><circle cx="32" cy="28" r="2" fill="#000"/></svg>`,

  ptz_camera: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="30" r="16" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="32" cy="30" r="6" stroke="#000" stroke-width="2" fill="none"/><circle cx="32" cy="30" r="2.5" fill="#000"/><rect x="26" y="48" width="12" height="4" rx="2" stroke="#000" stroke-width="2" fill="none"/></svg>`,

  fisheye_camera: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="20" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="32" cy="32" r="8" stroke="#000" stroke-width="2" fill="none"/><circle cx="32" cy="32" r="3" fill="#000"/></svg>`,

  multisensor_quad: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="20" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="24" cy="24" r="3" fill="#000"/><circle cx="40" cy="24" r="3" fill="#000"/><circle cx="24" cy="40" r="3" fill="#000"/><circle cx="40" cy="40" r="3" fill="#000"/></svg>`,

  multisensor_dual: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><ellipse cx="32" cy="32" rx="22" ry="14" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="22" cy="32" r="3" fill="#000"/><circle cx="42" cy="32" r="3" fill="#000"/></svg>`,

  switch: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="8" y="18" width="48" height="28" rx="4" stroke="#000" stroke-width="2.5" fill="none"/><rect x="12" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="17" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="22" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="27" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="32" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="37" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="42" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="47" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><circle cx="16" cy="39" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="22" cy="39" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/></svg>`,

  access_switch: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="8" y="18" width="48" height="28" rx="4" stroke="#000" stroke-width="2.5" fill="none"/><rect x="12" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="17" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="22" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="27" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="32" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="37" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="42" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><rect x="47" y="26" width="3" height="7" rx="0.7" stroke="#000" stroke-width="1.2" fill="none"/><circle cx="16" cy="39" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="22" cy="39" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><path d="M44 40 h8" stroke="#000" stroke-width="1.7"/><path d="M48 36 v8" stroke="#000" stroke-width="1.7"/></svg>`,

  rack: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="18" y="8" width="28" height="48" rx="2" stroke="#000" stroke-width="2.5" fill="none"/><line x1="24" y1="8" x2="24" y2="56" stroke="#000" stroke-width="1.7"/><line x1="40" y1="8" x2="40" y2="56" stroke="#000" stroke-width="1.7"/><line x1="24" y1="16" x2="40" y2="16" stroke="#000" stroke-width="1.7"/><line x1="24" y1="24" x2="40" y2="24" stroke="#000" stroke-width="1.7"/><line x1="24" y1="32" x2="40" y2="32" stroke="#000" stroke-width="1.7"/><line x1="24" y1="40" x2="40" y2="40" stroke="#000" stroke-width="1.7"/><line x1="24" y1="48" x2="40" y2="48" stroke="#000" stroke-width="1.7"/></svg>`,

  nvr: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="10" y="18" width="44" height="24" rx="4" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="18" cy="30" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="22" cy="30" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><path d="M28 26 H46" stroke="#000" stroke-width="1.7"/><path d="M28 34 H40" stroke="#000" stroke-width="1.7"/><circle cx="48" cy="34" r="2.2" stroke="#000" stroke-width="1.7" fill="none"/></svg>`,

  door: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="18" y="8" width="28" height="48" rx="1" stroke="#000" stroke-width="2.5" fill="none"/><line x1="24" y1="8" x2="24" y2="56" stroke="#000" stroke-width="1.7"/><circle cx="39" cy="32" r="1.8" stroke="#000" stroke-width="1.7" fill="none"/></svg>`,

  door_controller: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="10" y="8" width="44" height="48" rx="4" stroke="#000" stroke-width="2.5" fill="none"/><rect x="16" y="14" width="20" height="10" rx="2" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="44" cy="19" r="3" stroke="#000" stroke-width="1.7" fill="none"/><line x1="16" y1="30" x2="48" y2="30" stroke="#000" stroke-width="1.7"/><line x1="16" y1="36" x2="48" y2="36" stroke="#000" stroke-width="1.7"/><line x1="16" y1="42" x2="48" y2="42" stroke="#000" stroke-width="1.7"/><line x1="16" y1="48" x2="48" y2="48" stroke="#000" stroke-width="1.7"/></svg>`,

  card_reader: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="20" y="8" width="24" height="48" rx="5" stroke="#000" stroke-width="2.5" fill="none"/><path d="M26 18 H38" stroke="#000" stroke-width="1.7"/><path d="M26 24 H38" stroke="#000" stroke-width="1.7"/><circle cx="32" cy="40" r="7" stroke="#000" stroke-width="1.7" fill="none"/><path d="M29 40 L31 42 L35 37" stroke="#000" stroke-width="1.7"/></svg>`,

  electric_strike: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="20" y="10" width="24" height="44" rx="3" stroke="#000" stroke-width="2.5" fill="none"/><path d="M30 16 H38 Q42 16 42 20 V30 Q42 34 38 34 H30" stroke="#000" stroke-width="2.5" fill="none"/><line x1="26" y1="16" x2="26" y2="48" stroke="#000" stroke-width="1.7"/><circle cx="24" cy="18" r="1.5" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="24" cy="46" r="1.5" stroke="#000" stroke-width="1.7" fill="none"/></svg>`,

  maglock: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="10" y="22" width="28" height="12" rx="2" stroke="#000" stroke-width="2.5" fill="none"/><rect x="40" y="20" width="14" height="16" rx="2" stroke="#000" stroke-width="2.5" fill="none"/><line x1="38" y1="28" x2="40" y2="28" stroke="#000" stroke-width="2.5"/><line x1="14" y1="28" x2="34" y2="28" stroke="#000" stroke-width="1.7"/></svg>`,

  router_gateway: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="10" y="24" width="44" height="18" rx="4" stroke="#000" stroke-width="2.5" fill="none"/><path d="M20 24 L24 14 H40 L44 24" stroke="#000" stroke-width="2.5" fill="none"/><path d="M26 33 H38" stroke="#000" stroke-width="1.7"/><circle cx="20" cy="33" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="44" cy="33" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/></svg>`,

  firewall: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="12" y="12" width="40" height="40" rx="4" stroke="#000" stroke-width="2.5" fill="none"/><path d="M24 12 V52" stroke="#000" stroke-width="1.7"/><path d="M40 12 V52" stroke="#000" stroke-width="1.7"/><path d="M12 24 H52" stroke="#000" stroke-width="1.7"/><path d="M12 40 H52" stroke="#000" stroke-width="1.7"/><path d="M28 20 L20 32 L28 44" stroke="#000" stroke-width="1.7" fill="none"/><path d="M36 20 L44 32 L36 44" stroke="#000" stroke-width="1.7" fill="none"/></svg>`,

  wireless_ap: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="18" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="32" cy="32" r="4" stroke="#000" stroke-width="1.7" fill="none"/><path d="M22 32 A10 10 0 0 1 42 32" stroke="#000" stroke-width="1.7" fill="none"/><path d="M18 32 A14 14 0 0 1 46 32" stroke="#000" stroke-width="1.7" fill="none"/><path d="M14 32 A18 18 0 0 1 50 32" stroke="#000" stroke-width="1.7" fill="none"/></svg>`,

  bridge_ptp: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><circle cx="18" cy="32" r="8" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="46" cy="32" r="8" stroke="#000" stroke-width="2.5" fill="none"/><line x1="26" y1="32" x2="38" y2="32" stroke="#000" stroke-width="2.5"/><path d="M24 24 Q32 18 40 24" stroke="#000" stroke-width="1.7" fill="none"/><path d="M24 40 Q32 46 40 40" stroke="#000" stroke-width="1.7" fill="none"/></svg>`,

  server: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="12" y="10" width="40" height="14" rx="2" stroke="#000" stroke-width="2.5" fill="none"/><rect x="12" y="26" width="40" height="14" rx="2" stroke="#000" stroke-width="2.5" fill="none"/><rect x="12" y="42" width="40" height="12" rx="2" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="18" cy="17" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="22" cy="17" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><line x1="28" y1="17" x2="46" y2="17" stroke="#000" stroke-width="1.7"/><circle cx="18" cy="33" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="22" cy="33" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><line x1="28" y1="33" x2="46" y2="33" stroke="#000" stroke-width="1.7"/><circle cx="18" cy="48" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="22" cy="48" r="1.2" stroke="#000" stroke-width="1.7" fill="none"/><line x1="28" y1="48" x2="46" y2="48" stroke="#000" stroke-width="1.7"/></svg>`,

  monitor: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="12" y="12" width="40" height="28" rx="3" stroke="#000" stroke-width="2.5" fill="none"/><line x1="26" y1="44" x2="38" y2="44" stroke="#000" stroke-width="2.5"/><line x1="32" y1="40" x2="32" y2="48" stroke="#000" stroke-width="2.5"/><line x1="22" y1="48" x2="42" y2="48" stroke="#000" stroke-width="2.5"/></svg>`,

  patch_panel: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="8" y="22" width="48" height="20" rx="2" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="14" cy="28" r="0.7" fill="#000"/><circle cx="18" cy="28" r="0.7" fill="#000"/><circle cx="22" cy="28" r="0.7" fill="#000"/><circle cx="26" cy="28" r="0.7" fill="#000"/><circle cx="30" cy="28" r="0.7" fill="#000"/><circle cx="34" cy="28" r="0.7" fill="#000"/><circle cx="38" cy="28" r="0.7" fill="#000"/><circle cx="42" cy="28" r="0.7" fill="#000"/><circle cx="46" cy="28" r="0.7" fill="#000"/><circle cx="50" cy="28" r="0.7" fill="#000"/><circle cx="14" cy="36" r="0.7" fill="#000"/><circle cx="18" cy="36" r="0.7" fill="#000"/><circle cx="22" cy="36" r="0.7" fill="#000"/><circle cx="26" cy="36" r="0.7" fill="#000"/><circle cx="30" cy="36" r="0.7" fill="#000"/><circle cx="34" cy="36" r="0.7" fill="#000"/><circle cx="38" cy="36" r="0.7" fill="#000"/><circle cx="42" cy="36" r="0.7" fill="#000"/><circle cx="46" cy="36" r="0.7" fill="#000"/><circle cx="50" cy="36" r="0.7" fill="#000"/></svg>`,

  horn_speaker: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><path d="M14 30 L28 22 L28 42 L14 34 Z" stroke="#000" stroke-width="2.5" fill="none"/><rect x="28" y="25" width="12" height="14" rx="2" stroke="#000" stroke-width="2.5" fill="none"/><line x1="40" y1="32" x2="48" y2="32" stroke="#000" stroke-width="2.5"/><path d="M50 26 Q56 32 50 38" stroke="#000" stroke-width="1.7" fill="none"/><path d="M53 22 Q62 32 53 42" stroke="#000" stroke-width="1.7" fill="none"/></svg>`,

  intercom: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="18" y="10" width="28" height="44" rx="4" stroke="#000" stroke-width="2.5" fill="none"/><line x1="24" y1="18" x2="40" y2="18" stroke="#000" stroke-width="1.7"/><line x1="24" y1="22" x2="40" y2="22" stroke="#000" stroke-width="1.7"/><line x1="24" y1="26" x2="40" y2="26" stroke="#000" stroke-width="1.7"/><circle cx="32" cy="36" r="6" stroke="#000" stroke-width="1.7" fill="none"/><rect x="26" y="46" width="12" height="4" rx="2" stroke="#000" stroke-width="1.7" fill="none"/></svg>`,

  junction_box: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="12" y="12" width="40" height="40" rx="4" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="18" cy="18" r="1.8" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="46" cy="18" r="1.8" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="18" cy="46" r="1.8" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="46" cy="46" r="1.8" stroke="#000" stroke-width="1.7" fill="none"/><circle cx="32" cy="32" r="7" stroke="#000" stroke-width="2.5" fill="none"/></svg>`,

  mount_ring: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="#000" stroke-width="1.2" fill="none"/><circle cx="32" cy="32" r="25.5" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="32" cy="32" r="19" stroke="#000" stroke-width="1.2" fill="none"/><circle cx="32" cy="32" r="16.5" stroke="#000" stroke-width="2.5" fill="none"/><circle cx="32" cy="32" r="7.5" stroke="#000" stroke-width="1.2" fill="none"/><circle cx="32" cy="32" r="5.5" stroke="#000" stroke-width="2.5" fill="none"/></svg>`,
}

// ---- Map device sub-type to SVG key ----
export const CATEGORY_TO_ICON: Record<string, string> = {
  dome: 'dome_camera',
  bullet: 'bullet_camera',
  turret: 'turret_camera',
  ptz: 'ptz_camera',
  fisheye: 'fisheye_camera',
  multisensor_quad: 'multisensor_quad',
  multisensor_dual: 'multisensor_dual',
  door: 'door',
  door_controller: 'door_controller',
  card_reader: 'card_reader',
  electric_strike: 'electric_strike',
  maglock: 'maglock',
  switch: 'switch',
  access_switch: 'access_switch',
  rack: 'rack',
  nvr: 'nvr',
  router: 'router_gateway',
  firewall: 'firewall',
  wireless_ap: 'wireless_ap',
  bridge: 'bridge_ptp',
  server: 'server',
  monitor: 'monitor',
  patch_panel: 'patch_panel',
  speaker: 'horn_speaker',
  intercom: 'intercom',
  junction_box: 'junction_box',
  mount_ring: 'mount_ring',
  // Fallback mappings for DeviceCategory enums
  cctv: 'dome_camera',
  access_control: 'door',
  network: 'switch',
  av: 'horn_speaker',
  vape_environmental: 'junction_box',
  other: 'junction_box',
}

// ---- Sidebar Icon JSX (20x20 for icon tab bar) ----
export const SidebarIcons: Record<string, React.JSX.Element> = {
  layers: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>,
  camera: <svg width="20" height="20" viewBox="0 0 64 64" fill="currentColor" style={{ fillRule: 'evenodd', clipRule: 'evenodd' }}><path d="M12.853,23.384c-1.04,-0.332 -3.315,-0.827 -5.158,0.404c-1.427,0.953 -2.714,2.987 -2.718,7.212l-0.977,0c-0.552,0 -1,0.448 -1,1l0,17c0,0.552 0.448,1 1,1l2,0c0.796,0 1.559,-0.316 2.121,-0.879c0.563,-0.562 0.879,-1.325 0.879,-2.121l-0,-3.5l4.5,-0c0.944,-0 1.788,-0.437 2.337,-1.12l11.2,-11.175l17.767,4.761c0.533,0.143 1.081,-0.174 1.224,-0.707l0.425,-1.584l3.477,0.931c1.601,0.429 3.246,-0.52 3.674,-2.121l1.117,-4.166l4.128,-3.846c0.534,-0.498 0.757,-1.247 0.58,-1.955c-0.176,-0.709 -0.723,-1.267 -1.429,-1.456l-42.995,-11.549c-0.512,-0.138 -1.058,-0.066 -1.518,0.199c-0.46,0.265 -0.795,0.702 -0.932,1.214l-2.475,9.234c-0.142,0.534 0.174,1.082 0.707,1.225l2.463,0.66l-0.397,1.339Z" /></svg>,
  door: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18" /><path d="M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" /><circle cx="14" cy="12" r="1" /></svg>,
  network: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="6" rx="1" /><rect x="16" y="16" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><path d="M12 8v4" /><path d="M5 16v-2a2 2 0 012-2h10a2 2 0 012 2v2" /></svg>,
  av: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5.5 3L7.5 9" /><path d="M9.5 3L7.5 9" /><path d="M6.2 7h2.6" /><path d="M13 3l2.5 6" /><path d="M18 3l-2.5 6" /><rect x="2" y="13" width="20" height="8" rx="2" /><rect x="4.5" y="15.5" width="15" height="3" rx="1" /><circle cx="7" cy="17" r="0.8" fill="currentColor" stroke="none" /><rect x="10" y="16" width="4" height="2" rx="0.5" fill="currentColor" stroke="none" /><circle cx="17" cy="17" r="0.8" fill="currentColor" stroke="none" /></svg>,
  sensors: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9.137a7.062 7.062 0 0 1 4.944 2.008l-.696.718a6.092 6.092 0 0 0-8.496 0l-.696-.718A7.062 7.062 0 0 1 12 9.137zm7.778-.815a11.012 11.012 0 0 0-15.556 0l.707.707a10.011 10.011 0 0 1 14.142 0zM1.394 5.494L2.1 6.2a14.017 14.017 0 0 1 19.798 0l.707-.707a15.016 15.016 0 0 0-21.212 0zM21 19.02V22H3v-2.98A3.024 3.024 0 0 1 6.02 16H9a3 3 0 0 1 6 0h2.98A3.024 3.024 0 0 1 21 19.02zm-1 0A2.022 2.022 0 0 0 17.98 17H6.02A2.022 2.022 0 0 0 4 19.02V21h16zM10 16h4a2 2 0 0 0-4 0z" /></svg>,
  other: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>,
}

// ---- Toolbar Icon JSX (16x16) ----
export const ToolbarIcons: Record<string, React.JSX.Element> = {
  select: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /></svg>,
  measure: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20M6 8v8M18 8v8M12 8v8" /></svg>,
  cable: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20L20 4" /><circle cx="4" cy="20" r="2" /><circle cx="20" cy="4" r="2" /></svg>,
  blocker: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 12h18" /></svg>,
  text: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>,
  dori: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
  zoomIn: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>,
  zoomOut: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>,
  fitView: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></svg>,
}

// ---- Action Icon JSX (14-16px) ----
export const ActionIcons: Record<string, React.JSX.Element> = {
  import: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  export: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  print: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>,
  save: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  close: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>,
  trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>,
  chevDown: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>,
  chevRight: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 6 15 12 9 18" /></svg>,
}

// ---- Per-device-type label codes (spec-compliant) ----
// Produces labels like CAM-D-001, ACS-DC-001, PTZ-001, etc.
export const LABEL_CODES: Record<string, string> = {
  // Category-level fallbacks
  cctv: 'CAM',
  access_control: 'ACS',
  network: 'NET',
  av: 'AV',
  vape_environmental: 'ENV',
  other: 'DEV',
  // CCTV sub-types
  dome: 'CAM-D',
  bullet: 'CAM-B',
  turret: 'CAM-T',
  ptz: 'PTZ',
  fisheye: 'CAM-F',
  multisensor_quad: 'MCAM-Q',
  multisensor_dual: 'MCAM-D',
  // Access control sub-types
  door: 'ACS-DR',
  door_controller: 'ACS-DC',
  card_reader: 'ACS-CR',
  electric_strike: 'ACS-ES',
  maglock: 'ACS-ML',
  rim_strike: 'ACS-RS',
  mortise_lock: 'ACS-MR',
  elr: 'ACS-ELR',
  intercom: 'ICOM',
  video_intercom: 'ICOM-V',
  audio_intercom: 'ICOM-A',
  // Network sub-types
  switch: 'SW',
  access_switch: 'SW',
  poe_switch: 'PSW',
  rack: 'RACK',
  nvr: 'NVR',
  router: 'RTR',
  firewall: 'FW',
  wireless_ap: 'WAP',
  bridge: 'PTP',
  server: 'SRV',
  patch_panel: 'PP',
  // AV sub-types
  monitor: 'MON',
  speaker: 'SPK',
  // Vape / Environmental
  vape_detector: 'VAPE',
  environmental_detector: 'ENV',
  // Misc
  junction_box: 'JB',
  mount_ring: 'MNT',
}

/** @deprecated Use LABEL_CODES instead */
export const LABEL_PREFIX = LABEL_CODES
