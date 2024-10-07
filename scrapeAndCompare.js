// Import required libraries
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Get URLs from command line arguments
const urlsToScrape = process.argv.slice(2);

if (urlsToScrape.length === 0) {
    console.log('Please provide at least one URL as an argument');
    process.exit(1);
}

// Filepath for storing the JSON data locally
const localApiDataFilePath = path.join(__dirname, 'playersData.json');
const apiUrl = 'https://api.sleeper.app/v1/players/nfl';

// Function to check if the local JSON file is populated
const checkLocalApiDataFile = () => {
    try {
        if (fs.existsSync(localApiDataFilePath)) {
            const fileStats = fs.statSync(localApiDataFilePath);
            return fileStats.size > 0; // Return true if the file is populated
        }
    } catch (error) {
        console.error(`Error checking local file: ${error.message}`);
    }
    return false;
};

// Function to fetch the JSON data from the API and store it locally
const fetchAndStoreApiData = async () => {
    try {
        const response = await axios.get(apiUrl);
        const apiData = response.data;
        fs.writeFileSync(localApiDataFilePath, JSON.stringify(apiData, null, 2), 'utf-8');
        console.log('API data has been saved locally.');
        return apiData;
    } catch (error) {
        console.error(`Error fetching API data: ${error.message}`);
    }
};

// Function to retrieve the JSON data from the local file
const getLocalApiData = () => {
    try {
        const rawData = fs.readFileSync(localApiDataFilePath, 'utf-8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error(`Error reading local API data: ${error.message}`);
    }
};

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
        let apiData;

        // Check if the local JSON file exists and is populated
        if (checkLocalApiDataFile()) {
            console.log('Using local API data.');
            apiData = getLocalApiData(); // Use local data if file is populated
        } else {
            console.log('Fetching API data.');
            apiData = await fetchAndStoreApiData(); // Fetch from API and store locally if no file or empty file
        }

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
