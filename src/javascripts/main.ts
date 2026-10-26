"use strict";

import { RuleSet, Colour, Line } from "./lsystem/model";
import { buildRuleSet, validateRenderFields } from "./lsystem/editor";
import { RuleEditor } from "./editor-ui";
import { presets } from "./lsystem/presets";
import { applyTransform, fitTransform, type ViewTransform } from "./lsystem/fit";
import { expandGrammar, GrammarError, ExpansionLimitError, MAX_TOTAL_SYMBOLS } from "./lsystem/grammar";
import { buildScene, displayText, SegmentLimitError, type Scene, type TreeScene } from "./lsystem/scene";
import { Playback } from "./lsystem/playback";

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

let theta = 0; // the default angle to be rotated by

let pickIndex = 0; // which l system to display

const playback = new Playback();
let scene: Scene | null = null;
let interval = 10;
let animate = true;
let leaves = false;
let loop = false;
let forest = false;

let inheritance = 0;
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
  // Debounced re-fit of the existing scene; never regenerates, so stochastic grammars and forest placement stay put.
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => Render(false), 120);
}
let resizeTimer: ReturnType<typeof setTimeout> | undefined;

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

  SizeCanvas(); // also clears the canvas

  theta = ruleset.theta;
  interval = parseFloat(fSettingsInterval.value);
  animate = fSettingsAnimate.checked;
  leaves = fSettingsLeaves.checked;
  forest = fSettingsForest.checked;

  let startCol: Colour = <Colour>HexToRGB(fSettingsCol.value);

  // Every tree ends at the same length: the starting length divided by the factor once per iteration.
  let finalLength = startlength;
  for(let i = 1; i <= iterations; i++) finalLength /= ruleset.factor;
  const finals = expansions.map(g => ({ generation: g[iterations] ?? ruleset.start, length: finalLength }));

  let built: Scene;
  try
  {
    built = buildScene(finals, theta, forest, cssWidth, cssHeight, { base: startCol, variance: inheritance });
  }
  catch(e)
  {
    if(e instanceof SegmentLimitError)
    {
      playback.cancel();
      ShowError(e.message + " Lower the iterations or the number of trees.");
      return;
    }
    throw e;
  }
  fError.style.display = "none";
  scene = built;

  // Generations are shown as text nodes, never parsed as HTML, so grammar symbols can't inject markup.
  // One fragment per generation set, truncated when huge, keeps the DOM small and cheap.
  const fragment = document.createDocumentFragment();
  for(let s = 0; s < expansions.length; s++)
  {
    const output = document.createElement("div");
    output.append(displayText(ruleset.start), document.createElement("br"), document.createElement("br"));
    for(let i = 1; i <= iterations; i++)
    {
      output.append(displayText(expansions[s][i]), document.createElement("br"), document.createElement("br"));
    }
    fragment.append(output);
  }
  oView.replaceChildren(fragment);

  Render(animate);
}

// Fits the current scene to the current canvas and plays it. Never regenerates: the scene (grammar expansion,
// stochastic choices, forest placement, colours, leaf jitter) is fixed, so this is also what resize uses.
function Render(animated: boolean)
{
  playback.cancel();
  SizeCanvas();
  if(scene === null) return;
  const fit = fitTransform(scene.bounds, cssWidth, cssHeight, fSettingsFit.checked ? undefined : canvasScale);
  if(fit === null) return; // nothing drawable (empty or degenerate result)
  view = fit;

  const current = scene;
  playback.start({
    counts: current.trees.map(t => t.lines.length),
    intervalMs: animated ? interval : 0,
    draw: (tree, segment) => DrawSegment(current.trees[tree], segment),
  });
}

function DrawSegment(tree: TreeScene, i: number)
{
  const seg: Line = tree.lines[i];
  const [sx, sy] = applyTransform(view, seg.start.x, seg.start.y);
  const [ex, ey] = applyTransform(view, seg.end.x, seg.end.y);

  ctx.strokeStyle = tree.colours[i];
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  if(leaves && tree.leafAt[i])
  {
    ctx.fillStyle = tree.colours[i];
    let percent = (100 / fView.scrollHeight) * ey;
    let radius = Math.abs((100 - percent) / 10);
    ctx.beginPath();
    ctx.ellipse(ex, ey, radius + tree.leafJitter[2 * i], radius + tree.leafJitter[2 * i + 1], Math.PI / 4, 0, 2 * Math.PI);
    ctx.fill();
  }
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
