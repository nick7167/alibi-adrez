import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROMPTS } from '../../../packages/shared/content/prompts';
import { CODE_RE, clickUntil, open } from './helpers';

const root = resolve(process.cwd(), '../../docs/app-store');
const names = ['Freja', 'Mikkel', 'Sofie', 'Jonas', 'Emma'];
const devices = {
  iphone: { width: 440, height: 956 },
  ipad: { width: 1032, height: 1376 },
};
// Fictional answers entered through the actual UI, never substituted in the DOM.
// All everyday prompts are covered because the real server randomly chooses one.
const answers: Record<string, [string[], string[]]> = {
  'last-search': [['Kan pingviner få kolde fødder?', 'Nemt surdejsbrød', 'Vejret i morgen', 'Verdens største kartoffel', 'Hvordan holder man en plante i live?'], ['Do penguins get cold feet?', 'Easy sourdough bread', 'Tomorrow’s weather', 'The world’s biggest potato', 'How do I keep a plant alive?']],
  'pocket-contents': [['En kvittering fra sidste år', 'Tre læbepomader', 'En meget flad müslibar', 'En løs skrue', 'Nøgler til min gamle cykel'], ['A receipt from last year', 'Three lip balms', 'A very flat cereal bar', 'A loose screw', 'Keys to my old bike']],
  'last-photo': [['Min kat midt i et gab', 'En virkelig flot bolle', 'En skæv parkeret cykel', 'Mine nye sokker', 'En solnedgang gennem en beskidt rude'], ['My cat mid-yawn', 'A really good bread roll', 'A badly parked bike', 'My new socks', 'A sunset through a dirty window']],
  'breakfast-today': [['Kaffe og en halv småkage', 'Havregrød med alt for meget kanel', 'Pizza fra i går', 'En banan på vej ud', 'Rugbrød med ost'], ['Coffee and half a cookie', 'Porridge with too much cinnamon', 'Yesterday’s pizza', 'A banana on my way out', 'Rye bread and cheese']],
  'oldest-open-tab': [['En opskrift, jeg aldrig får lavet', 'En sofa, der er for dyr', 'Togtider fra sidste sommer', 'En guide til at folde lagner', 'En ferie, jeg stadig drømmer om'], ['A recipe I will never make', 'A sofa I cannot afford', 'Train times from last summer', 'How to fold a fitted sheet', 'A holiday I still dream about']],
  'notes-app-last-line': [['Køb ost. Mere ost.', 'Husk at vande planten', 'En virkelig god idé klokken to', 'Ring til mormor', 'Gulerødder og batterier'], ['Buy cheese. More cheese.', 'Water the plant', 'A brilliant idea at two in the morning', 'Call Grandma', 'Carrots and batteries']],
  'phone-greeting': [['Halløj i skuret!', 'Ja, det er mig', 'Hvad så?', 'Hej! Kan du høre mig?', 'Goddag i den anden ende'], ['Well hello there!', 'Yep, it’s me', 'What’s up?', 'Hello! Can you hear me?', 'Hello from the other side']],
  'last-message-sent': [['Jeg er der om fem. Måske ti.', 'Skal vi have pizza?', 'Har du set min oplader?', 'Jeg tager kage med', 'Det var ikke mig'], ['I’ll be there in five. Maybe ten.', 'Shall we get pizza?', 'Have you seen my charger?', 'I’ll bring cake', 'It wasn’t me']],
  'saddest-thing-in-fridge': [['En agurk med opgivne drømme', 'En ensom oliven', 'En halv citron uden fremtid', 'Sennep fra en anden tidsalder', 'En meget træt salat'], ['A cucumber with broken dreams', 'One lonely olive', 'Half a lemon with no future', 'Mustard from another era', 'A very tired lettuce']],
  'chore-put-off': [['At sortere den ene skuffe', 'At rense ovnen', 'At lappe cyklen', 'At pudse vinduer', 'At folde vasketøjet'], ['Sorting that one drawer', 'Cleaning the oven', 'Fixing my bike', 'Cleaning the windows', 'Folding the laundry']],
  'lazy-dinner': [['Rugbrød direkte over vasken', 'Pasta med smør', 'Toast med ekstra ost', 'Morgenmad igen', 'Alt på én bageplade'], ['Toast straight over the sink', 'Pasta with butter', 'Extra cheesy toast', 'Breakfast again', 'Everything on one baking tray']],
  'song-on-repeat': [['Den fra min gamle skolefest', 'Den med det alt for lange omkvæd', 'Min egen sang i badet', 'Den samme fødselsdagssang', 'Den fra reklamen'], ['The one from our school party', 'The one with the endless chorus', 'My own song in the shower', 'The same birthday song', 'The one from that advert']],
  'phone-wallpaper': [['Min kat med dobbelthage', 'Et bjerg, jeg aldrig har besteget', 'Et sløret billede af vennerne', 'Den baggrund, telefonen kom med', 'Havet i regnvejr'], ['My cat’s double chin', 'A mountain I have never climbed', 'A blurry photo of my friends', 'The default wallpaper', 'The sea in the rain']],
  'last-purchase': [['En alt for dyr kaffe', 'Fem kilo kartofler', 'En plante mere', 'Sokker med ænder', 'En bolle til togturen'], ['An overpriced coffee', 'Five kilos of potatoes', 'Another plant', 'Socks with ducks', 'A bread roll for the train']],
  'useless-skill': [['At genkende folk på deres nys', 'At folde en serviet til en svane', 'At gætte klokken uden ur', 'At huske gamle reklamer', 'At stable mønter'], ['Recognising people by their sneeze', 'Folding napkin swans', 'Guessing the time without a watch', 'Remembering old adverts', 'Stacking coins']],
  'daily-ritual': [['At sige godmorgen til kaffemaskinen', 'At tjekke vejret tre gange', 'At lede efter nøglerne', 'At synge for planten', 'At drikke te af det samme krus'], ['Saying morning to the coffee machine', 'Checking the weather three times', 'Looking for my keys', 'Singing to the plant', 'Tea from the same mug']],
  'not-your-name': [['Chefen', 'Kartoflen', 'Professoren', 'Sovetrynen', 'Kaffeministeren'], ['The boss', 'Potato', 'Professor', 'Sleepyhead', 'Minister of coffee']],
  'last-thing-watched': [['En kat, der faldt af en sofa', 'En dokumentar om svampe', 'En opskrift på pandekager', 'Vejrudsigten', 'En meget lang togtur'], ['A cat falling off a sofa', 'A documentary about mushrooms', 'A pancake recipe', 'The weather forecast', 'A very long train journey']],
  'usual-cafe-order': [['Kaffe og noget med kanel', 'En stor cappuccino', 'Te og dobbelt kage', 'En lille espresso', 'Varm kakao med det hele'], ['Coffee and something with cinnamon', 'A large cappuccino', 'Tea and double cake', 'A small espresso', 'Hot chocolate with everything']],
  'bedside-table': [['Tre bøger, jeg er halvvejs i', 'Et tomt vandglas', 'En hel samling hårelastikker', 'En væltet lampe', 'Min reserveoplader'], ['Three half-read books', 'An empty water glass', 'A collection of hair ties', 'A knocked-over lamp', 'My spare charger']],
  'highest-screen-time': [['Min podcastafspiller', 'Kort, fordi jeg altid farer vild', 'Den med alle opskrifterne', 'Min browser med hundrede faner', 'Beskeder fra familiegruppen'], ['My podcast player', 'Maps, because I always get lost', 'The one with all the recipes', 'My browser with a hundred tabs', 'Messages from the family group']],
  'home-alone-mutter': [['Nå, hvad skal vi så spise?', 'Hvor er den nu?', 'Det var faktisk ret smart', 'Bare én småkage mere', 'Jeg burde virkelig støvsuge'], ['Right, what shall we eat?', 'Where did it go?', 'That was actually quite clever', 'Just one more cookie', 'I really should vacuum']],
  'word-you-overuse': [['Seriøst', 'Altså', 'Hyggeligt', 'Præcis', 'Måske'], ['Seriously', 'Basically', 'Lovely', 'Exactly', 'Maybe']],
  'broken-at-home': [['Den ene skuffe i køkkenet', 'Ringeklokken', 'Lampen over spisebordet', 'Håndtaget til altanen', 'Min venstre hovedtelefon'], ['That one kitchen drawer', 'The doorbell', 'The dining table light', 'The balcony handle', 'My left headphone']],
  'most-worn-clothing': [['Min bløde trøje med et hul', 'De samme sorte jeans', 'En alt for stor hættetrøje', 'Sokker, der aldrig matcher', 'Min gamle regnjakke'], ['My soft jumper with a hole', 'The same black jeans', 'An oversized hoodie', 'Socks that never match', 'My old raincoat']],
};

async function capture(page: Page, lang: string, name: string) {
  for (const [device, viewport] of Object.entries(devices)) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.locator('.confetti-bit').evaluateAll(nodes => nodes.every(node => Number(getComputedStyle(node).opacity) === 0))).toBe(true);
    if (name.startsWith('answer-')) {
      await page.getByTestId('entry-field').focus();
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowRight');
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const dir = resolve(root, 'raw', lang, device);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: resolve(dir, `${name}.png`), animations: 'disabled', caret: 'initial' });
    {
      const parts = name.startsWith('answer-')
        ? [page.getByTestId('prompt'), page.getByTestId('entry-field').locator('..'), page.getByTestId('hand-in')]
        : name === '01-guess'
          ? [page.locator('.gu-prompt'), page.getByTestId('answer-card'), page.getByTestId('guess-grid')]
          : name === '03-reveal'
            ? [page.getByTestId('staged-answer'), page.getByTestId('reveal-author'), page.getByTestId('reveal-rows')]
            : name === '04-lobby'
              ? [page.getByTestId('share-code'), page.getByTestId('player-card').first().locator('../..'), page.getByTestId('packs-summary')]
              : name === '05-packs'
                ? [page.getByTestId('share-code'), page.locator('[role="group"][aria-labelledby="packs-label"]'), page.getByTestId('start-game')]
                : [page.getByTestId('finale-headline'), page.getByTestId('finale-podium'), page.getByTestId('finale-board')];
      for (const [i, part] of parts.entries()) {
        await expect(part).toBeVisible();
        const path = resolve(dir, `${name}-detail-${i}.png`);
        if (await part.getAttribute('data-testid') === 'share-code') {
          // Crop the actual code/label/hint, excluding the separate absolute
          // leave control which overlaps the button's otherwise empty margin.
          const clip = await part.locator(':scope > span').evaluateAll(nodes => {
            const boxes = nodes.map(node => node.getBoundingClientRect());
            const x = Math.min(...boxes.map(b => b.x));
            const y = Math.min(...boxes.map(b => b.y));
            return { x, y, width: Math.max(...boxes.map(b => b.right)) - x, height: Math.max(...boxes.map(b => b.bottom)) - y };
          });
          await page.screenshot({ path, clip, animations: 'disabled' });
        } else {
          await part.screenshot({ path, animations: 'disabled', caret: 'initial' });
        }
      }
    }
  }
  await page.setViewportSize(devices.iphone);
}

for (const lang of ['da', 'en'] as const) {
  test(`capture and compose real ${lang} gameplay`, async ({ browser }) => {
    if (process.env.STORE_RENDER_ONLY !== '1') {
    const clients = [];
    const errors: string[] = [];
    try {
      for (const name of names) {
        const context = await browser.newContext({ viewport: devices.iphone, deviceScaleFactor: 3, locale: lang === 'da' ? 'da-DK' : 'en-GB', reducedMotion: 'no-preference' });
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        clients.push({ name, context, page });
      }
      const host = clients[0].page;
      await open(host, '/');
      await clickUntil('create-room', host, () => host.waitForURL(CODE_RE));
      const code = new URL(host.url()).pathname.split('/').at(-1)!;
      for (const [i, client] of clients.entries()) {
        await open(client.page, `/room/${code}`);
        await client.page.getByTestId('nickname').fill(client.name);
        await client.page.getByTestId(`avatar-${i}`).click();
        await clickUntil('join-submit', client.page, () => expect(client.page.getByTestId('players-heading')).toBeVisible());
      }
      await expect(host.getByTestId('player-card')).toHaveCount(names.length);
      await capture(clients[1].page, lang, '04-lobby');
      await capture(host, lang, '05-packs');
      for (const pack of ['opinions', 'absurd', 'spicy']) {
        const toggle = host.getByTestId(`pack-${pack}`);
        if (await toggle.getAttribute('aria-checked') === 'true') await toggle.click();
      }
      await host.getByTestId('toggle-timings').click();
      for (const [key, target] of Object.entries({ questions: 1, rounds: 1, answerSec: 300, guessSec: 60, revealSec: 15, standingsEvery: 0 })) {
        const value = host.getByTestId(`value-${key}`);
        for (let guard = 0; guard < 60; guard++) {
          const shown = Number(await value.getAttribute('data-value'));
          if (shown === target) break;
          await host.getByTestId(`${shown < target ? 'inc' : 'dec'}-${key}`).click();
        }
        await expect(value).toHaveAttribute('data-value', String(target));
      }
      await clickUntil('start-game', host, () => expect(host.getByTestId('intro-splash')).toBeVisible());
      await expect(host.getByTestId('entry-field')).toBeVisible({ timeout: 30000 });
      const promptText = (await host.getByTestId('prompt').innerText()).trim();
      const prompt = PROMPTS.find(p => p[lang] === promptText);
      expect(prompt, 'real localized everyday prompt').toBeDefined();
      const responses = answers[prompt!.id][lang === 'da' ? 0 : 1];
      for (const [i, client] of clients.entries()) {
        await client.page.getByTestId('entry-field').pressSequentially(responses[i].slice(0, -2), { delay: 35 });
        // Save each actual player's answer screen; select the real author later.
        await capture(client.page, lang, `answer-${i}`);
        await client.page.getByTestId('entry-field').pressSequentially(responses[i].slice(-2), { delay: 35 });
      }
      for (const client of clients) await client.page.getByTestId('hand-in').click();
      await expect(host.getByTestId('staged-answer')).toBeVisible();
      let author = -1;
      for (const [i, client] of clients.entries()) if (await client.page.getByTestId('guessing-yours').count()) author = i;
      expect(author).toBeGreaterThanOrEqual(0);
      const guessers = clients.filter((_, i) => i !== author);
      const correct = guessers[0];
      await expect(correct.page.getByTestId('staged-answer')).toHaveText(responses[author]);
      await correct.page.getByTestId('guess-chip').filter({ hasText: names[author] }).click();
      await capture(correct.page, lang, '01-guess');
      for (const wrong of guessers.slice(1)) {
        const target = clients.find(c => c !== wrong && c.name !== names[author])!;
        await wrong.page.getByTestId('guess-chip').filter({ hasText: target.name }).click();
      }
      await expect(correct.page.getByTestId('reveal-author')).toContainText(names[author], { timeout: 65000 });
      await expect(correct.page.getByTestId('staged-answer')).toHaveText(responses[author]);
      await capture(correct.page, lang, '03-reveal');
      for (const device of Object.keys(devices)) {
        copyFileSync(resolve(root, 'raw', lang, device, `answer-${author}.png`), resolve(root, 'raw', lang, device, '02-answer.png'));
        for (let i = 0; i < 3; i++) copyFileSync(resolve(root, 'raw', lang, device, `answer-${author}-detail-${i}.png`), resolve(root, 'raw', lang, device, `02-answer-detail-${i}.png`));
      }
      await expect(host.getByTestId('finale-headline')).toBeVisible({ timeout: 25000 });
      const scores = await host.getByTestId('finale-score').allTextContents();
      expect(scores.reduce((sum, s) => sum + Number(s.replace(/\D/g, '')), 0)).toBe(5);
      await capture(host, lang, '06-finale');
      writeFileSync(resolve(root, `scenario-${lang}.json`), JSON.stringify({ language: lang, names, prompt: promptText, promptId: prompt!.id, responses, author: names[author], correctGuesser: correct.name, scoreTotal: 5, source: 'Actual local game; no text, votes or scores altered after capture.' }, null, 2) + '\n');
      expect(errors).toEqual([]);
      await host.getByTestId('finale-lobby').click();
      for (const client of clients) await client.page.getByTestId('leave-game').click();
    } finally {
      await Promise.all(clients.map(c => c.context.close()));
    }
    }
    // Compose actual screenshots in an original HTML poster; no invented UI.
    for (const [device, viewport] of Object.entries(devices)) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: device === 'ipad' ? 2 : 3 });
      try {
        const page = await context.newPage();
        for (let slide = 1; slide <= 6; slide++) {
          await page.goto(`${pathToFileURL(resolve(root, 'artwork.html')).href}?device=${device}&lang=${lang}&slide=${slide}`);
          await page.evaluate(() => document.fonts.ready);
          await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
          expect(await page.locator('h1').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
          const copy = await page.locator('.copy').boundingBox();
          const frame = await page.locator('.device').boundingBox();
          expect(copy!.y + copy!.height, `${lang}/${device}/${slide}: headline clearance`).toBeLessThan(frame!.y - 8);
          const dir = resolve(root, 'final', lang, device);
          mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: resolve(dir, `${String(slide).padStart(2, '0')}.png`), animations: 'disabled' });
        }
      } finally { await context.close(); }
    }
  });
}
