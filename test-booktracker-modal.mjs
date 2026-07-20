import { chromium } from "playwright";

const mockBooksHtml = Array.from({ length: 14 }, (_, i) => `
  <button data-book-id="b${i}" class="w-full text-left rounded-2xl border-2 border-yellow-400/50 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-yellow-500/10 hover:border-yellow-400 active:scale-95 transition-all shadow-md touch-manipulation">
    <div class="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 flex-wrap">
      <div class="flex-1 min-w-0">
        <span class="font-bold text-xs sm:text-sm text-foreground block truncate">Libro archivado numero ${i + 1} con un titulo bastante largo para probar el truncate</span>
        <span class="text-xs text-muted-foreground block">Autor Ejemplo ${i + 1}</span>
      </div>
      <span class="text-xs bg-yellow-500/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-full font-bold flex-shrink-0 whitespace-nowrap">
        ${120 + i}/300
      </span>
    </div>
  </button>
`).join("\n");

const mockPage = `
<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" id="overlay">
  <div class="overflow-hidden rounded-3xl border border-border/50 bg-background max-w-md w-full h-[85dvh] max-h-[85dvh] flex flex-col" id="modal">
    <div class="flex-1 min-h-0 flex flex-col" id="booktracker-root">
      <div class="h-full min-h-0 flex flex-col bg-background text-foreground" id="booktracker-hfull">
        <div class="w-full flex flex-col h-full min-h-0" id="archived-panel">
          <div class="border-b border-yellow-500/30 px-4 sm:px-6 py-5 bg-gradient-to-r from-yellow-500/5 to-amber-500/5">
            <div class="flex items-start gap-3 sm:gap-4">
              <button class="flex-shrink-0 mt-0.5 sm:mt-1 rounded hover:bg-yellow-500/10 p-1.5 sm:p-1 transition-colors h-8 w-8 sm:h-auto sm:w-auto touch-manipulation">←</button>
              <div class="min-w-0 flex-1">
                <h2 class="font-black text-base sm:text-lg text-yellow-700 dark:text-yellow-300 flex items-center gap-2 flex-wrap">
                  <span>⚔️ Experiencias</span>
                </h2>
                <p class="mt-1 text-xs sm:text-sm text-yellow-600/70 dark:text-yellow-400/70">Viviste estos libros</p>
              </div>
            </div>
          </div>
          <div class="px-3 sm:px-5 py-3 flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/10" id="scroll-list">
            ${mockBooksHtml}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

async function run() {
  const browser = await chromium.launch();
  const viewports = [
    { name: "mobile", width: 375, height: 812 },
    { name: "desktop", width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3001/", { waitUntil: "load" });
    await page.evaluate((html) => {
      document.body.innerHTML = html;
    }, mockPage);
    await page.waitForTimeout(300);

    // Screenshot full modal (top of list)
    await page.screenshot({ path: `C:/Users/DANIEL~1/AppData/Local/Temp/claude/c--Users-Daniel-Visona-Desktop-Skill-Map-Builder/a8f10267-61c9-44e9-8dc5-82ae7faf7c9e/scratchpad/archived-${vp.name}-top.png` });

    // Verify modal + list bounding boxes stay within viewport
    const modalBox = await page.locator("#modal").boundingBox();
    const listBox = await page.locator("#scroll-list").boundingBox();
    const scrollInfo = await page.locator("#scroll-list").evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));

    console.log(`[${vp.name}] viewport=${vp.width}x${vp.height}`);
    console.log(`[${vp.name}] modalBox=`, modalBox);
    console.log(`[${vp.name}] listBox=`, listBox);
    console.log(`[${vp.name}] scrollInfo=`, scrollInfo);
    console.log(`[${vp.name}] modal fits within viewport height: ${modalBox.y + modalBox.height <= vp.height}`);
    console.log(`[${vp.name}] list is scrollable (scrollHeight > clientHeight): ${scrollInfo.scrollHeight > scrollInfo.clientHeight}`);

    const debugInfo = await page.evaluate(() => {
      const ids = ["overlay", "modal", "booktracker-root", "booktracker-hfull", "archived-panel", "scroll-list"];
      return ids.map((id) => {
        const el = document.getElementById(id);
        const cs = getComputedStyle(el);
        return { id, height: cs.height, maxHeight: cs.maxHeight, minHeight: cs.minHeight, display: cs.display, flex: cs.flex, overflowY: cs.overflowY };
      });
    });
    console.log(`[${vp.name}] debugInfo=`, JSON.stringify(debugInfo, null, 2));

    // Scroll to bottom of list, then screenshot
    await page.locator("#scroll-list").evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `C:/Users/DANIEL~1/AppData/Local/Temp/claude/c--Users-Daniel-Visona-Desktop-Skill-Map-Builder/a8f10267-61c9-44e9-8dc5-82ae7faf7c9e/scratchpad/archived-${vp.name}-scrolled.png` });

    await context.close();
  }

  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
