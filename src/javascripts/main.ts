"use strict";

function CalculateVh()
{
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', vh + 'px');
}

window.addEventListener('DOMContentLoaded', CalculateVh);
window.addEventListener('resize', CalculateVh);
window.addEventListener('orientationchange', CalculateVh);

class Colour
{
  r: number = 0;
  g: number = 0;
  b: number = 0;
  constructor(r:number, g:number, b:number)
  {
    this.r = r;
    this.g = g;
    this.b = b;
  }
}

class Line
{
  start: Vector = new Vector(0, 0);
  end: Vector = new Vector(0, 0);
  leaf: boolean = false;
  branchStart: boolean = false;
  rot: number = 0;

  constructor(a:Vector, b:Vector) // vector, vector
  {
    this.start = a;
    this.end = b;
    this.leaf = false; // determine if the position is the end of a line in branching systems
    this.branchStart = false // to store branching colors
    this.rot = 0; // store rotation
  }
}

class Vector
{
  x: number = 0;
  y: number = 0;
  constructor(x:number, y:number)
  {
    this.x = x;
    this.y = y;
  }
}

class Transform
{
  pos: Vector = new Vector(0, 0);
  rot: number = 0;
  constructor(pos:Vector, rot:number)
  {
    this.pos = new Vector(pos.x, pos.y);
    this.rot = rot;
  }
}

class Successor
{
  successor: string = "";
  weight: number = 0;
  constructor(successor:string, weight:number)
  {
    this.successor = successor;
    this.weight = weight;
  }
}

class Rule
{
  predecessor: string = "";
  successors: Successor[] = [];
  contextL: string = "";
  contextR: string = "";
  constructor(predecessor:string, successors:Successor[], contextL:string, contextR:string)
  {
    this.predecessor = predecessor; // the main trigger char
    this.successors = successors; // the replacements and their probability weighting
    this.contextL = contextL; // left context for activation
    this.contextR = contextR; // right context
  }
}

class RuleSet
{
  name: string = "";
  start: string = "";
  theta: number = 0;
  factor: number = 0;
  rules: Rule[] = [];
  ignore: string[] = [''];
  constructor(name:string, start:string, theta:number, factor:number, rules:Rule[], ignore:string[]) 
  {
    this.name = name;
    this.start = start; // the starting statement
    this.theta = theta; // rotation angle
    this.factor = factor; // how much the length reduces per iteration
    this.rules = rules; // stores the rules in an array
    this.ignore = ignore; // string of ignore characters when considering context
  }
}

const primaryButton: string = "inline-flex justify-center items-center px-4 py-2 border rounded-md font-semibold text-xs uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition ease-in-out duration-150 bg-white rounded-lg w-24 h-12 mx-auto my-4 active:scale-95";

const GenerateButton: HTMLElement = <HTMLElement>document.getElementById("GenerateButton");
const LSystemsButton: HTMLElement = <HTMLElement>document.getElementById("LSystemsButton");
const OutputButton: HTMLElement = <HTMLElement>document.getElementById("OutputButton");
const HideButton: HTMLElement = <HTMLElement>document.getElementById("HideButton");

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

GenerateButton.onclick = function() { GetSystem(); };
LSystemsButton.onclick = function() { SwitchView(views, 0, viewsB, 0); };
OutputButton.onclick = function() { SwitchView(views, 1, viewsB, 1); };
HideButton.onclick = function() { SwitchView(views, 2, viewsB, 2); };

fSettingsReplacementAdd.onclick = function() { AddRule(); };
fSettingsPresets.onchange = function() { 
  UpdateSelect(parseInt(fSettingsPresets.value)); 
  //Initiate(lSystems[pickIndex], 2, 1000);
  GetSystem();
};

const views = [fContainer, oView, fSettings];
const viewsB = [LSystemsButton, OutputButton, HideButton];

let timeOut = undefined;

ctx.lineWidth = 1;

let canvasSize = 1; // increases the canvas size to make bigger lsystems
let canvasScale = 1; // increases the canvas size to make bigger lsystems

let current = "";
let next = "";

let cT = new Transform(new Vector(0, 0), 0); // moving point
let len = 0; // default length
let theta = 0; // the default angle to be rotated by
let matrix: Transform[] = []; // to store transform history

let pickIndex = 0; // which l system to display

let xStart = 0;
let yStart = 0;
let minX = 0;
let maxX = 0;
let minY = 0;
let maxY = 0;

let animateInterval: number = 0;
let counter = 0;
let offsetX = 0;
let offsetY = 0;
let interval = 10;
let animate = true;
let leaves = false;
let loop = false;
let forest = false;

let rgb: Colour = new Colour(0, 0, 0);
let inheritance = 0;
let lines: any[] = []; // stores line info
let lSystems: RuleSet[] = [];

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
  fSettingsLength.value = "250";
  fSettingsCanvas.value = "1";
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
  fCanvas.width = window.innerWidth;
  fCanvas.height = window.innerHeight * 0.85;
  // ctx.width = window.innerWidth;
  // ctx.height = window.innerHeight * 0.85;
  GetSystem();
}

function Initiate(ruleset: RuleSet, iterations: number, startlength: number)
{
  ctx.scale(canvasScale, canvasScale);
  ctx.clearRect(0,0, fCanvas.width, fCanvas.height);

  fCanvas.width = window.innerWidth;
  fCanvas.height = window.innerHeight * 0.85;
  
  // ctx.width = window.innerWidth;
  // ctx.height = window.innerHeight * 0.85;

  matrix.length = 0;
  xStart = fCanvas.width / 2;
  yStart = fCanvas.height / 2;
  minX = xStart;
  maxX = xStart;
  minY = yStart;
  maxY = yStart;
  theta = ruleset.theta;

  interval = parseFloat(fSettingsInterval.value);
  animate = fSettingsAnimate.checked;
  leaves = fSettingsLeaves.checked;
  forest = fSettingsForest.checked;

  offsetX = 0;
  offsetY = 0;

  if(forest)
  {
    
  }

  let startCol: Colour = <Colour>HexToRGB(fSettingsCol.value);

  oView.innerHTML = "";
  lines = [];

  let forestIndex = 1;
  if(forest) forestIndex = parseFloat(fSettingsCount.value);

  for(let s = 0; s < forestIndex; s++)
  {
    rgb.r = startCol.r;
    rgb.g = startCol.g;
    rgb.b = startCol.b;

    current = ruleset.start;
    len = startlength;

    oView.innerHTML += ruleset.start;
    oView.innerHTML += "<br>";
    oView.innerHTML += "<br>";

    for(let i = 0; i < iterations; i++) Iterate(ruleset);

    currentIndex = s;

    GetLines(s);
  
    Draw(s);
  }
}

function Iterate(ruleset: RuleSet)
{
  len /= ruleset.factor;
  next = "";
  for (let i = 0; i < current.length; i++) // for each character in current
  {
    let c = current.charAt(i);
    let triggered = false;
    for(let r = 0; r < ruleset.rules.length; r++) // compare it against each rule
    {
      if(c == ruleset.rules[r].predecessor) // compare it against each predecessor
      {
        let contextL = ruleset.rules[r].contextL;
        let contextR = ruleset.rules[r].contextR;

        if(contextL !== undefined && i > 1 && ruleset.ignore !== undefined && contextL !== "*")
        {
          let leftC = current.charAt(i - 1);

          if(leftC === "]")
          {
            let counter = i;
            let increment = 1;
            let newChar = "";
            while (counter > 0)
            {
              increment++;
              newChar = current.charAt(i - increment);
              if(newChar === "[")
              {
                increment++;
                leftC = current.charAt(i - increment);
                break;
              }
              counter--;
            }
          }

          if(leftC !== contextL && !ruleset.ignore.includes(leftC))
          {
            continue;
          }
        }

        if(contextR !== undefined && i < (current.length - 1) && ruleset.ignore !== undefined && contextR !== "*")
        {
          let rightC = current.charAt(i + 1);

          if(rightC === "[")
          {
            let counter = i;
            let increment = 1;
            let newChar = "";
            while (counter < current.length)
            {
              increment++;
              newChar = current.charAt(i + increment);
              if(newChar === "]")
              {
                increment++;
                rightC = current.charAt(i + increment);
                break;
              }
              counter++;
            }
          }

          if(rightC !== contextR && !ruleset.ignore.includes(rightC))
          {
            continue;
          }
        }

        if(ruleset.rules[r].successors.length > 0) // if > 0 successors find the relevant one by
        {
          let pick = Math.random(); // picking random value between 0-1
          let counter = 0;
          for(let s = 0; s < ruleset.rules[r].successors.length; s++) // then go through each successor till find matching weight
          {
            counter += ruleset.rules[r].successors[s].weight;
            if(counter >= pick)
            {
              next += ruleset.rules[r].successors[s].successor;
              triggered = true;
              break;
            }
          }
        } 
        else
        {
          next += ruleset.rules[r].successors[0].successor; // else add the first successor if the only one
          triggered = true;
        }
      }
    }
    if(!triggered) next += c; // if no replacement, add the original character
  }
  current = next;

  oView.innerHTML += current;
  oView.innerHTML += "<br>";
  oView.innerHTML += "<br>";
}

function GetLines(index: number)
{
  lines[index] = [];
  matrix.length = 0;

  let startX = parseFloat( (fCanvas.width/2).toFixed(2) ) ;
  let startY = parseFloat( (fCanvas.height/2).toFixed(2) ) ;

  if(forest)
  {
    startY = parseFloat( (fCanvas.height).toFixed(2) ) ;

    let divide = (fCanvas.width * 0.8) / parseFloat(fSettingsCount.value);
    let dif = Math.floor(Math.random() * divide) * index;

    if(Math.random() < 0.5)
    {
      startX += dif;
    }
    else
    {
      startX -= dif;
    }
  }

  cT = new Transform(new Vector(startX, startY), 270); // reset

  for (let i = 0; i < current.length; i++)
  {
    let c = current.charAt(i);
    if (c == "F" || c == "G")
    {
      let newLine = GetLine(cT, len);
      lines[index].push(newLine);
      MoveLine(cT, len);
    }
    else if (c == "f")
    {
      MoveLine(cT, len);
    }
    else if (c == "+")
    {
      RotateTransform(cT, theta);
    }
    else if (c == "-")
    {
      RotateTransform(cT, -theta);
    }
    else if (c == "[")
    {
      let saveT = new Transform(new Vector(cT.pos.x, cT.pos.y), cT.rot);
      matrix.push(saveT);
    }
    else if (c == "]")
    {
      if(matrix.length > 0)
      {
        cT = matrix[matrix.length-1];
        matrix.length = matrix.length -1;
        if(lines[index].length > 0) lines[index][lines[index].length - 1].leaf = true;
      }
    }
  }

  if(lines[index].length > 0)
  {
    lines[index][lines[index].length - 1].leaf = true;
  }

  for (let i = 0; i < lines[index].length; i++)
  {
    let valid = false;
    for (let c = 0; c < lines[index].length; c++)
    {
      if(lines[index][i].start.x === lines[index][c].start.x &&
        lines[index][i].start.y === lines[index][c].start.y && i !== c)
      {
        valid = true;
        break;
      }
    }
    if(valid)
    {
      lines[index][i].branchStart = true;
    }
  }
}

function GetLine(transform: Transform, length: number)
{
  let startVector = new Vector(transform.pos.x, transform.pos.y);
  
  let ang = transform.rot * (Math.PI/180);
  let endX = transform.pos.x + length * Math.cos(ang);
  let endY = transform.pos.y + length * Math.sin(ang);

  endX = parseFloat( endX.toFixed(2) ) ;
  endY = parseFloat( endY.toFixed(2) ) ;

  let endVector = new Vector(endX, endY);

  // get pos

  // max X
  if(startVector.x > maxX) maxX = startVector.x;
  if(endVector.x > maxX) maxX = endVector.x;
  // max Y
  if(startVector.y > maxY) maxY = startVector.y;
  if(endVector.y > maxY) maxY = endVector.y;

  // min X
  if(startVector.x < minX) minX = startVector.x;
  if(endVector.x < minX) minX = endVector.x;
  // max Y
  if(startVector.y < minY) minY = startVector.y;
  if(endVector.y < minY) minY = endVector.y;

  let resultLine = new Line(new Vector(startVector.x, startVector.y), 
  new Vector(endVector.x, endVector.y));
  resultLine.rot = transform.rot;

  return resultLine;
}

function MoveLine(transform: Transform,length: number)
{
  let ang = transform.rot * (Math.PI/180);
  let endX = transform.pos.x + length * Math.cos(ang);
  let endY = transform.pos.y + length * Math.sin(ang);
  cT.pos.x = parseFloat( endX.toFixed(2) ) ;
  cT.pos.y = parseFloat( endY.toFixed(2) ) ;
}

function RotateTransform(transform: Transform, ang: number) // updates the rotation to a transform clockwise angle
{
  let newA = transform.rot + ang;
  if(newA >= 360)
  {
    let dif = 360 - newA;
    newA = 360 - dif;
  }
  if(newA < 0)
  {
    newA = 360 + newA;
  }
  return new Transform(
  new Vector(transform.pos.x, transform.pos.y),
  (transform.rot = newA)
  );
};

function Draw(index: number)
{
  if(forest === false)
  {
    offsetX = ((maxX - minX)) / 2;
    offsetY = ((maxY - minY)) / 2;
  
    offsetX -= (maxX - lines[index][0].start.x);
    offsetY -= (maxY - lines[index][0].start.y);
  }

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

function DrawLine()
{
  ctx.strokeStyle = RandomColour(inheritance, 1);

  ctx.beginPath();
  ctx.moveTo(lines[currentIndex][counter].start.x + offsetX, lines[currentIndex][counter].start.y + offsetY);
  ctx.lineTo(lines[currentIndex][counter].end.x + offsetX, lines[currentIndex][counter].end.y + offsetY);
  ctx.stroke();

  if(leaves)
  {
    if(lines[currentIndex][counter].leaf)
    {
      ctx.fillStyle = ctx.strokeStyle;
  
      let valid = true;
      for(let i = 0; i < lines[currentIndex].length; i++)
      {
        if(lines[currentIndex][counter].end.x === lines[currentIndex][i].start.x &&
          lines[currentIndex][counter].end.y === lines[currentIndex][i].start.y)
        {
          valid = false;
          break;
        }
      }
      if(valid)
      {
        let percent = (100 / fView.scrollHeight) * (lines[currentIndex][counter].end.y + offsetY);
        let radius = Math.abs((100 - percent) / 10);
        let radiusX = radius + Math.random();
        let radiusY = radius + Math.random();
        ctx.beginPath();
        ctx.ellipse(
        lines[currentIndex][counter].end.x + offsetX, 
        lines[currentIndex][counter].end.y + offsetY, 
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
  let theta = parseInt(fSettingsTheta.value);
  let iterations = parseInt(fSettingsIterations.value);
  let drawLength = parseInt(fSettingsLength.value);
  inheritance = parseFloat(fSettingsVariance.value);
  canvasScale = parseInt(fSettingsCanvas.value);

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
    4,
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

function Main()
{
  FillSelect();
  UpdateSelect(pickIndex);
  //Initiate(lSystems[pickIndex], 2, 1000);
  GetSystem();
}

window.addEventListener('resize', ReSize);
document.addEventListener("DOMContentLoaded", Main);

let kochIsland = new RuleSet(
"Koch Island",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [new Rule("F", [ new Successor("F-F+F+FF-F-F+F", 1) ], '*', '*') ], ['']);
lSystems.push(kochIsland);

let kochCurve1 = new RuleSet(
"Koch Curve 2",
"-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F+F-F-F+F", 1)
  ], '*', '*')
], ['']);
lSystems.push(kochCurve1);

let lakesAndIslands = new RuleSet(
"Lakes and Islands",
"F+F+F+F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F+f-FF+F+FF+Ff+FF-f+FF-F-FF-Ff-FFF", 1)
  ], '*', '*'),
  new Rule("f",  [
    new Successor("ffffff", 1)
  ], '*', '*')
], ['']);
lSystems.push(lakesAndIslands);

let ruleset1 = new RuleSet(
"Ruleset 1",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FF-F-F-F-F-F+F", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset1);

let ruleset2 = new RuleSet(
"Ruleset 2",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FF-F-F-F-FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset2);

let ruleset3 = new RuleSet(
"Ruleset 3",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FF-F+F-F-FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset3);

let ruleset4 = new RuleSet(
"Ruleset 4",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FF-F--F-F", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset4);

let ruleset5 = new RuleSet(
"Ruleset 5",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F-FF--F-F", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset5);

let ruleset6 = new RuleSet(
"Ruleset 6",
"F-F-F-F", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F-F+F-F-F", 1)
  ], '*', '*')
], ['']);
lSystems.push(ruleset6);

let dragoncurve = new RuleSet(
"Dragon Curve",
"FX", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("X",  [
    new Successor("X+YF+", 1)
  ], '*', '*'),
  new Rule("Y",  [
    new Successor("-FX-Y", 1)
  ], '', '')
], ['']);
lSystems.push(dragoncurve);

let sierpinkskiCurve = new RuleSet(
"Sierpinski Curve",
"F--XF--F--XF", // start
45, // theta
4, // length reduction factor
 [
  new Rule("X",  [
    new Successor("XF+G+XF--F--XF+G+X", 1)
  ], '*', '*')
], ['']);
lSystems.push(sierpinkskiCurve);

let sierpinkskiTriangle = new RuleSet(
"Sierpinkski Triangle",
"F-G-G", // start
120, // theta
4, // length reduction factor
 [
  new Rule("F",  [
    new Successor("F-G+F+G-F", 1)
  ], '*', '*'),
  new Rule("G",  [
    new Successor("GG", 1)
  ], '*', '*')
], ['']);
lSystems.push(sierpinkskiTriangle);

let cantorSet = new RuleSet(
"Cantor Set",
"F", // start
45, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FfF", 1)
  ], '*', '*'),
  new Rule("f",  [
    new Successor("fff", 1)
  ], '*', '*')
], ['']);

let kochCurve = new RuleSet(
"Koch Curve 1",
"F", // start
60, // theta
4, // length reduction factor
 [
  new Rule("F",  [
    new Successor("F+F--F+F", 1)
  ], '*', '*')
], ['']);
lSystems.push(kochCurve);

let kochSnowflake = new RuleSet(
"Koch Snowflake",
"F--F--F", // start
60, // theta
4, // length reduction factor
 [
  new Rule("F",  [
    new Successor("F+F--F+F", 1)
  ], '*', '*')
], ['']);
lSystems.push(kochSnowflake);

let hilbertCurve = new RuleSet(
"Hilbert Curve",
"A", // start
90, // theta
4, // length reduction factor
 [ 
  new Rule("A",  [
    new Successor("+BF-AFA-FB+", 1)
  ], '*', '*'),
  new Rule("B",  [
    new Successor("-AF+BFB+FA-", 1)
  ], '*', '*')
], ['']);
lSystems.push(hilbertCurve);

let levyCCurve = new RuleSet(
"Levy C Curve",
"F", // start
45, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("+F--F+", 1)
  ], '*', '*')
], ['']);
lSystems.push(levyCCurve);

let star = new RuleSet(
"Star",
"F", // start
77, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F++F", 1)
  ], '*', '*')
], ['']);
lSystems.push(star);

let pentigree = new RuleSet(
"Pentigree Curve",
"F-F-F-F-F", // start
72, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F-F-F++F+F-F", 1)
  ], '*', '*')
], ['']);
lSystems.push(pentigree);

let snowflake = new RuleSet(
"Snowflake",
"F++F++F++F++F", // start
36, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F++F++F+++++F-F++F", 1)
  ], '*', '*')
], ['']);
lSystems.push(snowflake);

let gosperCurve = new RuleSet(
"Gosper Curve",
"F", // start
60, // theta
4, // length reduction factor
 [
  new Rule("F",  [
    new Successor("F-G--G+F++FF+G-", 1)
  ], '*', '*'),
  new Rule("G",  [
    new Successor("+F-GG--G-F++F+G", 1)
  ], '*', '*')
], ['']);
lSystems.push(gosperCurve);

// Bracketed

let fractalPlant = new RuleSet(
"Fractal Plant 1",
"X", // start
25, // theta
4, // length reduction factor
 [ 
  new Rule("X",  [
    new Successor("F+[[X]-X]-F[-FX]+X", 1)
  ], '*', '*'),
  new Rule("F",  [
    new Successor("FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant);

let fractalPlant1 = new RuleSet(
"Fractal Plant 2",
"F", // start
25.7, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F[+F]F[-F]F", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant1);

let fractalPlant2 = new RuleSet(
"Fractal Plant 3",
"F", // start
22.5, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("FF-[-F+F+F]+[+F-F-F]", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant2);

let fractalPlant3 = new RuleSet(
"Fractal Plant 4",
"F", // start
20, // theta
4, // length reduction factor
 [ 
  new Rule("F",  [
    new Successor("F[+F]F[-F][F]", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant3);

let fractalPlant4 = new RuleSet(
"Fractal Plant 5",
"X", // start
20, // theta
4, // length reduction factor
 [ 
  new Rule("X",  [
    new Successor("F[+X]F[-X]+X", 1)
  ], '*', '*'),
  new Rule("F",  [
    new Successor("FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant4);

let fractalPlant5 = new RuleSet(
"Fractal Plant 6",
"X", // start
25.7, // theta
4, // length reduction factor
 [ 
  new Rule("X",  [
    new Successor("F[+X][-X]FX", 1)
  ], '*', '*'),
  new Rule("F",  [
    new Successor("FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant5);

let fractalPlant6 = new RuleSet(
"Fractal Plant 7",
"X", // start
22.5, // theta
4, // length reduction factor
 [ 
  new Rule("X",  [
    new Successor("[[X]+X]+F[+FX]-X", 1)
  ], '', ''),
  new Rule("F",  [
    new Successor("FF", 1)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant6);

// Stochastic

let fractalPlant7 = new RuleSet(
"Fractal Plant 8",
"F", // start
20, // theta
4, // length reduction factor
 [
  new Rule("F",  [
    new Successor("F[+F]F[-F]F", 0.34),
    new Successor("F[+F]F", 0.33),
    new Successor("F[-F]F", 0.33)
  ], '*', '*')
], ['']);
lSystems.push(fractalPlant7);

// Context sensitive

let fractalPlant8 = new RuleSet(
"Fractal Plant 9",
"F1F1F1", // start
22.5, // theta
4, // length reduction factor
 
[

// 1
new Rule(
"0", //predecessor
 [new Successor("0", 1)], // successor array
"0", // left context
"0" // right context
),

// 2
new Rule(
"0", //predecessor
 [new Successor("1[+F1F1]", 1)], // successor array
"0", // left context
"1" // right context
),

// 3
new Rule(
"1", //predecessor
 [new Successor("1", 1)], // successor array
"0", // left context
"0" // right context
),

// 4
new Rule(
"1", //predecessor
 [new Successor("1", 1)], // successor array
"0", // left context
"1" // right context
),


// 5
new Rule(
"0", //predecessor
 [new Successor("0", 1)], // successor array
"1", // left context
"0" // right context
),


// 6
new Rule(
"0", //predecessor
 [new Successor("1F1", 1)], // successor array
"1", // left context
"1" // right context
),

// 7
new Rule(
"1", //predecessor
 [new Successor("0", 1)], // successor array
"1", // left context
"0" // right context
),

// 8
new Rule(
"1", //predecessor
 [new Successor("0", 1)], // successor array
"1", // left context
"1" // right context
),

// 9
new Rule(
"+", //predecessor
 [new Successor("-", 1)], // successor array
"*", // left context
"*" // right context
),

// 10
new Rule(
"-", //predecessor
 [new Successor("+", 1)], // successor array
"*", // left context
"*" // right context
)
],

["+", "-", "F"] // ignore list

);
lSystems.push(fractalPlant8);