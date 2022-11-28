import puppeteer from 'puppeteer';
import fs from 'fs';
import axios from 'axios';

/*

Instructions: 
  execute npm install to get dependencies
  
  open your browser and go to https://bowvalleycollege.ca/programs-courses-search#
  then apply the filters you want, copy url and put it into programsURL.

  if you want to watch the browser in action set false.

  execute node server on terminal

  the files will be created in files folder after execution ends.

  To make changes, read https://pptr.dev/ first
*/

const headless = true;

// all programs
const programsURL =
  'https://bowvalleycollege.ca/programs-courses-search#f:@fprogramtypename85917=[Continuing%20Learning%20Course,Diploma,Certificate,Continuing%20Learning%20Certificate,Program,Post-Diploma%20Certificate,Upgrading,Certificate%20of%20Achievement]';

// // Only Technology Programs

// const programsURL =
//   'https://bowvalleycollege.ca/programs-courses-search#f:Programs=[Technology]';

// DO NOT CHANGE BELOW THIS LINE.
const tuitionsURL = 'https://bowvalleycollege.ca/admissions/tuition-and-fees';
const outlinesURL =
  'https://bowvalleycollege.ca/sitecore/api/courseoutline/CourseOutline/GetCourseOutlines?_=1669628262851';

const programList = [];
const courseList = [];
const programDeliveryType = [];
const programTerms = [];
const programTuiton = [];
const courseTuition = [];
let couseOutlines;
let nextButton = false;
let lastid = 0;

const browser = await puppeteer.launch({ headless: headless });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 5000 });

// programs
await page.goto(programsURL);
async function getPrograms() {
  let programs, title, url, type;

  try {
    await page.waitForSelector('.program-template-container');
    await page.waitForNetworkIdle({ waitUntil: 'networkidle0' });
    programs = await page.$$('.program-template-container'); // '.my-result-template-header'
    await page.waitForSelector('.coveo-results-per-page-list-item-text\n');
  } catch {
    console.log('Something wrong, maybe BVC changed the CSS classes.\n');
  }

  for (let i = 0; i < programs.length; i++) {
    const id = lastid + 1;
    lastid++;
    const element = programs[i];

    // program title
    try {
      title = await element.$eval(
        '.my-result-template-header a',
        (element) => element.innerText,
      );
    } catch {
      title = 'n/a';
      console.log(
        'Please check if the program has a title on the official website, otherwise the css was probably changed.\n',
      );
    }

    // program oficial url
    try {
      url = await element.$eval(
        '.program-template-container > a', //'.my-result-template-header a'
        (element) => element.href,
      );
    } catch {
      url = 'n/a';
      console.log(
        'Please check if the program has a url on the official website, otherwise the css was probably changed.\n',
      );
    }

    // program type
    try {
      type = await element.$eval(
        '[data-field="@fprogramtypename85917"] > span',
        (element) => element.innerText,
      );
    } catch {
      type = 'n/a';
      console.log(
        'Please check if the program has a type on the official website, otherwise the css was probably changed.\n',
      );
    }

    // add to list
    programList.push({ id, title, url, type });
  } // end of programs outer for loop

  console.log(
    `Programs collected: ${programList.length}, searching for more...`,
  );

  try {
    nextButton = await page.$$eval('[title="Next"]', (el) => el.length);
    await page.click('[title="Next"]');
    await page.waitForNetworkIdle({ waitUntil: 'networkidle0' });
    console.log('..... reading.');
  } catch (error) {
    console.log('Finishing... ');
    nextButton = false;
    console.log(`Total of programs collected: ${programList.length}`);
    return error;
  }
} // end of getPrograms function

// Program Details

async function getProgramDetails() {
  console.log('\nCollecting programs details....\n');
  let subtitle,
    duration,
    category,
    startDate = [];
  let lastid;
  // navigate to each program url to collect details
  for (let i = 0; i < programList.length; i++) {
    await page.goto(programList[i].url);
    try {
      await page.waitForSelector('.banner-content p');
    } catch {
      console.log(
        `Something wrong with progra ${programList[i]} details page.`,
      );
    }
    // await page.waitForNetworkIdle({ waitUntil: 'networkidle0' });

    // program subtitle
    try {
      subtitle = await page.$eval(
        '.banner-content p',
        (element) => element.innerText,
      );
      programList[i].subtitle = subtitle;
    } catch {
      programList[i].subtitle = 'n/a';
      console.log(
        `Please check if the program "${programList[i].title}" detail has a subtitle(short description) on the official website, otherwise the css was probably changed.\n`,
      );
    }
    // program duration
    try {
      duration = await page.$eval(
        '.header-variant-2',
        (element) => element.innerText,
      );
      duration = duration.replace(/\s+/g, ' ').trim();
      programList[i].duration = duration;
    } catch {
      programList[i].duration = 'n/a';
      console.log(
        `Please check if the program "${programList[i].title}" detail has a duration on the official website, otherwise the css was probably changed.\n`,
      );
    }

    // program category
    try {
      category = await page.$eval(
        '.col-xs-12.col-sm-12 > h5 > a',
        (element) => element.innerText,
      );
      programList[i].category = category;
    } catch {
      programList[i].category = 'n/a';
      console.log(
        `Please check if the program "${programList[i].title}" detail has a category on the official website, otherwise the css was probably changed.\n`,
      );
    }

    // program start dates
    try {
      const startDates = await page.$$eval(
        '.icon-calendar ~ div.program-item-list > ul > li',
        (items) => {
          return items.map((item) => item.textContent);
        },
      );
      programList[i].startdate = startDates;
    } catch {
      programList[i].startdate = [];
      console.log(
        'Please check if the program has a start date on the official website, otherwise the css was probably changed.\n',
      );
    }

    // program delivery types
    programList[i].deliveryTypes = [];
    try {
      const programId = programList[i].id;
      const programTitle = programList[i].title;
      const deliveryTypes = await page.$$eval(
        '.program-item-list > ul.lightblue > li',
        (items) => {
          return items.map((item) => item.innerHTML.split('<', 1)[0]);
        },
      );
      deliveryTypes.forEach((type) => {
        programDeliveryType.push({ programId, programTitle, type });
        programList[i].deliveryTypes.push(type);
      });
    } catch {
      programList[i].startdate = [];
      console.log(
        'Please check if the program has a start date on the official website, otherwise the css was probably changed.\n',
      );
    }

    // program terms
    try {
      const terms = await page.$$('h5:has([data-parent^="#accordion-item-"])');
      // inner for loop 4 matches terms with current program details page
      for (let l = 0; l < terms.length; l++) {
        const programId = programList[i].id;
        const programTitle = programList[i].title;
        const element = terms[l];
        let courseCode = await element.$eval(
          'a',
          (element) => element.innerText,
        );
        courseCode = courseCode.split(' -', 1)[0];
        let courseTitle = await element.$eval(
          'a > span',
          (element) => element.innerText,
        );
        let term = await element.$eval(
          'a',
          (element) => element.dataset.parent,
        );
        term = Number(term.split('-', 5)[2]) + 1;
        programTerms.push({
          programId,
          programTitle,
          term,
          courseCode,
          courseTitle,
        });
      }
    } catch {
      console.log(`No terms found for program ${programList[i].title}`);
    }
  } // end of outer for loop
  return;
} // end of getProgramDetails function

console.log('Collecting programs...');
await getPrograms(); // start application

while (nextButton) {
  await getPrograms();
}

// start collecting program details
await getProgramDetails();

// programs & courses tuition
await page.goto(tuitionsURL);
async function getProgramTuition() {
  let tableTabsTitle,
    programRows,
    coursesRows,
    program = {};
  try {
    await page.waitForSelector('[role = "tablist"');
    tableTabsTitle = await page.$$eval(
      '[role = "tablist"] > li > a',
      (items) => {
        return items.map((item) => item.textContent);
      },
    );
  } catch {
    console.log(`Something wrong with Tuition & fees page...`);
  }

  // programs tuition

  try {
    await page.waitForSelector('tbody > tr');
    programRows = await page.$$('[id*="ProgramTuition"] tbody tr');
  } catch {
    console.log('No tuitions available');
  }

  for (let i = 0; i < programRows.length; i++) {
    const row = programRows[i];
    const tds = await row.$$('td');

    if (tds.length == 11) {
      if (program.program) {
        programTuiton.push(program);

        // add tuition to program
        let index = programList.findIndex((item) => {
          return item.title.includes(program.program);
        });

        if (index >= 0) {
          programList[index].tuition = {
            period: tableTabsTitle[0].split(' ', 1)[0],
            Domestic: program.totalDomesticTuition,
            International: program.totalInternationalTuition,
          };
        }
        program = {};
      }

      // Program Name
      program.program = await row.$eval('td:nth-of-type(1)', (element) => {
        return element.textContent;
      });

      // Domestic tuition
      program.totalDomesticTuition = await row.$eval(
        'td:nth-of-type(10)',
        (element) => {
          return Number(element.textContent.replace(',', ''));
        },
      );

      // international tuition
      program.totalInternationalTuition = await row.$eval(
        'td:nth-of-type(11)',
        (element) => {
          return Number(element.textContent.replace(',', ''));
        },
      );
    }

    if (tds.length == 10) {
      // domestic tuition
      program.totalDomesticTuition += await row.$eval(
        'td:nth-of-type(9)',
        (element) => {
          return Number(element.textContent.replace(',', ''));
        },
      );

      // international tuition
      program.totalInternationalTuition += await row.$eval(
        'td:nth-of-type(10)',
        (element) => {
          return Number(element.textContent.replace(',', ''));
        },
      );
    }
    if (i == programRows.length - 1) {
      programTuiton.push(program);
      break;
    }
  }

  // courses tuition
  await page.click('[role = "tablist"]>li:nth-child(3)');
  try {
    await page.waitForSelector('tbody > tr');
    coursesRows = await page.$$('[id*="CourseTuition"] tbody tr');
  } catch {
    console.log('No tuitions available');
  }

  for (let j = 0; j < coursesRows.length; j++) {
    const row = coursesRows[j];

    const courseCode = await row.$eval('td:nth-of-type(1)', (element) => {
      return element.innerHTML
        .replace(/(\r\n|\n|\r)/gm, '')
        .replace('&nbsp;', '')
        .replace('<br>', ' ')
        .trim();
    });

    const courseName = await row.$eval('td:nth-of-type(2)', (element) => {
      return element.innerHTML
        .replace(/(\r\n|\n|\r)/gm, '')
        .replace('&nbsp;', '')
        .replace('<br>', ' ')
        .trim();
    });

    const courseCredits = await row.$eval('td:nth-of-type(3)', (element) => {
      return Number(element.textContent);
    });

    const tuitionDomestic = await row.$eval('td:nth-of-type(4)', (element) => {
      return Number(element.textContent);
    });

    const tuitionInternational = await row.$eval(
      'td:nth-of-type(5)',
      (element) => {
        return Number(element.textContent);
      },
    );

    courseTuition.push({
      courseCode,
      courseName,
      courseCredits,
      tuition: {
        period: tableTabsTitle[0].split(' ', 1)[0],
        Domestic: tuitionDomestic,
        International: tuitionInternational,
      },
    });

    // add tuition to course

    let courseIndex = programTerms.filter(
      (item) => item.courseCode == courseCode,
    );

    if (courseIndex.length > 0) {
      for (let z = 0; z < courseIndex.length; z++) {
        const item = courseIndex[z];
        item.credits = courseCredits;
        item.tuition = {
          period: tableTabsTitle[0].split(' ', 1)[0],
          Domestic: tuitionDomestic,
          International: tuitionInternational,
        };
      }
    }
  }

  // add program terms courses and tuition to programs
  for (let k = 0; k < programList.length; k++) {
    const item = programList[k];
    let terms = programTerms.filter((term) => term.programId == item.id);
    item.terms = terms.map((term) => {
      return {
        credits: term.credits,
        term: term.term,
        courseCode: term.courseCode,
        courseTitle: term.courseTitle,
        courseTuition: term.tuition,
      };
    });
  }
}

// courses tuition
console.log('Collecting programs tuition...');
await getProgramTuition();

// courses outline
async function getOutlines() {
  const request = await axios.get(outlinesURL);
  const outlines = await request.data;

  for (let i = 0; i < courseTuition.length; i++) {
    const item = courseTuition[i];
    let courseOutlines = outlines.filter(
      (outline) => outline.CourseCode == item.courseCode,
    );
    item.outlines = courseOutlines.map((item) => {
      return {
        academicYear: item.AcademicYear,
        effectiveStartTerm: item.EffectiveStartTerm,
        effectiveTermEnd: item.EffectiveTermEnd,
        URL: `https://bowvalleycollege.ca${item.URL}`,
      };
    });
  }

  for (let i = 0; i < programList.length; i++) {
    const item = programList[i];
    item.terms.forEach((item) => {
      let courseOutlines = outlines.filter(
        (outline) => outline.CourseCode == item.courseCode,
      );
      item.outlines = courseOutlines.map((item) => {
        return {
          academicYear: item.AcademicYear,
          effectiveStartTerm: item.EffectiveStartTerm,
          effectiveTermEnd: item.EffectiveTermEnd,
          URL: `https://bowvalleycollege.ca${item.URL}`,
        };
      });
    });
  }
}

console.log('Collecting courses outlines...');
await getOutlines();
await browser.close();

console.log('Creating files...');

if (!fs.existsSync('./files')) {
  fs.mkdirSync('./files');
}

// fill programs.json file with programList
fs.writeFile(
  `./files/programs.json`,
  JSON.stringify(programList, null, 2),
  (err) => {
    if (err) console.log(err);
  },
);

// fill programDelivery.json file with program delivery types matching programs
// fs.writeFile(
//   `programDelivery.json`,
//   JSON.stringify(programDeliveryType, null, 2),
//   (err) => {
//     if (err) console.log(err);
//   },
// );

// fill programTerms.json file with program terms matching programs
// fs.writeFile(
//   `programTerms.json`,
//   JSON.stringify(programTerms, null, 2),
//   (err) => {
//     if (err) console.log(err);
//   },
// );

// fill programsTuition.json file with program terms matching programs
// fs.writeFile(
//   `programsTuition.json`,
//   JSON.stringify(programTuiton, null, 2),
//   (err) => {
//     if (err) console.log(err);
//   },
// );

// fill coursesTuition.json file with program terms matching programs
fs.writeFile(
  `./files/courses.json`,
  JSON.stringify(courseTuition, null, 2),
  (err) => {
    if (err) console.log(err);
  },
);

console.log('Have fun with your data!!! Cya =) - Tiago Trambaioli');
