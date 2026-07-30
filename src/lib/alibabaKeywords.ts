/**
 * Alibaba keyword extraction.
 *
 * Goal: turn a noisy marketplace title (Takealot / Amazon / Walmart) into the
 * CORE PRODUCT NOUN that maps onto an Alibaba canonical showroom page
 * (which is nearly always the plural form, e.g. /showroom/luggage-sets.html).
 *
 *   "3 Piece Hard Outer Shell Luggage Set"          -> "luggage set"
 *   "Bottle Warmer & Sterilizer"                    -> "bottle warmer"
 *   "Professional Electric Hair Clipper USB 2000mAh"-> "hair clipper"
 */

/** Filler / marketing / spec words that never help identify a product. */
const STOPWORDS = new Set<string>([
  // grammar
  "the","a","an","and","or","of","for","with","in","on","to","from","by","at","this","that","plus","w",
  // marketing
  "vintage","professional","premium","deluxe","luxury","new","hot","sale","top","best","quality","high",
  "super","ultra","mega","pro","advanced","upgraded","upgrade","classic","modern","stylish","fashion",
  "multifunctional","multifunction","multi","functional","heavy","duty","durable","comfortable","adjustable",
  "foldable","folding","collapsible","lightweight","light","weight","compact","large","small","medium","big",
  "xl","xxl","xs","inch","inches","cm","mm","litre","liter","liters","litres","ml","kg","g","oz","lb","lbs",
  // spec / feature noise
  "mini","portable","household","home","house","office","travel","outdoor","indoor","use","using",
  "waterproof","wireless","rechargeable","usb","typec","type","powered","power","electric","electrical",
  "english","cordless","corded","smart","auto","automatic","manual","digital","led","lcd","bluetooth",
  "safe","safety","fast","quick","instant","easy","non","stick","nonstick","stainless","steel","plastic",
  "silicone","glass","wooden","wood","metal","aluminium","aluminum","leather","cotton","nylon",
  // audience
  "men","mens","man","women","womens","woman","kids","kid","boys","girls","unisex","adult","adults",
  "baby","babies","child","children","toddler","toddlers","teen","teens","infant","newborn","pet","pets",
  // packaging / counts
  "piece","pieces","pcs","pc","pack","packs","packet","count","ct","x","pair","pairs","bundle","combo",
  // meta
  "model","style","series","size","sizes","color","colour","colors","colours","edition","version","gen",
  "black","white","red","blue","green","pink","gold","silver","gray","grey","brown","beige","purple","yellow",
  "buy","cheap","free","shipping","brand","branded","genuine","original","official","oem","odm",
  "hard","soft","outer","inner","shell","full","half","mini","maxi","standard","universal","original",
]);

/** Brand names we should never search Alibaba for. */
const BRANDS = new Set<string>([
  "samsung","apple","iphone","huawei","xiaomi","redmi","oppo","vivo","nokia","lg","sony","philips","bosch",
  "kenwood","russell","hobbs","defy","hisense","tcl","jbl","anker","logitech","hp","dell","lenovo","asus",
  "acer","canon","nikon","gopro","fitbit","garmin","adidas","nike","puma","reebok","levis","gucci","prada",
  "loreal","nivea","dove","colgate","pampers","huggies","johnson","olay","gillette","braun","remington",
  "wahl","tefal","tupperware","volkano","mecer","sinotec","aim","salton","logik","pineware","sunbeam",
  "makita","dewalt","bosch","ryobi","stanley","karcher","lego","barbie","hasbro","mattel","fisher","price",
  "nestle","cadbury","coca","pepsi","energizer","duracell","3m","xbox","playstation","nintendo","canyon",
]);

/**
 * Canonical two-word product nouns. If the title contains one of these
 * (in order, allowing filler between the words), we use it directly —
 * this is what makes "3 Piece Hard Outer Shell Luggage Set" -> "luggage set".
 */
const COMPOUND_NOUNS: string[] = [
  "luggage set","suitcase set","travel bag","backpack bag","laptop bag","tool kit","tool set",
  "bottle warmer","baby monitor","breast pump","baby carrier","car seat","high chair","diaper bag",
  "hair clipper","hair trimmer","hair dryer","hair straightener","curling iron","shaver razor",
  "air fryer","pressure cooker","slow cooker","rice cooker","coffee maker","coffee machine","water bottle",
  "blender machine","food processor","electric kettle","microwave oven","gas stove","induction cooker",
  "vacuum cleaner","steam mop","washing machine","air purifier","air conditioner","space heater","fan heater",
  "bluetooth speaker","wireless earbuds","gaming headset","phone case","phone holder","screen protector",
  "power bank","charging cable","wall charger","smart watch","fitness tracker","action camera",
  "security camera","door lock","led strip","solar panel","solar light","light bulb","desk lamp",
  "office chair","gaming chair","coffee table","dining table","bed frame","mattress topper","bedding set",
  "curtain set","storage box","storage rack","shoe rack","clothes rack","laundry basket","trash bin",
  "resistance band","yoga mat","dumbbell set","skipping rope","exercise bike","treadmill machine",
  "water dispenser","water filter","garden hose","lawn mower","pressure washer","drill machine",
  "sewing machine","hair extension","makeup brush","face cream","body lotion","perfume bottle",
  "school bag","lunch box","pencil case","building blocks","magnetic tiles","board game","puzzle toy",
  "remote car","dog bed","pet carrier","cat litter","dog leash","bird cage",
  "cutlery set","cookware set","pot set","knife set","glass set","plate set","mug set","towel set",
  "sunglasses frame","watch strap","wallet purse","belt buckle","jewelry set","earring set",
];

/** Single-word fallback nouns that are strong on their own. */
const STRONG_NOUNS = new Set<string>([
  "luggage","suitcase","backpack","handbag","wallet","watch","speaker","headphone","earphone","earbuds",
  "clipper","trimmer","shaver","dryer","kettle","blender","fryer","cooker","oven","fridge","freezer",
  "mattress","pillow","duvet","blanket","towel","curtain","carpet","rug","sofa","chair","table","desk",
  "lamp","projector","printer","scanner","keyboard","mouse","monitor","tablet","laptop","charger","cable",
  "camera","drone","scooter","bicycle","stroller","pram","toy","doll","puzzle","tent","cooler","grill",
  "generator","inverter","battery","toolbox","drill","grinder","sander","hammer","wrench","ladder",
  "shampoo","perfume","lipstick","mascara","sunscreen","nappies","diaper","bottle","flask","tumbler",
  "sneakers","sandals","boots","slippers","jacket","hoodie","dress","shirt","jeans","socks","cap","hat",
]);

function singular(w: string): string {
  if (/ies$/.test(w)) return w.slice(0, -3) + "y";
  if (/(ches|shes|xes|zes|ses)$/.test(w)) return w.slice(0, -2);
  if (/[^s]s$/.test(w)) return w.slice(0, -1);
  return w;
}

export function pluralize(word: string): string {
  if (/(s|x|z|ch|sh)$/.test(word)) return word + "es";
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
  if (!word.endsWith("s")) return word + "s";
  return word;
}

function pluralizePhrase(phrase: string): string {
  const parts = phrase.split(" ").filter(Boolean);
  if (!parts.length) return phrase;
  return [...parts.slice(0, -1), pluralize(parts[parts.length - 1])].join(" ");
}

/** "IPX6", "IP67", "2000mah", "5g", "16gb", "gts-1360" */
const RE_MODEL_TOKEN = /^(ipx?\d+|ip\d{2,}|\d+[a-z]{1,4}|[a-z]{1,3}\d+[a-z]*|\d+)$/i;

function tokenize(title: string): string[] {
  const cleaned = title
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    // leading quantities: "3 piece", "5-pack", "40pcs", "set of 3"
    .replace(/\b\d+\s*-?\s*(piece|pieces|pcs|pc|pack|packs|in\s*1)\b/gi, " ")
    .replace(/\bset of \d+\b/gi, " set ")
    .replace(/[^a-zA-Z0-9\s-]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return cleaned
    .split(" ")
    .map((w) => w.trim())
    .filter((w) => w.length > 1)
    .filter((w) => !BRANDS.has(w))
    .filter((w) => !RE_MODEL_TOKEN.test(w));
}

function meaningful(tokens: string[]): string[] {
  return tokens.filter((w) => !STOPWORDS.has(w));
}

/**
 * Extract the core product noun plus 2-3 alternative keyword variants.
 * `primary` is the best guess; `variants` are additional queries worth trying
 * automatically (plural slug form, single noun, etc.).
 */
export function extractSmartKeywords(title: string): { primary: string; variants: string[] } {
  if (!title || !title.trim()) return { primary: "", variants: [] };

  const tokens = tokenize(title);
  const singulars = tokens.map(singular);

  // 1) Known compound noun present in the title (word order preserved).
  let core = "";
  for (const compound of COMPOUND_NOUNS) {
    const [a, b] = compound.split(" ");
    const ia = singulars.indexOf(a);
    if (ia === -1) continue;
    const ib = singulars.indexOf(b, ia + 1);
    if (ib === -1) continue;
    if (ib - ia <= 3) { core = compound; break; }
  }

  const words = meaningful(singulars);

  // 2) Strong single noun + the meaningful word before it => "hair clipper".
  if (!core) {
    for (let i = words.length - 1; i >= 0; i--) {
      if (STRONG_NOUNS.has(words[i])) {
        core = i > 0 ? `${words[i - 1]} ${words[i]}` : words[i];
        break;
      }
    }
  }

  // 3) Fallback: last two meaningful words (product noun trails in most titles).
  if (!core) {
    const last2 = words.slice(-2).join(" ");
    core = last2 || words[words.length - 1] || singulars.slice(-2).join(" ") || title.toLowerCase();
  }

  core = core.split(" ").slice(0, 2).join(" ").trim();

  // Alibaba showroom slugs are canonically plural -> lead with the plural form.
  const primary = pluralizePhrase(core);

  const variants: string[] = [];
  const add = (s: string) => {
    const t = s.trim();
    if (t && t !== primary && !variants.includes(t) && t.split(" ").length <= 3) variants.push(t);
  };
  add(core);                                        // singular compound
  const parts = core.split(" ");
  const head = parts[parts.length - 1];
  if (head) { add(pluralize(head)); add(head); }    // bare noun, plural first

  return { primary, variants: variants.slice(0, 3) };
}
