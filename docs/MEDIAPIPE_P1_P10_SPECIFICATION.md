# MediaPipe P1–P10 för golfsvingen

**Teknisk specifikation och implementationsunderlag**  
**Dokumentstatus:** Föreslagen normativ specifikation v1.0  
**Projekt:** SwingSwang  
**Datum:** 20 september 2026  
**Primärt användningsfall:** Full golfsving filmad face-on (FO) eller down-the-line (DTL), analyserad lokalt med MediaPipe Pose Landmarker  
**Målplattform:** Android/iOS, offlineanalys av importerad eller inspelad video  

**Kärnbeslut:** MediaPipe Pose Landmarkers 33 kroppspunkter innehåller varken klubba eller boll. P2, P6 och P8 definieras av klubbskaftet och P7 av bollträffen. Utan separat klubb-/bollsignal får dessa positioner därför endast returneras som uttryckliga proxyer, aldrig som exakta P-positioner.

---

## Innehållsförteckning

1. [Beslutssammanfattning](#1-beslutssammanfattning)
2. [Operativ P1–P10-konvention](#2-operativ-p1p10-konvention)
3. [Indata- och koordinatkontrakt](#3-indata--och-koordinatkontrakt)
4. [Vyhantering: face-on och DTL](#4-vyhantering-face-on-och-dtl)
5. [Förbehandling, smoothing och derivator](#5-förbehandling-smoothing-och-derivator)
6. [Fasdetektion före P-klassificering](#6-fasdetektion-före-p-klassificering)
7. [Positionsspecifikation P1–P10](#7-positionsspecifikation-p1p10)
8. [Confidence, kvalitet och abstention](#8-confidence-kvalitet-och-abstention)
9. [Global eventlösare](#9-global-eventlösare)
10. [Resultatkontrakt](#10-resultatkontrakt)
11. [Teststrategi och konkreta testfall](#11-teststrategi-och-konkreta-testfall)
12. [Acceptanskriterier och release-gates](#12-acceptanskriterier-och-release-gates)
13. [Rekommenderad implementationsordning](#13-rekommenderad-implementationsordning)
14. [Definition of Done](#14-definition-of-done)
15. [Källor och tekniska noter](#15-källor-och-tekniska-noter)

---

## 1. Beslutssammanfattning

1. Systemet ska arbeta på en **tidsserie**, inte klassificera varje bild oberoende.
2. Händelserna väljs gemensamt med ordningskravet $P1 < P2 < \dots < P10$; en lokal träff får inte bryta sekvensen.
3. Resultatkontraktet har tre utfall: `DETECTED_EXACT`, `DETECTED_PROXY` och `ABSTAIN`.
4. `DETECTED_EXACT` för P2/P6/P8 kräver klubbaxel. `DETECTED_EXACT` för P7 kräver klubbhuvud + bollkontakt eller en validerad kontaktfusion. Pose-only får högst returnera `P2_PROXY`, `P6_PROXY`, `IMPACT_PROXY` och `P8_PROXY`.
5. FO och DTL ska ha separata parametrar, kvalitetsregler och kalibrering. Vy ska anges av inspelningsflödet; automatisk vyklassificering används endast som konsistenskontroll.
6. Handedness ska anges eller vara känt. Den får inte gissas från en enskild bild.
7. 120 fps är mål, 60 fps är golv för full P1–P10-pipeline. Under 60 fps ska snabbzonen P6–P8 normalt avstås eller markeras `DEGRADED`.
8. Smoothing ska vara tidsstämpelbaserad, bevara rådata och inte fylla luckor längre än 50 ms.
9. Confidence är initialt ett **quality score**, inte en sannolikhet. Ordet sannolikhet får användas först efter kalibrering på ett separat valideringsset.
10. En saknad position ska representeras med `timestampMs: null` och en maskinläsbar `reasonCode` — aldrig med en fabricerad tid och 0 % confidence.

---

## 2. Operativ P1–P10-konvention

P-systemet varierar något mellan träningsmiljöer. Denna implementation låser följande konvention. P4 betyder övergångens topp, inte att skaftet måste vara parallellt. P9 använder trail arm, inte lead arm.

| Position | Normativ betydelse | Primär fysisk signal | Pose-only-status |
| :--- | :--- | :--- | :--- |
| **P1** | **Address**: sista stabila uppställningsbilden före takeaway | Stabil kropp och stabilt grepp före ihållande rörelse | Kan detekteras |
| **P2** | Skaftet parallellt med marken i baksvingen | Klubbaxelns vinkel + riktning bort från bollen | Endast `P2_PROXY` utan klubba |
| **P3** | Lead arm parallell med marken i baksvingen | Lead shoulder $\rightarrow$ lead wrist nära horisontell, stigande fas | Kan detekteras |
| **P4** | **Toppen/övergången** mellan bak- och nedsving | Greppbanans vändning och lokal rörelseminskning | Kan detekteras, men kräver temporal kontext |
| **P5** | Lead arm parallell med marken i nedsvingen | Samma geometri som P3, men fallande och efter P4 | Kan detekteras |
| **P6** | Skaftet parallellt med marken i nedsvingen | Klubbaxelns vinkel + snabb nedsvingsfas | Endast `P6_PROXY` utan klubba |
| **P7** | **Faktisk bollträff** | Klubbhuvud–boll-kontakt; ev. fusion med ljud | Endast `IMPACT_PROXY` utan klubba/boll |
| **P8** | Skaftet parallellt med marken efter träff | Klubbaxelns vinkel + rörelse bort från träffzonen | Endast `P8_PROXY` utan klubba |
| **P9** | **Trail arm** parallell med marken i genomsvingen | Trail shoulder $\rightarrow$ trail wrist nära horisontell, stigande | Kan detekteras |
| **P10** | **Finish**: första stabila slutläget efter P9 | Låg kroppshastighet under stabilt fönster | Kan detekteras; avstå om finish inte hålls |

> **Viktigt:** Händelsedetektion ska inte bedöma om positionen är "bra". En kort backsving kan ha en giltig P4. En obalanserad finish kan vara en giltig P10. Coachingmått beräknas efter att händelserna är fastställda.

---

## 3. Indata- och koordinatkontrakt

### 3.1 MediaPipe-data som ska lagras per frame

MediaPipe Pose Landmarker returnerar 33 landmarks i normaliserade bildkoordinater samt 33 world landmarks i meter med höftcentrum som origo. Video- och live-läge kräver monotont ökande tidsstämplar. Varje frame ska lagras utan att förlora råvärden.

```typescript
type Vec3 = { x: number; y: number; z: number };

type Landmark = Vec3 & {
  visibility: number; // [0, 1]
  presence?: number;  // finns i aktuella Tasks-SDK-resultat
};

type PoseFrame = {
  frameIndex: number;
  timestampUs: number; // källans PTS, inte frameIndex / nominell fps
  image: Landmark[];   // exakt 33, x/y normaliserade
  world: Landmark[];   // exakt 33, meter
  sourceSizePx: { width: number; height: number };
  rotationAppliedDeg: 0 | 90 | 180 | 270;
  inputWasMirrored: boolean;
};

type CaptureContext = {
  view: "FACE_ON" | "DTL";
  handedness: "LEFT" | "RIGHT";
  mode: "VIDEO" | "LIVE_STREAM";
  nominalFps: number;
};
```

### 3.2 Relevanta landmark-index

| Struktur | Vänster | Höger | Användning |
| :--- | :--- | :--- | :--- |
| Shoulder | 11 | 12 | Armvinkel, torso, rotation |
| Elbow | 13 | 14 | Armkvalitet och identity-swap-kontroll |
| Wrist | 15 | 16 | Primär grepproxy |
| Pinky | 17 | 18 | Handkvalitet, ej ensam eventtrigger |
| Index | 19 | 20 | Handkvalitet, ej klubbhuvud |
| Thumb | 21 | 22 | Handkvalitet, ej klubbhuvud |
| Hip | 23 | 24 | Pelviscentrum och skala |
| Knee | 25 | 26 | Stabilitet och crop-kvalitet |
| Ankle | 27 | 28 | Stans, FO-riktning och helkroppskvalitet |
| Heel | 29 | 30 | Fotstabilitet |
| Foot index | 31 | 32 | Fot-/markkontakt |

### 3.3 Canonicalisering

1. Applicera videorotation/EXIF före inference eller skapa motsvarande korrekt orienterad MPImage.
2. Inference ska göras på omirrorerade pixlar. Selfie-spegel används endast i UI. En redan speglad fil avspeglas före inference.
3. Konvertera bildens y-led till en intern uppåtriktad axel: $y_{Up} = 1 - y_{Image}$.
4. Mappa `lead` och `trail` från `handedness`:
   - Högerhänt: lead = anatomiskt vänster, trail = anatomiskt höger;
   - Vänsterhänt: lead = anatomiskt höger, trail = anatomiskt vänster.
5. Normalisera 2D-längder med median torsohöjd i P1-fönstret:
   $$S_{2D} = \text{median}\left( \left\| \frac{S_L + S_R}{2} - \frac{H_L + H_R}{2} \right\| \right)$$
6. World-koordinater centreras om per frame till pelviscentrum. Absolut world-orientering ska inte användas som kamerapose; den är en monokulär modellskattning.

### 3.4 Grundpunkter och geometri

```typescript
midShoulder = mean(L_SHOULDER, R_SHOULDER)
midHip      = mean(L_HIP, R_HIP)
grip2D      = qualityWeightedMean(L_WRIST, R_WRIST)

leadArm     = leadWrist - leadShoulder
trailArm    = trailWrist - trailShoulder
leadArmDeg  = abs(angleToImageHorizontal(leadArm)) // 0° = horisontell

gripSpeed   = norm(d(grip2D / S2D) / dt)           // torso-längder/s
gripAccel   = norm(d²(grip2D / S2D) / dt²)
```

Fingertopparna ska inte medelvärdesbildas in i greppet om de är instabila. De används som stödbevis. Om handlederna korsas eller byter identitet ska kontinuitet över axel–armbåge–handled kontrolleras innan event kan godkännas.

---

## 4. Vyhantering: face-on och DTL

### 4.1 Gemensam regel

FO/DTL ska väljas i capture-UI eller komma från säker metadata. En automatisk vyklassificerare får ge `viewConsistency`, men får inte tyst skriva över användarens val. Om vald vy och geometrin är tydligt oförenliga returneras `VIEW_AMBIGUOUS`.

| Aspekt | Face-on | Down-the-line |
| :--- | :--- | :--- |
| **Starkaste signaler** | Lateral förflyttning, armarnas projekterade horisontalitet, händer relativt stans | Handhöjd, temporal vändning, armbågs-/handledsbana och djup som stödsignal |
| **Vanlig svaghet** | Klubba/arm kan döljas av kroppen nära toppen | Lead/trail-armar och handleder överlappar; ID-swap vanligare |
| **P2/P6/P8** | 2D-klubbaxel är användbar om kameran är square och skaftet syns | Skaftet kan foreshortenas längs kamerans siktlinje; kräv minsta synlig längd eller 3D-/kalibrerad klubbsignal |
| **P3/P5/P9** | Arm-horisontalitet i bildplanet är stark | Arm-horisontalitet får lägre vikt; temporal fas och world-geometri får högre vikt |
| **P7** | Boll/klubbkontakt lättare att lokalisera lateralt | Bra för klubbplan men kontakt kan döljas och bollens bildstorlek är liten |
| **2D target-riktning** | Kan skattas från trail ankle $\rightarrow$ lead ankle vid P1 | Ska inte skattas från fotlinjen; target ligger huvudsakligen i djupet |

### 4.2 Capture-gates

Följande ska valideras före analys:
- Hela kroppen, båda händerna och klubbans relevanta del ska vara innanför bild under hela svingen;
- Kameran ska vara fixerad, upprätt och utan digital zoomförändring;
- Endast en dominant person får finnas;
- FO-kameran ska vara ungefär vinkelrät mot target line, DTL ungefär parallell;
- Aktuell fps ska beräknas från PTS, inte litas på från filmetadata;
- Om mer än 5 % av analysfönstret saknar pose eller om nyckelpunkt saknas >50 ms nära en kandidat ska aktuell position avstås.

Trösklar för automatisk view-konsistens ska läras på projektets egna data. Exempelvis är projekterad axelbredd/torsohöjd oftast större FO än DTL, men den är inte tillräckligt stabil för ett universellt hårt gränsvärde.

---

## 5. Förbehandling, smoothing och derivator

### 5.1 Rekommenderad offlinepipeline

1. Sortera på `timestampUs`; avvisa duplicerade eller bakåtgående tider.
2. Skapa per-landmark-kvalitet $q = \min(\text{visibility}, \text{presence} \text{ ?? } 1)$.
3. Markera punkt som ogiltig när $q < 0.50$. Värden mellan 0.50 och 0.75 får användas men sänker eventkvalitet.
4. Interpolera endast interna luckor $\le 50$ ms när båda ändpunkterna har $q \ge 0.75$. Ingen extrapolation över clipets början/slut.
5. Kör ett litet robust outliersteg (median/Hampel över cirka 25–35 ms) utan att ersätta en verklig snabb rörelse.
6. Smoothing av koordinater, inte färdiga vinklar:
   - Offline: Centrerad Savitzky–Golay, ordning 2, tidsfönster 65–85 ms;
   - 120 fps: Startvärde 9 samples;
   - 60 fps: Startvärde 5 samples.
7. Beräkna hastighet/acceleration från samma lokala polynomfit och verkliga tidsstämplar.
8. Bevara `raw`, `interpolatedMask`, `smoothed` och filterparametrar i `PipelineTrace`.

Det centrerade filtret har ingen kausal fasförskjutning och passar offlineanalys. Parametrarna ovan är startvärden som måste benchmarkas; de är inte biologiska konstanter.

### 5.2 Livepipeline

För livefeedback används ett tidsstämpelmedvetet adaptivt lågpassfilter, exempelvis One Euro. Startområde för normaliserade koordinater: `minCutoff` 1–2 Hz, `beta` 0.01–0.05, `dCutoff` 1 Hz. Parameter ska optimeras separat för FO/DTL och enhet. Händelser får vara `TENTATIVE` tills tillräcklig look-ahead finns:
- P1 bekräftas efter takeaway;
- P4 bekräftas när nedsvingen är etablerad;
- P7-proxy bekräftas efter att händerna lämnat impactzonen;
- P10 bekräftas först efter stabilitetsfönstret.

### 5.3 Förbud

- Inget filter får jämna över en pose-reset, ID-swap eller lucka >50 ms;
- Ingen fast "frame per second"-division för derivator;
- Ingen framtidsinformation i live-resultat utan att latenstiden redovisas;
- Ingen interpolation av klubb-/bollkontakt över osäkra detektioner utan redovisad `temporalUncertaintyMs`.

---

## 6. Fasdetektion före P-klassificering

P-kandidater ska sökas inom grova faser, inte över hela videon.

### 6.1 Addressfönster och takeaway

Ett addressfönster kräver minst 250 ms där medianen av grepp-, axel- och pelvishastighet är låg. Startvärden, i kroppsskalor:
- `median(gripSpeed) < 0.10 S/s`;
- `median(midHipSpeed) < 0.05 S/s`;
- Ingen nyckelpunkt under hard quality floor;
- Båda fötter kvar i frame.

Takeaway börjar när grepphastigheten överstiger 0.18 S/s under minst 50 ms och greppets nettodisplacement från address överstiger 0.04 S. Små waggle-rörelser som återgår till address ska inte starta svingen.

### 6.2 Övergång och genomsvingsfas

Skapa ett normaliserat `backswingProgress` från flera signaler:
- Greppets båglängd från P1;
- Greppets avstånd från address;
- Grepphöjd;
- Lead-armens vinkel;
- Torso-/shoulderturn som stödsignal.

P4-kandidaten ligger där progressionshastigheten byter tecken eller når ett robust lokalt maximum och efterföljs av ihållande nedsvingsrörelse. En paus på toppen är tillåten; välj sista stabila frame före accelerationen ned.

Fullsvingens breda plausibilitetsfönster används som mjuka priors, inte som stilregler:

| Intervall | Mjuk normalzon | Hård utredningsgräns |
| :--- | :--- | :--- |
| **P1 $\rightarrow$ P4** | 0.45–1.60 s | 0.25–2.50 s |
| **P4 $\rightarrow$ P7** | 0.18–0.45 s | 0.10–0.70 s |
| **P7 $\rightarrow$ P10** | 0.35–1.80 s | 0.20–3.00 s |

Utanför hård gräns ska systemet pröva `PARTIAL_SWING`, fel swingsegment eller abstention — inte tvinga fram sekvensen.

---

## 7. Positionsspecifikation P1–P10

Trösklar är initiala. Armens "horisontell"-tolerans anges relativt bildens horisontal efter korrekt rotation. Vid tydlig kameraroll ska analysen avstå eller först rektifieras.

| P | Kandidatregel | Obligatorisk evidens | Vyspecifik viktning | Utdata när endast pose finns |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | Sista framen i stabilt addressfönster före godkänd takeaway | Axlar, handleder, höfter, knän, anklar; $\ge 250$ ms stabilitet | FO: grepp/stans och lateral stabilitet. DTL: vertikal stabilitet och helkropp. | `DETECTED_EXACT`, cap 0.90 |
| **P2** | Första frame P1–P3 där klubbaxeln är $\le 8^\circ$ från rektifierad horisontal/markriktning och rör sig i baksving | Klubbaxel med synlig längd $\ge 0.25\text{ S}$; kalibrerad vy eller 3D-klubba; korrekt fas | FO: hög 2D-klubbvikt. DTL: avstå vid foreshortening utan 3D/kalibrering. | `P2_PROXY`, cap 0.55 |
| **P3** | Första frame före P4 där `leadArmDeg` $\le 10^\circ$, med baksvingriktning och $\ge 30$ ms beständighet | Lead shoulder/elbow/wrist | FO: armgeometri hög. DTL: temporal signal och world-arm får högre vikt. | `DETECTED_EXACT`, cap 0.85 |
| **P4** | Sista robusta progressionsmaximum/stabila frame före ihållande nedsving | Båda handleder, axlar och höfter; $\ge 80$ ms kontext på båda sidor | FO: 2D-bana + turn. DTL: temporal vändning + world-bana. | `DETECTED_EXACT`, cap 0.85 |
| **P5** | Första frame efter P4 där `leadArmDeg` $\le 10^\circ$, nu fallande med ökande nedsvingshastighet | Lead shoulder/elbow/wrist | FO: armgeometri hög. DTL: temporal signal får högre vikt. | `DETECTED_EXACT`, cap 0.85 |
| **P6** | Första frame P5–P7 där klubbaxeln är $\le 8^\circ$ från rektifierad horisontal/markriktning i nedsvingen | Klubbaxel; synlig längd; kalibrerad vy/3D; snabb fas | FO: 2D-klubb + händer. DTL: hård foreshortening-gate. | `P6_PROXY`, cap 0.55 |
| **P7** | Klubbhuvudets bana korsar bollens kontaktzon; välj subframe-tid och närmaste poseframe | Klubbhuvud + boll eller validerad klubb-/ljudfusion | FO: lateral kontakt stark. DTL: bana/djup + kontaktstöd. | `IMPACT_PROXY`, cap 0.50 |
| **P8** | Första frame efter P7 där klubbaxeln åter är $\le 8^\circ$ från rektifierad horisontal/markriktning och lämnar impactzonen | Klubbaxel, synlig längd, kalibrerad vy/3D, rätt riktning | FO: 2D-klubb hög. DTL: hård foreshortening-gate. | `P8_PROXY`, cap 0.55 |
| **P9** | Första frame efter P8 där `trailArmDeg` $\le 12^\circ$ i stigande genomsvingsfas | Trail shoulder/elbow/wrist | FO: armgeometri hög. DTL: temporal signal får högre vikt. | `DETECTED_EXACT`, cap 0.80 |
| **P10** | Första frame i stabilt slutläge $\ge 300$ ms efter P9; välj början av stabilplatån | Axlar, handleder, höfter, anklar; låg hastighet | FO: lateral/turn som stöd. DTL: helkroppsstabilitet. | `DETECTED_EXACT`, cap 0.90 |

### 7.1 Pose-only-proxyer

Proxyerna ska väljas inom redan avgränsade intervall och får inte beskrivas som skaft- eller kontaktmätning:
- **`P2_PROXY`**: Bästa kombination av grepp i höftband, tidig båglängd och rörelse bort från P1, endast inom P1–P3.
- **`P6_PROXY`**: Greppet passerar leveransens höftband med fallande bana och hög hastighet, endast inom P5–P7_PROXY.
- **`IMPACT_PROXY`**: Minimum av avstånd till address-greppzonen och förväntad genomgång av nedre bågen efter P6_PROXY; FO får använda lateral passering, DTL främst tids-/höjdsignal. Den är en kroppshändelse, inte bevis på bollträff.
- **`P8_PROXY`**: Första utgående passering av motsvarande höftband efter IMPACT_PROXY och före P9.

Proxyer ska alltid bära `warnings: ["NO_CLUB_SIGNAL"]`; P7 dessutom `"NO_BALL_CONTACT_SIGNAL"`.

### 7.2 Exakt P7 med subframe-estimat

Med klubbhuvudcentrum $c(t)$ och bollcentrum $b$ skattas kontaktid runt minsta avstånd eller banans korsning av bollens kontaktzon. En lokal kvadratisk/linjär fit får ge subframe-estimat endast när minst tre klubbsamples är giltiga och residuen är inom validerad gräns. Returnera både:
- `timestampMs`: Skattad kontaktid;
- `poseFrameIndex`: Närmaste verkliga poseframe;
- `temporalUncertaintyMs`: Kvantiserings-, detektions- och fitosäkerhet.

Vid 60 fps är frameintervallet cirka 16.7 ms; vid 120 fps cirka 8.3 ms. Därför får en 60-fps "impactframe" inte marknadsföras som exakt utan osäkerhetsintervall.

---

## 8. Confidence, kvalitet och abstention

### 8.1 Kvalitetskomponenter

För varje kandidat beräknas:
- $Q_{landmarks}$: Geometriskt medel av nödvändiga punkters $q$, med hard floor per punkt;
- $Q_{geometry}$: Hur nära kandidatens geometri är eventmålet;
- $Q_{temporal}$: Rätt riktning, beständighet, lokal unikhet och ordning;
- $Q_{view}$: Hur väl capture och vald vy överensstämmer;
- $Q_{aux}$: Klubb-/boll-/ljudkvalitet när relevant.

```typescript
quality = geometricMean([
  Q_landmarks ** 0.35,
  Q_geometry  ** 0.25,
  Q_temporal  ** 0.25,
  Q_view      ** 0.15,
]);

quality = Math.min(quality, modeCap[position]);
```

Vikterna är startvärden. Ett hard gate-fel kan inte kompenseras av höga övriga värden. Quality ska senare kalibreras mot observerat tidsfel; före kalibrering heter fältet `qualityScore`, inte `probability`.

### 8.2 Obligatorisk abstention

Systemet ska avstå från berörd position eller hela sekvensen när något av följande gäller:

| Orsak | Scope | reasonCode |
| :--- | :--- | :--- |
| Ingen stabil address eller clipet börjar mitt i svingen | P1 eller sekvens | `NO_STABLE_ADDRESS` / `CLIP_TRUNCATED_START` |
| Ingen säker temporal vändning | P4 och beroende positioner | `NO_TRANSITION` |
| Nyckellandmark under 0.50 eller lucka >50 ms vid event | Position | `LANDMARK_GAP` |
| Handleder/armar byter identitet | Berörda armpositioner | `WRIST_IDENTITY_UNSTABLE` |
| Fel/oklar vy eller stark kamerarörelse | Sekvens | `VIEW_AMBIGUOUS` / `CAMERA_MOVED` |
| Flera personer konkurrerar om spåret | Sekvens | `MULTIPLE_PEOPLE` |
| Kropp/armar lämnar frame | Position eller sekvens | `OUT_OF_FRAME` |
| Under 60 verkliga fps i P6–P8-zonen | P6–P8 | `FPS_TOO_LOW_FOR_FAST_ZONE` |
| Ingen klubba för exakt P2/P6/P8 | Exakt event | `NO_CLUB_SIGNAL` |
| Ingen kontaktdata för exakt P7 | Exakt event | `NO_BALL_CONTACT_SIGNAL` |
| Kandidater kan inte ordnas utan konflikt | Sekvens | `ORDER_CONFLICT` |
| Svingen är pitch/chip/övningsrörelse utanför fullsvingens scope | Saknade positioner | `PARTIAL_SWING` / `NO_BALL_SWING` |
| Confidence under validerad tröskel eller flera nästan lika kandidater | Position | `LOW_SCORE` / `AMBIGUOUS_CANDIDATES` |

**Regel:** Om en beroendeposition saknas får senare positioner fortfarande rapporteras endast om de kan identifieras oberoende och ordningen är säker. Exempel: P4 kan finnas även om P3 avstås. `PipelineTrace` ska visa luckan.

---

## 9. Global eventlösare

En greedy "första frame som matchar" ger fel vid waggle, paus och occlusion. Skapa i stället kandidater och lös hela ordningen med dynamisk programmering.

```typescript
function detectPSequence(rawFrames, context): SequenceResult {
  const validated = validateInput(rawFrames, context);
  if (!validated.sequenceUsable) return abstainSequence(validated.reasons);

  const canonical = canonicalize(validated.frames, context);
  const filtered = smoothWithMasks(canonical, {
    maxGapMs: 50,
    sgWindowMs: context.nominalFps >= 100 ? 75 : 83,
    polyOrder: 2,
  });

  const features = deriveFeatures(filtered, context);
  const phases = segmentSwing(features); // ADDRESS, BACK, DOWN, THROUGH, FINISH
  if (!phases.hasTakeaway || !phases.hasTransition) {
    return abstainSequence(phases.reasonCodes);
  }

  const candidates: Candidate[][] = POSITIONS.map(p =>
    generateCandidates(p, features, phases, context)
      .filter(c => passesHardGates(p, c, context))
      .map(c => ({ ...c, score: scoreCandidate(p, c, context) }))
  );

  const path = solveMonotonicPath(candidates, {
    order: POSITIONS,
    durationPriors: VIEW_SPECIFIC_PRIORS[context.view],
    allowMissing: true,
    missingPenalty: POSITION_MISSING_PENALTY,
  });

  return finalizeWithAbstention(path, features, context);
}
```

### 9.1 DP-princip

För position $k$ och kandidat $j$:
$$D(k, j) = -\log s_{k, j} + \min_{i : t_i < t_j} \left[ D(k-1, i) + \lambda \phi_k(t_j - t_i) \right]$$

där $s$ är kandidatscore och $\phi$ är ett mjukt durationstraff. En särskild missing-state tillåter abstention. Hårda gates gäller fortfarande för tidsordning, extrema tidsluckor och datakvalitet.

### 9.2 Kandidatfunktioner

```typescript
function armParallelCandidate(frame, side, phase, toleranceDeg) {
  const v = frame.wrist(side).sub(frame.shoulder(side));
  return {
    angleErrorDeg: abs(angleToHorizontal(v)),
    persistentMs: localTimeInsideTolerance(toleranceDeg),
    directionOk: phase === "BACK" ? isBackswing(frame) : isThrough(frame),
    q: requiredPointQuality([shoulder(side), elbow(side), wrist(side)]),
  };
}

function topCandidate(t) {
  return combineEvidence({
    progressMaximum: localRobustMaximum(backswingProgress, t),
    reversal: sustainedDirectionChange(gripVelocity, t, 80),
    lowTransitionSpeed: relativeLocalMinimum(gripSpeed, t), // stöd, ej krav
    noIdentitySwap: armTrackStable(t - 80, t + 80),
  });
}

function exactShaftParallelCandidate(t, phase) {
  if (!clubAxis.valid(t) || clubAxis.visibleLength(t) < 0.25 * S2D) return null;
  return {
    angleErrorDeg: angleToGroundPlane(clubAxis.at(t)),
    phaseOk: phaseDirectionMatches(t, phase),
    foreshorteningOk: context.view === "FACE_ON" || club3D.valid(t) || calibrated2D.valid(t),
  };
}
```

---

## 10. Resultatkontrakt

```typescript
type EventStatus = "DETECTED_EXACT" | "DETECTED_PROXY" | "ABSTAIN";

type SwingEvent = {
  position: "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "P9" | "P10";
  semantic: string; // t.ex. IMPACT_PROXY
  status: EventStatus;
  timestampMs: number | null;
  frameIndex: number | null;
  qualityScore: number | null; // ej kallad probability före kalibrering
  temporalUncertaintyMs: number | null;
  view: "FACE_ON" | "DTL";
  evidence: Record<string, number | boolean | string>;
  warnings: string[];
  reasonCode?: string;
};
```

### Exempel utan klubbsignal:
```json
{
  "position": "P7",
  "semantic": "IMPACT_PROXY",
  "status": "DETECTED_PROXY",
  "timestampMs": 1842.6,
  "frameIndex": 221,
  "qualityScore": 0.47,
  "temporalUncertaintyMs": 22.0,
  "view": "FACE_ON",
  "evidence": {
    "distanceToAddressGrip": 0.08,
    "gripSpeedBodyLengthsPerSec": 4.31,
    "phase": "DOWN_TO_THROUGH"
  },
  "warnings": ["NO_CLUB_SIGNAL", "NO_BALL_CONTACT_SIGNAL"]
}
```

### Exempel på abstention:
```json
{
  "position": "P6",
  "semantic": "SHAFT_PARALLEL_DOWNSWING",
  "status": "ABSTAIN",
  "timestampMs": null,
  "frameIndex": null,
  "qualityScore": null,
  "temporalUncertaintyMs": null,
  "view": "DTL",
  "evidence": {},
  "warnings": [],
  "reasonCode": "NO_CLUB_SIGNAL"
}
```

---

## 11. Teststrategi och konkreta testfall

### 11.1 Enhetstester

| ID | Test | Förväntat resultat |
| :--- | :--- | :--- |
| **U01** | 33 landmarks, korrekt indexmappning | Alla named accessors returnerar rätt index |
| **U02** | Höger-/vänsterhänt mapping | Lead/trail byts exakt; MediaPipe-index ändras inte |
| **U03** | Rotera 90/180/270° och canonicalisera | Samma normaliserade featurevärden inom tolerans |
| **U04** | Mirrored preview, omirrorerad inference | Eventtider oförändrade; ingen dubbel spegling |
| **U05** | Ojämna PTS med samma rörelse | Hastighet baseras på tid och matchar referens $\pm 2\%$ |
| **U06** | Lucka 33 ms med bra ändpunkter | Interpoleras och flaggas |
| **U07** | Lucka 67 ms | Interpoleras inte; relevant event avstår |
| **U08** | Lead arm passerar horisontell två gånger | P3 väljs före P4, P5 efter P4 |
| **U09** | Trail arm horisontell efter P8 | P9 använder trail, inte lead |
| **U10** | Klubba saknas | P2/P6/P8 aldrig `DETECTED_EXACT` |
| **U11** | Boll/klubbkontakt saknas | P7 aldrig `DETECTED_EXACT` |
| **U12** | Två kandidater med samma lokalscore | DP väljer globalt giltig sekvens eller avstår |

### 11.2 Syntetiska tidsserier

```typescript
it("does not treat a waggle as takeaway", () => {
  const clip = address()
    .then(waggle({ displacementS: 0.03, returnsToAddress: true }))
    .then(fullSwing());
  expect(detect(clip).P1.timestampMs).toBeAfter(waggleEnd);
});

it("keeps top at the last frame before downswing after a pause", () => {
  const clip = swingWithTopPause(180);
  const p4 = detect(clip).P4;
  expect(p4.timestampMs).toBeWithin(1 / clip.fps * 1000, downswingStartMs);
});

it("abstains across a wrist identity swap", () => {
  const clip = injectIdentitySwap(fullSwing(), { around: "P5", durationMs: 90 });
  expect(detect(clip).P5.reasonCode).toBe("WRIST_IDENTITY_UNSTABLE");
});
```

### 11.3 Golden-videofall

| ID | Variation | Måste verifiera |
| :--- | :--- | :--- |
| **G01** | FO, högerhänt, 120 fps | Komplett ordnad sekvens; proxyetiketter utan klubba |
| **G02** | FO, vänsterhänt, 120 fps | Speglingsinvarians och rätt lead/trail |
| **G03** | DTL, högerhänt, 120 fps | Överlappande handleder; ingen ID-swap |
| **G04** | DTL, vänsterhänt, 60 fps | View-/handedness-specifik logik |
| **G05** | 240 fps referens nedprovas till 120/60/30 | Fel och coverage mot fps |
| **G06** | Lång paus på toppen | P4 vid slutet av pausen, inte början |
| **G07** | Flera waggles | P1 omedelbart före riktiga takeaway |
| **G08** | Kort Rahm-liknande backsving | P4 hittas utan krav på skaft parallellt |
| **G09** | Overswing | P4 temporal vändning, inte första höjdmaximum |
| **G10** | Early extension/ovanlig stil | Händelser hittas utan att "ideal" geometri krävs |
| **G11** | Chip/pitch | `PARTIAL_SWING`; inga fabricerade P2–P10 |
| **G12** | Practice swing utan boll | P7 högst proxy; `NO_BALL_SWING` om detta är känt |
| **G13** | Klippt start eller slut | `CLIP_TRUNCATED_*`; P1/P10 avstår |
| **G14** | Armar ur frame vid top | P4 avstår eller får låg coverage enligt gate |
| **G15** | DTL-foreshortened klubb | P2/P6/P8 exact avstår |
| **G16** | Två personer i frame | Dominant-track gate eller `MULTIPLE_PEOPLE` |
| **G17** | Samsung VFR-video | PTS-baserad timing; ingen drift från nominal fps |
| **G18** | EXIF 90°/270° | Samma tider som fysiskt roterad referens |
| **G19** | Kamera skakar under impact | Snabbzonen avstår eller stabiliseras med trace |
| **G20** | Svart klädsel/kontrastsvag arm | Landmark-gate fungerar; ingen dold fallback |

### 11.4 Annoteringsprotokoll

- Minst två kvalificerade annotatörer markerar varje event oberoende.
- P2/P6/P8 annoteras bara när klubban syns; P7 kräver synlig kontakt eller högfrekvent kontaktreferens.
- Oenighet anges som intervall, inte tvingad punkt.
- Ground truth lagrar `eventTime`, `acceptableStart`, `acceptableEnd`, `view`, `handedness`, `fps` och orsak när event inte går att se.
- Ett adjudicerat facit skapas utan tillgång till modellens prediktion.
- Träning/tuning, kalibrering och final test hålls åtskilda per spelare så att samma person inte läcker mellan set.

---

## 12. Acceptanskriterier och release-gates

### 12.1 Dataintegritet

| Gate | PASS |
| :--- | :--- |
| **Real landmarks** | Exakt 33 verkliga MediaPipe-landmarks/frame; ingen mock eller tyst fallback i produktion |
| **Tidsstämplar** | 100 % strikt monotona; derivator använder PTS |
| **Rotation/mirroring** | Guldklipp ger samma events efter alla stödda rotationer/speglingar inom 1 frame |
| **Trace** | Rådata, filterversion, parametrar, gaps, view, handedness och reason codes sparas |
| **Ordningsinvariant** | 100 % av returnerade event uppfyller strikt $P1 < \dots < P10$ |
| **Semantisk ärlighet** | 0 fall där pose-only returnerar exact P2/P6/P7/P8 |

### 12.2 Modellkvalitet på låst testset

Minsta releaseunderlag: $\ge 200$ fulla svingar, balanserat över FO/DTL, vänster-/högerhänt, 60/120+ fps, flera enhetsmodeller, kroppslängder, kläder och ljus. Rapportera resultat per stratum, inte bara totalmedel.

| Mått | Gate v1 |
| :--- | :--- |
| P1/P3/P4/P5/P9/P10 median absolut tidsfel vid $\ge 60$ fps | $\le 1.5$ frames |
| Samma event, 95:e percentil | $\le 3$ frames |
| Exact P2/P6/P8 med godkänd klubbsignal, median | $\le 1.5$ frames |
| Exact P7 med klubb+boll vid $\ge 120$ fps, median | $\le 1$ frame eller inom annotatörernas intervall |
| P7 `temporalUncertaintyMs` coverage | Ground truth inom rapporterat intervall i $\ge 90\%$ |
| Klassificerbara kvalitetsklipp: sequence coverage | $\ge 90\%$ FO, $\ge 85\%$ DTL |
| Kända dåliga/oklara klipp: korrekt abstention | $\ge 95\%$ |
| False exact rate för klubbberoende event utan stöd | 0 % |
| Vänster/höger- och speglingsskillnad efter stratifiering | Ingen statistiskt eller praktiskt relevant systematisk bias |

> Accuracy ska alltid rapporteras tillsammans med coverage. Ett system som avstår på allt får inte godkännas; ett system som gissar på allt får inte heller godkännas.

### 12.3 Prestanda och robusthet

- 60- och 120-fps-video ska ge samma eventordning.
- $120 \rightarrow 60$-nedprovning ska hålla P1/P3/P4/P5/P9/P10 inom 2 frames i minst 95 % av kvalitetsklippen.
- Pipeline får inte krascha vid tomt resultat, tappad frame, låg confidence eller saknad world landmark.
- Samma deterministiska input och konfiguration ska ge samma resultat.
- Live-latens, offlineanalystid och peak memory mäts separat på mål-Samsung och minst en iPhone; ingen kvalitetsgate får tyst sänkas för att nå realtid.

---

## 13. Rekommenderad implementationsordning

### Leverans A — Pose-only, ärliga proxyer
1. Lås `PoseFrame`, canonicalisering och `PipelineTrace`.
2. Implementera quality masks, gap-regel, offline-smoothing och timestampderivator.
3. Implementera address/takeaway, P3/P4/P5/P9/P10.
4. Lägg till uttryckliga P2/P6/P7/P8-proxyer med caps och warnings.
5. Implementera DP-ordning och abstention reason codes.
6. Kör unit- och golden-tester FO/DTL, höger/vänster, 60/120 fps.

### Leverans B — Exakta klubbberoende event
1. Lägg till klubbaxel-/klubbshuvuddetektor och synlig-längd/foreshortening-gates.
2. Lägg till bollposition eller manuell bollkalibrering.
3. Fusera klubb–boll–eventuellt ljud för P7 med subframe-estimat.
4. Kalibrera exact-event separat per vy och fps.
5. Behåll pose-only-fallback endast som synligt märkt proxy, aldrig tyst.

### Leverans C — Kalibrering och produktgate
1. Frys annoteringsmanual och testset.
2. Tune trösklar på tuning-set; kalibrera quality på calibration-set.
3. Kör låst testset och redovisa accuracy + coverage + abstention per stratum.
4. Aktivera coachningsmått först efter att eventgaten passerat; inget biomekaniskt mått ska beräknas från en avstådd position.

---

## 14. Definition of Done

P1–P10-modulen är klar först när följande påstående är sant:

> För en given video kan systemet visa exakt vilka råa 33-punktsframes, kvalitetsvärden, filterparametrar, vyregler och temporala bevis som ledde till varje P-position; klubbberoende event är antingen stödda av verklig klubb-/bolldata eller tydligt märkta proxyer; osäkra event avstås med en specifik orsak; och hela beteendet klarar de låsta accuracy-, coverage-, invarians- och abstention-gaterna utan mockdata eller tyst fallback.

---

## 15. Källor och tekniska noter

1. Google AI Edge, *Pose landmark detection guide* — Pose Landmarker tar bild, dekodade videoframes eller livevideo och returnerar normaliserade landmarks samt world landmarks; modellen ger 33 3D-punkter. https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
2. Google AI Edge, *Pose landmark detection guide for Android* — VIDEO/LIVE_STREAM använder tidsstämplar; utdata inkluderar x/y/z, visibility och presence, samt world coordinates i meter med höftcentrum som origo. https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/android
3. Google AI Edge, *Pose landmark detection guide for iOS* — MPImage-orientering, video-/live-API och begränsning för speglade orienteringar. https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/ios
4. Bazarevsky et al., *BlazePose: On-device Real-time Body Pose Tracking*, arXiv:2006.10204. https://arxiv.org/abs/2006.10204
5. Casiez, Roussel & Vogel, *1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems*. https://gery.casiez.net/1euro/

**Normativitet:** Källorna beskriver MediaPipe och filtreringsprinciper. P1–P10-regler, trösklar, confidence-fusion och acceptanskriterier i detta dokument är en projektspecifik engineering-specifikation och måste verifieras mot SwingSwangs märkta golfdataset.
