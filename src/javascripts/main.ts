"use strict";

import { Rule, RuleSet, Successor, Colour, Vector, Line } from "./lsystem/model";
import { presets } from "./lsystem/presets";
import { applyTransform, fitTransform, mergeBounds, validateRenderSettings, type ViewTransform } from "./lsystem/fit";
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

const primaryButton: string = "inline-flex justify-center items-center px-4 py-2 border rounded-md font-semibold text-xs uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition ease-in-out duration-150 bg-white rounded-lg w-24 h-12 mx-auto my-4 active:scale-95";

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

const fSettingsAxiom: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsAxiom");
const fSettingsTheta: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsTheta");
const fSettingsReplacementDiv: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsReplacementDiv");
const fSettingsReplacementAdd: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsReplacementAdd");
const fSettingsIterations: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsIterations");
const fSettingsLength: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsLength");
const fSettingsCanvas: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsCanvas");
const fSettingsFactor: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsFactor");
const fSettingsFit: HTMLInputElement = <HTMLInputElement>document.getElementById("fSettingsFit");
const fSettingsFitNow: HTMLElement = <HTMLElement>document.getElementById("fSettingsFitNow");
const fSettingsResetView: HTMLElement = <HTMLElement>document.getElementById("fSettingsResetView");

GenerateButton.onclick = function() { GetSystem(); };
LSystemsButton.onclick = function() { SwitchView(views, 0, viewsB, 0); };
OutputButton.onclick = function() { SwitchView(views, 1, viewsB, 1); };
HideButton.onclick = function() { SwitchView(views, 2, viewsB, 2); };

fSettingsReplacementAdd.onclick = function() { AddRule(); };
fSettingsFitNow.onclick = function() { fSettingsFit.checked = true; GetSystem(); };
fSettingsResetView.onclick = function() { ResetView(); GetSystem(); };
fSettingsFit.onchange = function() { GetSystem(); };
fSettingsPresets.onchange = function() { 
  UpdateSelect(parseInt(fSettingsPresets.value)); 
  //Initiate(lSystems[pickIndex], 2, 1000);
  GetSystem();
};

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
        newOption.innerHTML = lSystems[i].name;
        selectBox.appendChild(newOption);
      }
    }
  }
}

function UpdateSelect(index:number)
{
  pickIndex = index;
  fSettingsAxiom.value = lSystems[pickIndex].start;
  fSettingsTheta.value = lSystems[pickIndex].theta.toString();
  FillReplacement(lSystems[pickIndex]);
  fSettingsIterations.value = "2";
  fSettingsFactor.value = lSystems[pickIndex].factor.toString();
  ResetView();
}

function ResetView()
{
  fSettingsLength.value = "250";
  fSettingsCanvas.value = "1";
  fSettingsFit.checked = true;
}

function FillReplacement(ruleset: RuleSet)
{
  fSettingsReplacementDiv.innerHTML = "";

  for(let i = 0; i < ruleset.rules.length; i++)
  {
    fSettingsReplacementDiv.innerHTML += `<div>Rule ` + (i + 1) + `</div>`;
    let predecessor = ruleset.rules[i].predecessor;

    fSettingsReplacementDiv.innerHTML += `
    <div class="replacementRules" id="replacementRule` + i + `" data-index="` + i + `" data-successorCount="` + ruleset.rules[i].successors.length + `">`;

    fSettingsReplacementDiv.innerHTML += `<label for="predecessor`+ i + `">Predecessor</label>`;
    fSettingsReplacementDiv.innerHTML += `<textarea id="predecessor`+ i + `" class="border border-black rounded-lg p-2 m-2">` + predecessor + `</textarea>`;

    for(let s = 0; s < ruleset.rules[i].successors.length; s++)
    {
      let successor = ruleset.rules[i].successors[s].successor;
      let weight = ruleset.rules[i].successors[s].weight;
  
      fSettingsReplacementDiv.innerHTML += `
        <label for="successor`+ i + `` + s + `">Successor</label>
        <textarea id="successor`+ i + `` + s + `" class="border border-black rounded-lg p-2 m-2">` + successor + `</textarea>
        <label for="weight`+ i + `` + s + `">Weight</label>
        <textarea id="weight`+ i + `` + s + `" class="border border-black rounded-lg p-2 m-2">` + weight + `</textarea>
        <button class="` + primaryButton + ` p-2 border border-black flex justify-center items-center" id="removeSuccessor`+ i + `` + s + `" onclick="RemoveSuccessor(` + i + `,` + s + `)">Remove Successor</button>
        <br>`;

      fSettingsReplacementDiv.innerHTML += `<div class="fBorder"></div>`;
    }

    fSettingsReplacementDiv.innerHTML += `
    <button class="` + primaryButton + ` p-2 border border-black flex justify-center items-center" id="add`+ i + `" onclick="AddSuccessor(`+ i + `)">Add Successor</button>
    <br>
    <button class="` + primaryButton + ` p-2 border border-black flex justify-center items-center" id="removeRule`+ i + `" onclick="RemoveRule(`+ i + `)">Remove Rule</button>
    <br>
    `;

    let contextLeft = ruleset.rules[i].contextL;
    let contextRight = ruleset.rules[i].contextR;

    if(contextLeft !== undefined)
    {
      fSettingsReplacementDiv.innerHTML += `
      <label for="contextLeft`+ i + `">Left Context</label>
      <textarea id="contextLeft`+ i + `" class="border border-black rounded-lg p-2 m-2">` + contextLeft + `</textarea>`;
    }

    if(contextRight !== undefined)
    {
      fSettingsReplacementDiv.innerHTML += `
      <label for="contextRight`+ i + `">Right Context</label>
      <textarea id="contextRight`+ i + `" class="border border-black rounded-lg p-2 m-2">` + contextRight + `</textarea>`;
    }

    fSettingsReplacementDiv.innerHTML += `
    </div>
    <br>`;

    fSettingsReplacementDiv.innerHTML += `<div class="fBorder"></div>`;
  }

  let ignore = ruleset.ignore;

  if(ignore !== undefined)
  {
    fSettingsReplacementDiv.innerHTML += `
    <label for="ignore">Ignore List</label>
    <textarea id="ignore" class="border border-black rounded-lg p-2 m-2">` + ignore.toString() + `</textarea>`;
  }
}

function RemoveSuccessor(rule: number, successor: number)
{
  lSystems[pickIndex].rules[rule].successors.splice(successor, 1);
  FillReplacement(lSystems[pickIndex]);
}

function AddSuccessor(rule: number)
{
  let newSuccessor = new Successor("", 0);
  lSystems[pickIndex].rules[rule].successors.push(newSuccessor);
  FillReplacement(lSystems[pickIndex]);
}

function RemoveRule(rule: number)
{
  lSystems[pickIndex].rules.splice(rule, 1);
  FillReplacement(lSystems[pickIndex]);
}

function AddRule()
{
  let newRule = new Rule("", [], "", "");
  lSystems[pickIndex].rules.push(newRule);
  FillReplacement(lSystems[pickIndex]);
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

  oView.innerHTML = "";
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

    let output = ruleset.start + "<br><br>";

    for(let i = 1; i <= iterations; i++) output += Iterate(ruleset, expansions[s][i]);
    oView.innerHTML += output; // one parse per tree rather than three per generation

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
  return current + "<br><br>";
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

function GetSystem()
{
  let axiom = fSettingsAxiom.value.toString();
  let theta = parseFloat(fSettingsTheta.value);
  let iterations = parseInt(fSettingsIterations.value);
  let drawLength = parseFloat(fSettingsLength.value);
  let factor = parseFloat(fSettingsFactor.value);
  inheritance = parseFloat(fSettingsVariance.value);
  let scale = parseFloat(fSettingsCanvas.value);

  // Auto fit ignores length and scale, so only the manual path needs them valid.
  let problems = validateRenderSettings({ length: drawLength, scale, factor, theta });
  if(fSettingsFit.checked) problems = problems.filter(p => !p.startsWith("Starting length") && !p.startsWith("Scale"));
  if(problems.length > 0)
  {
    ShowError(problems.join(" "));
    return;
  }
  canvasScale = scale;
  if(!(drawLength > 0)) drawLength = 250; // only reachable with auto fit, where the length does not affect the fit

  let rules: HTMLCollectionOf<HTMLElement> = document.getElementsByClassName("replacementRules") as HTMLCollectionOf<HTMLElement>;

  let ignore: string[] = [''];

  if(document.getElementById("ignore") !== null)
  {
    let ignoreEl: HTMLInputElement = <HTMLInputElement>document.getElementById("ignore");
    ignore = ignoreEl.value.split(",");
  }

  let ruleSet = new RuleSet(
    "-",
    axiom,
    theta,
    factor,
    [],
    ignore
  );

  let newRules = [];

  for(let i = 0; i < rules.length; i++)
  {
    let index = rules[i].dataset.index;
    let sCount: string = <string>rules[i].dataset.successorcount;
    let successorCount = parseInt(sCount);

    let pEl: HTMLInputElement = <HTMLInputElement>document.getElementById("predecessor" + index);
    let predecessor: string = (pEl) ? pEl.value : '';

    let cLeft = '*';
    let cRight = '*';

    if(document.getElementById("contextLeft" + index) !== null)
    {
      let cEl: HTMLInputElement = <HTMLInputElement>document.getElementById("contextLeft" + index);
      cLeft = (cEl) ? cEl.value : '';
    }
    if(document.getElementById("contextRight" + index) !== null)
    {
      let cEl: HTMLInputElement = <HTMLInputElement>document.getElementById("contextRight" + index); 
      cRight = (cEl) ? cEl.value : '';
    }

    let nR = new Rule(
      predecessor,
      [],
      cLeft,
      cRight
    );

    let successors = [];

    for(let s = 0; s < successorCount; s++)
    {
      let sEl: HTMLInputElement = <HTMLInputElement>document.getElementById("successor" + index + s);
      let successor: string = (sEl) ? sEl.value : '';
      let wEl: HTMLInputElement = <HTMLInputElement>document.getElementById("weight" + index + s);
      let weight: number = (wEl) ? parseFloat(wEl.value) : 1;

      let newSuccessor = new Successor(
        successor,
        weight
      );

      successors.push(newSuccessor);
    }

    nR.successors = successors;

    newRules.push(nR);
  }

  ruleSet.rules = newRules;

  Initiate(ruleSet, iterations, drawLength);
}

// main.ts is now a module, so TypeScript flags these legacy unused declarations (the audit lists them
// as known defects: dead code and inline handlers that never resolve). Referenced here, not removed.
void [fDiv, timeOut, canvasSize, loop, lineCol, HideSettings, RemoveSuccessor, AddSuccessor, RemoveRule, RandomFlowerColour];

function Main()
{
  FillSelect();
  UpdateSelect(pickIndex);
  //Initiate(lSystems[pickIndex], 2, 1000);
  GetSystem();
}

window.addEventListener('resize', ReSize);
document.addEventListener("DOMContentLoaded", Main);
