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

// Filepaths for storing the JSON data locally
const localApiDataFilePath = path.join(__dirname, 'playersData.json');
const availablePlayersFilePath = path.join(__dirname, 'availablePlayers.json');
const playerValueFilePath = path.join(__dirname, 'playerValue.json');
const apiUrl = 'https://api.sleeper.app/v1/players/nfl';
const leagueRostersUrl = 'https://api.sleeper.app/v1/league/1049003724397465600/rosters';

// Fantasy positions to exclude
const excludedPositions = ["DB", "OL", "OT", "DL", "LB", "OL"];

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

// Function to fetch roster data from the Sleeper API
const fetchRosterData = async () => {
    try {
        const response = await axios.get(leagueRostersUrl);
        return response.data;
    } catch (error) {
        console.error(`Error fetching roster data: ${error.message}`);
    }
};

// Function to find available players not on any rosters and exclude unwanted positions
const findAvailablePlayers = (allPlayers, rosteredPlayers) => {
    const availablePlayers = {};

    for (const playerId in allPlayers) {
        const player = allPlayers[playerId];
        const playerPosition = player.fantasy_positions;

        // Exclude players who are on a roster or have excluded fantasy positions
        if (
            !rosteredPlayers.has(playerId) && 
            playerPosition && 
            !playerPosition.some(pos => excludedPositions.includes(pos))
        ) {
            availablePlayers[playerId] = player;
        }
    }

    return availablePlayers;
};

// Function to scrape a single URL and store player values
const scrapeWebsite = async (url) => {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        // Define an array to hold player values for this URL
        let playerValue = [];

        // Assuming the table rows (tr) contain player names at eq(1) and PPR values at eq(4)
        $('table tbody tr').each((index, element) => {
            const playerName = $(element).find('td').eq(1).text().trim();  // Player name in eq(1)
            const pprValue = $(element).find('td').eq(4).text().trim();    // PPR value in eq(4)
            
            // Push the player and PPR data into the array
            if (playerName && pprValue) {
                playerValue.push({
                    player: playerName,
                    PPR: parseFloat(pprValue)  // Convert PPR to a number
                });
            }
        });

        return playerValue;
    } catch (error) {
        console.error(`Error scraping website ${url}: ${error.message}`);
        return []; // Return empty array if error occurs for a URL
    }
};

// Function to scrape all provided URLs and store in playerValue
const scrapeAllWebsites = async (urls) => {
    let playerValue = [];

    for (const url of urls) {
        console.log(`Scraping data from: ${url}`);
        const scrapedData = await scrapeWebsite(url);

        // Append the scraped data to the main JSON array
        playerValue = playerValue.concat(scrapedData);
    }

    return playerValue;
};

// Function to log player data to console as JSON
const logPlayerData = (playerData) => {
    console.log(JSON.stringify(playerData, null, 2));
};

// Function to find top 10 available players based on PPR values
const findTopAvailablePlayers = (availablePlayers, playerValue) => {
    // Filter playerValue array to only include players in availablePlayers
    const filteredPlayerValues = playerValue.filter(pv => 
        Object.values(availablePlayers).some(player => player.full_name === pv.player)
    );

    // Sort by PPR value in descending order
    filteredPlayerValues.sort((a, b) => b.PPR - a.PPR);

    // Return the top 10 players
    return filteredPlayerValues.slice(0, 10);
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

        // Fetch the roster data
        console.log('Fetching roster data...');
        const rosterData = await fetchRosterData();
        
        // Gather all player IDs from the rosters
        const rosteredPlayers = new Set();
        rosterData.forEach(roster => {
            roster.players.forEach(playerId => rosteredPlayers.add(playerId));
        });

        // Find available players not on any roster
        const availablePlayers = findAvailablePlayers(apiData, rosteredPlayers);

        // Save available players to a JSON file
        fs.writeFileSync(availablePlayersFilePath, JSON.stringify(availablePlayers, null, 2), 'utf-8');
        console.log('Available players data has been saved to availablePlayers.json.');

        // Scrape provided URLs
        const playerValue = await scrapeAllWebsites(urlsToScrape);

        // Save scraped player values to a JSON file
        fs.writeFileSync(playerValueFilePath, JSON.stringify(playerValue, null, 2), 'utf-8');
        console.log('Player values data has been saved to playerValue.json.');

        // Find top 10 available players based on PPR values
        const topAvailablePlayers = findTopAvailablePlayers(availablePlayers, playerValue);

        console.log('Top 10 available players by PPR:');
        logPlayerData(topAvailablePlayers);

    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
};

// Run the main function
main();