const puppeteer = require('puppeteer');

const CONCERT_ID = '6aec50df716ae22e5aa1797f';
const SESSION_COOKIE = '6263ef407df77bd163d089fe401513400f1d7091c04cfb891788c8f04327356f';

async function checkAttendeeInputs() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  await page.setCookie({
    name: 'rapira.sid',
    value: SESSION_COOKIE,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false
  });

  await page.setViewport({ width: 375, height: 812 });
  await page.goto(`http://localhost:3000/concerts/${CONCERT_ID}/book?quantity=2&seats=A-01,A-02&category=recliner`, {
    waitUntil: 'networkidle2'
  });

  const attendeeInfo = await page.evaluate(() => {
    const row = document.querySelector('.rapira-attendee-row');
    const nameField = document.querySelector('.field-name');
    const ageField = document.querySelector('.field-age');
    const nameInput = document.querySelector('#attendeeName0');
    const ageInput = document.querySelector('#attendeeAge0');

    return {
      rowDirection: row ? window.getComputedStyle(row).flexDirection : null,
      rowGap: row ? window.getComputedStyle(row).gap : null,
      nameFieldWidth: nameField ? nameField.offsetWidth : null,
      ageFieldWidth: ageField ? ageField.offsetWidth : null,
      nameInputWidth: nameInput ? nameInput.offsetWidth : null,
      ageInputWidth: ageInput ? ageInput.offsetWidth : null,
      nameFieldTop: nameField ? nameField.offsetTop : null,
      ageFieldTop: ageField ? ageField.offsetTop : null
    };
  });

  console.log('Attendee Inputs at 375px:', JSON.stringify(attendeeInfo, null, 2));

  await browser.close();
}

checkAttendeeInputs().catch(console.error);

