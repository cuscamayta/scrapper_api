const clientAPI = require('phin-retry');
const save = require('save-file');
const cheerio = require('cheerio');
// var iconv = require('iconv');
const read = require('read-file');
const path = require('path');

// const test = require('./data/madrid/caategories.json')
const SimpleNodeLogger = require('simple-node-logger'),
    opts = {
        timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
    },
    logger = SimpleNodeLogger.createSimpleLogger(opts);

const BaseService = require("./base.service");
let _ideaRepository = null;

class IdeaService extends BaseService {
    constructor({ IdeaRepository }) {
        super(IdeaRepository);
        _ideaRepository = IdeaRepository;
    }

    getCurrentSeason($) {
        const seasons = this.dropdownToList($, '#season');
        const currentSeason = Math.max(...seasons.map(o => o.value));
        return seasons.find(x => x.value == currentSeason);
    }

    dropdownToList($, dropdownSelector) {
        let items = [];
        $(dropdownSelector).find('option').each((index, item) => {
            items.push({
                name: $(item).html(),
                value: $(item).val(),
                label: $(item).text()
            });
        });

        return items.filter(x => x.name !== 'Seleccione');
    }

    convertObjToArray(obj) {
        let array = Object.keys(obj)
            .map(function (key) {
                return obj[key];
            });

        return array;
    }

    async readCategoriesFromCache() {
        const pathFile = path.resolve(__dirname, 'data/madrid/categories.json');
        const categories = await read.sync(pathFile, { encoding: 'utf8' });
        return categories ? JSON.parse(categories) : '';
    }

    options(url) {
        return {
            url: url,
            retry: 10,
            delay: 5000
        }
    }

    async loadTypesCompetition(currentSeason, types) {
        logger.info('Loading types ompetitions...');
        for (let type of types) {
            let resp = await clientAPI.get(this.options(`https://www.rffm.es/api/competition?idSeason=${currentSeason.value}&idGameType=${type.value}&idGrouping=1`));
            type.groupCompetitions = this.convertObjToArray(resp.extra.data);
        }
    }

    async loadGroupByTypeCompetition(currentSeason, types) {
        logger.info('Loading groups by type competition...');
        for (let type of types) {
            for (let groupCompetition of type.groupCompetitions) {
                for (let competition of groupCompetition.competitions) {
                    let resp = await clientAPI.get(`https://www.rffm.es/api/groups?idSeason=${currentSeason.value}&idGameType=${type.value}&idCompetition=${competition.id}`);
                    competition.groups = this.convertObjToArray(resp.extra.data);
                    await this.loadMatchesByGroup(competition.groups, currentSeason.value, type, competition);
                }
            }
        }
    }

    async loadMatchesByGroup(groups, seasonId, type, competition) {
        for (let group of groups) {
            // const currentGroup = groups[group];
            let resp = await clientAPI.get(`https://www.rffm.es/api/rounds?idGroup=${group.id}`);
            group.categoryInfo = { seasonId, typeId: type.value, competitionId: competition.id, groupId: group.id };
            group.matches = resp.extra.data;

            //TODO uncomment to geet matches
            // await loadMatchesInformation(seasonId, type, competition, currentGroup);
        }
    }

    getMatchDateTime(stringDate) {
        var dates = stringDate.replace(/\s+/g, ' ').trim().split(' ');
        return dates ? buildDateTime(dates[0], dates[1]) : buildDateTime('', '');

        function buildDateTime(date, time) {
            return {
                date: date,
                time: time
            }
        }
    }

    getScore(score) {
        let scoreList = score.replace(/[^\d-\.]*/g, '').split('-');
        return {
            score: scoreList.join('-'),
            team1: scoreList[0],
            team2: scoreList[1]
        }
    }

    buildTeamInformation($, team, goals) {
        return {
            name: $(team).find('h3').text(),
            logo: $(team).find('img').attr('src'),
            url: $(team).find('a').attr('href'),
            goals: goals,
            playerLineup: []
        }
    }


    async loadMatchInformation(seasonId, typeId, competitionId, groupId, matchId) {

        // for (let match in group.matches) {
        // const currentMatch = group.matches[match];
        logger.info('Processing matchs...');
        const response = await clientAPI.get(`https://www.rffm.es/competiciones/resultados?season=${seasonId}&type=${typeId}&grouping=1&competition=${competitionId}&group=${groupId}&round=${matchId}`);
        const $ = cheerio.load(response);
        var matches = [];
        logger.info('Iterating into each match...');
        $('.clasification-results .clasification-results-row-item').each((index, row) => {
            let team1 = $(row).find('.team1');
            let team2 = $(row).find('.team2');
            let matchInfo = $(row).find('.matchinfo');
            let matchInfoField = $(row).find('.matchinfo-field');
            let refereeInfo = $(row).find('.text-info-partido');
            let matchInfoDetail = $(row).find('.matchinfo-detail').find('.item-info').find('a');
            const matchDate = this.getMatchDateTime($(matchInfo).find('.item-date').text());
            const teamsScore = this.getScore($(matchInfo).find('.item-results').text());
            logger.info('Getting information from match...');
            let roundInformation = {
                date: matchDate.date,
                time: matchDate.time,
                score: teamsScore.score,
                location: $(matchInfoField).text().replace(/\s+/g, ' '),
                referees: $(refereeInfo).text(),
                actUrl: $(matchInfoDetail[0]).attr('href'),
                reportComparative: $(matchInfoDetail[1]).attr('href'),
                local: this.buildTeamInformation($, team1, teamsScore.team1),
                visitor: this.buildTeamInformation($, team2, teamsScore.team2)
            }

            matches.push(roundInformation);

        });

        let teams = [];

        matches.forEach(x => {
            teams.push(x.local);
            teams.push(x.visitor);
        });
        return teams;
    }

    async loadMatchesInformation(seasonId, type, competition, group) {

        for (let match in group.matches) {
            const currentMatch = group.matches[match];
            logger.info('Processing matchs...');
            const matchsUrl = `https://www.rffm.es/competiciones/resultados?season=${seasonId}&type=${type.value}&grouping=1&competition=${competition.id}&group=${group.id}&round=${currentMatch.id}`;
            const response = await clientAPI.get(matchsUrl);
            const $ = cheerio.load(response);
            var matches = [];
            logger.info('Iterating into each match...');
            $('.clasification-results .clasification-results-row-item').each((index, row) => {
                let team1 = $(row).find('.team1');
                let team2 = $(row).find('.team2');
                let matchInfo = $(row).find('.matchinfo');
                let matchInfoField = $(row).find('.matchinfo-field');
                let refereeInfo = $(row).find('.text-info-partido');
                let matchInfoDetail = $(row).find('.matchinfo-detail').find('.item-info').find('a');
                const matchDate = getMatchDateTime($(matchInfo).find('.item-date').text());
                const teamsScore = getScore($(matchInfo).find('.item-results').text());
                logger.info('Getting information from match...');
                let roundInformation = {
                    date: matchDate.date,
                    time: matchDate.time,
                    score: teamsScore.score,
                    location: $(matchInfoField).text().replace(/\s+/g, ' '),
                    referees: $(refereeInfo).text(),
                    actUrl: $(matchInfoDetail[0]).attr('href'),
                    reportComparative: $(matchInfoDetail[1]).attr('href'),
                    local: buildTeamInformation($, team1, teamsScore.team1),
                    visitor: buildTeamInformation($, team2, teamsScore.team2)
                }

                matches.push(roundInformation);

            });

            logger.info('Getting information from players...');
            for (let match of matches) {
                let response = await clientAPI.get(match.actUrl);
                logger.info('Processing response from...', match.actUrl);
                const $ = cheerio.load(response);
                logger.info('Getting information from local team...');
                match.local.playerLineup = await getPlayers($, '.local-team .acta-table-item .acta-table-item-player');
                logger.info('Getting information from visitor team...');
                match.visitor.playerLineup = await getPlayers($, '.visitor-team .acta-table-item .acta-table-item-player');
            }

            currentMatch.information = matches;
        }

        logger.info('Saving matchs in json file...');
    }


    async getTeamInformation(seasonId, type, competition, group, teamId) {

    }


    async getCategories() {
        let types = await this.readCategoriesFromCache();

        if (!types) {
            const resp = await clientAPI.get(this.options('https://www.rffm.es/competiciones'));
            const $ = cheerio.load(resp);
            const currentSeason = this.getCurrentSeason($);
            types = this.dropdownToList($, '#type');
            await this.loadTypesCompetition(currentSeason, types);
            await this.loadGroupByTypeCompetition(currentSeason, types);
            await save(JSON.stringify(types), path.resolve(__dirname, 'data/madrid/categories.json'));
        }

        return types;
    }

    async getTeams(seasonId, typeId, competitionId, groupId, matchId) {
        const teams = await this.loadMatchInformation(seasonId, typeId, competitionId, groupId, matchId);
        return teams;
    }

    async getPlayers() {
        return 'players';
    }

    async getPlayerDetail(playerId) {
        return 'player detail' + playerId;
    }

    async getClubDetail(clubId) {
        return 'clubdetail' + clubId;
    }

    async getTeamDetail(detail) {
        // const { seasonId, type, competition, group, teamId } = detail;
        const resp = await clientAPI.get(this.options(detail.url));
        const $ = cheerio.load(resp);
        if($('.ficha-equipo-container').length <= 0) return {};
        const panels = $('.ficha-equipo-container');
        var shield = $(panels[0]).find('img');
        let information = $(panels[1]).find('.ficha-equipo-item .info-item');
        let fax = $(panels[2]).find('.ficha-equipo-item .info-item');

        let uniform = $('.equipo-uniform');
        let mainUniform = $(uniform[0]).find('.uniform-item h3');
        let secondUniform = $(uniform[1]).find('.uniform-item h3');

        let correspondence = $('.equipo-corespondecia .equipo-corespondecia-item');

        let team = {
            shieldUrl: $(shield).attr('src'),
            name: $(information[0]).text(),
            category: $(information[1]).text(),
            club: $(information[2]).text(),
            phone: $(information[3]).text(),
            fax: $(fax[0]).text(),
            stadium: $('.nombre-campo h3').text(),
            mainEquipment: {
                shirt: $(mainUniform[0]).text(),
                shortPants: $(mainUniform[1]).text(),
                sportSocks: $(mainUniform[2]).text(),
            },
            secondEquipment: {
                shirt: $(secondUniform).length > 0 ? $(secondUniform[0]).text() : '',
                shortPants: $(secondUniform).length > 1 ? $(secondUniform[1]).text() : '',
                sportSocks: $(secondUniform).length > 2 ? $(secondUniform[2]).text() : '',
            },
            correspondence: {
                address: $(correspondence[1]).find('h3').text(),
                cp: $(correspondence[2]).find('h3').text(),
                province: $(correspondence[3]).find('h3').text(),
                location: $(correspondence[4]).find('h3').text(),
                email: $(correspondence[5]).find('a').text()
            },
            players: [

            ],
            coachs: [

            ],
            delegates: [

            ],
            auxiliars: [

            ]
        }

        return team;
    }


    async getUserIdeas(author) {
        if (!author) {
            const error = new Error();
            error.status = 404;
            error.message = 'No existe ese usuario';
            throw error;
        }
        return await _ideaRepository.getUserIdeas(author);
    }

    async upvoteIdea(ideaId) {
        if (!ideaId) {
            const error = new Error();
            error.status = 400;
            error.message = 'No existe ese id';
            throw error;
        }
        const idea = await _ideaRepository.get(ideaId);
        if (!idea) {
            const error = new Error();
            error.status = 404;
            error.message = 'No existe esa idea';
            throw error;
        }
        idea.upvotes.push(true);
        return await _ideaRepository.update(ideaId, { upvotes: idea.upvotes });
    }


    async downvoteIdea(ideaId) {
        if (!ideaId) {
            const error = new Error();
            error.status = 400;
            error.message = 'No existe ese id';
            throw error;
        }
        const idea = await _ideaRepository.get(ideaId);
        if (!idea) {
            const error = new Error();
            error.status = 404;
            error.message = 'No existe esa idea';
            throw error;
        }
        idea.downvotes.push(true);
        return await _ideaRepository.update(ideaId, { downvotes: idea.downvotes });
    }


}

module.exports = IdeaService;