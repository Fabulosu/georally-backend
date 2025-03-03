const countries = require('../utils/countries.json');
const { coastCountries } = require('../utils/coastCountries.json');

const graph = {};
countries.forEach(({ name, neighbours }) => {
    graph[name] = neighbours;
});

function findShortestPath(start, end) {
    if (!graph[start] || !graph[end]) {
        console.log("One or both of the countries are not in the dataset.");
    }

    let queue = [[start]];
    let visited = new Set();

    while (queue.length > 0) {
        let path = queue.shift();
        let country = path[path.length - 1];

        if (country === end) {
            console.log(`Start country: ${start}\nEnd country: ${end}\nShortest path: ${path}`)
            return path;
        }

        if (!visited.has(country)) {
            visited.add(country);
            const neighbours = graph[country];

            if (Array.isArray(neighbours)) {
                for (let neighbor of neighbours) {
                    if (!visited.has(neighbor)) {
                        queue.push([...path, neighbor]);
                    }
                }
            }
        }
    }
    console.log(`No path found between ${start} and ${end}.`);
    return null;
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

const generateCountries = (difficulty) => {
    let startCountry, middleCountry, targetCountry, bannedCountry;
    do {
        startCountry = countries[Math.floor(Math.random() * countries.length)];
        middleCountry = countries[Math.floor(Math.random() * countries.length)];
        targetCountry = countries[Math.floor(Math.random() * countries.length)];
    } while (
        startCountry === middleCountry ||
        middleCountry === targetCountry ||
        startCountry === targetCountry ||
        checkNeighbour(startCountry.name, middleCountry.name) ||
        checkNeighbour(startCountry.name, targetCountry.name) ||
        checkNeighbour(middleCountry.name, targetCountry.name)
    );

    if (difficulty === "hard" && Math.random() * 100 < 25) {
        const pathStartToMiddle = findShortestPath(startCountry.name, middleCountry.name);
        const pathMiddleToTarget = findShortestPath(middleCountry.name, targetCountry.name);

        if (pathStartToMiddle !== null || pathMiddleToTarget !== null) {
            if (pathStartToMiddle !== null) {
                let randomCountryName = pathStartToMiddle[Math.floor(Math.random() * pathStartToMiddle.length)];
                bannedCountry = countries.find(country => country.name === randomCountryName);
            } else if (pathMiddleToTarget !== null) {
                let randomCountryName = pathMiddleToTarget[Math.floor(Math.random() * pathMiddleToTarget.length)];
                bannedCountry = countries.find(country => country.name === randomCountryName);
            } else {
                bannedCountry = null;
            }
        } else {
            bannedCountry = null;
        }

        if (bannedCountry) {
            console.log(`Banned country: ${bannedCountry.name}`);
        }
    }

    return { startCountry, middleCountry, targetCountry, bannedCountry };
};

module.exports = { findShortestPath, isCoastCountry, checkNeighbour, canTravelByLand, generateCountries };