import fs from "node:fs";
import path from "node:path";
import sharp from "../node_modules/.pnpm/sharp@0.35.3_@types+node@24.13.3/node_modules/sharp/dist/index.mjs";

const root = path.resolve(import.meta.dirname, "..");
const sourceDir = path.join(root, "brand", "v3", "campaign", "source");
const exportDir = path.join(root, "brand", "v3", "campaign", "exports");
fs.mkdirSync(sourceDir, { recursive: true });
fs.mkdirSync(exportDir, { recursive: true });

const C = { chalk: "#F1EFE8", raised: "#F8F6EF", graphite: "#242826", soft: "#4E5451", mineral: "#697F8C", mineralLight: "#A7B5BA", peach: "#D39A83", fog: "#D9DEDC", success: "#2F6B4A", warning: "#9A6A27" };
const fontBase = path.join(root, "apps", "web", "node_modules", "@expo-google-fonts", "recursive");
const fonts = {
  regular: fs.readFileSync(path.join(fontBase, "400Regular", "Recursive_400Regular.ttf")).toString("base64"),
  medium: fs.readFileSync(path.join(fontBase, "500Medium", "Recursive_500Medium.ttf")).toString("base64"),
  bold: fs.readFileSync(path.join(fontBase, "700Bold", "Recursive_700Bold.ttf")).toString("base64"),
};
const photos = {
  chair: fs.readFileSync(path.join(root, "brand", "v3", "photography", "repair-chair-wide.png")).toString("base64"),
  jacket: fs.readFileSync(path.join(root, "brand", "v3", "photography", "mend-jacket-portrait.png")).toString("base64"),
};

const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const rect = (x,y,w,h,fill,{r=0,stroke="none",sw=1,opacity=1}={}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
const line = (x1,y1,x2,y2,stroke,width=1,opacity=1) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}"/>`;
const text = (x,y,value,size,fill,{weight=400,anchor="start",letter=0,opacity=1}={}) => `<text x="${x}" y="${y}" fill="${fill}" font-family="Recursive" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letter}" opacity="${opacity}">${esc(value)}</text>`;
const multiline = (x,y,lines,size,fill,options={}) => lines.map((value,index)=>text(x,y+index*(options.leading??Math.round(size*1.02)),value,size,fill,options)).join("");
const photo = (data,x,y,w,h,position="xMidYMid") => `<image href="data:image/png;base64,${data}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${position} slice"/>`;
const label = (x,y,value,fill=C.soft) => text(x,y,value.toUpperCase(),14,fill,{weight:700,letter:2.1});

function mark(x,y,size,dark=false) {
  const u=size/12, ink=dark?C.chalk:C.graphite;
  const module=(dx,dy,fill)=>rect(x+dx*u,y+dy*u,4.4*u,1.85*u,fill,{r:.38*u});
  return module(0,0,ink)+module(5.6,0,ink)+module(-1.1,3.15,dark?C.mineralLight:C.mineral)+module(6.7,3.15,C.peach)+module(0,6.3,ink)+module(5.6,6.3,ink);
}

function defs() {
  return `<defs><style>
    @font-face{font-family:Recursive;src:url(data:font/ttf;base64,${fonts.regular});font-weight:400}
    @font-face{font-family:Recursive;src:url(data:font/ttf;base64,${fonts.medium});font-weight:500}
    @font-face{font-family:Recursive;src:url(data:font/ttf;base64,${fonts.bold});font-weight:700}
  </style><filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="28" stdDeviation="28" flood-color="#242826" flood-opacity=".16"/></filter></defs>`;
}

function field(x,y,w,h,{dark=false,impact=false}={}) {
  let s="";
  const ink=dark?C.mineralLight:C.mineral, inactive=dark?C.soft:C.fog;
  if(impact){
    const values=[18,31,24,43,37,58,52,74,66,88];
    values.forEach((value,index)=>{const bw=(w-9*12)/10,bh=h*value/100;s+=rect(x+index*(bw+12),y+h-bh,bw,bh,index===9?C.peach:ink,{r:3,opacity:index===9?1:.38+index*.045});});
    return s;
  }
  const cols=7,rows=5,gap=10,cw=(w-(cols-1)*gap)/cols,ch=(h-(rows-1)*gap)/rows;
  for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){const active=row<3+(col%3===0?1:0);s+=rect(x+col*(cw+gap),y+row*(ch+gap),cw,ch,active?(row===2&&col===5?C.peach:ink):inactive,{r:4,opacity:active?.55+(row%3)*.14:.55});}
  return s;
}

function splitField(x,y,w,h,dark=true) {
  let s=""; const moduleW=(w-170)/6,moduleH=18,gapY=15;
  for(let row=0;row<6;row++) for(let col=0;col<6;col++){
    const side=col<3?-1:1,shift=(row===3?34:18)*side;
    const px=x+col*(moduleW+12)+(col>=3?98:0)+shift;
    s+=rect(px,y+row*(moduleH+gapY),moduleW,moduleH,row===3&&col===2?C.mineral:row===3&&col===3?C.peach:dark?C.mineralLight:C.mineral,{r:5,opacity:.5+((row+col)%3)*.18});
  }
  s+=line(x+w/2,y-8,x+w/2,y+h+2,dark?C.chalk:C.graphite,1,.14);
  return s;
}

function phoneFrame(x,y,w,h,dark=false) {
  const bg=dark?C.graphite:C.raised,stroke=dark?C.graphite:C.graphite;
  return `<g filter="url(#shadow)">${rect(x,y,w,h,bg,{r:Math.round(w*.09),stroke,sw:1.5})}${rect(x+w/2-36,y+16,72,8,dark?C.mineralLight:C.soft,{r:4,opacity:.65})}</g>`;
}

function phoneToday(x,y,w=420,h=840) {
  let s=phoneFrame(x,y,w,h,false),px=x+32;
  s+=label(px,y+67,"29 AUG",C.soft);
  s+=text(px,y+162,"42",94,C.graphite,{weight:500,letter:-6});
  s+=text(px+142,y+135,"minutes",19,C.graphite,{weight:700});
  s+=text(px+142,y+163,"returned today",17,C.soft);
  s+=text(px,y+205,"14 automatic opens became conscious choices.",13,C.soft);
  s+=line(px,y+238,x+w-32,y+238,C.fog);
  s+=text(px,y+277,"6",31,C.graphite,{weight:500});s+=text(px+44,y+274,"apps protected",14,C.soft);
  s+=text(px+195,y+277,"14",31,C.graphite,{weight:500});s+=text(px+245,y+274,"opens avoided",14,C.soft);
  s+=line(px,y+306,x+w-32,y+306,C.fog);
  s+=label(px,y+344,"Selected-app time / 7 days",C.soft);s+=field(px,y+369,w-64,120);
  s+=line(px,y+515,x+w-32,y+515,C.fog);s+=label(px,y+553,"Example impact fund",C.soft);s+=text(px,y+595,"$18,421",36,C.graphite,{weight:500});s+=text(x+w-32,y+589,"ILLUSTRATIVE →",11,C.soft,{anchor:"end",weight:700});
  s+=line(px,y+626,x+w-32,y+626,C.fog);s+=label(px,y+664,"Next",C.soft);s+=text(px,y+702,"Review protected apps",18,C.graphite,{weight:700});s+=text(x+w-32,y+702,"→",24,C.graphite,{anchor:"end"});
  s+=line(px,y+746,x+w-32,y+746,C.fog);s+=text(px,y+786,"Today",12,C.graphite,{weight:700});s+=text(px+115,y+786,"Passes",12,C.soft);s+=text(px+230,y+786,"Impact",12,C.soft);
  return s;
}

function phoneIntervention(x,y,w=420,h=840) {
  let s=phoneFrame(x,y,w,h,true),px=x+32;
  s+=label(px,y+67,"Instagram",C.chalk);s+=text(x+w-32,y+67,"00:01",13,C.chalk,{anchor:"end",weight:700,letter:1});
  s+=splitField(px+18,y+120,w-100,205,true);
  s+=multiline(px,y+398,["Instagram opened","7 times today."],37,C.chalk,{weight:500,leading:43,letter:-1});
  s+=text(px,y+504,"What do you want from the next 10 minutes?",14,C.mineralLight);
  s+=rect(px,y+552,w-64,58,C.chalk,{r:4});s+=text(x+w/2,y+589,"Go back",16,C.graphite,{anchor:"middle",weight:700});
  s+=line(px,y+647,x+w-32,y+647,C.soft);s+=text(px,y+686,"Use 1 pass · 10 min",15,C.chalk,{weight:700});s+=text(x+w-32,y+686,"→",22,C.chalk,{anchor:"end"});
  s+=line(px,y+718,x+w-32,y+718,C.soft);s+=text(px,y+756,"The pause returns after 10 minutes.",12,C.mineralLight);
  return s;
}

function phoneImpact(x,y,w=420,h=840) {
  let s=phoneFrame(x,y,w,h,false),px=x+32;
  s+=label(px,y+67,"Impact / illustrative record",C.soft);s+=label(px,y+120,"Illustrative fund",C.soft);s+=text(px,y+190,"$18,421",64,C.graphite,{weight:500,letter:-4});s+=text(px,y+224,"80% of recorded advertising revenue",13,C.soft);
  s+=field(px,y+270,w-64,135,{impact:true});s+=line(px,y+430,x+w-32,y+430,C.fog);
  [["Ocean Conservancy","42%"],["Doctors Without Borders","34%"],["Rainforest Trust","24%"]].forEach(([name,pct],i)=>{const yy=y+482+i*78;s+=text(px,yy,name,15,C.graphite,{weight:700});s+=text(x+w-32,yy,pct,18,C.graphite,{anchor:"end",weight:500});s+=line(px,yy+29,x+w-32,yy+29,C.fog);});
  s+=text(px,y+751,"ILLUSTRATIVE DATA",11,C.warning,{weight:700,letter:1});s+=text(x+w-32,y+751,"EXAMPLE VOTE →",11,C.soft,{anchor:"end",weight:700});
  return s;
}

function baseSvg(w,h,bg,body) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs()}${rect(0,0,w,h,bg)}${body}</svg>`; }

async function render(name,w,h,bg,body) {
  const svg=baseSvg(w,h,bg,body);
  fs.writeFileSync(path.join(sourceDir,`${name}.svg`),svg);
  await sharp(Buffer.from(svg),{density:144}).resize(w,h).png({compressionLevel:9}).toFile(path.join(exportDir,`${name}.png`));
  console.log(path.relative(root,path.join(exportDir,`${name}.png`)));
}

await render("launch-post",1080,1350,C.chalk,
  mark(72,72,86)+label(72,210,"Still / private beta")+multiline(72,330,["One second","before the app."],84,C.graphite,{weight:500,leading:82,letter:-4})+text(72,538,"The choice appears before the app does.",25,C.soft)+phoneIntervention(625,245,350,780)+label(72,1248,"Quiet technology / iOS + Android",C.soft));

await render("launch-story",1080,1920,C.graphite,
  mark(72,72,86,true)+label(72,226,"Still / private beta",C.mineralLight)+multiline(72,360,["Automatic","becomes","conscious."],106,C.chalk,{weight:500,leading:102,letter:-5})+splitField(130,760,820,240,true)+text(72,1118,"One opening. One second. Two clear paths.",27,C.mineralLight)+phoneIntervention(330,1210,420,840)+label(72,1835,"Private on device / no score / no streak",C.mineralLight));

await render("feature-intervention",1080,1350,C.graphite,
  mark(72,72,78,true)+label(72,198,"Feature / field aperture",C.mineralLight)+multiline(72,322,["The field opens","once."],91,C.chalk,{weight:500,leading:90,letter:-4})+splitField(100,610,880,260,true)+text(72,1012,"520 ms · one haptic · no loop",23,C.mineralLight)+line(72,1080,1008,1080,C.soft)+text(72,1140,"Go back",28,C.chalk,{weight:700})+text(1008,1140,"1 tap",28,C.chalk,{anchor:"end",weight:500})+text(72,1213,"Use 1 pass",28,C.chalk,{weight:700})+text(1008,1213,"10 min",28,C.peach,{anchor:"end",weight:500}));

await render("impact-report",1080,1350,C.raised,
  mark(72,72,78)+label(72,205,"Impact method / illustrative interface")+text(72,343,"80%",128,C.graphite,{weight:500,letter:-8})+text(72,392,"of recorded advertising revenue enters the fund",24,C.soft)+field(72,494,936,265,{impact:true})+line(72,809,1008,809,C.fog)+multiline(72,880,["Amount.","State.","Allocation.","Proof."],56,C.graphite,{weight:500,leading:65,letter:-2})+text(1008,918,"Open vote",18,C.soft,{anchor:"end",weight:700})+text(1008,982,"Proof after donation",18,C.warning,{anchor:"end",weight:700})+label(72,1260,"Illustrative values. Publish live ledger data only.",C.soft));

await render("vertical-ad",1080,1920,C.graphite,
  photo(photos.chair,0,0,1080,1035,"xMidYMid")+rect(0,0,1080,1035,C.graphite,{opacity:.08})+rect(0,1035,1080,885,C.graphite)+mark(72,1100,86,true)+label(72,1246,"Still / quiet technology",C.mineralLight)+multiline(72,1372,["Less automatic.","More room for","something real."],82,C.chalk,{weight:500,leading:81,letter:-4})+text(72,1685,"Still appears before the apps you open by reflex.",24,C.mineralLight)+rect(72,1770,310,70,C.chalk,{r:5})+text(227,1815,"Request beta access",18,C.graphite,{anchor:"middle",weight:700}));

await render("verified-quote-template",1080,1350,C.chalk,
  mark(72,72,78)+label(72,202,"Social proof / publishing gate")+multiline(72,338,["“Approved quote","goes here.”"],94,C.graphite,{weight:500,leading:92,letter:-4})+rect(72,610,936,1,C.fog)+text(72,680,"NAME / ROLE",16,C.soft,{weight:700,letter:1.8})+text(72,756,"This template must not ship until the quote, identity,",24,C.soft)+text(72,792,"permission and wording are verified.",24,C.soft)+rect(72,1020,936,160,C.graphite,{r:6})+label(102,1075,"Blocked by design",C.mineralLight)+text(102,1132,"Still does not fabricate testimonials.",27,C.chalk,{weight:700})+label(72,1270,"Status / awaiting verified participant evidence",C.warning));

await render("store-feature",1024,500,C.chalk,
  mark(52,55,66)+multiline(160,116,["One second","before you enter."],58,C.graphite,{weight:500,leading:56,letter:-2.5})+splitField(590,95,370,150,false)+label(590,315,"Automatic → conscious",C.soft)+text(590,362,"Private on device. No score.",20,C.soft)+label(52,454,"Still / iOS + Android",C.soft));

await render("app-store-01-intervention",1290,2796,C.chalk,
  mark(82,82,96)+label(82,252,"Still / intervention")+multiline(82,420,["See the moment","before you enter."],106,C.graphite,{weight:500,leading:104,letter:-5})+text(82,672,"A one-second pause makes an automatic opening visible.",28,C.soft)+phoneIntervention(380,850,530,1060)+label(82,2668,"Go back in one tap / continue for a clear 10 minutes",C.soft));

await render("app-store-02-today",1290,2796,C.graphite,
  mark(82,82,96,true)+label(82,252,"Still / today",C.mineralLight)+multiline(82,420,["A record.","Not a score."],112,C.chalk,{weight:500,leading:110,letter:-5})+text(82,690,"Time returned, protected apps, progress and the next action.",28,C.mineralLight)+phoneToday(380,850,530,1060)+label(82,2668,"Illustrative interface / detailed data stays on device",C.mineralLight));

await render("app-store-03-impact",1290,2796,C.raised,
  mark(82,82,96)+label(82,252,"Still / weekly impact")+multiline(82,420,["Impact leaves","a record."],112,C.graphite,{weight:500,leading:110,letter:-5})+text(82,690,"Amount, state, allocation and proof — in that order.",28,C.soft)+phoneImpact(380,850,530,1060)+label(82,2668,"Illustrative interface / live proof follows the transfer",C.soft));

await render("education-01",1080,1350,C.chalk,
  mark(72,72,78)+label(72,210,"Product education / 01")+multiline(72,345,["Choose the apps","you open on reflex."],78,C.graphite,{weight:500,leading:79,letter:-3.5})+field(72,660,936,250)+text(72,1020,"The names and detailed history stay on your phone.",28,C.soft)+label(72,1248,"Next / the one-second pause",C.mineral));

await render("education-02",1080,1350,C.graphite,
  mark(72,72,78,true)+label(72,210,"Product education / 02",C.mineralLight)+multiline(72,345,["Notice the fact.","Then choose."],82,C.chalk,{weight:500,leading:83,letter:-4})+splitField(105,650,870,250,true)+text(72,1030,"Go back, or use one pass for 10 minutes.",28,C.mineralLight)+label(72,1248,"Next / read the day without a score",C.peach));

await render("education-03",1080,1350,C.raised,
  mark(72,72,78)+label(72,210,"Product education / 03")+multiline(72,345,["Read what","actually happened."],82,C.graphite,{weight:500,leading:83,letter:-4})+text(72,655,"42",150,C.graphite,{weight:500,letter:-9})+text(292,610,"minutes",30,C.graphite,{weight:700})+text(292,652,"returned today",28,C.soft)+field(72,800,936,240)+label(72,1248,"No streak / no grade / one next action",C.mineral));

fs.writeFileSync(path.join(root,"brand","v3","campaign","README.md"),`# Still v3 campaign\n\nGenerated from the frozen Soft Field system. Photos are project-owned generated assets; UI and typography are deterministic.\n\nApp Store and education compositions marked as illustrative are design examples, not live impact claims. Replace illustrative values with a verified ledger snapshot before publication.\n\nThe file \`verified-quote-template.png\` is intentionally blocked from publication until a real quote, identity, permission, and exact wording are verified.\n`);
