const countries = require('../utils/countries.json');
const { coastCountries } = require('../utils/coastCountries.json');

function generateGame() {
    const gameId = 'game-' + Math.random().toString(36).substring(2, 15);
    let startCountry, middleCountry, targetCountry;

    do {
        startCountry = countries[Math.floor(Math.random() * countries.length)];
        middleCountry = countries[Math.floor(Math.random() * countries.length)];
        targetCountry = countries[Math.floor(Math.random() * countries.length)];
    } while (startCountry === middleCountry || middleCountry === targetCountry || startCountry === targetCountry);

    return { gameId, startCountry, middleCountry, targetCountry };
}

function isCoastCountry(country) {
    return coastCountries.includes(country);
}

function checkNeighbour(country, neighbour) {
    const countryObj = countries.find(c => c.name === country);
    if (countryObj && countryObj.neighbours.includes(neighbour)) {
        return true;
    } else {
        return false;
    }
}

function canTravelByLand(startCountry, targetCountry) {
    const visited = new Set();
    const stack = [[startCountry, [startCountry]]];

    while (stack.length > 0) {
        const [currentCountry, path] = stack.pop();
        if (currentCountry === targetCountry) {
            console.log(path)
            return true;
        }
        if (!visited.has(currentCountry)) {
            visited.add(currentCountry);
            const countryObj = countries.find(c => c.name === currentCountry);
            if (countryObj) {
                for (const neighbour of countryObj.neighbours) {
                    if (!visited.has(neighbour)) {
                        stack.push([neighbour, path.concat(neighbour)]);
                    }
                }
            }
        }
    }
    return false;
}

module.exports = { generateGame, isCoastCountry, checkNeighbour, canTravelByLand }