import { RuleSet } from "./model";

export type RandomSource = () => number;

// One rewriting generation (moved unchanged from main.ts Iterate). `random` defaults to Math.random;
// tests inject a seeded or scripted source.
export function rewrite(ruleset: RuleSet, current: string, random: RandomSource = Math.random): string
{
  let next = "";
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
          let pick = random(); // picking random value between 0-1
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
  return next;
}
