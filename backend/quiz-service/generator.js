const fs = require('fs');
const path = require('path');

// Small curated datasets for offline question generation
const countries = [
  { country: 'Japan', capital: 'Tokyo' },
  { country: 'France', capital: 'Paris' },
  { country: 'Brazil', capital: 'Brasília' },
  { country: 'Canada', capital: 'Ottawa' },
  { country: 'Australia', capital: 'Canberra' },
  { country: 'Germany', capital: 'Berlin' },
  { country: 'India', capital: 'New Delhi' },
  { country: 'Egypt', capital: 'Cairo' },
  { country: 'Kenya', capital: 'Nairobi' },
  { country: 'Mexico', capital: 'Mexico City' }
];

const tech = [
  { question: 'Which protocol is primarily used to browse the web?', answer: 'HTTP' },
  { question: 'Which language is primarily used for styling web pages?', answer: 'CSS' },
  { question: 'Which language runs in the browser and on Node.js?', answer: 'JavaScript' },
  { question: 'Which company created the Go programming language?', answer: 'Google' },
  { question: 'Which data format is commonly used for APIs and lightweight data interchange?', answer: 'JSON' }
];

const history = [
  { event: 'Moon landing (Apollo 11)', year: 1969 },
  { event: 'Fall of the Berlin Wall', year: 1989 },
  { event: 'Start of World War I', year: 1914 },
  { event: 'Declaration of Independence (USA)', year: 1776 },
  { event: 'French Revolution begins', year: 1789 }
];

const science = [
  { question: 'What planet is known as the Red Planet?', answer: 'Mars' },
  { question: 'What gas do plants absorb from the atmosphere?', answer: 'Carbon dioxide' },
  { question: 'What is the chemical symbol for water?', answer: 'H2O' },
  { question: 'What part of the cell contains genetic material?', answer: 'Nucleus' },
  { question: 'What force keeps us on the ground?', answer: 'Gravity' }
];

const sports = [
  { question: 'How many players are there in a football (soccer) team on the field?', answer: '11' },
  { question: 'In which sport is a touchdown scored?', answer: 'American football' },
  { question: 'Which sport uses a shuttlecock?', answer: 'Badminton' },
  { question: 'How many rings are on the Olympic flag?', answer: '5' },
  { question: 'In cricket, what is the number of players per team?', answer: '11' }
];

function sample(arr, n) {
  const copy = arr.slice();
  const out = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let nextId = Date.now() % 100000;

function genCountryQuestion(difficulty = 'medium') {
  const c = sample(countries, 1)[0];
  // difficulty influences distractor closeness
  const pool = countries.filter(x => x.capital !== c.capital);
  let wrongChoices = [];
  if (difficulty === 'easy') {
    wrongChoices = sample(pool, 3).map(x => x.capital);
  } else if (difficulty === 'hard') {
    // try pick capitals of countries starting with same letter if possible
    const similar = pool.filter(x => x.country[0] === c.country[0]);
    wrongChoices = sample((similar.length >= 3 ? similar : pool), 3).map(x => x.capital);
  } else {
    // medium
    wrongChoices = sample(pool, 3).map(x => x.capital);
  }
  const options = shuffle([c.capital, ...wrongChoices]);
  const answer = options.indexOf(c.capital);
  return {
    id: ++nextId,
    question: `What is the capital of ${c.country}?`,
    options,
    answer,
    category: 'Country',
    points: 10
  };
}

function genTechQuestion(difficulty = 'medium') {
  const t = sample(tech, 1)[0];
  // build wrong options with increasing closeness for harder difficulties
  const easyDistractors = ['XML', 'HTML', 'YAML', 'TCP'];
  const mediumDistractors = ['C', 'Python', 'Rust', 'HTML'];
  const hardDistractors = ['TypeScript', 'Node.js', 'Server', 'ECMAScript'];
  let pool = mediumDistractors;
  if (difficulty === 'easy') pool = easyDistractors;
  else if (difficulty === 'hard') pool = hardDistractors.concat(mediumDistractors);
  const wrong = shuffle(pool.filter(x => x !== t.answer)).slice(0, 3);
  const options = shuffle([t.answer, ...wrong]);
  const answer = options.indexOf(t.answer);
  return {
    id: ++nextId,
    question: t.question,
    options,
    answer,
    category: 'Tech',
    points: difficulty === 'hard' ? 15 : 10
  };
}

function genHistoryQuestion(difficulty = 'medium') {
  const h = sample(history, 1)[0];
  const correct = String(h.year);
  const wrongYears = [];
  while (wrongYears.length < 3) {
    // difficulty affects how close wrong years are
    const offset = difficulty === 'easy' ? (Math.floor(Math.random() * 50) + 10) : (difficulty === 'hard' ? (Math.floor(Math.random() * 8) + 1) : (Math.floor(Math.random() * 20) + 3));
    const sign = Math.random() > 0.5 ? 1 : -1;
    const y = String(h.year + (offset * sign));
    if (y !== correct && !wrongYears.includes(y)) wrongYears.push(y);
  }
  const options = shuffle([correct, ...wrongYears]);
  const answer = options.indexOf(correct);
  return {
    id: ++nextId,
    question: `In which year did ${h.event} occur?`,
    options,
    answer,
    category: 'History',
    points: difficulty === 'hard' ? 15 : 10
  };
}

function genScienceQuestion(difficulty = 'medium') {
  const s = sample(science, 1)[0];
  const easyDistractors = ['Oxygen', 'Nitrogen', 'Helium', 'Hydrogen'];
  const mediumDistractors = ['Velocity', 'Energy', 'Atom', 'Cell'];
  const hardDistractors = ['Carbon monoxide', 'Mitochondria', 'Photosynthesis', 'Osmosis'];
  let pool = mediumDistractors;
  if (difficulty === 'easy') pool = easyDistractors;
  else if (difficulty === 'hard') pool = hardDistractors.concat(mediumDistractors);
  const wrong = shuffle(pool.filter(x => x !== s.answer)).slice(0, 3);
  const options = shuffle([s.answer, ...wrong]);
  return {
    id: ++nextId,
    question: s.question,
    options,
    answer: options.indexOf(s.answer),
    category: 'Science',
    points: difficulty === 'hard' ? 15 : 10
  };
}

function genSportsQuestion(difficulty = 'medium') {
  const s = sample(sports, 1)[0];
  const easyDistractors = ['10', '12', '15', '9'];
  const mediumDistractors = ['7', '8', '6', '13'];
  const hardDistractors = ['American football', 'Rugby', 'Hockey', 'Baseball'];
  let pool = mediumDistractors;
  if (difficulty === 'easy') pool = easyDistractors;
  else if (difficulty === 'hard') pool = hardDistractors.concat(mediumDistractors);
  const wrong = shuffle(pool.filter(x => x !== s.answer)).slice(0, 3);
  const options = shuffle([s.answer, ...wrong]);
  return {
    id: ++nextId,
    question: s.question,
    options,
    answer: options.indexOf(s.answer),
    category: 'Sports',
    points: difficulty === 'hard' ? 15 : 10
  };
}

function generate(category = 'mixed', count = 10, difficulty = 'medium') {
  const out = [];
  const cat = (category || 'mixed').toLowerCase();

  for (let i = 0; i < count; i++) {
    if (cat === 'country') out.push(genCountryQuestion(difficulty));
    else if (cat === 'tech') out.push(genTechQuestion(difficulty));
    else if (cat === 'history') out.push(genHistoryQuestion(difficulty));
    else if (cat === 'science') out.push(genScienceQuestion(difficulty));
    else if (cat === 'sports') out.push(genSportsQuestion(difficulty));
    else {
      // mixed: rotate through available generators
      switch (i % 5) {
        case 0:
          out.push(genCountryQuestion(difficulty));
          break;
        case 1:
          out.push(genTechQuestion(difficulty));
          break;
        case 2:
          out.push(genHistoryQuestion(difficulty));
          break;
        case 3:
          out.push(genScienceQuestion(difficulty));
          break;
        default:
          out.push(genSportsQuestion(difficulty));
          break;
      }
    }
  }

  return out;
}

module.exports = { generate };
