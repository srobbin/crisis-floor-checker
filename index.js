import cron from 'node-cron';
import sheets from '@googleapis/sheets';
import fetch from 'node-fetch';

const {
  CRON_SCHEDULE,
  GOOGLE_SHEET_ID,
  OPENSEA_API_KEY,
} = process.env;

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
    const collectionUrl = assetFloorParts[1]
    const collectionSlug = collectionUrl.split('/').pop();
    const floorPrice = await fetchFloor(collectionSlug);
    if (!floorPrice) continue;

    // Append it to the log file
    const createdAt = (new Date()).toISOString().slice(0, 19).replace(/-/g, '/').replace('T', ' ');
    const logResource = { values: [[assetName, floorPrice, createdAt]] };
    await client.spreadsheets.values.append({ auth, spreadsheetId: GOOGLE_SHEET_ID, range: 'Floor Price Log', valueInputOption: 'USER_ENTERED', resource: logResource });
  
    // Update the floor price in the main sheet
    const updateRange = `$CRISIS Assets!B${i + 1}`;
    const updateValue = `=HYPERLINK("${collectionUrl}", ${floorPrice})`;
    const updateResource = { values: [[updateValue]] };
    await client.spreadsheets.values.update({ auth, spreadsheetId: GOOGLE_SHEET_ID, range: updateRange, valueInputOption: 'USER_ENTERED', resource: updateResource })
  
    // Sleep to give their server a break
    await new Promise(r => setTimeout(r, 5000));
  }
}

async function fetchFloor(collectionSlug) {
  const response = await fetch(`https://api.opensea.io/api/v1/collection/${collectionSlug}/stats`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': OPENSEA_API_KEY,
    }
  });
  const data = await response.json();
  return data.stats.floor_price;
}

cron.schedule(CRON_SCHEDULE, checkFloorPrices);

if (process.env.NODE_ENV !== 'production') {
  checkFloorPrices();
}
