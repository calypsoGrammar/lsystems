// DOM binding for the ruleset editor (CAL-1274). The form is the source of truth: every structural change (add/remove a
// rule or successor, preset switch) first reads the whole form into an EditorState, changes that, and re-renders from it,
// so nothing typed is lost. Elements are built with createElement/textContent (never innerHTML) and the buttons use one
// delegated click listener, so grammar text can't inject markup and there are no inline or global handlers.
import type { RuleSet } from "./lsystem/model";
import {
  addRule, addSuccessor, cloneState, fieldIds, removeRule, removeSuccessor, statesEqual, stateFromPreset,
  type EditorState, type FieldErrors,
} from "./lsystem/editor";

const INPUT = "border border-black rounded-lg p-2 m-2 w-full";
const BUTTON = "bg-white rounded-lg min-h-10 px-3 py-1 m-1 active:scale-95 border border-black";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K]
{
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function field(id: string, label: string, control: HTMLElement): HTMLElement
{
  control.id = id;
  const wrap = el("div", { class: "flex flex-col" });
  wrap.append(el("label", { for: id }, label), control);
  return wrap;
}

function textInput(value: string, data: Record<string, string>, multiline = false): HTMLInputElement | HTMLTextAreaElement
{
  const c = multiline ? el("textarea", { rows: "2" }) : el("input", { type: "text", autocomplete: "off", spellcheck: "false" });
  c.className = INPUT;
  c.value = value;
  for (const [k, v] of Object.entries(data)) c.dataset[k] = v;
  return c;
}

function button(label: string, action: string, rule?: number, succ?: number): HTMLButtonElement
{
  const b = el("button", { type: "button", class: BUTTON }, label);
  b.dataset.action = action;
  if (rule !== undefined) b.dataset.rule = String(rule);
  if (succ !== undefined) b.dataset.succ = String(succ);
  return b;
}

const staticFields = {
  axiom: "fSettingsAxiom", theta: "fSettingsTheta", iterations: "fSettingsIterations", factor: "fSettingsFactor",
} as const;

export class RuleEditor
{
  private template: EditorState;
  private index = -1;
  private notice = "";
  private shown: FieldErrors = new Map();

  constructor(private readonly presets: RuleSet[], private readonly container: HTMLElement,
    private readonly status: HTMLElement | null, private readonly onChange: () => void = () => {})
  {
    this.template = stateFromPreset(presets[0]);
    container.addEventListener("click", ev =>
    {
      const t = (ev.target as HTMLElement | null)?.closest<HTMLElement>("button[data-action]");
      if (t && container.contains(t)) this.act(t);
    });
    const onEdit = () => { this.revalidate(); this.updateStatus(); };
    // One delegated listener on the whole panel, so rendering and appearance inputs revalidate too.
    const panel = container.closest("#fSettings") ?? container;
    panel.addEventListener("input", onEdit);
    panel.addEventListener("change", onEdit);
  }

  get presetIndex(): number { return this.index; }

  // Reads the whole form: this, not any cached copy, is what gets validated and generated.
  readState(): EditorState
  {
    const value = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
    const rules = [...this.container.querySelectorAll<HTMLElement>("[data-rule-block]")].map(block =>
    {
      const v = (f: string) => block.querySelector<HTMLInputElement>(`[data-field="${f}"]`)?.value ?? "";
      return {
        predecessor: v("predecessor"), contextL: v("contextL"), contextR: v("contextR"),
        successors: [...block.querySelectorAll<HTMLElement>("[data-succ-row]")].map(row => ({
          successor: row.querySelector<HTMLInputElement>('[data-field="successor"]')?.value ?? "",
          weight: row.querySelector<HTMLInputElement>('[data-field="weight"]')?.value ?? "",
        })),
      };
    });
    return {
      axiom: value(staticFields.axiom), theta: value(staticFields.theta), iterations: value(staticFields.iterations),
      factor: value(staticFields.factor), rules,
      ignore: this.container.querySelector<HTMLInputElement>('[data-field="ignore"]')?.value ?? "",
    };
  }

  isModified(): boolean { return !statesEqual(this.readState(), this.template); }

  // Load a preset's original template. Unsaved edits to the previous preset are discarded, and the status line says so.
  selectPreset(index: number): void
  {
    const discarded = this.index >= 0 && this.index !== index && this.isModified();
    const previous = this.index >= 0 ? this.presets[this.index].name : "";
    this.index = index;
    this.template = stateFromPreset(this.presets[index]);
    this.apply(this.template);
    this.notice = discarded ? `Loaded the original ${this.presets[index].name}; unsaved edits to ${previous} were discarded.` : "";
  }

  // Discard unsaved edits to the current preset and reload its original template.
  resetToPreset(): void
  {
    this.apply(this.template);
    this.notice = "";
    this.updateStatus();
    this.onChange();
  }

  private apply(state: EditorState): void
  {
    for (const [k, id] of Object.entries(staticFields))
      (document.getElementById(id) as HTMLInputElement).value = state[k as keyof typeof staticFields];
    this.render(state);
    this.clearErrors();
  }

  addRule(): void
  {
    this.render(addRule(this.readState()));
    this.clearErrors();
    this.updateStatus();
  }

  private act(button: HTMLElement): void
  {
    const action = button.dataset.action;
    const rule = Number(button.dataset.rule);
    const succ = Number(button.dataset.succ);
    const state = this.readState(); // keep every unrelated edit
    let next: EditorState;
    let focus: string | undefined;
    switch (action)
    {
      case "addRule": next = addRule(state); focus = fieldIds.predecessor(next.rules.length - 1); break;
      case "removeRule": next = removeRule(state, rule); focus = "fSettingsReplacementAdd"; break;
      case "addSuccessor": next = addSuccessor(state, rule); focus = fieldIds.successor(rule, next.rules[rule].successors.length - 1); break;
      case "removeSuccessor": next = removeSuccessor(state, rule, succ); focus = `add${rule}`; break;
      case "reset": this.resetToPreset(); return;
      default: return;
    }
    this.render(next);
    this.clearErrors();
    this.updateStatus();
    if (focus) document.getElementById(focus)?.focus();
  }

  private render(state: EditorState): void
  {
    const root = this.container;
    root.replaceChildren();
    state.rules.forEach((rule, i) =>
    {
      const block = el("fieldset", { id: fieldIds.rule(i), class: "w-full border border-black rounded-lg p-2 my-2 flex flex-col gap-1" });
      block.dataset.ruleBlock = String(i);
      block.append(el("legend", { class: "px-1" }, `Rule ${i + 1}`));
      block.append(field(fieldIds.predecessor(i), "Predecessor", textInput(rule.predecessor, { field: "predecessor" })));
      rule.successors.forEach((s, j) =>
      {
        const row = el("div", { class: "grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-x-2 border-t border-gray-300 pt-1" });
        row.dataset.succRow = String(j);
        row.append(
          field(fieldIds.successor(i, j), `Successor ${j + 1}`, textInput(s.successor, { field: "successor" }, true)),
          field(fieldIds.weight(i, j), "Weight", textInput(s.weight, { field: "weight" })));
        const rm = button("Remove Successor", "removeSuccessor", i, j);
        rm.id = `removeSuccessor${i}${j}`;
        row.append(rm);
        block.append(row);
      });
      const add = button("Add Successor", "addSuccessor", i);
      add.id = `add${i}`;
      const rmRule = button("Remove Rule", "removeRule", i);
      rmRule.id = `removeRule${i}`;
      const actions = el("div", { class: "flex flex-row flex-wrap" });
      actions.append(add, rmRule);
      const ctx = el("div", { class: "grid grid-cols-2 gap-x-2" });
      ctx.append(
        field(fieldIds.contextL(i), "Left Context", textInput(rule.contextL, { field: "contextL" })),
        field(fieldIds.contextR(i), "Right Context", textInput(rule.contextR, { field: "contextR" })));
      block.append(actions, ctx);
      root.append(block);
    });
    root.append(field(fieldIds.ignore, "Ignore List (comma separated)", textInput(state.ignore, { field: "ignore" })));
  }

  // --- validation display -------------------------------------------------------------------------------------------

  showErrors(errors: FieldErrors): void
  {
    this.clearErrors();
    this.shown = errors;
    for (const [id, message] of errors)
    {
      const target = document.getElementById(id);
      if (!target) continue; // whole-form messages are shown by the caller
      const p = el("p", { id: `${id}-error`, class: "text-red-700 text-sm m-1", "data-field-error": "" }, message);
      if (target.tagName === "FIELDSET") target.append(p); else target.parentElement?.insertBefore(p, target.nextSibling);
      if (target.tagName !== "FIELDSET") target.setAttribute("aria-invalid", "true");
      target.setAttribute("aria-describedby", p.id);
      if (target.tagName !== "FIELDSET") target.classList.add("border-red-700");
    }
  }

  clearErrors(): void
  {
    this.shown = new Map();
    document.querySelectorAll("[data-field-error]").forEach(p => p.remove());
    document.querySelectorAll("#fSettings [aria-invalid]").forEach(e => { e.removeAttribute("aria-invalid"); e.removeAttribute("aria-describedby"); e.classList.remove("border-red-700"); });
    document.querySelectorAll("#fSettings [aria-describedby]").forEach(e => e.removeAttribute("aria-describedby"));
  }

  hasErrors(): boolean { return this.shown.size > 0; }

  // Set by the owner of validation so that errors shown earlier follow the user's corrections.
  revalidator: (() => void) | undefined;
  private revalidate(): void { if (this.shown.size > 0) this.revalidator?.(); }

  private updateStatus(): void
  {
    if (this.isModified()) this.notice = "";
    if (!this.status) return;
    this.status.textContent = this.isModified()
      ? "Edited: unsaved changes. Reset to preset restores the original; loading another preset discards them."
      : this.notice || "Original preset.";
  }

  updateStatusNow(): void { this.updateStatus(); }
  snapshot(): EditorState { return cloneState(this.readState()); }
}
