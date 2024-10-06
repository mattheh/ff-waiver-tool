// Import required libraries
const axios = require('axios');
const cheerio = require('cheerio');

// Get URLs from command line arguments
const urlsToScrape = process.argv.slice(2);

if (urlsToScrape.length === 0) {
    console.log('Please provide at least one URL as an argument');
    process.exit(1);
}

// Function to scrape a single URL
const scrapeWebsite = async (url) => {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        // Define an array to hold player data for this URL
        let playerData = [];

        // Assuming the table rows (tr) contain player names and PPR values
        $('table tbody tr').each((index, element) => {
            // Parse player name and PPR value from each row
            const playerName = $(element).find('td').eq(1).text().trim();  // Adjust this selector based on actual structure
            const pprValue = $(element).find('td').eq(4).text().trim();    // Adjust the index for the PPR value column
            
            // Push the player and PPR data into the array
            if (playerName && pprValue) {
                playerData.push({
                    player: playerName,
                    PPR: pprValue
                });
            }
        });

        return playerData;
    } catch (error) {
        console.error(`Error scraping website ${url}: ${error.message}`);
        return []; // Return empty array if error occurs for a URL
    }
};

// Function to scrape all provided URLs
const scrapeAllWebsites = async (urls) => {
    let allPlayerData = [];

    for (const url of urls) {
        console.log(`Scraping data from: ${url}`);
        const scrapedData = await scrapeWebsite(url);

        // Append the scraped data to the main JSON array
        allPlayerData = allPlayerData.concat(scrapedData);
    }

    return allPlayerData;
};

// Function to log player data to console as JSON
const logPlayerData = (playerData) => {
    console.log(JSON.stringify(playerData, null, 2));
};

// Main function to run the script
const main = async () => {
    try {
        const allScrapedData = await scrapeAllWebsites(urlsToScrape);

        if (allScrapedData && allScrapedData.length > 0) {
            logPlayerData(allScrapedData);
        } else {
            console.log('No data found.');
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
};

// Run the main function
main();
