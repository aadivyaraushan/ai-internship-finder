// test-scraper.js
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeWebsite(url) {
  try {
    console.log(`🌐 Fetching: ${url}`);

    // Fetch the webpage
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    // Load the HTML into cheerio
    const $ = cheerio.load(response.data);

    // Remove script and style elements
    $('script, style, noscript, iframe').remove();

    // Get clean text content
    const text = $('body')
      .text()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n/g, ' ') // Replace newlines with space
      .trim();

    return {
      success: true,
      url: url,
      text: text,
      length: text.length,
    };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return {
      success: false,
      error: error.message,
      url: url,
    };
  }
}

// Get URL from command line arguments
const url = process.argv[2];
if (!url) {
  console.log('❌ Please provide a URL as an argument');
  console.log('Usage: node test-scraper.js <url>');
  process.exit(1);
}

// Run the scraper
scrapeWebsite(url).then((result) => {
  if (result.success) {
    console.log('✅ Successfully scraped:');
    console.log(`📄 Text length: ${result.length} characters`);
    console.log('\n📝 First 500 characters:');
    console.log('---');
    console.log(result.text.substring(0, 5000) + '...');
    console.log('---');
  } else {
    console.error('❌ Failed to scrape:', result.error);
  }
});
