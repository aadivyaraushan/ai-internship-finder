const fetch = require('node-fetch');

const RAPID_API_KEY = '3d69deaba4msh0f5249a46b5ad79p11338djsn693698b861b0';
const username = 'sarptecimer';
const url = `https://linkedin-data-scraper-api1.p.rapidapi.com/profile/detail?username=${username}`;

const options = {
  method: 'GET',
  headers: {
    'x-rapidapi-host': 'linkedin-data-scraper-api1.p.rapidapi.com',
    'x-rapidapi-key': RAPID_API_KEY
  }
};

console.log('Testing LinkedIn API with key:', RAPID_API_KEY ? 'Key found' : 'No key found');
console.log('Request URL:', url);

fetch(url, options)
  .then(response => {
    console.log('Response status:', response.status);
    return response.text();
  })
  .then(data => {
    console.log('Response data:', data);
  })
  .catch(error => {
    console.error('Error:', error);
  });
