# Lift-station reference panel: parts list (draft 1)

2026-11-06. Claude, from research agents and Joy's own catalog
(`randd/catalog`). **For James to review as a PE before any of it becomes
`panel.json` or part files.** The design decisions behind it are in
`content/library/plant.md` (D1–D8). Prices and stock were read on 11-06.

Confidence column: **verified** means the catalog number and ratings were
read on the maker's or distributor's own page or cut sheet. **partly** means
it came from a catalog PDF or a third-party listing only. Nothing here is
guessed. Where a number couldn't be verified, the cell is blank.

Vendor rule: AutomationDirect (AD) where it has a suitable UL product,
because viewers can price it and download free CAD. Specialists for
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

From Joy's catalog (`randd/catalog/items.json`, `io.json`), prices verified
there 2026-09/10.

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
| Enclosure | ENC | Hammond Eclipse (AD) | EN4SD603612SSWH | 60×36×12 in, 304 SS (white powder coat), NEMA 3R/4/4X/12/13 | 914×1524×305 | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/wall-mount_enclosures/en4sd603612sswh) | verified |
| Backpanel | ENC-BP | Hammond (AD) | EP6036 | 12 ga steel, 34.17×58.17 in | 868×1478 | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/subpanels/ep6036) | verified |
| Inner swing-out dead front | ENC-SP | Hammond (AD) | ESP6036 | 12 ga steel, 33.79×57.75 in | 858×1467 | ? | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/enclosure_parts_-a-_accessories/swing_panels/esp6036) | partly |
| Air conditioner | AC1 | Stratus (AD) | TA10-059-16-4X (or TA10-033-16-4X, 3300 BTU/h) | 5910 BTU/h (≈1730 W); 115 VAC, 6.14 A run, **32.3 A inrush**, 12 A TD fuse; Type 4X | — | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosures_-z-_subpanels_-z-_thermal_management_-z-_lighting/enclosure_thermal_management/air_conditioners/ta10-059-16-4x) | verified |
| Heater with thermostat | HTR1 | Stego (AD) | 027009-01 | 550 W 120 VAC (≈4.6 A); thermostat 0–60 °C; UL Recognized | — | no | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosure_thermal_management_-a-_lights/heaters/027009-01) | verified |
| Panel light | LT1 | Stego (AD) | 122040-00 | 120 VAC 16 W, own switch and receptacle | 693 long | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosure_thermal_management_-a-_lights/enclosure_lighting/122040-00) | verified |
| Door switch for LT1 | DS1 | Stego (AD) | 013500-00 | SPDT 10 A 250 VAC; no UL listing shown | — | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/enclosures_-a-_racks/enclosure_parts_-a-_accessories/door_switches/013500-00) | partly |
| GFCI receptacle | REC1 | Gladiator (AD) | GR-REC2-GFCI | 15 A 125 VAC, DIN/panel; needs 20 A protection; **backordered to 2027-01-22** | — | yes | [AD](https://www.automationdirect.com/adc/shopping/catalog/wire_-a-_cable_termination/wiring_devices/din_rail_receptacles/gr-rec2-gfci) | verified |
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

## What the PE needs to decide or check

From the power research:

1. **Panel SCCR is 5 kA**, capped by the GH15ET contactor and RTD32 overload
   starters (the only published rating: 60 A RK5, type 2). Everything else is
   rated 100–200 kA. What's the available fault current at the station? A
   pad-mount transformer often gives more than 5 kA at 480 V. If 5 kA is too
   low, either show the Class J fuses raise it under UL 508A SB4, or swap to
   a contactor family with published high-fault Class J ratings (Eaton XT,
   TeSys D, A-B 100-C; not verified yet). This is a strong PNL-P02 example
   either way.
2. **Bypass branch protection.** JHL45 is a high-speed semiconductor fuse
   required by the drive's listing, and it won't ride through an
   across-the-line start (6–8 × 21 A). So the bypass has its own JDL40
   time-delay fuses, tapped ahead of the drive fuses. Confirm the sizing and
   the tap.
3. **Heat: 760 W from two drives** in a sealed NEMA 4X box. That needs an
   air conditioner or a heat exchanger. The flange kit (GS4-FMKIT-B, heatsink
   out the back) is NEMA 1 only, so it breaks the 4X rating. (PNL-P03.)
4. **The CPT is too small at 500 VA** (4.17 A). It can't carry the
   receptacle, the heater and the lights, and plant.md estimates about
   1 kVA of control load. Go to 1.5–2 kVA, or feed the receptacle and heater
   separately. (PNL-F12 does the calculation.) Is a UL Recognized
   transformer acceptable?
5. **Drive rating vs. nameplate.** The GS4-4015 VT output is 24 A. If the
   pump's nameplate or service-factor amps are higher, use the GS4-4020.
6. **Overloads.** Submersible pump makers often require class 10 quick-trip.
   RTD32 is class 10A. Should the overload be in the bypass leg only (the
   drive protects in VFD mode) or on the common motor leads?
7. **Neutral.** The SPD is wye 4W+G, so the neutral comes into the panel. The
   inlet and MTS above are 3-pole. Use the 4P5W inlet and a 4-pole switch if
   the generator is separately derived or there are neutral loads.
8. **Q1 as service disconnect** needs a service-entrance rating. Confirm the
   70 A main fuses coordinate with a bypass start and with the 45 A drive
   fuses.
9. **SPD connection point** (load side of Q1?), and whether Mersen requires
   an overcurrent device ahead of this Type 1 unit.

From the control, door and enclosure research:

10. **The 120 V side is bigger than the CPT.** The air conditioner runs at
    6.1 A with a 32 A inrush, and the heater draws 4.6 A, on top of the
    receptacle, the light, the contactor coils and the 24 V supply. That
    makes item 4 firmer: the CPT should be 2 kVA or more, or the AC and
    receptacle get their own 120 V source. The AC also needs its own
    breaker (CB5), with a 12 A time-delay fuse per its listing.
11. **Enclosure: 60×36×12 in, Hammond**, the only stainless set where the
    enclosure, backpanel and inner panel could all be verified. 12 in deep
    with a swing panel in front of 190 mm-deep drives is tight; consider
    16 in. Cooling: the 5910 BTU/h AC has margin (heat load ≈1.0–1.5 kW
    with sun). An air-to-air exchanger can't cool below ambient. Set the
    heater and AC thermostats so they don't fight.
12. **Hazardous area:** Div 1 or Div 2 under NFPA 820. Check float,
    transducer and cable entity values against the control drawings; IS
    separation, seals and the IS ground. The transducer must run on ≥16 V
    at 20 mA; Co/Lo come from drawing 116-0439. KFD2-SR2 with dry-contact
    floats needs P+F's line-fault resistor network, or line-fault detection
    off by DIP switch.
13. **Pump protection relay sensor circuit isn't intrinsically safe.** For
    explosion-proof pumps in a Div 1 well, follow the pump's FM listing for
    the sensor leads (including any manual reset on over-temperature).
    Confirm the pumps use Flygt FLA/CLS sensors. (Genuine Flygt MiniCAS
    14-407129 only appears on distributor pages.)
14. **Hand is hardwired, independent of the PC?** (D6 says yes.) Use HT8E
    gold blocks for contacts that only feed a 24 VDC input, and HT8A where
    they switch 120 VAC coils.
15. **UL status** of the ground bar (SCE-GB10) and door switch (013500-00):
    no UL file shown. Accept or substitute. The panel light has no
    external-switch input, so the door switch breaks its 120 V feed (or use
    the motion-sensor model 122140-00).
16. **GFCI receptacle backordered** to January 2027.
17. **The beacon on the enclosure top** needs a listed Type 4X hub.
