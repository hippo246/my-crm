/* eslint-disable */

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const today = () => new Date().toISOString().slice(0,10);

// Strict batch↔delivery product matching.
// Normalises to lowercase, strips trailing "pack", plural "s", and common
// suffixes so "Paratha Pack (5 pcs)" and "Paratha" both normalise to "paratha".
// Returns true ONLY when the core product name is the same — prevents
// "Paratha" from matching "Roti" or "Special Paratha" from matching "Paratha".
// ─────────────────────────────────────────────────────────────────────────────
//  SMART PRODUCT NAME MATCHING  (v2 — advanced fuzzy engine)
//  Normalises → exact → prefix → token-set → Levenshtein similarity
//  Returns true when two names refer to the same product with high confidence.
// ─────────────────────────────────────────────────────────────────────────────
function normProd(name) {
  return (name||"")
    .toLowerCase()
    .replace(/\s*\(.*?\)/g,"")    // strip parentheticals "(5 pcs)"
    .replace(/\bpack\b/g,"")      // remove "pack"
    .replace(/\bspecial\b/g,"")   // treat special variants as base
    .replace(/\bextra\b/g,"")     // strip "extra"
    .replace(/\bregular\b/g,"")   // strip "regular"
    .replace(/\bdeluxe\b/g,"")    // strip "deluxe"
    .replace(/[^a-z0-9\s]/g," ")  // remove punctuation
    .replace(/\b(\d+)\s*(pcs?|pieces?|nos?|units?|kgs?|gms?|g|kg|ml|l)\b/g,"") // strip quantities
    .replace(/\s+/g," ")
    .trim();
}
function levenSim(a,b) {
  // Returns 0-1 similarity (1=identical)
  if(!a||!b)return 0;
  if(a===b)return 1;
  const la=a.length, lb=b.length;
  if(Math.abs(la-lb)>Math.max(la,lb)*0.6)return 0; // too different in length
  const dp=Array.from({length:lb+1},(_,i)=>i);
  for(let i=1;i<=la;i++){
    let prev=dp[0]; dp[0]=i;
    for(let j=1;j<=lb;j++){const tmp=dp[j];dp[j]=a[i-1]===b[j-1]?prev:1+Math.min(prev,dp[j],dp[j-1]);prev=tmp;}
  }
  return 1-dp[lb]/Math.max(la,lb);
}
function prodNamesMatch(a,b){
  if(!a||!b)return false;
  const na=normProd(a), nb=normProd(b);
  if(!na||!nb)return false;
  // 1. Exact normalised match
  if(na===nb)return true;
  // 2. Leading-word prefix (prevents mid-word false positives)
  if(nb.startsWith(na+" ")||na.startsWith(nb+" "))return true;
  // 3. Token-set ratio: both share all tokens of the shorter name
  const ta=na.split(" ").filter(Boolean);
  const tb=nb.split(" ").filter(Boolean);
  const shorter=ta.length<=tb.length?ta:tb;
  const longer =ta.length<=tb.length?tb:ta;
  if(shorter.length>0&&shorter.every(tok=>longer.includes(tok)))return true;
  // 4. Levenshtein similarity ≥ 0.82 (strict — avoids false positives)
  if(levenSim(na,nb)>=0.82)return true;
  return false;
}
const ts    = () => new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const inr   = n  => `₹${Number(n||0).toLocaleString("en-IN")}`;
const cx    = (...a) => a.filter(Boolean).join(" ");
const safeO = x  => (x && typeof x === "object" && !Array.isArray(x)) ? x : {};
// safeArr: Firebase can return an object {0:x,1:y} instead of an array when elements
// have been deleted. This coerces it back to a real array safely everywhere.
const safeArr = x => Array.isArray(x) ? x : (x && typeof x === "object") ? Object.values(x) : [];
const mapU  = (a,lat,lng) => lat&&lng ? `https://maps.google.com/?q=${lat},${lng}` : `https://maps.google.com/?q=${encodeURIComponent(a||"")}`;

function lineTotal(lines) {
  return Object.values(safeO(lines)).reduce((s,l) => s + (l.qty||0)*(l.priceAmount||0), 0);
}
function lineTotalWithTax(lines, taxRate) {
  const sub = lineTotal(lines);
  if(!taxRate||+taxRate<=0) return sub;
  return Math.round(sub * (1 + (+taxRate)/100) * 100) / 100;
}
function lineRows(lines, prods) {
  return prods.map(p => ({...p,...(safeO(lines)[p.id]||{qty:0,priceAmount:0})})).filter(l=>l.qty>0);
}



export { uid, today, ts, inr, cx, safeO, safeArr, mapU, lineTotal, lineTotalWithTax, lineRows, normProd, levenSim, prodNamesMatch };
