import fs from 'fs';

const content = fs.readFileSync('scratch/index-C1aiahLr.js', 'utf8');

// Find all matches of http/https urls or domain-like patterns
const urlRegex = /https?:\/\/[^\s"'`]+/g;
const urls = content.match(urlRegex) || [];
console.log('URLs found in JS:');
console.log([...new Set(urls)]);

// Search for any occurrence of "api"
const apiIndex = content.indexOf('api');
console.log('\nDoes "api" exist in JS?', apiIndex !== -1);
if (apiIndex !== -1) {
  console.log('Context around "api":', content.slice(Math.max(0, apiIndex - 50), apiIndex + 50));
}

// Search for "onrender"
const renderIndex = content.indexOf('onrender');
console.log('\nDoes "onrender" exist in JS?', renderIndex !== -1);
if (renderIndex !== -1) {
  console.log('Context around "onrender":', content.slice(Math.max(0, renderIndex - 50), renderIndex + 50));
}

// Search for "AnimatePresence"
const animatePresenceIndex = content.indexOf('AnimatePresence');
console.log('\nDoes "AnimatePresence" exist in JS?', animatePresenceIndex !== -1);
if (animatePresenceIndex !== -1) {
  console.log('Context around "AnimatePresence":', content.slice(Math.max(0, animatePresenceIndex - 50), animatePresenceIndex + 50));
}

