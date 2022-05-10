const cron = require('node-cron');
const puppeteer = require('puppeteer');
const sheets = require('@googleapis/sheets')

const { CRON_SCHEDULE, GOOGLE_SHEET_ID } = process.env;

const auth = new sheets.auth.GoogleAuth({
  keyFile: "google-credentials.json",
  scopes: "https://www.googleapis.com/auth/spreadsheets", 
});

async function checkFloorPrices() {
  const authClient = await auth.getClient();
  const client = await sheets.sheets({ version: 'v4', auth: authClient });

  // Read assets tab
  const response = await client.spreadsheets.values.get({ auth, spreadsheetId: GOOGLE_SHEET_ID, range: '$CRISIS Assets', valueRenderOption: 'FORMULA' });
  const { values: assetRows } = response.data;

  // Log
  console.log('Fetching floor prices...')

  // Loop through and find hyperlinked floor prices
  for(let i=0; i < assetRows.length; i++) {
    const assetName = assetRows[i][0];
    const assetFloor = String(assetRows[i][1]);
    const assetFloorParts = assetFloor.match(/^=HYPERLINK\("(.*)",\s?(.*)\)/)
    if (!assetFloorParts) continue;

    console.log(`==> ${assetName}`)

    // Get the floor price
    const researchUrl = assetFloorParts[1]
    const floorPrice = await fetchFloorFromUrl(researchUrl);
    if (!floorPrice) continue;

    // Append it to the log file
    const createdAt = (new Date()).toISOString().slice(0, 19).replace(/-/g, '/').replace('T', ' ');
    const logResource = { values: [[assetName, floorPrice, createdAt]] };
    await client.spreadsheets.values.append({ auth, spreadsheetId: GOOGLE_SHEET_ID, range: 'Floor Price Log', valueInputOption: 'USER_ENTERED', resource: logResource });
  
    // Update the floor price in the main sheet
    const updateRange = `$CRISIS Assets!B${i + 1}`;
    const updateValue = `=HYPERLINK("${researchUrl}", ${floorPrice})`;
    const updateResource = { values: [[updateValue]] };
    await client.spreadsheets.values.update({ auth, spreadsheetId: GOOGLE_SHEET_ID, range: updateRange, valueInputOption: 'USER_ENTERED', resource: updateResource })
  
    // Sleep to give their server a break
    await new Promise(r => setTimeout(r, 5000));
  }
}

async function fetchFloorFromUrl(url) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    headless: true
  })
  const page = await browser.newPage();
  let floorPrice = null;

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36')
  await page.goto(url, { waitUnit: 'networkidle2' });
  await page.waitForNetworkIdle()

  try {
    const floorItem = await page.$x('//div[contains(text(), "FLOOR")]');
    const floorText = await floorItem[0].evaluate(el => el.nextElementSibling.innerText);
    floorPrice = parseFloat(floorText);
  } catch {
    // Do nothing, continue
  } finally {
    await browser.close();
  }

  return floorPrice;
}

cron.schedule(CRON_SCHEDULE, checkFloorPrices);

if (process.env.NODE_ENV !== 'production') {
  checkFloorPrices();
}
