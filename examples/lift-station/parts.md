# Lift-station reference panel: parts list (draft 2)

2026-11-06. Claude, from research agents and Joy's own catalog
(`randd/catalog`). Engineering calls are made below under **Assumptions**,
each with its arithmetic; James reviews them in passing, not as a gate. The
design decisions behind it are in
`content/library/plant.md` (D1–D8). **The panel is virtual** (a 3D build, not
a purchase), so price, stock and lead time don't matter. What matters is
that each part is real, with published dimensions, ratings and CAD.

Confidence column: **verified** means the catalog number and ratings were
read on the maker's or distributor's own page or cut sheet. **partly** means
it came from a catalog PDF or a third-party listing only. Nothing here is
guessed. Where a number couldn't be verified, the cell is blank.

Vendor rule: AutomationDirect (AD) where it has a suitable UL product,
because it publishes ratings openly and offers free CAD downloads. Specialists for
hazardous-area and pump-protection parts. Joy's catalog for the controller,
I/O and network.

## 1 · Power and motors

**Main disconnect sizing (Q1).** The drive input is 2 × 26 A (variable
torque), plus about 2.1 A of control load, so 54 A. × 1.15 (NEC 430.128)
gives 62 A. The bypass check by equivalent hp (430.110(C)) gives 44 A, which
is 40 hp. The 60 A FUSERBLOC is rated only 30 hp at 480 V, so this uses the
100 A frame. The maximum main fuse under 430.62 is 45 + 26 + 2.1 = 73 A, so
70 A Class J time-delay fuses.

**Bypass topology.** The GS4 manual (ch. 2) says "Do not connect the AC input
power to the T1, T2, and T3 output terminals." So each pump has a drive
output isolation contactor (M…A), mechanically interlocked with its bypass
contactor (M…B). Coils are 120 VAC.

| Function | Tag | Make | Catalog no. | Key ratings | W×H×D mm | STEP | Source | Conf. |
|---|---|---|---|---|---|---|---|---|
| Main fusible disconnect | Q1 | Socomec (AD) | 38613010 | 100 A 3P 600 VAC, UL 98, Class J ≤100 A; 60 hp / 77 A at 480 V; SCCR 200 kA with Class J | 149×186×122 | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/circuit_protection_-z-_fuses_-z-_disconnects/disconnects_-a-_switches/fused_disconnects/38613010), [spec](https://cdn.automationdirect.com/static/specs/fuserblocul98f.pdf) | verified |
| Q1 through-door handle | Q1-H | Socomec (AD) | 142D2111 | S2 handle, NEMA 4/4X, lockable off | — | yes | [AD](https://www.automationdirect.com/pn/142D2111) | verified |
| Q1 shaft | Q1-S | Socomec (AD) | 14001032 (320 mm) or 14001020 (200 mm) | length set by enclosure depth | — | ? | fuserblocul98f.pdf | partly |
| Main fuses | FU1–3 | Edison (AD) | JDL70 | 70 A Class J time-delay, 600 VAC, IR 200 kA | — | — | [cut sheet](https://cdn.automationdirect.com/static/specs/cutsheet/JDL70_cutsheet.pdf) | verified |
| Surge protective device | SPD1 | Mersen (AD) | STXR480Y05N | UL 1449 Type 1, 480Y/277 wye 4W+G, In 20 kA, SCCR 200 kA, VPR 1200 V L-N | 85×85×79 | ? | [cut sheet](https://cdn.automationdirect.com/static/specs/cutsheet/STXR480Y05N_cutsheet.pdf) | verified |
| Phase monitor | PMR1 | Klemsan (AD) | P1D-M1WASF-295-480 | 150–500 VAC 3φ; loss, reversal, unbalance, over/under V; SPDT 10 A; SCCR not stated | 18×90×64 | ? | [cut sheet](https://cdn.automationdirect.com/static/specs/cutsheet/P1D-M1WASF-295-480_cutsheet.pdf) | verified |
| PMR fuse holder / fuses | FU7–9 | Edison (AD) | EHCC3DU / HCTR1 | Class CC 30 A 3P holder, SCCR 200 kA; 1 A Class CC TD fuses | — | ? | [holder](https://cdn.automationdirect.com/static/specs/cutsheet/EHCC3DU_cutsheet.pdf), [fuse](https://cdn.automationdirect.com/static/specs/cutsheet/HCTR1_cutsheet.pdf) | verified |
| VFD, pump 1 / 2 | VFD101 / VFD201 | DURApulse (AD) | GS4-4015 | 15 hp 460 V; VT out 24 A / in 26 A; SCCR 100 kA; **heat 380 W** (287 heatsink + 93 internal); IP20 | 190×320×190 | yes | [AD](https://www.automationdirect.com/pn/GS4-4015), [spec](https://cdn.automationdirect.com/static/specs/gs4drives.pdf) | verified |
| Modbus TCP card | VFD101-COM / VFD201-COM | DURApulse (AD) | GS4-CM-MODTCP | Modbus TCP, 1 RJ45, comm timeout | — | ? | [cut sheet](https://cdn.automationdirect.com/static/specs/cutsheet/GS4-CM-MODTCP_cutsheet.pdf) | verified |
| Drive input fuses (per listing) | FU101–103 / FU201–203 | Edison (AD) | JHL45-1 | 45 A high-speed Class J, 600 VAC; the drive's fuse chart lists only JHL45 or TJS45, no breaker | — | — | [cut sheet](https://cdn.automationdirect.com/static/specs/cutsheet/JHL45-1_cutsheet.pdf) | verified |
| Class J fuse holders | (drive and bypass) | Bussmann (AD) | CH60J3 | 60 A Class J 3P, SCCR 200 kA; pack of 2, need 4 | — | ? | [cut sheet](https://cdn.automationdirect.com/static/specs/cutsheet/CH60J3_cutsheet.pdf) | verified |
| Bypass branch fuses | FU104–106 / FU204–206 | Edison (AD) | JDL40 | 40 A Class J TD (175 % × 21 A, 430.52), IR 200 kA | — | — | [cut sheet](https://cdn.automationdirect.com/static/specs/cutsheet/JDL40_cutsheet.pdf) | verified (sizing ⟨PE⟩) |
| Bypass contactor | M101B / M201B | AD | GH15ET-3-00A | 15 hp 480 V, 32 A; coil 120 VAC, 80–100 VA pickup / 9–12 VA sealed; **SCCR 5 kA** | 45×80×91 | yes | [AD](https://www.automationdirect.com/pn/GH15ET-3-00A), [spec](https://cdn.automationdirect.com/static/specs/ghseriescontactors.pdf) | verified |
| Drive output contactor | M101A / M201A | AD | GH15ET-3-00A | as above | 45×80×91 | yes | as above | verified |
| Mechanical interlock A↔B | — | AD | BM0H | side mount, GH15 | — | ? | ghseriescontactors.pdf | partly |
| Bypass overload | OL101 / OL201 | AD | RTD32-2400 | 17–24 A, class 10A, phase-loss sensitive, mounts on GH15ET | ≈45×146×91 with contactor | ? | [cut sheet](https://cdn.automationdirect.com/static/specs/cutsheet/RTD32-2400_cutsheet.pdf) | verified |
| Control power transformer | T1 | BLOCK (AD) | CT-050-048-12-1 | 500 VA 480:120 V, integral Class CC fuse block; UL **Recognized**, not Listed | ≈145×141×138 | yes | [cut sheet](https://cdn.automationdirect.com/static/specs/cutsheet/CT-050-048-12-1_cutsheet.pdf) | verified (size ⟨PE⟩, see below) |
| CPT fuses | FU10–11 / FU12 | Edison (AD) | HCTR2-5 / HCTR6 | 2.5 A primary, 6 A secondary, Class CC TD | — | — | [pri](https://cdn.automationdirect.com/static/specs/cutsheet/HCTR2-5_cutsheet.pdf), [sec](https://cdn.automationdirect.com/static/specs/cutsheet/HCTR6_cutsheet.pdf) | verified |
| 120 V branch breakers | CB1 light, CB2 receptacle, CB3 heater, CB4 24 V supply | Gladiator (AD) | GMCBU-1C-10 / -1C-15 / -1C-10 / -1C-6 | UL 489, 1P, C curve, IR 10 kA at 277 V | 18 wide | yes | [cut sheet](https://cdn.automationdirect.com/static/specs/cutsheet/GMCBU-1C-15_cutsheet.pdf) | verified |
| Generator inlet (outside the panel) | GEN-IN | Hubbell | HBL4100B7W (3P4W); HBL5100B7W if a neutral is needed | 100 A 480 V, IEC 60309, IP67 | — | ? | [Hubbell](https://www.hubbell.com/hubbell/en/products/p/163954) | partly |
| Manual transfer switch (outside the panel) | MTS | Eaton | DT363URK | 100 A 3P 600 VAC heavy-duty double-throw, NEMA 3R | — | ? | [Gexpro](https://www.gexpro.com/p/364962/eaton/safety-switch-100a-3p-600vac-250vdc-hd-non-fusible-nema-3r/782113426426/dt363urk) | partly |

## 2 · Controller, I/O and network

From Joy's catalog (`randd/catalog/items.json`, `io.json`).

| Function | Tag | Make | Catalog no. | Key ratings | Why |
|---|---|---|---|---|---|
| Controller (Linux PC running Nautilus) | PC1 | OnLogic | Karbon 410 (K410) | Atom x6425E, 8 GB; 9–48 VDC; −40 to 70 °C; UL 62368-1; DIN kit | Outdoor box with two drives in it; the cheaper Factor 201 is rated only to 60 °C |
| Remote I/O head | RIO1 | Moxa | ioThinx 4510 (-T) | Modbus TCP server, 7 clients, comm-loss safe values; 12–48 VDC | D5 |
| Digital inputs | RIO1-1, -2 | Moxa | 45MR-1600 (-T) ×2 | 16 DI 24 VDC each | 13 DI used already; two modules for spare |
| Digital outputs | RIO1-3 | Moxa | 45MR-2601 (-T) | 16 DO 24 VDC sourcing | beacon, horn, fail and high-level pilots |
| Analog inputs | RIO1-4 | Moxa | 45MR-3800 (-T) | 8 AI 4–20 mA | LIT-101, FIT-101, spare |
| Ethernet switch | SW1 | Moxa | SDS-G3008 (-T?) | 8 GbE, MRP/RSTP; UL | UL-listed (the Planet switch in the catalog isn't) |
| Cellular router (gateway .1) | RTR1 | Teltonika | RUT241 | LTE Cat 4, North American carrier certified, 9–30 VDC, DIN kit | D8 |
| DC UPS | UPS1 | Phoenix Contact | QUINT4-UPS/24DC/24DC/10 (2907066) | 10 A, communicating | D7 |
| UPS battery | BAT1 | Phoenix Contact | UPS-BAT/PB/24DC/4AH | 4 Ah lead | D7; catalog number to confirm |
| 24 VDC supply | PS1 | AD (Rhino) | PSR-24-240 or Mean Well SDR-240-24 | 10 A | PNL-F12 sets the size |

## 3 · Control, door, hazardous area and enclosure

Floats and the level transmitter go through intrinsically safe devices
(D4). Door operators are one family (Eaton HT800, 30 mm, sold by AD).

| Function | Tag | Make | Catalog no. | Key ratings | W×H×D mm | STEP | Source | Conf. |
|---|---|---|---|---|---|---|---|---|
| IS relay, 2 ch, both floats | ISR1 | Pepperl+Fuchs | KFD2-SR2-Ex2.W (203355) | 19–30 VDC ≤1 W; 2 × SPDT 30 VDC/2 A; Uo 10.5 V, Io 13 mA, Po 34 mW; cULus dwg 116-0473, FM dwg 116-0035 | 20×119×115 | ? | [datasheet](https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/203355_eng.pdf) | verified |
| IS isolator, 4–20 mA level loop | ISB1 | Pepperl+Fuchs | KFD2-STC5-Ex1 (239206) | 18–30 VDC ≤1.6 W; ≥16 V at 20 mA to the field; out 4–20 mA source/sink; Uo 26.2 V, Io 93 mA, Po 634 mW; cULus dwg 116-0439 | 20×124×115 | ? | [datasheet](https://files.pepperl-fuchs.com/webcat/navi/productInfo/pds/239206_eng.pdf) | verified |
| Pump protection relay (seal leak + thermal) | PPR101 / PPR201 | Macromatic | TCF7F (+ 70170-D 11-pin socket) | 24 VAC/DC 3 VA; 2 × SPDT 7 A; replaces Flygt MiniCAS for FLA/CLS sensors | — | eCAD only | [Macromatic](https://macromatic.com/product/tcf7f/) | verified (socket partly) |
| HOA selector | SS101 / SS201 | Eaton HT800 (AD) | HT8JBH1DAA5 | 3-pos maintained, 2 N.O. (HT8A); NEMA 4/4X | 30.5 mm hole | no (kit) | [AD](https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/selector_switches/ht8jbh1daa5) | verified |
| VFD/Off/Bypass selector | SS102 / SS202 | Eaton HT800 (AD) | HT8JBH1DAA5 (+ HT8A/HT8B for interlocks) | as above | 30.5 mm | no | as above | verified |
| Gold contact block (contacts to 24 VDC DI only) | — | Eaton HT800 (AD) | HT8E | 5 V/1 mA min, 28 V/500 mA max | — | ? | [spec](https://cdn.automationdirect.com/static/specs/eaton30mm3select.pdf) | verified |
| RUN pilot, green | PL101 / PL201 | Eaton HT800 (AD) | HT8HFGV3 + HT8LEDGF3 | 24 VAC/DC; LED current not published (≤50 mA) | 30.5 mm | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/eaton_cutler-hammer_30mm_(ht800_series)/indicators_(regular_-a-_push-to-test)/ht8hfgv3) | verified |
| FAIL pilot, red | PL102 / PL202 | Eaton HT800 (AD) | HT8HFRV3 + HT8LEDRF3 | as above | 30.5 mm | ? | [spec](https://cdn.automationdirect.com/static/specs/eaton30mmii.pdf) | verified |
| High-level pilot, amber | PL1 | Eaton HT800 (AD) | HT8HFAV3 + HT8LEDAF3 | as above | 30.5 mm | ? | as above | verified |
| Alarm reset pushbutton | PB1 | Eaton HT800 (AD) | HT8AAHA (or HT8AAH + HT8E for a DI) | black flush, 1 N.O. | 30.5 mm | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/pushbuttons/ht8aaha) | verified |
| Beacon + horn, one unit | BCN1 | Pfannenberg PYRA (AD) | 21556818055 | 12–48 VDC; light 120 mA, sounder 15 mA, separate inputs; 101 dB; colour selectable; NEMA 4/4X | 166×114×134 | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/pushbuttons_-z-_switches_-z-_indicators/signaling_devices/audible-visual_signaling_devices/21556818055) | verified |
| Interposing relay + socket | CRx | AD | 782-2C-24D + 782-2C-SKT | 24 VDC coil 1.15 W; DPDT 15 A | — | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/relays_-z-_timers/electro-mechanical_relays/782-2c-24d) | verified |
| Enclosure | ENC | Hammond Eclipse | EN4SD723612SSR | 72×36×12 in, 304 SS, NEMA 3R/4/4X/12/13 (was the 60×36 EN4SD603612SSWH: assumption 26) | 914×1829×305 | yes | [Standard Electric](https://www.standardelectricsupply.com/Hammond-Manufacturing-EN4SD723612SSR-Eclipse-Single-Door-Enclosure) | verified |
| Backpanel | ENC-BP | Hammond | EP7236 | 12 ga steel, 34.2×70.2 in | 869×1783 | yes | [Standard Electric](https://www.standardelectricsupply.com/Hammond-Manufacturing-EP7236-Inner-Panel) | verified |
| Inner swing-out dead front | ENC-SP | Hammond (AD) | ESP6036 | 12 ga steel, 33.79×57.75 in | 858×1467 | ? | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/enclosure_parts_-a-_accessories/swing_panels/esp6036) | partly |
| Air conditioner | AC1 | Stratus (AD) | TA10-059-16-4X (or TA10-033-16-4X, 3300 BTU/h) | 5910 BTU/h (≈1730 W); 115 VAC, 6.14 A run, **32.3 A inrush**, 12 A TD fuse; Type 4X | — | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosures_-z-_subpanels_-z-_thermal_management_-z-_lighting/enclosure_thermal_management/air_conditioners/ta10-059-16-4x) | verified |
| Heater with thermostat | HTR1 | Stego (AD) | 027009-01 | 550 W 120 VAC (≈4.6 A); thermostat 0–60 °C; UL Recognized | — | no | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosure_thermal_management_-a-_lights/heaters/027009-01) | verified |
| Panel light | LT1 | Stego (AD) | 122040-00 | 120 VAC 16 W, own switch and receptacle | 693 long | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosure_thermal_management_-a-_lights/enclosure_lighting/122040-00) | verified |
| Door switch for LT1 | DS1 | Stego (AD) | 013500-00 | SPDT 10 A 250 VAC; no UL listing shown | — | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/enclosure_parts_-a-_accessories/door_switches/013500-00) | partly |
| GFCI receptacle | REC1 | Gladiator (AD) | GR-REC2-GFCI | 15 A 125 VAC, DIN/panel; needs 20 A protection | — | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/wire_-a-_cable_termination/wiring_devices/din_rail_receptacles/gr-rec2-gfci) | verified |
| Ground bar | GB1 | Saginaw (AD) | SCE-GB10 | 4 in, 10 × #10-32, tinned copper; no UL listing shown | 102 long | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/enclosure_parts_-a-_accessories/grounding_-a-_isolation/sce-gb10) | verified |
| Terminal, feed-through 2.5 mm² | TB | AD DINnector | DN-T12-A (100/pk) | 600 V 20 A, SCCR 100 kA | 5 wide | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/terminal_blocks/dinnector_din-rail_terminal_blocks/single-level_feed-through_terminal_blocks/dn-t12-a) | verified |
| Terminal accessories | TB acc. | AD DINnector | DN-EC1210 end cover; DN-2J2Y / DN-3J2Y / DN-24J2Y jumpers; DN-EB35-A end bracket | — | — | ? | [spec](https://cdn.automationdirect.com/static/specs/dinfeedthru.pdf) | verified |
| Ground terminal | TB-PE | AD DINnector | DN-G10 | 4 mm², bonds to rail | 7 wide | ? | [spec](https://cdn.automationdirect.com/static/specs/dingnd.pdf) | verified |
| Fused 24 VDC terminal, LED | FTB | AD DINnector | DN-F10L24 (10/pk) | 5×20 fuse 6.3 A max (fuses separate); LED polarity-sensitive | 10 wide | ? | [AD](https://www.automationdirect.com/adc/shopping/catalog/wiring_solutions/terminal_blocks/circuit_protection_terminal_blocks/dn-f10l24) | verified |
| DIN rail | DIN | AD | DN-R35S1 | 35×7.5 slotted | — | ? | [spec](https://cdn.automationdirect.com/static/specs/dinfeedthru.pdf) | verified |
| Wire duct | DUCT | Iboco T1 (AD) | T1-2230G-1 | 2.25 W × 3 H in, 2 m, slotted with cover | 57×76×2000 | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/wire_-a-_cable_management/wire_duct/wide_finger_wall/t1-2230g-1) | verified |

**24 VDC load from this section:** about 28 W with margin. That's the IS
devices (2.6 W), two TCF7F relays (≈6 VA), the beacon and horn (3.2 W),
eight interposing relays (9.2 W) and five pilots at the 50 mA ceiling (6 W).
The controller, I/O, switch and router come on top. PNL-F12 adds it all up.

## Assumptions (decided 11-06)

Each item states the call and the arithmetic. Every one of them is also the
spec for a future `sepia check`, so the tool makes these calls next time,
not a person (design.md §5).

1. **Available fault current is an input, not a choice.** It comes from the
   utility transformer and the service cable, so it lives in `sepia.json`
   under `service`. Assumed: 150 kVA, 480Y/277 V, 2.0 %Z pad mount.
   I = 150 000 / (√3 × 480) / 0.020 ≈ **9.0 kA** at the transformer (cable
   impedance ignored, so this is conservative). The panel SCCR is **5 kA**,
   limited by the GH15ET contactors and RTD32 overloads. The example
   therefore **fails** the SCCR check on purpose. Fixing it is lesson
   PNL-P02 (Class J fuse combination ratings under UL 508A SB4, or a
   contactor family with published high-fault ratings).
2. **Bypass protection as drawn:** JDL40 time-delay fuses, tapped ahead of
   the JHL45 drive fuses. 175 % × 21 A = 36.75 A, next size up is 40 A
   (430.52).
3. **Heat:** two drives at 380 W is 760 W, plus sun load, so about 1.0 to
   1.5 kW. The TA10-059 A/C (≈1730 W) stays. No flange kit, because it
   would break the 4X rating.
4. **CPT: 3 kVA, replacing the 500 VA unit.** The 120 V load:

   | Load | VA |
   |---|---|
   | A/C, 6.14 A running | 737 |
   | Heater | 550 |
   | Receptacle (220.14(I)) | 180 |
   | Light | 16 |
   | Four contactor coils, sealed, 4 × 12 | 48 |
   | 24 V supply, 240 W ÷ 0.9 | 267 |
   | **Total** | **≈1800** |

   2 kVA would carry that at 90 %. 3 kVA leaves room for the A/C's 32 A
   inrush. **Changed 11-07: 2.5 kVA, BLOCK CT-250-048-12-0.** AutomationDirect
   has no 3 kVA 480:120 V unit (the BLOCK CT series stops at 2.5 kVA, and
   Hammond's SP3000MQMJ was retired). Running: 1800 VA on 2.5 kVA is 72 %.
   Starting: the A/C's 32.3 A inrush is 3.9 kVA for a moment, on top of
   about 1.1 kVA of everything else, so 5.0 kVA, or 2.0 × rating. The sag
   is roughly 1.9 %Z × 2.0 ≈ 4 %, so the secondary holds about 115 V,
   well above the 85 % (102 V) a contactor coil needs to stay in. BLOCK
   doesn't publish inrush VA for the CT series; this estimate is the
   check, and it ignores the start's power factor.
5. **Drive:** GS4-4015 holds. The pump is 15 hp at 460 V, 21 A per NEC
   Table 430.250, under the 24 A VT rating.
6. **Overloads:** in the bypass leg only. In VFD mode the drive protects the
   motor.
7. **Neutral:** it comes in for the SPD only. Every 120 V load is on the CPT.
   The transfer is 3-pole with a solid neutral, so the generator inlet is
   HBL5100B7W (4P5W).
8. **Q1 is not the service disconnect.** The utility meter-main upstream is
   the service disconnect. Q1 is the panel main, and its 70 A fuses sit
   above both the 45 A drive fuses and the 40 A bypass fuses.
9. **SPD on the load side of Q1**, so Q1's fuses protect it.
10. **A/C on its own time-delay fuse, FU13,** because its listing asks for
    a 12 A fuse, not a breaker. There's no 12 A Class CC at
    AutomationDirect, so it's **10 A** (HCTR10), the next size under the
    listing's maximum. That's 163 % of the 6.14 A running current, and a
    time-delay fuse rides through the 32 A start. (Changed 11-07: this was
    CB5.)
11. **Enclosure: keep the Hammond (now 72×36×12 in, assumption 26) and drop the swing-out dead
    front (ESP6036).** The operators go on the main door. Depth check:
    305 mm − ≈15 mm standoff − 190 mm drive = 100 mm, which clears the
    ≈70 mm operator bodies as long as no operator sits directly in front of
    a drive. That becomes a 3D clearance check.
12. **Wet well: Class I, Div 1** (an unventilated wet well under NFPA 820).
    Floats go through KFD2-SR2 with line-fault detection off by DIP switch.
    The level transmitter goes through KFD2-STC5. Pump sensor leads follow
    the pump's FM listing.
13. **Hand is hardwired** (D6). HT8E gold blocks feed 24 VDC inputs, and
    HT8A blocks switch 120 VAC coils.
14. **The ground bar and door switch without UL files** are accepted for
    the example. The beacon gets any listed Type 4X hub.
15. **Wire numbering** (James 11-06): line numbers inside the panel,
    from-to at the field terminals.

## Assumptions added drawing the full panel (11-07)

16. **CPT fuses, for 2.5 kVA at 480:120 V with primary and secondary
    protection (NEC 450.3(B)).** Primary current is 2500 ÷ 480 = 5.21 A,
    and up to 250 % is allowed, so 13.0 A. The pick is **10 A Class CC
    time-delay** (HCTR10 ×2 in an EHCC2DU), which rides through magnetizing
    inrush. Secondary current is 2500 ÷ 120 = 20.8 A, and 125 % is 26 A.
    The pick is **25 A** (HCTR25 in an EHCC1DU).
17. **Each pump's control circuit has its own breaker**, CB6 and CB7 (6 A),
    so a fault in one pump's control doesn't drop the other. Their outputs,
    wires 211 and 213, are the left rails of sheets 3 and 4. The flow meter
    has CB8.
18. **The drive's run input follows its output contactor.** The drive
    output contactor's aux N.O. (13-14) feeds both the controller's input
    and the drive's DI1, from the panel's 24 VDC. The drive's inputs are set
    to source mode, with the common tied to 0 V. In Auto the controller sets
    the speed over Modbus. In Hand, a running controller still sets it, and
    with the controller dead the drive holds its last speed (its
    communication-loss action, a drive parameter for PNL-F07).
19. **Pump protection relays report, they don't stop the pump.** The TCF7F
    reads one loop per pump (pins 5 and 7): the seal probe in series with
    the motor's N.C. thermal switch. Its two alarm contacts (leak 11–9,
    temperature 1–4) go to inputs, and the controller trips the pump.
    In Hand with the controller dead, nothing stops a hot motor except the
    bypass overload. Wiring the thermal contact into the run circuit is a
    good lesson change and an easy edit.
20. **Field wiring lands on three strips:** TB1 for 120 VAC (the flow
    meter's power), TB2 for 24 VDC (the pump sensors and the flow signal),
    and TBIS for the intrinsically safe circuits only (the floats and
    LIT-101), in light blue per NEC 504.80. Pump sensor leads aren't on
    TBIS, because they follow the pump's own FM listing (assumption 12).
21. **Pilots and the beacon are controller outputs.** With the controller
    dead they're dark. A hardwired "running" pilot from an aux contact is
    the usual alternative.
22. **Power wire numbering:** a power conductor takes its branch number and
    phase or terminal (103L1 into the drive, 103U out of it, 103T1 to the
    motor). The incoming conductors keep their phase names (L1, L2, L3, N).
23. **Fused 24 VDC terminals (FTB1–8)** protect each load on its own:
    controller 4 A, remote I/O, switch and router 2 A each, IS barriers and
    pump relays 1 A each, input field power (FP+) 2 A, and the output
    module's supply (EXT+) 2 A. That totals 16 A of fusing on a 10 A supply,
    which is normal because they don't all draw their fuse rating. PNL-F12
    adds up the real load. The input contacts are sourced from the +24 rail
    rather than from FP+. It's the same supply and potential, fused
    separately, though Moxa's guide shows the contacts on FP+.
24. **The level loop's IS entity check passes.** KFD2-STC5-Ex1 output to
    the field: Uo 26.2 V, Io 93 mA, Po 634 mW. The FMX21's entity limits:
    Vmax 30 V, Imax 133 mA, Pmax 1 W. Every source value is under its
    limit. The cable's capacitance and inductance haven't been checked
    against Co and Lo yet, which is the PNL-A01 exercise and a future
    `sepia check`.
25. **Parts picked 11-07** (verified by research unless marked): BLOCK
    CT-250-048-12-0, Edison EHCC2DU/EHCC1DU with HCTR10/HCTR25, Rhino
    PSR-24-240, Phoenix UPS-BAT/PB/24DC/4AH (1274117), SJE-Rhombus
    MilliAmpMaster 1016213 floats (partly: SJE's sheet hosted by a
    distributor), E+H Waterpilot FMX21-FE121GGB10A, and a Badger ModMAG
    M2000 6 in (partly: the model string needs confirming with Badger).
    Still unknown from the makers: Eaton HT800 contact numbering by
    position, the Gladiator breaker and Edison holder markings, and the
    M2000's terminals. Those parts say so in their `notes`.

## Assumptions added laying out the panel (11-07)

Sizes are in each part's `mount.size_mm` (width along the rail, height,
depth), read from AutomationDirect, Phoenix, Moxa, Stego, Pfannenberg,
Stratus and Hammond drawings and datasheets. The estimated ones are listed
in 31.

26. **The enclosure goes up to 72×36×12 in (EN4SD723612SSR, EP7236
    backpanel); 60×36 doesn't fit.** The 60×36 backpanel is 868×1478 mm.
    Its top 480 mm goes to the two drives: 320 mm tall, plus the GS4's
    60 mm above and below, plus top duct. Each DIN row is a 60 mm duct and
    about 160–290 mm of parts, and five of them are needed. Rail parts
    total about 2,100 mm against 708 mm of usable rail per row, so three
    full rows plus the terminal row. Add the UPS battery's 50 mm above and
    below (191 mm tall) and the 190 mm transformer, and it comes to about
    1,780 mm. The 72 in panel is 1,783 mm, with the transformer and heater
    at the bottom. The SSR (plain 304) finish replaces the white-painted
    SSWH, which isn't made in 72 in. This is the largest single-door size
    in the series. Anything more goes to two enclosures (drives apart:
    PNL-P03).
27. **Layout, top to bottom:** panel light; top duct; the two drives side
    by side with their clearances, and Q1, SPD1 and rail A (phase monitor
    and CC fuses) beside them; rail B, power (J fuse holders and the
    interlocked contactor pairs, overloads hanging under the bypass
    contactors); rail C, control power (breakers, 24 V supply, UPS and
    battery, fused terminals, relays, receptacle); rail D, the controller,
    remote I/O, switch, router and the IS barriers; and at the bottom the
    heater, field terminals, transformer and ground bar. Field wiring comes
    in through the bottom. Ducts are 60 mm (T1-2230G-1) between every row
    and down both sides.
28. **Intrinsically safe wiring is kept apart.** ISR1 and ISB1 sit at the
    right end of rail D, and TBIS has its own short rail F, more than
    300 mm from TB2 (NEC 504.30 asks for 50 mm). It isn't checked yet; a
    separation check comes with segregated duct.
29. **The door (no dead front):** a row per pump (HOA, VFD-off-bypass,
    run, fail) and an alarm row (high level, reset), on an 80 mm × 100 mm
    grid, about two-thirds of the way up the door. The top row starts at
    650 mm down the door, 62 mm below the drives' bottom edge (565 mm on
    the backpanel plus its 23 mm inset), so no operator sits in front of a
    drive. The rows do sit in front of rail B; the depth check (32) passes
    them with room to spare: the tightest is PL1 (70 mm behind the door)
    in front of M101A (91 mm off the backpanel), 282 − 70 − 91 = 121 mm. The disconnect handle isn't drawn yet. The beacon is on top
    and the air conditioner on the right side.
30. **The air conditioner on the side is tight, and the check says so.**
    The TA10-059-16-4X drawing (AutomationDirect, 7/13/2022) gives
    299.7 mm across the mounting face, mounting holes 270.5 mm apart
    (14.6 mm in from each edge), 381 mm out from the wall, 914 mm tall,
    and 50.8 mm clear on both sides. The enclosure side is 305 mm deep,
    and the door opening's return and the back bend take about 30 mm of
    that (32), leaving 275 mm flat: the side-fit check warns. Hammond's
    drawing would settle it (as `side_flat_mm` on the enclosure part).
    If it doesn't fit, the choices are a deeper enclosure (Hammond lists
    72×36×16 in this series only in painted steel, EN4SD723616GY; in
    stainless the next step is the 18 in deep free-standing HN4FS723618S16)
    or a unit with a narrower face. The door is a poor fallback: the unit
    ships at 104 lb, about 45 kg, to hang on a 72 in single door.
31. **Estimated sizes:** Eaton HT800 operators (Eaton's sheet wasn't
    reachable: 44×57 mm legend plates, 55 mm behind the door for
    selectors and buttons, 70 mm for pilots); the Gladiator breakers
    (18×90×75); OnLogic K410 depth on its DIN kit; RUT241 on its DIN kit;
    782 relay on socket depth. The TCF7F is a flange relay made for an
    inner-door cutout. With no dead front it goes on its 70170-D socket on
    rail C, which takes its 54×108 mm flange as the footprint.
32. **Depth, for 3D and the depth checks (estimated where Hammond
    doesn't publish it):** the backpanel's face is 21 mm from the outside
    of the back (2 mm wall, 16 mm collar studs, 3 mm 12 ga panel), so
    there are 282 mm from the backpanel to the inside of a 2 mm door
    (305 − 21 − 2). Each side loses about 30 mm to the door opening's
    return (20) and the back bend (10). A part's depth is measured from
    the backpanel's face, DIN parts included (most datasheets measure from
    the rail's back); a door operator's from the door's inside. The duct
    is 80 mm deep (T1-2230G-1, 60 × 80), the rail 7.5 mm. A door operator
    should leave 13 mm to whatever is behind it, for the contact blocks'
    screws and the door closing. The door hinges on the left.
