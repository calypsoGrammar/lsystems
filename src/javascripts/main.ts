"use strict";

import { RuleSet, Colour, Vector, Line } from "./lsystem/model";
import { buildRuleSet, validateRenderFields } from "./lsystem/editor";
import { RuleEditor } from "./editor-ui";
import { presets } from "./lsystem/presets";
import { applyTransform, fitTransform, mergeBounds, type ViewTransform } from "./lsystem/fit";
import { expandGrammar, GrammarError, ExpansionLimitError, MAX_TOTAL_SYMBOLS } from "./lsystem/grammar";
import { forestStart, interpretTurtle, type Bounds } from "./lsystem/turtle";

function CalculateVh()
{
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', vh + 'px');
}

window.addEventListener('DOMContentLoaded', CalculateVh);
window.addEventListener('resize', CalculateVh);
window.addEventListener('orientationchange', CalculateVh);

const GenerateButton: HTMLElement = <HTMLElement>document.getElementById("GenerateButton");
const LSystemsButton: HTMLElement = <HTMLElement>document.getElementById("LSystemsButton");
const OutputButton: HTMLElement = <HTMLElement>document.getElementById("OutputButton");
const HideButton: HTMLElement = <HTMLElement>document.getElementById("HideButton");

const fError: HTMLElement = <HTMLElement>document.getElementById("fError");
const oView: HTMLElement = <HTMLElement>document.getElementById("oView");
const fDiv: HTMLElement = <HTMLElement>document.getElementById("fDiv");

const fSettings: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettings");

const fContainer: HTMLElement = <HTMLElement>document.getElementById("fContainer");
const fView: HTMLElement = <HTMLElement>document.getElementById("fView");
const fCanvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("fCanvas");
const ctx: CanvasRenderingContext2D = <CanvasRenderingContext2D>fCanvas.getContext("2d");

const fSettingsPresets: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsPresets");
const fSettingsCol: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsCol");
const fSettingsVariance: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsVariance");
const fSettingsAnimate: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsAnimate");
const fSettingsInterval: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsInterval");
const fSettingsLeaves: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsLeaves");
const fSettingsForest: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsForest");
const fSettingsCount: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsCount");

const fSettingsReplacementDiv: HTMLElement = <HTMLInputElement>document.getElementById("fSettingsReplacementDiv");
const fSettingsReset: HTMLElement = <HTMLElement>document.getElementById("fSettingsReset");
const fSettingsStatus: HTMLElement = <HTMLElement>document.getElementById("fSettingsStatus");
const fSettingsReplacementAdd: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsReplacementAdd");
const fSettingsLength: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsLength");
const fSettingsCanvas: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsCanvas");
const fSettingsFit: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsFit");
const fSettingsFitNow: HTMLElement = <HTMLElement>document.getElementById("fSettingsFitNow");
const fSettingsResetView: HTMLElement = <HTMLElement>document.getElementById("fSettingsResetView");

GenerateButton.onclick = function() { GetSystem(); };
LSystemsButton.onclick = function() { SwitchView(views, 0, viewsB, 0); };
OutputButton.onclick = function() { SwitchView(views, 1, viewsB, 1); };
HideButton.onclick = function() { SwitchView(views, 2, viewsB, 2); };

fSettingsReplacementAdd.onclick = function() { editor.addRule(); };
fSettingsReset.onclick = function() { editor.resetToPreset(); GetSystem(); };
fSettingsFitNow.onclick = function() { fSettingsFit.checked = true; GetSystem(); };
fSettingsResetView.onclick = function() { ResetView(); GetSystem(); };
fSettingsFit.onchange = function() { GetSystem(); };
fSettingsPresets.onchange = function() { 
  UpdateSelect(parseInt(fSettingsPresets.value));
  GetSystem();
};

const editor = new RuleEditor(presets, fSettingsReplacementDiv, fSettingsStatus);

const views = [fContainer, oView, fSettings];
const viewsB = [LSystemsButton, OutputButton, HideButton];

let timeOut = undefined;

// Canvas size in CSS pixels; the backing store is cssWidth * devicePixelRatio. Drawing coordinates are CSS pixels
// (the context transform is only ever set, never accumulated); the logical-to-canvas fit is applied per point.
let cssWidth = 1;
let cssHeight = 1;

function SizeCanvas()
{
  const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  cssWidth = window.innerWidth;
  cssHeight = window.innerHeight * 0.85;
  fCanvas.width = Math.max(1, Math.round(cssWidth * dpr));
  fCanvas.height = Math.max(1, Math.round(cssHeight * dpr));
  fCanvas.style.width = cssWidth + 'px';
  fCanvas.style.height = cssHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // resizing resets context state, so set it afresh every time
  ctx.lineWidth = 1;
}

let canvasSize = 1; // legacy, unused
let canvasScale = 1; // manual scale, used when auto fit is off
let view: ViewTransform = { scale: 1, tx: 0, ty: 0 };

let current = "";

let len = 0; // default length
let theta = 0; // the default angle to be rotated by
let matrix: never[] = []; // legacy; transform history now lives in traceLines

let pickIndex = 0; // which l system to display

let animateInterval: number = 0;
let counter = 0;
let interval = 10;
let animate = true;
let leaves = false;
let loop = false;
let forest = false;

let rgb: Colour = new Colour(0, 0, 0);
let inheritance = 0;
let lines: any[] = []; // stores line info
let lSystems: RuleSet[] = presets;

let lineCol = "black";

function HideSettings()
{
  if(fSettings.style.display === "")
  {
    fSettings.style.display = "none";
  }
  else
  {
    fSettings.style.display = "";
  }
}

function SwitchView(array:any[], aIndex:number, buttons:any[], bIndex:number)
{
  let aLen = array.length;
  let bLen = buttons.length;
  if(aIndex > aLen) return;
  if(bIndex > bLen) return;
  if(aLen > 0)
  {
    for(let i = 0; i < aLen; i++)
    {
      if(i === aIndex) array[i].style.display = "";
      else array[i].style.display = "none";
    }
  }
  if(bLen > 0)
  {
    for(let i = 0; i < bLen; i++)
    {
      if(i === bIndex) buttons[i].dataset.state = "selected";
      else buttons[i].dataset.state = "";
    }
  }
}

function FillSelect()
{
  if(lSystems.length > 0)
  {
    let selectBox: HTMLElement | null = document.getElementById("fSettingsPresets");

    if(selectBox !== null)
    {
      for(let i = 0; i < lSystems.length; i++)
      {
        let newOption: HTMLOptionElement = document.createElement("option");
        newOption.value = i.toString();
        newOption.textContent = lSystems[i].name;
        selectBox.appendChild(newOption);
      }
    }
  }
}

function UpdateSelect(index:number)
{
  pickIndex = index;
  editor.selectPreset(index);
  editor.updateStatusNow();
  ResetView();
}

function ResetView()
{
  fSettingsLength.value = "250";
  fSettingsCanvas.value = "1";
  fSettingsFit.checked = true;
}

function ReSize()
{
  fContainer.style.width = window.innerWidth + 'px';
  fContainer.style.height = window.innerHeight * 0.85 + 'px';
  fView.style.width = window.innerWidth + 'px';
  fView.style.height = window.innerHeight * 0.85 + 'px';
  GetSystem();
}

function ShowError(message: string)
{
  fError.textContent = message;
  fError.style.display = "block";
}

function Initiate(ruleset: RuleSet, iterations: number, startlength: number)
{
  // Expand every tree before touching the canvas or output, so a rejected grammar leaves the previous drawing intact.
  let treeCount = fSettingsForest.checked ? parseFloat(fSettingsCount.value) : 1;
  let expansions: string[][] = [];
  try
  {
    let budget = MAX_TOTAL_SYMBOLS; // shared by all trees, so Forest cannot multiply the cap
  for(let s = 0; s < treeCount; s++)
  {
    let generations = expandGrammar(ruleset, iterations, Math.random, budget);
    budget -= generations.reduce((n, g) => n + g.length, 0);
    expansions.push(generations);
  }
  }
  catch(e)
  {
    if(e instanceof GrammarError) ShowError(e.problems.join(" "));
    else if(e instanceof ExpansionLimitError) ShowError(e.message + " Lower the iterations or simplify the rules.");
    else throw e;
    return;
  }
  fError.style.display = "none";

  SizeCanvas(); // also clears the canvas

  matrix.length = 0;
  theta = ruleset.theta;

  interval = parseFloat(fSettingsInterval.value);
  animate = fSettingsAnimate.checked;
  leaves = fSettingsLeaves.checked;
  forest = fSettingsForest.checked;

  let startCol: Colour = <Colour>HexToRGB(fSettingsCol.value);

  oView.replaceChildren();
  lines = [];

  let forestIndex = 1;
  if(forest) forestIndex = parseFloat(fSettingsCount.value);
  treeBounds = [];

  for(let s = 0; s < forestIndex; s++)
  {
    rgb.r = startCol.r;
    rgb.g = startCol.g;
    rgb.b = startCol.b;

    current = ruleset.start;
    len = startlength;

    // Generations are shown as text nodes, never parsed as HTML, so grammar symbols can't inject markup.
    const output = document.createElement("div");
    output.append(ruleset.start, document.createElement("br"), document.createElement("br"));
    for(let i = 1; i <= iterations; i++)
    {
      output.append(Iterate(ruleset, expansions[s][i]), document.createElement("br"), document.createElement("br"));
    }
    oView.append(output);

    GetLines(s);
  }

  // Fit over every tree's drawable segments, then draw with one shared transform.
  let allBounds = mergeBounds(treeBounds);
  let fit = fitTransform(allBounds, cssWidth, cssHeight, fSettingsFit.checked ? undefined : canvasScale);
  if(fit === null) return; // nothing drawable (empty or degenerate result)
  view = fit;

  for(let s = 0; s < forestIndex; s++)
  {
    if(lines[s].length === 0) continue;
    currentIndex = s;
    Draw(s);
  }
}

let treeBounds: (Bounds | null)[] = [];

function Iterate(ruleset: RuleSet, generation: string)
{
  len /= ruleset.factor;
  current = generation;
  return current;
}

function GetLines(index: number)
{
  matrix.length = 0;

  // Logical coordinates: a single tree starts at the origin; forest trees are spread along the canvas width.
  let start = new Vector(0, 0);

  if(forest)
  {
    start = forestStart(cssWidth, cssHeight, parseFloat(fSettingsCount.value), index);
  }

  const traced = interpretTurtle(current, len, theta, start);
  lines[index] = traced.lines;
  treeBounds[index] = traced.bounds;
}

function Draw(index: number)
{
  ctx.strokeStyle = RandomColour(inheritance, interval);

  if(animate)
  {
    counter = 0;
    clearInterval(animateInterval);

    animateInterval = setInterval(DrawLine, interval);
  }
  else
  {
    for(let i = 0; i < lines[index].length; i++)
    {
      counter = i;
      DrawLine();
    }
  }
}

let currentIndex = 0;
const startKeys = new WeakMap<object, Set<string>>(); // segment start points per tree, for the O(1) leaf check

function DrawLine()
{
  ctx.strokeStyle = RandomColour(inheritance, 1);

  const seg: Line = lines[currentIndex][counter];
  const [sx, sy] = applyTransform(view, seg.start.x, seg.start.y);
  const [ex, ey] = applyTransform(view, seg.end.x, seg.end.y);

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  if(leaves)
  {
    if(lines[currentIndex][counter].leaf)
    {
      ctx.fillStyle = ctx.strokeStyle;
  
      let starts = startKeys.get(lines[currentIndex]);
      if(starts === undefined)
      {
        starts = new Set(lines[currentIndex].map((l: Line) => l.start.x + "," + l.start.y));
        startKeys.set(lines[currentIndex], starts);
      }
      let valid = !starts.has(lines[currentIndex][counter].end.x + "," + lines[currentIndex][counter].end.y);
      if(valid)
      {
        let percent = (100 / fView.scrollHeight) * ey;
        let radius = Math.abs((100 - percent) / 10);
        let radiusX = radius + Math.random();
        let radiusY = radius + Math.random();
        ctx.beginPath();
        ctx.ellipse(
        ex, 
        ey, 
        radiusX, 
        radiusY, 
        Math.PI / 4,
        0, 
        2 * Math.PI);
        // (lines[counter].rot * Math.PI/180)
        // (Math.PI + (Math.PI * 1) / 2)
        // (Math.PI + (Math.PI * 0) / 2)
        ctx.fill();
      }
    }
  }

  if(animate)
  {
    counter++;
    if(counter >= lines[currentIndex].length) clearInterval(animateInterval);
  }
}

function RandomColour(inheritFactor: number, alpha: number)
{
  let lastR = rgb.r;
  let lastG = rgb.g;
  let lastB = rgb.b;

  let varR = Math.floor(Math.random() * inheritFactor);
  let varG = Math.floor(Math.random() * inheritFactor);
  let varB = Math.floor(Math.random() * inheritFactor);

  let plusMinus = Math.random();

  let newR = lastR - varR;
  let newG = lastG - varG;
  let newB = lastB - varB;

  if(plusMinus > 0.5)
  {
    newR = lastR + varR;
    newG = lastG + varG;
    newB = lastB + varB;
  }

  if(newR < 0) newR = 0;
  if(newR > 255) newR = 255;

  if(newG < 0) newG = 0;
  if(newG > 255) newG = 255;

  if(newB < 0) newB = 0;
  if(newB > 255) newB = 255;

  rgb = new Colour(newR, newG, newB);
  return "rgba(" + newR + "," + newG + "," + newB + "," + alpha + ")";
}

function RandomFlowerColour()
{
  let varR = Math.floor(Math.random() * 255);
  let varG = Math.floor(Math.random() * 255);
  let varB = Math.floor(Math.random() * 255);

  return [varR, varG, varB];
}

function HexToRGB(hex: string)
{
  if(/^#([a-f0-9]{3}){1,2}$/.test(hex))
  {
    if(hex.length== 4)
    {
      hex= '#'+[hex[1], hex[1], hex[2], hex[2], hex[3], hex[3]].join('');
    }
    let c = '0x' + hex.substring(1);
    let r: number = ( parseFloat(c) >> 16 ) & 255;
    let g: number = ( parseFloat(c) >> 8 ) & 255;
    let b: number = parseFloat(c) & 255;
    return new Colour(r, g, b);
  }
}

function GetSystem(validateOnly = false)
{
  // The form is the source of truth: validate and generate from exactly what is displayed.
  const state = editor.readState();
  const built = buildRuleSet(state);
  const errors = built.ok ? new Map<string, string>() : new Map(built.errors);

  inheritance = parseFloat(fSettingsVariance.value);
  let drawLength = parseFloat(fSettingsLength.value);
  const scale = parseFloat(fSettingsCanvas.value);

  // Auto fit ignores length and scale, so only the manual path needs them valid (likewise Count, Interval).
  for(const [id, message] of validateRenderFields({
    length: fSettingsLength.value, scale: fSettingsCanvas.value, count: fSettingsCount.value,
    interval: fSettingsInterval.value, variance: fSettingsVariance.value,
    fit: fSettingsFit.checked, forest: fSettingsForest.checked, animate: fSettingsAnimate.checked,
  })) errors.set(id, message);

  editor.revalidator = () => { GetSystem(true); };
  if(!built.ok || errors.size > 0)
  {
    editor.showErrors(errors);
    ShowError("Fix the highlighted fields: " + [...errors.values()].join(" "));
    return;
  }
  editor.clearErrors();
  canvasScale = scale;
  if(!(drawLength > 0)) drawLength = 250; // only reachable with auto fit, where the length does not affect the fit

  if(validateOnly) { fError.style.display = "none"; return; }
  Initiate(built.ruleSet, parseInt(state.iterations), drawLength);
}

// main.ts is now a module, so TypeScript flags these legacy unused declarations (the audit lists them
// as known defects: dead code). Referenced here, not removed.
void [fDiv, timeOut, canvasSize, loop, lineCol, HideSettings, RandomFlowerColour];

function Main()
{
  FillSelect();
  UpdateSelect(pickIndex);
  //Initiate(lSystems[pickIndex], 2, 1000);
  GetSystem();
}

window.addEventListener('resize', ReSize);
document.addEventListener("DOMContentLoaded", Main);
